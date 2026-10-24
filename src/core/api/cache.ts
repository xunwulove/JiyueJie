/**
 * 网易/QQ 榜单·推荐歌单数据每日缓存
 * - 每天首次进入拉取一次，当天内复用本地缓存（避免频繁请求官方接口被风控）
 * - 拉取失败/为空时回退上一次缓存数据（即使过期，保证功能可用）
 */

import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import * as neteaseApi from "./netease";
import * as qqApi from "./qq";
import PluginManager from "@/core/pluginManager";
import { platformMatches } from "@/core/playMatcher";

const store = getOrCreateMMKV("Api.SheetCache");

interface IApiCacheEntry<T> {
    data: T;
    fetchedAt: number;
}

function readCache<T>(key: string): IApiCacheEntry<T> | null {
    const raw = store.getString(key);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as IApiCacheEntry<T>;
    } catch {
        return null;
    }
}

function writeCache<T>(key: string, data: T): void {
    store.set(
        key,
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

/** 每日缓存：今天已获取 → 用缓存；跨天 → 拉取；拉取失败 → 回退旧缓存 */
async function getCachedOrFetch<T>(
    key: string,
    fetcher: () => Promise<T | null>,
    nonEmpty: (v: T | null) => v is T = (v): v is T => !!v,
): Promise<T | null> {
    const cached = readCache<T>(key);
    const now = new Date();

    if (cached && sameDay(cached.fetchedAt, now)) {
        // 今天已获取过，直接用缓存（不再请求，防风控）
        return cached.data;
    }

    const fresh = await fetcher();
    if (nonEmpty(fresh)) {
        writeCache(key, fresh);
        return fresh;
    }

    // 拉取失败/为空 → 回退上一次数据（即使过期）
    return cached?.data ?? null;
}

/**
 * 获取缓存版榜单/推荐歌单列表
 * @param type recommend=推荐歌单 / toplist=排行榜
 * @param platform netease=网易云 / qq=QQ音乐
 */
export function getCachedSheets(
    type: "recommend" | "toplist",
    platform: "netease" | "qq",
): Promise<IMusic.IMusicSheetItemBase[] | null> {
    const key = `${platform}:${type}`;
    const fetcher =
        type === "recommend"
            ? platform === "netease"
                ? neteaseApi.getRecommendSheets
                : qqApi.getRecommendSheets
            : platform === "netease"
                ? neteaseApi.getTopLists
                : qqApi.getTopLists;
    return getCachedOrFetch(
        key,
        fetcher,
        (v): v is IMusic.IMusicSheetItemBase[] =>
            !!v && v.length > 0,
    );
}

/**
 * 获取缓存版歌单/榜单详情（网易接口 / QQ 榜单接口 / QQ 歌单走插件）
 */
export function getCachedSheetDetail(
    sheetInfo: IMusic.IMusicSheetItemBase,
): Promise<IMusic.IMusicItem[] | null> {
    const key = `detail:${sheetInfo.apiSource ?? "?"}:${sheetInfo.id}`;
    const fetcher = async (): Promise<IMusic.IMusicItem[] | null> => {
        if (sheetInfo.apiSource === "netease") {
            return neteaseApi.getSheetDetail(sheetInfo.id);
        }
        if (sheetInfo.apiSource === "qq") {
            // QQ 榜单：走接口；QQ 歌单：直连接口反爬 → 走 QQ 系插件
            if (sheetInfo.topid !== undefined) {
                return qqApi.getTopListDetail(sheetInfo.id);
            }
            return getQQSheetDetail(sheetInfo);
        }
        return null;
    };
    return getCachedOrFetch(
        key,
        fetcher,
        (v): v is IMusic.IMusicItem[] => !!v && v.length > 0,
    );
}

/** QQ 歌单详情：遍历 QQ 系插件（有 getMusicSheetInfo 能力）尝试解析 */
async function getQQSheetDetail(
    sheetInfo: IMusic.IMusicSheetItemBase,
): Promise<IMusic.IMusicItem[] | null> {
    const plugins = PluginManager.getSortedPluginsWithAbility(
        "getMusicSheetInfo",
    );
    const qqPlugins = plugins.filter(p =>
        platformMatches(p.instance.platform, sheetInfo.platform),
    );
    const rest = plugins.filter(
        p => !platformMatches(p.instance.platform, sheetInfo.platform),
    );
    for (const plugin of [...qqPlugins, ...rest]) {
        try {
            const result = await plugin.methods?.getMusicSheetInfo?.(
                sheetInfo as IMusic.IMusicSheetItem,
                1,
            );
            if (result?.musicList?.length) {
                return result.musicList;
            }
        } catch {
            // 继续下一个插件
        }
    }
    return null;
}
