/**
 * 音源可用率统计（按插件平台，分维度）
 *
 * 每个音源（插件平台）按维度独立记录成功/失败次数：
 *   - search：搜索（搜索结果是否有数据）
 *   - parse：解析（getMediaSource 是否返回播放地址）
 *   - play：真实播放（实际出声 ≥2s 无报错）
 *   - lyric：歌词（getLyric 是否返回歌词）
 *
 * 合成可用率（用于插件排序/换源候选）：播放 60% + 解析 30% + 搜索 10%，
 * 缺失维度的权重按比例重新归一化（例：只有播放数据 → 100% 播放成功率）。
 * 播放是最重要的维度：解析成功 ≠ 能播，只有真实出声才能反映用户听歌体验。
 *
 * 播放匹配（playMatcher）时按合成可用率排序候选源；可在设置页关闭
 * （basic.sortPluginByReliability，默认开启）。
 *
 * 另设一套"推荐歌单专用可用率"（独立 key、独立计数）：
 * 推荐歌单页/首页横滑区按它择优排序，避免"能搜索但推荐歌单拉胯"的源抢占推荐位。
 * 写入方：①推荐歌单页真实拉取（拉到非空数据记 ok）；②App 内音源探测
 * （probeService 歌单维度：歌单能显示 + 歌单内第一首能解析/可播才算 ok）。
 * 独立于 search/parse/play 合成可用率——歌单显示有问题但播放路径正常的源
 * 不会被歌单维度拖累合成可用率。
 */
import { getStorage, setStorage } from "@/utils/storage";
import { StorageKeys } from "@/constants/commonConst";
import Config from "@/core/appConfig";

/** 无统计数据时的默认可用率（0.5：不偏向新源，也不压旧源） */
export const RELIABILITY_DEFAULT = 0.5;
/** 推荐歌单专用可用率：无数据时的默认值（同上 0.5） */
export const RECOMMEND_DEFAULT = 0.5;

/** 统计维度 */
export type ReliabilityDimension = "search" | "parse" | "play" | "lyric";

/** 单维度计数 */
interface IDimensionCount {
    success: number;
    fail: number;
}

/** 分维度统计记录（缺省的维度=该维度暂无数据） */
interface IReliabilityRecord {
    search?: IDimensionCount;
    parse?: IDimensionCount;
    play?: IDimensionCount;
    lyric?: IDimensionCount;
}

/** 合成权重：播放最重要 */
const DIMENSION_WEIGHTS: Array<[keyof IReliabilityRecord, number]> = [
    ["play", 0.6],
    ["parse", 0.3],
    ["search", 0.1],
];

const ALL_DIMENSIONS = DIMENSION_WEIGHTS.map(w => w[0]) as ReliabilityDimension[];

/** 推荐歌单专用统计记录 */
interface IRecommendReliabilityRecord {
    ok: number;
    fail: number;
    /** 累计拉取耗时（毫秒；timeCount>0 时有效） */
    timeCost?: number;
    /** 耗时样本数 */
    timeCount?: number;
}

let reliabilityMap: Record<string, IReliabilityRecord> = {};
let loaded = false;

let recommendMap: Record<string, IRecommendReliabilityRecord> = {};
let recommendLoaded = false;

/* ============ 统计变更订阅（UI 实时刷新用） ============ */

type ReliabilityListener = () => void;
const listeners = new Set<ReliabilityListener>();

/** 订阅统计变更（写入成功后触发），返回取消订阅函数 */
export function subscribeReliability(listener: ReliabilityListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** 通知所有订阅者（统计被写入后调用；try/catch 隔离单个监听器异常） */
function notifyReliability() {
    for (const l of listeners) {
        try {
            l();
        } catch {}
    }
}

/** 开关：音源可用率自动排序（默认开启） */
export function isReliabilitySortEnabled(): boolean {
    return Config.getConfig("basic.sortPluginByReliability") ?? true;
}

/** 旧版单桶数据（{success,fail} 顶层，无维度键）→ 并入 search 维度 */
function normalizeRecord(raw: any): IReliabilityRecord | null {
    if (!raw) {
        return null;
    }
    // 兼容旧格式：顶层直接是 success/fail
    if (
        typeof raw.success === "number" &&
        typeof raw.fail === "number" &&
        !raw.search &&
        !raw.parse &&
        !raw.play &&
        !raw.lyric
    ) {
        return { search: { success: raw.success, fail: raw.fail } };
    }
    const r: IReliabilityRecord = {};
    for (const dim of ALL_DIMENSIONS) {
        const d = raw[dim];
        if (
            d &&
            typeof d.success === "number" &&
            typeof d.fail === "number"
        ) {
            r[dim] = { success: d.success, fail: d.fail };
        }
    }
    return r;
}

export async function ensureLoaded(): Promise<void> {
    if (loaded) {
        return;
    }
    try {
        const data = await getStorage(StorageKeys.PluginReliability);
        const rawMap = (data as Record<string, unknown> | null) ?? {};
        const map: Record<string, IReliabilityRecord> = {};
        for (const key of Object.keys(rawMap)) {
            const n = normalizeRecord(rawMap[key]);
            if (n) {
                map[key] = n;
            }
        }
        reliabilityMap = map;
    } catch {
        reliabilityMap = {};
    }
    loaded = true;
}

/** 某维度成功率（无数据返回 null） */
function dimensionRate(d?: IDimensionCount): number | null {
    if (!d || d.success + d.fail <= 0) {
        return null;
    }
    return d.success / (d.success + d.fail);
}

/** 合成可用率：播放 60% + 解析 30% + 搜索 10%，缺失维度权重归一化 */
function calcReliability(r?: IReliabilityRecord): number {
    if (!r) {
        return RELIABILITY_DEFAULT;
    }
    let weighted = 0;
    let weightSum = 0;
    for (const [dim, w] of DIMENSION_WEIGHTS) {
        const rate = dimensionRate(r[dim]);
        if (rate !== null) {
            weighted += rate * w;
            weightSum += w;
        }
    }
    if (weightSum <= 0) {
        return RELIABILITY_DEFAULT;
    }
    return weighted / weightSum;
}

/** 某音源可用率（0~1；无数据返回默认 0.5） */
export async function getReliability(
    platform: string | undefined,
): Promise<number> {
    if (!platform) {
        return RELIABILITY_DEFAULT;
    }
    await ensureLoaded();
    return calcReliability(reliabilityMap[platform]);
}

/** 某音源原始统计（无数据返回 null，用于 UI 区分“暂无数据”与默认值） */
export async function getReliabilityRecord(
    platform: string | undefined,
): Promise<IReliabilityRecord | null> {
    if (!platform) {
        return null;
    }
    await ensureLoaded();
    return reliabilityMap[platform] ?? null;
}

/** 同步取可用率（排序用；未加载完成时返回默认） */
export function getReliabilitySync(platform: string | undefined): number {
    if (!platform) {
        return RELIABILITY_DEFAULT;
    }
    return calcReliability(reliabilityMap[platform]);
}

/* ============ 展示口径：能力强弱决定（合成/歌词/歌单取最高） ============ */

/** 展示口径类型：synthetic=合成可用率，lyric=歌词可用率，sheet=歌单可用率 */
export type BestDimensionType = "synthetic" | "lyric" | "sheet";

/** 展示口径结果 */
export interface IBestDimension {
    type: BestDimensionType;
    rate: number | null;
}

/** 参与比较的样本下限：成功率基于 ≥3 次样本才可信，样本过少不参与比较（防 1/1=100% 噪声） */
const BEST_DIM_MIN_SAMPLES = 3;
/** 排序样本保护下限：与展示口径一致，样本 <3 时排序回退默认可用率（不偏向） */
const SORT_MIN_SAMPLES = 3;

/**
 * 按"能力强弱"取展示口径：各口径（合成/歌词/歌单）有数据即参与比较，
 * 成功率最高者胜出；样本保护见 BEST_DIM_MIN_SAMPLES。
 * 仅单一口径有数据时不受样本下限限制。无任何数据 → 合成口径、rate null。
 */
export function getBestDimensionSync(
    platform: string | undefined,
): IBestDimension {
    if (!platform) {
        return { type: "synthetic", rate: null };
    }
    const rec = reliabilityMap[platform];
    const sheet = recommendMap[platform];
    const cands: Array<{ type: BestDimensionType; rate: number; samples: number }> =
        [];
    // 合成口径：play/parse/search 任一维度有计数即参与
    const hasSynthetic =
        !!rec &&
        (["play", "parse", "search"] as const).some(dim => {
            const c = rec[dim];
            return !!c && c.success + c.fail > 0;
        });
    if (hasSynthetic) {
        let samples = 0;
        for (const dim of ["play", "parse", "search"] as const) {
            const c = rec![dim];
            if (c) {
                samples += c.success + c.fail;
            }
        }
        cands.push({
            type: "synthetic",
            rate: calcReliability(rec),
            samples,
        });
    }
    // 歌词口径
    const lyric = rec?.lyric;
    if (lyric && lyric.success + lyric.fail > 0) {
        cands.push({
            type: "lyric",
            rate: lyric.success / (lyric.success + lyric.fail),
            samples: lyric.success + lyric.fail,
        });
    }
    // 歌单口径
    if (sheet && sheet.ok + sheet.fail > 0) {
        cands.push({
            type: "sheet",
            rate: sheet.ok / (sheet.ok + sheet.fail),
            samples: sheet.ok + sheet.fail,
        });
    }
    if (cands.length === 0) {
        return { type: "synthetic", rate: null };
    }
    // 样本保护：多口径并存时，样本 <3 的口径不参与比较；
    // 全部不满足时回退全参与（避免歌词/歌单只有少数样本时无法展示）
    let pool = cands;
    if (cands.length > 1) {
        const qualified = cands.filter(c => c.samples >= BEST_DIM_MIN_SAMPLES);
        if (qualified.length > 0) {
            pool = qualified;
        }
    }
    pool.sort((a, b) => b.rate - a.rate);
    return { type: pool[0].type, rate: pool[0].rate };
}

/** 是否有通用统计记录（同步；任意维度有计数即 true） */
export function hasRecordSync(platform: string | undefined): boolean {
    if (!platform) {
        return false;
    }
    const r = reliabilityMap[platform];
    if (!r) {
        return false;
    }
    return ALL_DIMENSIONS.some(dim => {
        const c = r[dim];
        return !!c && c.success + c.fail > 0;
    });
}

/**
 * 同步取某音源原始分维度统计记录（无记录返回 null）。
 * 仅供展示层读取明细（成功/失败计数）；不修改任何状态。
 */
export function getRecordSync(
    platform: string | undefined,
): IReliabilityRecord | null {
    if (!platform) {
        return null;
    }
    return reliabilityMap[platform] ?? null;
}

/**
 * 记录一次某维度结果（ok=是否成功）。
 * 竞态说明：ensureLoaded 之后的更新段内不含第二个 await（同一微任务原子段），
 * 并发调用不会交错读写内存；持久化 fire-and-forget，不阻塞调用方。
 */
export async function recordResult(
    platform: string | undefined,
    ok: boolean,
    dimension: ReliabilityDimension = "search",
): Promise<void> {
    if (!platform) {
        return;
    }
    await ensureLoaded();
    const r = reliabilityMap[platform] ?? {};
    const d = r[dimension] ?? { success: 0, fail: 0 };
    if (ok) {
        d.success += 1;
    } else {
        d.fail += 1;
    }
    r[dimension] = d;
    reliabilityMap[platform] = r;
    void setStorage(StorageKeys.PluginReliability, reliabilityMap).catch(() => {});
    notifyReliability();
}

/** 记录真实播放结果（实际出声 ≥2s 无报错） */
export async function recordPlayResult(
    platform: string | undefined,
    ok: boolean,
): Promise<void> {
    return recordResult(platform, ok, "play");
}

/** 记录歌词获取结果（getLyric 返回歌词） */
export async function recordLyricResult(
    platform: string | undefined,
    ok: boolean,
): Promise<void> {
    return recordResult(platform, ok, "lyric");
}

/** 歌词维度可用率（同步；无数据默认 0.5；歌词源选择排序用） */
export function getLyricReliabilitySync(
    platform: string | undefined,
): number {
    if (!platform) {
        return RELIABILITY_DEFAULT;
    }
    return dimensionRate(reliabilityMap[platform]?.lyric) ?? RELIABILITY_DEFAULT;
}

/** 是否有歌词维度统计记录（同步） */
export function hasLyricRecordSync(platform: string | undefined): boolean {
    if (!platform) {
        return false;
    }
    const d = reliabilityMap[platform]?.lyric;
    return !!d && d.success + d.fail > 0;
}

/* ============ 推荐歌单专用可用率（独立统计） ============ */

export async function ensureRecommendLoaded(): Promise<void> {
    if (recommendLoaded) {
        return;
    }
    try {
        const data = await getStorage(StorageKeys.PluginRecommendReliability);
        recommendMap =
            (data as Record<string, IRecommendReliabilityRecord> | null) ??
            {};
    } catch {
        recommendMap = {};
    }
    recommendLoaded = true;
}

function calcRecommend(r?: IRecommendReliabilityRecord): number {
    if (!r || r.ok + r.fail <= 0) {
        return RECOMMEND_DEFAULT;
    }
    return r.ok / (r.ok + r.fail);
}

/** 同步取推荐歌单可用率（0~1；无数据默认 0.5；排序用） */
export function getRecommendReliabilitySync(
    platform: string | undefined,
): number {
    if (!platform) {
        return RECOMMEND_DEFAULT;
    }
    return calcRecommend(recommendMap[platform]);
}

/** 同步取推荐歌单原始统计记录（无记录返回 null；供详情展示 ok/fail 计数） */
export function getRecommendRecordSync(
    platform: string | undefined,
): IRecommendReliabilityRecord | null {
    if (!platform) {
        return null;
    }
    const r = recommendMap[platform];
    if (!r || r.ok + r.fail <= 0) {
        return null;
    }
    return r;
}

/** 是否有推荐歌单统计记录（同步；无记录返回 false，用于"暂无数据排最后"） */
export function hasRecommendRecordSync(platform: string | undefined): boolean {
    if (!platform) {
        return false;
    }
    const r = recommendMap[platform];
    return !!r && r.ok + r.fail > 0;
}

/** 同步取推荐歌单平均拉取耗时（毫秒；无耗时样本返回 null，供"成功率相近时快者优先"排序） */
export function getRecommendLatencySync(
    platform: string | undefined,
): number | null {
    if (!platform) {
        return null;
    }
    const r = recommendMap[platform];
    if (!r || !r.timeCount || r.timeCount <= 0) {
        return null;
    }
    return (r.timeCost ?? 0) / r.timeCount;
}

/* ============ 排序评分：按能力切口径 + 耗时 tie-breaker ============ */

/**
 * 探测耗时镜像：probeService 每轮探测写入 lastRuns 时同步喂入本表，
 * 供排序 tie-breaker 读取（避免 pluginManager → probeService 循环依赖）。
 * 仅内存镜像（重启后由下次探测重新填充；镜像缺失时 tie-breaker 跳过）。
 */
let dimMsMap: Record<string, Partial<Record<string, number>>> = {};

/** probeService 写入每维度探测耗时均值（ms） */
export function setDimMs(
    platform: string,
    dimMs: Partial<Record<string, number>>,
): void {
    dimMsMap[platform] = { ...(dimMsMap[platform] ?? {}), ...dimMs };
}

/** 歌单相关能力：排序主分用歌单可用率 */
const SHEET_ABILITIES = new Set([
    "getRecommendSheetTags",
    "getMusicSheetInfo",
    "getRecommendSheetsByTag",
]);

/**
 * 合成可用率（带样本保护）：play/parse/search 总样本 ≥3 才按加权公式，
 * 样本不足回退默认 0.5——排序场景防"一次探测成功即 100% 虚高"（展示口径
 * getBestDimensionSync 已有同类保护）。
 */
function calcReliabilitySafe(r?: IReliabilityRecord): number {
    if (!r) {
        return RELIABILITY_DEFAULT;
    }
    let samples = 0;
    for (const dim of ["play", "parse", "search"] as const) {
        const c = r[dim];
        if (c) {
            samples += c.success + c.fail;
        }
    }
    if (samples < SORT_MIN_SAMPLES) {
        return RELIABILITY_DEFAULT;
    }
    return calcReliability(r);
}

/**
 * 排序主分：按能力切口径——歌单能力用歌单可用率、歌词能力用歌词可用率，
 * 其余（搜索/解析/播放）用合成可用率；目标口径无数据/样本不足时兜底合成可用率。
 * 各口径同样带样本保护（<SORT_MIN_SAMPLES 回退默认，不偏向新源或单次探测结果）。
 */
export function getSortRateSync(
    platform: string | undefined,
    ability: string,
): number {
    if (!platform) {
        return RELIABILITY_DEFAULT;
    }
    const synthRate = () =>
        calcReliabilitySafe(reliabilityMap[platform]);
    if (SHEET_ABILITIES.has(ability)) {
        const rec = getRecommendRecordSync(platform);
        if (rec && rec.ok + rec.fail >= SORT_MIN_SAMPLES) {
            return calcRecommend(rec);
        }
        return synthRate();
    }
    if (ability === "getLyric") {
        const d = reliabilityMap[platform]?.lyric;
        if (d && d.success + d.fail >= SORT_MIN_SAMPLES) {
            return dimensionRate(d) ?? RELIABILITY_DEFAULT;
        }
        return synthRate();
    }
    return synthRate();
}

/**
 * 排序评分：{ 主分 rate, 耗时 latencyMs(ms) }。
 * rate 同 getSortRateSync；latencyMs 取对应口径耗时：
 * 歌单 → 推荐歌单累计均值（recommendMap）；歌词/合成 → 探测耗时镜像 dimMs
 * （合成取 play/parse/search 均值，缺失则用任一有值维度）。
 */
export function getSortScoreSync(
    platform: string | undefined,
    ability: string,
): { rate: number; latencyMs: number | null } {
    const rate = getSortRateSync(platform, ability);
    let latencyMs: number | null = null;
    if (SHEET_ABILITIES.has(ability)) {
        latencyMs = getRecommendLatencySync(platform);
    } else if (ability === "getLyric") {
        latencyMs = getDimMsValue(platform, "lyric");
    } else {
        const ms = getDimMsValue(platform, "play");
        const parse = getDimMsValue(platform, "parse");
        const search = getDimMsValue(platform, "search");
        const vals = [ms, parse, search].filter(
            (v): v is number => v !== null,
        );
        latencyMs =
            vals.length > 0
                ? vals.reduce((a, b) => a + b, 0) / vals.length
                : null;
    }
    return { rate, latencyMs };
}

function getDimMsValue(
    platform: string | undefined,
    dim: string,
): number | null {
    if (!platform) {
        return null;
    }
    const v = dimMsMap[platform]?.[dim];
    return typeof v === "number" && v >= 0 ? v : null;
}

/** 异步取推荐歌单可用率 */
export async function getRecommendReliability(
    platform: string | undefined,
): Promise<number> {
    if (!platform) {
        return RECOMMEND_DEFAULT;
    }
    await ensureRecommendLoaded();
    return calcRecommend(recommendMap[platform]);
}

/**
 * 记录一次推荐歌单获取结果（ok=是否成功返回非空数据；elapsedMs=本次拉取耗时毫秒，
 * 可选，传入后累加进 timeCost/timeCount 供平均耗时统计）；同 recordResult 的竞态处理
 */
export async function recordRecommendResult(
    platform: string | undefined,
    ok: boolean,
    elapsedMs?: number,
): Promise<void> {
    if (!platform) {
        return;
    }
    await ensureRecommendLoaded();
    const r = recommendMap[platform] ?? {
        ok: 0,
        fail: 0,
        timeCost: 0,
        timeCount: 0,
    };
    if (ok) {
        r.ok += 1;
    } else {
        r.fail += 1;
    }
    if (typeof elapsedMs === "number" && elapsedMs >= 0) {
        r.timeCost = (r.timeCost ?? 0) + elapsedMs;
        r.timeCount = (r.timeCount ?? 0) + 1;
    }
    recommendMap[platform] = r;
    void setStorage(
        StorageKeys.PluginRecommendReliability,
        recommendMap,
    ).catch(() => {});
    notifyReliability();
}

/** 预加载推荐歌单专用统计（启动时调用） */
export async function setupRecommend(): Promise<void> {
    await ensureRecommendLoaded();
}

/** 重置推荐歌单统计（调试用） */
export async function resetRecommendReliability(): Promise<void> {
    recommendMap = {};
    recommendLoaded = true;
    try {
        await setStorage(StorageKeys.PluginRecommendReliability, {});
    } catch {}
}

/** 启动时预加载持久化数据 */
export async function setup(): Promise<void> {
    await ensureLoaded();
}

/** 重置（调试用；未接入 UI） */
export async function resetReliability(): Promise<void> {
    reliabilityMap = {};
    loaded = true;
    try {
        await setStorage(StorageKeys.PluginReliability, {});
    } catch {}
}

const pluginReliability = {
    setup,
    recordResult,
    recordPlayResult,
    recordLyricResult,
    getReliability,
    getReliabilityRecord,
    getReliabilitySync,
    getRecordSync,
    // 展示口径：能力强弱决定（合成/歌词/歌单取最高）
    getBestDimensionSync,
    getLyricReliabilitySync,
    hasLyricRecordSync,
    hasRecordSync,
    isReliabilitySortEnabled,
    RELIABILITY_DEFAULT,
    // 统计变更订阅（UI 实时刷新）
    subscribeReliability,
    // 推荐歌单专用可用率
    setupRecommend,
    recordRecommendResult,
    getRecommendReliability,
    getRecommendReliabilitySync,
    getRecommendRecordSync,
    getRecommendLatencySync,
    hasRecommendRecordSync,
    RECOMMEND_DEFAULT,
    resetRecommendReliability,
    // 排序评分：按能力切口径 + 耗时 tie-breaker
    getSortRateSync,
    getSortScoreSync,
    setDimMs,
};

export default pluginReliability;

// 模块加载即后台预加载统计数据（setup() 内 ensureLoaded 幂等，重复调用无副作用）：
// 避免启动初期同步排序（getReliabilitySync 等）在 setup() 完成前平权返回默认 0.5。
void ensureLoaded();
void ensureRecommendLoaded();
