/**
 * 音源可用率统计（按插件平台）
 *
 * 记录每个音源（插件平台）的解析/搜索成功与失败次数，计算可用率。
 * 播放匹配（playMatcher）时按可用率排序候选源：可用率高的源优先尝试。
 * 可在设置页关闭（basic.sortPluginByReliability，默认开启）。
 */
import { getStorage, setStorage } from "@/utils/storage";
import { StorageKeys } from "@/constants/commonConst";
import Config from "@/core/appConfig";

/** 无统计数据时的默认可用率（0.5：不偏向新源，也不压旧源） */
export const RELIABILITY_DEFAULT = 0.5;

interface IReliabilityRecord {
    success: number;
    fail: number;
}

let reliabilityMap: Record<string, IReliabilityRecord> = {};
let loaded = false;

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
};

export default pluginReliability;
