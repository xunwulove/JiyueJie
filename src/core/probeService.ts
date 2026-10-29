/**
 * 音源主动探测服务（极悦界内嵌"轻量体检"）
 *
 * 与探测软件（独立 APK，全量深度验证）分工：极悦界内嵌探测做日常维护，
 * 串行探测已启用可搜索音源，结果写入分维度统计（search/parse/play/lyric
 * 及独立歌单统计）。
 * 深度模式（手动"检测音源"）额外做**真实播放验证**：原生独立 ExoPlayer
 * 静默播放样本 ≥2s（方案 B）——音量 0、不抢音频焦点、不打断当前播放，
 * 判定口径与用户真实播放一致，结果直接写入 play 维度。
 *
 * 探测维度（2026-10-25 补全，对齐探测软件）：
 * - 搜索：search(music) 是否有结果 → search 维度
 * - 解析：getMediaSource 能否取到播放地址 → parse 维度
 * - 播放：深度模式静默真实播放 ≥2s → play 维度
 * - 歌词：getLyric 是否返回歌词（仅具备该能力的源）→ lyric 维度
 * - 歌单：getRecommendSheetTags → 歌单列表非空 → 歌单第一首能解析
 *   （深度模式再静默播放验证），结果记入**独立歌单统计**（recommend），
 *   不写入 search/parse/play——歌单显示有问题但播放路径正常的源
 *   不会被歌单维度拖累合成可用率。
 *
 * 触发：
 * - 自动（启动后延迟 20s，bootstrap 调度）：每天最多一轮，
 *   按维度过期过滤——只探测 search/parse/lyric/sheet 任一维度
 *   缺失或 >24h 未探测的源（轻量：搜索+解析+歌词+歌单显示，不播放）。
 *   play 维度只由手动深度探测维护（自动轻量不执行播放）。
 *   真实播放/歌词/歌单等用户使用行为**不写探测时间戳**（使用≠探测，
 *   探测是主动巡检，用户行为是被动覆盖，两者记账分离）。
 * - 手动（音源管理页"检测音源"按钮）：随时全量深度探测（含真播放验证）
 *
 * 约束（防风控/防卡顿）：
 * - 串行执行，源间间隔 1.5s
 * - 总预算 120s，超时放弃剩余源；单步调用均有超时保护
 * - 只探测已启用且可搜索的源；失败不重试（留给下一轮）
 */
import PluginManager from "@/core/pluginManager";
import pluginReliability from "@/core/pluginReliability";
import ProbePlayer from "@/native/probePlayer";
import Config from "@/core/appConfig";
import { getQualityOrder } from "@/utils/qualities";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { devLog } from "@/utils/log";

/** 探测状态持久化（MMKV） */
const probeStore = getOrCreateMMKV("ProbeState");

/** 源间间隔（防风控） */
const PROBE_INTERVAL_MS = 1500;
/** 单轮总预算 */
const PROBE_BUDGET_MS = 120 * 1000;
/** 数据过期判定：上次探测超过该时长视为过期 */
const PROBE_STALE_MS = 24 * 60 * 60 * 1000;
/** 探测样本关键词（中文歌在各源命中率高） */
const PROBE_KEYWORD = "海阔天空";

/**
 * 运行互斥：自动（probeAuto）与手动（probeAllPlugins）共用同一执行体，
 * 防"后台探测未结束又触发新轮"造成并发（同源重复请求、统计写入乱序、风控风险）。
 * 互斥粒度为一整轮：任一模式在跑时，另一模式直接放弃本轮（不排队、不合并）。
 */
let probing = false;
/** 当前是否有探测轮次在运行（供 UI 入口先行提示，避免弹窗闪现） */
export function isProbing(): boolean {
    return probing;
}

/** 单源探测结果 */
export interface IProbeItem {
    platform: string;
    name: string;
    searchOk: boolean;
    parseOk: boolean;
    /** 深度模式：解析出的音频地址能拉到真实音频数据 */
    playable: boolean;
    /** 歌词可用（仅具备 getLyric 能力且返回非空歌词；无能力源不记录） */
    lyricOk: boolean;
    /** 歌单可用（歌单能显示 + 歌单内第一首能解析；深度模式再要求静默真实可播） */
    sheetOk: boolean;
    /** 每维度探测耗时均值（ms，仅本轮实际执行过的维度有值） */
    dimMs?: Partial<Record<ProbeDim, number>>;
    error?: string;
}

/** 一轮探测报告 */
export interface IProbeReport {
    results: IProbeItem[];
    total: number;
    searchOk: number;
    parseOk: number;
    playable: number;
    lyricOk: number;
    sheetOk: number;
    usedMs: number;
}

/* ============ 持久化：每源每维度上次探测时间 / 每日自动轮次 ============ */

/** 探测维度（与 IProbeItem 各字段对应） */
export type ProbeDim = "search" | "parse" | "play" | "lyric" | "sheet";

/** 每源维度时间戳（缺失维度 = 从未探测，下次探测补上）；
 *  dimMs：每维度探测耗时均值（ms），与维度时间戳同轮写入 */
type LastRunEntry = Partial<Record<ProbeDim, number>> & {
    dimMs?: Partial<Record<ProbeDim, number>>;
};

/** 导出给 UI：每源维度时间戳 + 探测耗时 */
export type ProbeLastRuns = LastRunEntry;

/** 旧数据兼容：历史值是整源单时间戳（number），归一化为全维度同值 */
function normalizeLastRun(v: number | LastRunEntry | undefined): LastRunEntry {
    if (v == null) {
        return {};
    }
    if (typeof v === "number") {
        return { search: v, parse: v, play: v, lyric: v, sheet: v };
    }
    return v;
}

function readLastRuns(): Record<string, LastRunEntry> {
    const raw = probeStore.getString("lastRuns");
    if (!raw) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw) as Record<
            string,
            number | LastRunEntry
        >;
        const out: Record<string, LastRunEntry> = {};
        for (const [k, v] of Object.entries(parsed)) {
            out[k] = normalizeLastRun(v);
        }
        return out;
    } catch {
        return {};
    }
}

function writeLastRuns(map: Record<string, LastRunEntry>): void {
    probeStore.set("lastRuns", JSON.stringify(map));
}

function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function readAutoDate(): string | null {
    return probeStore.getString("autoDate") ?? null;
}

function writeAutoDate(date: string): void {
    probeStore.set("autoDate", date);
}

/* ============ 探测执行 ============ */

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** 单步调用超时保护：超时返回 fallback（防卡死的插件拖住整轮探测） */
function withTimeout<T>(p: Promise<T> | T, ms: number, fallback: T): Promise<T> {
    const promise = Promise.resolve(p);
    return Promise.race([
        promise,
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
}

/**
 * 音频数据可拉取验证（深度模式的可播性判定）：
 * 对解析出的播放地址做 Range 请求拉取前 2KB，返回"非文本类内容"即视为可播。
 * 不依赖播放器、静默、不打断当前播放；对假页面（text/html）可有效排除。
 */
async function verifyAudioFetchable(
    url: string,
    headers?: Record<string, string>,
): Promise<boolean> {
    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                ...(headers ?? {}),
                Range: "bytes=0-2048",
            },
        });
        if (!res.ok && res.status !== 206) {
            return false;
        }
        const contentType = res.headers?.get?.("content-type") ?? "";
        const isTextPage =
            contentType.includes("text/html") ||
            contentType.includes("text/plain") ||
            contentType.includes("application/json");
        if (isTextPage) {
            return false;
        }
        const buf = await res.arrayBuffer();
        return buf.byteLength > 0;
    } catch {
        return false;
    }
}

/**
 * 深度可播验证：优先原生独立 ExoPlayer 静默播放验证（方案 B，真解码真播放 ≥2s 无错，
 * 与用户真实播放判定口径一致），原生模块不可用时降级为 Range 数据拉取验证。
 */
async function probePlayable(
    url: string,
    headers?: Record<string, string>,
): Promise<boolean> {
    try {
        if (ProbePlayer?.probeUrl) {
            const ok = await ProbePlayer.probeUrl(
                url,
                headers ?? null,
                15000,
            );
            if (ok === true) {
                return true;
            }
            // 原生验证明确失败（错误/超时）→ 直接判不可播，不再降级兜底
            return false;
        }
    } catch {
        // 原生调用异常（模块缺失/异常）→ 降级网络层拉取验证
    }
    return verifyAudioFetchable(url, headers);
}

/**
 * 单源探测：搜索 → 解析 → 歌词 → 歌单 → （深度）静音真实播放验证
 *
 * 维度与记录（2026-10-25 补全）：
 * - search/parse：写入对应维度（合成可用率 play60%+parse30%+search10%）
 * - lyric：仅具备 getLyric 能力的源记录，写 lyric 维度
 * - 歌单：仅具备 getRecommendSheetTags 能力的源记录，写独立 recommend 统计；
 *   判定 = 歌单能显示（拉到非空歌曲列表）+ 歌单第一首能解析（深度再静音可播）；
 *   歌单探测失败/无此能力**不写入** search/parse/play，避免拖累合成可用率
 * - play：仅深度模式做（静音 ExoPlayer ≥2s），写 play 维度
 */
/**
 * 单源探测。支持维度级执行：
 * - `only` 缺省 = 全部可执行维度；显式传入 = 只跑这些维度
 *   （依赖前置自动补全并记账：parse/lyric/play 需要搜索样本 → 自动执行 search；
 *    play 需要解析地址 → 自动执行 parse）
 * - 返回 dims = 实际执行过的维度（供按维度记账）
 */
async function probeSingle(
    plugin: any,
    deep: boolean,
    only?: ProbeDim[],
): Promise<{ item: IProbeItem; dims: ProbeDim[] }> {
    const platform = plugin.instance.platform;
    const dims: ProbeDim[] = [];
    const want = (d: ProbeDim) => !only || only.includes(d);
    const out: IProbeItem = {
        platform,
        name: plugin.name,
        searchOk: false,
        parseOk: false,
        playable: false,
        lyricOk: false,
        sheetOk: false,
    };
    const qualityOrder = getQualityOrder(
        Config.getConfig("basic.defaultPlayQuality") ?? "standard",
        Config.getConfig("basic.playQualityOrder") ?? "desc",
    );
    let song: any = null;
    let url: string | null = null;
    let headers: Record<string, string> | undefined;
    /** 每维度探测耗时均值（ms） */
    const dimMs: Partial<Record<ProbeDim, number>> = {};
    // 搜索是样本来源：search 本身、或 parse/lyric/play 任一命中都需要执行
    const needSearch =
        want("search") || want("parse") || want("lyric") || want("play");
    let data: any[] = [];
    if (needSearch) {
        const t0 = Date.now();
        try {
            dims.push("search");
            const result = await plugin.methods?.search?.(
                PROBE_KEYWORD,
                1,
                "music",
            );
            data = result?.data ?? [];
            out.searchOk = data.length > 0;
            void pluginReliability.recordResult(
                platform,
                out.searchOk,
                "search",
            );
            song = data[0] ?? null;
        } catch (e: any) {
            out.error = e?.message ?? "探测异常";
            void pluginReliability.recordResult(
                platform,
                false,
                "search",
            );
        }
        dimMs.search = Date.now() - t0;
    }
    if (
        needSearch &&
        data.length &&
        plugin.methods?.getMediaSource &&
        (want("parse") || want("play"))
    ) {
        const t0 = Date.now();
        dims.push("parse");
        for (const quality of qualityOrder) {
            try {
                const source =
                    (await plugin.methods.getMediaSource(
                        data[0],
                        quality,
                    )) ?? null;
                if (source?.url) {
                    url = source.url;
                    headers = source.headers;
                    break;
                }
            } catch {
                // 该质量解析失败，尝试下一档
            }
        }
        out.parseOk = !!url;
        void pluginReliability.recordResult(
            platform,
            out.parseOk,
            "parse",
        );
        dimMs.parse = Date.now() - t0;
    }

    // —— 歌词探测（有 getLyric 能力 + 有搜索样本）——
    if (want("lyric") && song && plugin.methods?.getLyric) {
        const t0 = Date.now();
        dims.push("lyric");
        try {
            const lrc = await withTimeout(
                plugin.methods.getLyric(song),
                5000,
                null,
            );
            const hasLyric =
                !!lrc && (!!lrc?.rawLrc || !!lrc?.translation);
            out.lyricOk = hasLyric;
            void pluginReliability.recordLyricResult(platform, hasLyric);
        } catch {
            void pluginReliability.recordLyricResult(platform, false);
        }
        dimMs.lyric = Date.now() - t0;
    }

    // —— 歌单探测（独立 recommend 统计；链路与 App 推荐歌单一致）——
    if (want("sheet") && plugin.methods?.getRecommendSheetTags) {
        const sheetT0 = Date.now();
        dims.push("sheet");
        let sheetOk = false;
        let sheetFirstUrl: string | null = null;
        let sheetFirstHeaders: Record<string, string> | undefined;
        try {
            const tags = await withTimeout(
                plugin.methods.getRecommendSheetTags(),
                8000,
                null,
            );
            if (tags) {
                const pinned = (tags?.pinned ?? []).filter(Boolean);
                const groups = (tags?.data ?? []).filter(
                    (g: any) => g?.title && g?.data?.length,
                );
                const pool = [
                    ...pinned,
                    ...groups.flatMap((g: any) => g?.data ?? []),
                ];
                // 优先"真实歌单"（带封面），否则第一个可用项（可能是标签）
                const real = pool.find(
                    (it: any) => it?.coverImg || it?.artwork,
                );
                const sheetItem =
                    real ?? pinned[0] ?? groups[0]?.data?.[0] ?? null;
                let musicList: any[] = [];
                if (sheetItem) {
                    const hasCover =
                        !!sheetItem.coverImg || !!sheetItem.artwork;
                    if (hasCover) {
                        // 真实歌单：直接拉详情
                        const info = await withTimeout(
                            plugin.methods.getMusicSheetInfo?.(
                                sheetItem,
                                1,
                            ),
                            8000,
                            null,
                        );
                        musicList = info?.musicList ?? [];
                    } else if (plugin.methods?.getRecommendSheetsByTag) {
                        // 标签：先拉该标签下歌单列表，再取第一个歌单拉详情
                        const list = await withTimeout(
                            plugin.methods.getRecommendSheetsByTag(
                                sheetItem,
                                1,
                            ),
                            8000,
                            null,
                        );
                        const first = (list?.data ?? []).find(
                            (it: any) => it?.coverImg || it?.artwork,
                        );
                        const target =
                            first ?? (list?.data ?? [])[0] ?? null;
                        if (target) {
                            const info = await withTimeout(
                                plugin.methods.getMusicSheetInfo?.(
                                    target,
                                    1,
                                ),
                                8000,
                                null,
                            );
                            musicList = info?.musicList ?? [];
                        }
                    } else {
                        // 无标签能力：pinned/分组项视为歌单详情（自带 musicList）
                        const info = await withTimeout(
                            plugin.methods.getMusicSheetInfo?.(
                                sheetItem,
                                1,
                            ),
                            8000,
                            null,
                        );
                        musicList = info?.musicList ?? [];
                    }
                }
                // 内容可播判定：歌单第一首能解析出播放地址
                if (musicList.length && plugin.methods?.getMediaSource) {
                    for (const quality of qualityOrder) {
                        try {
                            const src =
                                (await plugin.methods.getMediaSource(
                                    musicList[0],
                                    quality,
                                )) ?? null;
                            if (src?.url) {
                                sheetFirstUrl = src.url;
                                sheetFirstHeaders = src.headers;
                                break;
                            }
                        } catch {
                            // 尝试下一档
                        }
                    }
                }
                // 显示可用 = 歌单歌曲列表非空 + 第一首可解析
                sheetOk = musicList.length > 0 && !!sheetFirstUrl;
            }
        } catch {
            // 歌单探测异常 → 按失败记入歌单维度（不影响主链路）
        }
        // 深度模式：歌单第一首静音真实播放验证（与主链路播放串行，避免并发 ExoPlayer）
        if (deep && sheetOk && sheetFirstUrl) {
            try {
                sheetOk =
                    sheetOk && (await probePlayable(sheetFirstUrl, sheetFirstHeaders));
            } catch {
                sheetOk = false;
            }
        }
        out.sheetOk = sheetOk;
        void pluginReliability.recordRecommendResult(
            platform,
            sheetOk,
            Date.now() - sheetT0,
        );
        dimMs.sheet = Date.now() - sheetT0;
    }

    // —— 深度播放验证（主链路，静音 ExoPlayer ≥2s）——
    if (want("play") && deep && url) {
        const t0 = Date.now();
        dims.push("play");
        out.playable = await probePlayable(url, headers);
        // 深度探测是真播放验证（独立 ExoPlayer ≥2s），与用户真实播放判定口径一致，
        // 直接写入 play 维度（探测成功/失败均记录）
        void pluginReliability.recordPlayResult(
            platform,
            out.playable,
        );
        dimMs.play = Date.now() - t0;
    }
    out.dimMs = dimMs;
    return { item: out, dims };
}

/**
 * 探测一组插件（串行 + 间隔 + 总预算）；整轮持有互斥锁，finally 必复位。
 * dimSelector：每源要执行的维度（缺省 undefined = 全维度）；
 * 与按维度记账配合实现"只补过期/缺失维度"。
 */
async function probePlugins(
    plugins: any[],
    deep: boolean,
    onProgress?: (done: number, total: number, name: string) => void,
    dimSelector?: (platform: string) => ProbeDim[] | undefined,
): Promise<IProbeReport> {
    probing = true;
    try {
        const startTime = Date.now();
        const lastRuns = readLastRuns();
        const results: IProbeItem[] = [];
        let searchOk = 0;
        let parseOk = 0;
        let playable = 0;
        let lyricOk = 0;
        let sheetOk = 0;

        for (let i = 0; i < plugins.length; i++) {
            if (Date.now() - startTime > PROBE_BUDGET_MS) {
                devLog("info", "音源探测：总预算耗尽，剩余源跳过", plugins.length - i);
                break;
            }
            const plugin = plugins[i];
            const platform = plugin.instance.platform;
            try {
                const { item, dims } = await probeSingle(
                    plugin,
                    deep,
                    dimSelector?.(platform),
                );
                results.push(item);
                if (item.searchOk) {
                    searchOk += 1;
                }
                if (item.parseOk) {
                    parseOk += 1;
                }
                if (item.playable) {
                    playable += 1;
                }
                if (item.lyricOk) {
                    lyricOk += 1;
                }
                if (item.sheetOk) {
                    sheetOk += 1;
                }
                // 按实际执行过的维度记账（缺失能力/未执行的维度不刷新，
                // 下次自动探测仍会尝试补齐）
                const now = Date.now();
                const rec = lastRuns[platform] ?? {};
                for (const dim of dims) {
                    rec[dim] = now;
                }
                if (item.dimMs && Object.keys(item.dimMs).length > 0) {
                    rec.dimMs = {
                        ...(rec.dimMs ?? {}),
                        ...item.dimMs,
                    };
                }
                lastRuns[platform] = rec;
            } catch (e: any) {
                devLog("error", "音源探测异常", platform, e?.message ?? e);
            }
            onProgress?.(results.length, plugins.length, plugin.name);
            if (i < plugins.length - 1) {
                await sleep(PROBE_INTERVAL_MS);
            }
        }
        writeLastRuns(lastRuns);
        return {
            results,
            total: plugins.length,
            searchOk,
            parseOk,
            playable,
            lyricOk,
            sheetOk,
            usedMs: Date.now() - startTime,
        };
    } finally {
        probing = false;
    }
}

/** 手动全量探测（音源管理页"检测音源"按钮）：随时可跑，深度验证可播性；
 *  返回 null 表示已有其他轮次在跑（本次未执行） */
export async function probeAllPlugins(options?: {
    deep?: boolean;
    onProgress?: (done: number, total: number, name: string) => void;
}): Promise<IProbeReport | null> {
    if (probing) {
        return null;
    }
    const plugins = PluginManager.getSortedSearchablePlugins("music");
    return probePlugins(plugins, options?.deep ?? true, options?.onProgress);
}

/** 自动探测（启动后延迟调度）：每天最多一轮，只探测数据过期（>24h）的源，轻量；
 *  若已有轮次在跑（含手动检测）则本轮放弃 */
export async function probeAuto(): Promise<IProbeReport | null> {
    if (probing) {
        return null;
    }
    try {
        const today = todayStr();
        if (readAutoDate() === today) {
            return null; // 今天已跑过
        }
        writeAutoDate(today);
        const now = Date.now();
        const lastRuns = readLastRuns();
        // 按维度过期过滤并**只执行过期/缺失维度**：search/parse/lyric/sheet
        // 中哪些维度缺失或 >24h 未探测，本轮就只补这些（已验维度不重跑，
        // 单维失败/超时不会拖累其他维度也重跑）。
        // play 维度不参与自动过滤（自动轻量不执行播放，play 只由手动深度探测维护，
        // 且真实播放成功会刷新 play 时间戳）
        const autoDims: ProbeDim[] = ["search", "parse", "lyric", "sheet"];
        const expiredByPlatform = new Map<string, ProbeDim[]>();
        const stalePlugins = PluginManager.getSortedSearchablePlugins(
            "music",
        ).filter(p => {
            const rec = lastRuns[p.instance.platform] ?? {};
            const expired = autoDims.filter(dim => {
                const t = rec[dim];
                return !t || now - t > PROBE_STALE_MS;
            });
            if (!expired.length) {
                return false;
            }
            expiredByPlatform.set(p.instance.platform, expired);
            return true;
        });
        if (!stalePlugins.length) {
            return null; // 无过期源，无需探测
        }
        return await probePlugins(stalePlugins, false, undefined, platform =>
            expiredByPlatform.get(platform),
        );
    } catch (e: any) {
        devLog("error", "自动探测失败", e?.message ?? e);
        return null;
    }
}

/**
 * 真实播放成功 → 刷新该源 play 维度探测时间戳。
 * 语义：真实播放过 = play 维度最近已有验证证据（播放过即证明可播，
 * 用户 2026-10-25 明确口径），24h 内不再重复探测播放功能。
 * 播放失败不刷新（失败是失效疑点，留给探测核实）。
 */
export function refreshPlayProbed(platform: string): void {
    try {
        const lastRuns = readLastRuns();
        const rec = lastRuns[platform] ?? {};
        rec.play = Date.now();
        lastRuns[platform] = rec;
        writeLastRuns(lastRuns);
    } catch (e: any) {
        devLog("error", "刷新 play 探测时间戳失败", platform, e?.message ?? e);
    }
}

/**
 * 读取某音源各维度上次探测时间戳（毫秒）。
 * 无记录/未探测返回 null（UI 用于"有数据才显示"）；有记录返回 Partial<Record<ProbeDim, number>>，
 * 缺失的维度键 = 该维度从未探测。仅用于详情展示，不改写任何状态。
 */
export function getLastProbeRuns(
    platform: string | undefined,
): ProbeLastRuns | null {
    if (!platform) {
        return null;
    }
    try {
        const lastRuns = readLastRuns();
        const rec = lastRuns[platform];
        if (!rec || Object.keys(rec).length <= 0) {
            return null;
        }
        return rec;
    } catch {
        return null;
    }
}

const probeService = {
    probeAllPlugins,
    probeAuto,
    isProbing,
    refreshPlayProbed,
    getLastProbeRuns,
};

export default probeService;
