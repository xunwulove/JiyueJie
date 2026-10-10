import PluginManager from "@/core/pluginManager";
import { resetMediaItem } from "@/utils/mediaUtils";
import { devLog } from "@/utils/log";

/** 某插件的推荐歌单数据（pinned 固定推荐 + 分组歌单） */
export interface IPluginRecommendSheets {
    pluginHash: string;
    pluginName: string;
    pinned: IMusic.IMusicSheetItemBase[];
    groups: IMusic.IMusicSheetGroupItem[];
}

/**
 * 拉取指定插件的推荐歌单（插件协议 getRecommendSheetTags）
 * 这是 MusicFree 官方"推荐歌单"的数据链路：
 * 歌单/歌曲全部由插件自身返回（带 platform），
 * 点击歌单后由插件 getMusicSheetInfo 解析详情并直接播放，无需额外匹配。
 *
 * 与原版一致：返回的歌单显式打上插件 platform 标记（resetMediaItem），
 * 使详情页能按 platform/pluginHash 找到对应插件。
 */
export async function fetchPluginRecommendSheets(
    pluginHash: string,
): Promise<IPluginRecommendSheets | null> {
    const plugin = PluginManager.getByHash(pluginHash);
    if (!plugin) {
        return null;
    }
    try {
        const result = await plugin.methods.getRecommendSheetTags();
        const pinned = (result?.pinned ?? [])
            .filter(Boolean)
            .map(item => resetMediaItem(item, plugin.instance.platform));
        const groups = (result?.data ?? [])
            .filter(g => g?.title && g?.data?.length)
            .map(g => ({
                ...g,
                data: (g?.data ?? []).map(item =>
                    resetMediaItem(item, plugin.instance.platform),
                ),
            }));
        if (!pinned.length && !groups.length) {
            return null;
        }
        return { pluginHash, pluginName: plugin.name, pinned, groups };
    } catch (e: any) {
        devLog(
            "error",
            "获取插件推荐歌单失败",
            plugin.name,
            e?.message ?? e,
        );
        return null;
    }
}

/**
 * 遍历所有具备 getRecommendSheetTags 能力的已启用插件，
 * 返回第一个成功返回数据的插件（失败自动尝试下一个）。
 */
export async function getFirstAvailablePluginRecommend(): Promise<IPluginRecommendSheets | null> {
    const plugins =
        PluginManager.getSortedPluginsWithAbility("getRecommendSheetTags");
    for (const plugin of plugins) {
        const data = await fetchPluginRecommendSheets(plugin.hash);
        if (data) {
            return data;
        }
    }
    return null;
}

/** 平铺某插件推荐歌单的全部歌单（pinned + 所有分组） */
export function flattenPluginRecommend(
    data: IPluginRecommendSheets,
): IMusic.IMusicSheetItemBase[] {
    return [
        ...(data?.pinned ?? []),
        ...(data?.groups ?? []).flatMap(g => g?.data ?? []),
    ];
}
