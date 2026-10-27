import PluginManager from "@/core/pluginManager";
import { devLog } from "@/utils/log";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";

const cacheStore = getOrCreateMMKV("Plugin.TopListCache");

interface ITopListCacheEntry {
    data: IMusic.IMusicSheetGroupItem[];
    fetchedAt: number;
}

function readCache(hash: string): ITopListCacheEntry | null {
    const raw = cacheStore.getString(hash);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as ITopListCacheEntry;
    } catch {
        return null;
    }
}

function writeCache(
    hash: string,
    data: IMusic.IMusicSheetGroupItem[],
): void {
    cacheStore.set(
        hash,
        JSON.stringify({
            data,
            fetchedAt: Date.now(),
        }),
    );
}

/** 是否为同一天（本地时区） */
function sameDay(ts: number, now: Date): boolean {
    const d = new Date(ts);
    return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    );
}

/**
 * 每日缓存版插件排行榜（TopList 页 per-plugin Tab 共用，仿照推荐歌单 Plugin.RecommendCache）：
 * 当天已拉取 → 直接复用缓存（不再请求插件）；跨天 → 拉取 getTopLists 并覆盖缓存；
 * 拉取失败/返回空 → 回退上一次缓存（即使过期，保证功能可用）。
 *
 * 与内存原子缓存（pluginsTopListAtom）的关系：
 * 内存缓存优先（进程内不重复请求）；本模块只负责"内存未命中时"的持久化兜底与跨天刷新。
 */
export async function getCachedTopLists(
    pluginHash: string,
): Promise<IMusic.IMusicSheetGroupItem[] | null> {
    const plugin = PluginManager.getByHash(pluginHash);
    if (!plugin) {
        return null;
    }
    const cached = readCache(pluginHash);
    const now = new Date();

    if (cached && sameDay(cached.fetchedAt, now)) {
        // 今天已拉取过，直接复用（避免每次进入都请求插件）
        return cached.data;
    }

    try {
        const result = await plugin.methods.getTopLists?.();
        if (result?.length) {
            writeCache(pluginHash, result);
            return result;
        }
    } catch (e: any) {
        devLog(
            "error",
            "获取插件排行榜失败",
            plugin.name,
            e?.message ?? e,
        );
    }

    // 拉取失败/为空 → 回退上一次数据（即使过期，保证功能可用）
    return cached?.data ?? null;
}
