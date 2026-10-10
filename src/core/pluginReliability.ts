/**
 * 音源可用率统计（按插件平台）
 *
 * 记录每个音源（插件平台）的解析/搜索成功与失败次数，计算可用率。
 * 播放匹配（playMatcher）时按可用率排序候选源：可用率高的源优先尝试。
 * 可在设置页关闭（basic.sortPluginByReliability，默认开启）。
 *
 * 另设一套"推荐歌单专用可用率"（独立 key、独立计数，不混入上面的 success/fail）：
 * 推荐歌单页/首页横滑区按它择优排序，避免"能搜索但推荐歌单拉胯"的源抢占推荐位。
 */
import { getStorage, setStorage } from "@/utils/storage";
import { StorageKeys } from "@/constants/commonConst";
import Config from "@/core/appConfig";

/** 无统计数据时的默认可用率（0.5：不偏向新源，也不压旧源） */
export const RELIABILITY_DEFAULT = 0.5;
/** 推荐歌单专用可用率：无数据时的默认值（同上 0.5） */
export const RECOMMEND_DEFAULT = 0.5;

interface IReliabilityRecord {
    success: number;
    fail: number;
}

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

async function ensureLoaded(): Promise<void> {
    if (loaded) {
        return;
    }
    try {
        const data = await getStorage(StorageKeys.PluginReliability);
        reliabilityMap =
            (data as Record<string, IReliabilityRecord> | null) ?? {};
    } catch {
        reliabilityMap = {};
    }
    loaded = true;
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

function calcReliability(r?: IReliabilityRecord): number {
    if (!r || r.success + r.fail <= 0) {
        return RELIABILITY_DEFAULT;
    }
    return r.success / (r.success + r.fail);
}

/** 记录一次解析/搜索结果（ok=是否成功） */
export async function recordResult(
    platform: string | undefined,
    ok: boolean,
): Promise<void> {
    if (!platform) {
        return;
    }
    await ensureLoaded();
    const r = reliabilityMap[platform] ?? { success: 0, fail: 0 };
    if (ok) {
        r.success += 1;
    } else {
        r.fail += 1;
    }
    reliabilityMap[platform] = r;
    try {
        await setStorage(StorageKeys.PluginReliability, reliabilityMap);
    } catch {}
}

/* ============ 推荐歌单专用可用率（独立统计） ============ */

async function ensureRecommendLoaded(): Promise<void> {
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

/** 记录一次推荐歌单获取结果（ok=是否成功返回非空数据） */
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
    try {
        await setStorage(
            StorageKeys.PluginRecommendReliability,
            recommendMap,
        );
    } catch {}
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
    getReliability,
    getReliabilityRecord,
    getReliabilitySync,
    isReliabilitySortEnabled,
    RELIABILITY_DEFAULT,
    // 推荐歌单专用可用率
    setupRecommend,
    recordRecommendResult,
    getRecommendReliability,
    getRecommendReliabilitySync,
    RECOMMEND_DEFAULT,
    resetRecommendReliability,
};

export default pluginReliability;
