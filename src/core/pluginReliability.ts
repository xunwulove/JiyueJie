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
}

let reliabilityMap: Record<string, IReliabilityRecord> = {};
let loaded = false;

let recommendMap: Record<string, IRecommendReliabilityRecord> = {};
let recommendLoaded = false;

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

/** 是否有推荐歌单统计记录（同步；无记录返回 false，用于"暂无数据排最后"） */
export function hasRecommendRecordSync(platform: string | undefined): boolean {
    if (!platform) {
        return false;
    }
    const r = recommendMap[platform];
    return !!r && r.ok + r.fail > 0;
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

/** 记录一次推荐歌单获取结果（ok=是否成功返回非空数据）；同 recordResult 的竞态处理 */
export async function recordRecommendResult(
    platform: string | undefined,
    ok: boolean,
): Promise<void> {
    if (!platform) {
        return;
    }
    await ensureRecommendLoaded();
    const r = recommendMap[platform] ?? { ok: 0, fail: 0 };
    if (ok) {
        r.ok += 1;
    } else {
        r.fail += 1;
    }
    recommendMap[platform] = r;
    void setStorage(
        StorageKeys.PluginRecommendReliability,
        recommendMap,
    ).catch(() => {});
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
    getLyricReliabilitySync,
    hasLyricRecordSync,
    hasRecordSync,
    isReliabilitySortEnabled,
    RELIABILITY_DEFAULT,
    // 推荐歌单专用可用率
    setupRecommend,
    recordRecommendResult,
    getRecommendReliability,
    getRecommendReliabilitySync,
    hasRecommendRecordSync,
    RECOMMEND_DEFAULT,
    resetRecommendReliability,
};

export default pluginReliability;

// 模块加载即后台预加载统计数据（setup() 内 ensureLoaded 幂等，重复调用无副作用）：
// 避免启动初期同步排序（getReliabilitySync 等）在 setup() 完成前平权返回默认 0.5。
void ensureLoaded();
void ensureRecommendLoaded();
