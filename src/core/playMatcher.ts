/**
 * 播放前匹配服务（"我们的源"）
 *
 * 背景：推荐歌单/排行榜数据来自网易/QQ 公开接口（歌曲无音频地址，标记 apiSource）。
 * 播放这类歌曲时，用"我们的源"（启用的搜索型插件）逐源搜索匹配：
 *   - 候选源（≤2 个，用户要求"最多搜两次，切换一次"）：
 *     ① 歌曲来源对应平台插件优先（网易接口歌 → 网易系插件；QQ 接口歌 → QQ 系插件）
 *     ② 下一个兜底源（其余启用搜索插件，按音源排序）
 *   - 打分：作者+歌名精确 → 仅歌名精确 → 歌名互相包含
 *   - 命中 → 用匹配到的歌曲（插件平台，可解析）播放
 *   - 全失败 → 回退原歌解析（若对应平台插件可解析原 id 则成功，否则播放器自动下一首）
 *   - 匹配结果持久化缓存（MMKV）：成功 7 天 / 失败 24h，防重复搜索限流（2026-10-09 加固）
 *   - 失败熔断（2026-10-09 加固）：单源 5 分钟内失败 ≥5 次 → 熔断 10 分钟切换备选源，
 *     全部源熔断 → 返回 null 走原 id 解析，避免对已被风控的源循环加重
 *   - 队列预热（2026-10-09 加固）：prewarmApiSongs 对播放列表内接口歌曲按节奏预匹配
 *     （每 2.5s 一首、≤3 并发），把连播突发搜索变为平滑预热，轮到时命中缓存
 */

import PluginManager, { Plugin } from "@/core/pluginManager";
import pluginReliability from "@/core/pluginReliability";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";

/** 最多搜索的源数（用户：最多搜两次，切换一次） */
const MAX_MATCH_SOURCES = 2;

/** 接口数据源标记字段（neteaseApi/qqApi 写入） */
export const API_SOURCE_KEY = "apiSource";

/** 接口来源类型 */
export type ApiSourceType = "netease" | "qq";

/** 接口数据源歌曲（需播放前匹配） */
export function isApiSource(
    musicItem: IMusic.IMusicItem | null | undefined,
): boolean {
    return !!musicItem?.apiSource;
}

/* ============ 匹配结果持久化缓存（MMKV） ============ */
const cacheStore = getOrCreateMMKV("PlayMatcherCache");
/** 成功缓存有效期（7 天） */
const SUCCESS_TTL = 7 * 24 * 60 * 60 * 1000;
/** 失败缓存有效期（24h）：失败后一天内不再重搜同一首 */
const FAIL_TTL = 24 * 60 * 60 * 1000;

interface IMatchCacheEntry {
    item: IMusic.IMusicItem | null;
    ts: number;
}

function readCache(key: string): IMatchCacheEntry | undefined {
    const raw = cacheStore.getString(key);
    if (!raw) {
        return undefined;
    }
    try {
        return JSON.parse(raw) as IMatchCacheEntry;
    } catch {
        return undefined;
    }
}

function writeCache(key: string, entry: IMatchCacheEntry): void {
    cacheStore.set(key, JSON.stringify(entry));
}

function matchCacheKey(musicItem: IMusic.IMusicItem): string {
    return `${musicItem.platform ?? ""}|${musicItem.title ?? ""}|${
        musicItem.artist ?? ""
    }`;
}

/* ============ 失败熔断（运行时，单源维度） ============ */
interface ICircuitState {
    fails: number;
    openUntil: number;
}
const circuit = new Map<string, ICircuitState>();
/** 熔断阈值：5 分钟内失败次数 */
const CIRCUIT_FAIL_THRESHOLD = 5;
/** 熔断窗口：失败计数统计窗口 */
const CIRCUIT_WINDOW = 5 * 60 * 1000;
/** 熔断时长：10 分钟 */
const CIRCUIT_OPEN_MS = 10 * 60 * 1000;

/** 单源是否处于熔断中（到期自动恢复） */
function isCircuitOpen(platform: string | undefined): boolean {
    if (!platform) {
        return false;
    }
    const s = circuit.get(platform);
    if (!s) {
        return false;
    }
    if (Date.now() > s.openUntil) {
        circuit.delete(platform);
        return false;
    }
    return true;
}

/** 记录失败：窗口内失败达到阈值 → 熔断 */
function recordFailure(platform: string | undefined): void {
    if (!platform) {
        return;
    }
    const now = Date.now();
    const s = circuit.get(platform);
    const fails = s && now - (s.openUntil - CIRCUIT_OPEN_MS) < CIRCUIT_WINDOW
        ? s.fails + 1
        : 1;
    if (fails >= CIRCUIT_FAIL_THRESHOLD) {
        circuit.set(platform, {
            fails: 0,
            openUntil: now + CIRCUIT_OPEN_MS,
        });
    } else {
        circuit.set(platform, { fails, openUntil: now + CIRCUIT_OPEN_MS });
    }
}

/** 记录成功：清除熔断计数 */
function recordSuccess(platform: string | undefined): void {
    if (platform) {
        circuit.delete(platform);
    }
}

/** 平台关键词匹配：接口平台 → 插件平台（网易系/QQ系） */
export function platformMatches(
    pluginPlatform: string | undefined,
    targetPlatform: string | undefined,
): boolean {
    if (!pluginPlatform || !targetPlatform) {
        return false;
    }
    const p = pluginPlatform.toLowerCase();
    const t = targetPlatform.toLowerCase();
    const isNetEase =
        t.includes("网易") || t.includes("网抑") || t.includes("云音乐");
    const isQQ =
        t.includes("qq") ||
        t.includes("q音") ||
        t.includes("腾讯") ||
        t.includes("企鹅") ||
        t.includes("酷我") ||
        t.includes("酷狗");
    if (isNetEase) {
        return (
            p.includes("网易") ||
            p.includes("网抑") ||
            p.includes("云音乐")
        );
    }
    if (isQQ) {
        return (
            p.includes("qq") ||
            p.includes("q音") ||
            p.includes("腾讯") ||
            p.includes("企鹅") ||
            p.includes("酷我") ||
            p.includes("酷狗")
        );
    }
    return false;
}

/**
 * 候选源：平台对应插件优先（+1 分），组内按音源可用率降序（开关开启时）；
 * 最多取 2 个（用户：最多搜两次，切换一次）；熔断中的源不参与候选
 */
function getMatchCandidates(
    musicItem: IMusic.IMusicItem,
): Plugin[] {
    const all = PluginManager.getSortedSearchablePlugins("music");
    const src = musicItem.platform ?? "";
    const sortByReliability = pluginReliability.isReliabilitySortEnabled();
    const scored = all.map(p => {
        const same = platformMatches(p.instance.platform, src);
        const rel = sortByReliability
            ? pluginReliability.getReliabilitySync(p.instance.platform)
            : pluginReliability.RELIABILITY_DEFAULT;
        return { plugin: p, score: rel + (same ? 1 : 0) };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored
        .filter(s => !isCircuitOpen(s.plugin.instance.platform))
        .slice(0, MAX_MATCH_SOURCES)
        .map(s => s.plugin);
}

/** 归一化（去首尾空白/空格，忽略大小写） */
function norm(s: string | undefined): string {
    return (s ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
}

/** 打分匹配：作者+歌名精确 → 仅歌名精确 → 歌名互相包含 */
function pickBest(
    results: IMusic.IMusicItemBase[],
    title: string,
    artist: string,
): IMusic.IMusicItem | null {
    if (!results?.length) {
        return null;
    }
    const t = norm(title);
    const a = norm(artist);
    // 1. 作者+歌名完全一致
    const exact = results.find(
        r =>
            norm(r.title) === t &&
            a &&
            norm(r.artist) === a,
    );
    if (exact) {
        return exact as IMusic.IMusicItem;
    }
    // 2. 仅歌名完全一致
    const titleExact = results.find(r => norm(r.title) === t);
    if (titleExact) {
        return titleExact as IMusic.IMusicItem;
    }
    // 3. 歌名互相包含
    return (
        (results.find(
            r =>
                t &&
                (norm(r.title).includes(t) ||
                    t.includes(norm(r.title))),
        ) as IMusic.IMusicItem) ?? null
    );
}

/** 用单个源搜索并匹配（记录该源可用率 + 熔断计数；熔断中的源不发请求） */
async function matchInSource(
    plugin: Plugin,
    musicItem: IMusic.IMusicItem,
): Promise<IMusic.IMusicItem | null> {
    const platform = plugin.instance.platform;
    if (isCircuitOpen(platform)) {
        return null;
    }
    let result: { data?: IMusic.IMusicItemBase[] } | null = null;
    try {
        const query = [musicItem.title, musicItem.artist]
            .filter(Boolean)
            .join(" ");
        result = (await plugin.methods?.search?.(
            query,
            1,
            "music",
        )) as { data?: IMusic.IMusicItemBase[] } | null;
    } catch {
        result = null;
    }
    const ok = !!result?.data?.length;
    pluginReliability.recordResult(platform, ok);
    if (ok) {
        recordSuccess(platform);
        return pickBest(
            result!.data ?? [],
            musicItem.title,
            musicItem.artist,
        );
    }
    recordFailure(platform);
    return null;
}

/**
 * 播放前匹配：先查持久化缓存（成功 7 天 / 失败 24h）；
 * 未命中 → 逐源（≤2）搜索；结果写回缓存
 */
export async function matchMusic(
    musicItem: IMusic.IMusicItem,
): Promise<IMusic.IMusicItem | null> {
    const key = matchCacheKey(musicItem);
    const cached = readCache(key);
    if (cached) {
        const ttl = cached.item ? SUCCESS_TTL : FAIL_TTL;
        if (Date.now() - cached.ts < ttl) {
            return cached.item;
        }
        cacheStore.delete(key);
    }
    let matched: IMusic.IMusicItem | null = null;
    for (const plugin of getMatchCandidates(musicItem)) {
        matched = await matchInSource(plugin, musicItem);
        if (matched) {
            break;
        }
    }
    writeCache(key, { item: matched, ts: Date.now() });
    return matched;
}

/* ============ 队列预热（连播平滑化） ============ */
/** 预热节流：相邻两次预匹配间隔 */
const PREWARM_DELAY = 2500;
/** 预热并发上限 */
const PREWARM_MAX_CONCURRENT = 3;
/** 预热代际 token：歌单切换时终止旧预热，避免叠加请求 */
let prewarmToken = 0;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 对播放队列中的接口歌曲做后台预热匹配（fire-and-forget）：
 * - 已在缓存（成功/失败未过期）的歌 matchMusic 内部直接返回，不发请求；
 * - 未缓存的歌按 ≤3 并发、每首间隔 2.5s 平滑预匹配；
 * - 歌单被切换（再次调用本函数）时，旧预热任务在下一轮检查 token 后退出。
 */
export async function prewarmApiSongs(
    items: IMusic.IMusicItem[] | null | undefined,
): Promise<void> {
    const targets = (items ?? []).filter(isApiSource);
    if (!targets.length) {
        return;
    }
    const myToken = ++prewarmToken;
    let next = 0;
    const workers = Array.from({ length: PREWARM_MAX_CONCURRENT }, async () => {
        while (myToken === prewarmToken) {
            const idx = next++;
            if (idx >= targets.length) {
                break;
            }
            const item = targets[idx];
            try {
                await matchMusic(item);
            } catch {
                // 预热失败不影响播放主流程
            }
            await sleep(PREWARM_DELAY);
        }
    });
    await Promise.all(workers);
}
