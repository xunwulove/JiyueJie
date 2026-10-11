import PluginManager from "@/core/pluginManager";
import { resetMediaItem } from "@/utils/mediaUtils";
import { devLog } from "@/utils/log";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import pluginReliability, {
    getRecommendReliabilitySync,
    ensureRecommendLoaded,
} from "@/core/pluginReliability";
import Config from "@/core/appConfig";

const cacheStore = getOrCreateMMKV("Plugin.RecommendCache");

interface IPluginRecommendCacheEntry {
    data: IPluginRecommendSheets;
    fetchedAt: number;
}

function readCache(hash: string): IPluginRecommendCacheEntry | null {
    const raw = cacheStore.getString(hash);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as IPluginRecommendCacheEntry;
    } catch {
        return null;
    }
}

function writeCache(hash: string, data: IPluginRecommendSheets): void {
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
 *
 * 统一在这里记录"推荐歌单专用可用率"（recordRecommendResult）：
 * 成功返回非空数据=ok，异常/空壳=fail。所有调用方（二级页面板、
 * 首页横滑区、刷新按钮）都走本函数，因此统计天然去重、无需各处手动记。
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
            // 空壳：接口返回了但没有可用歌单 → 记失败
            pluginReliability.recordRecommendResult(
                plugin.instance.platform,
                false,
            );
            return null;
        }
        pluginReliability.recordRecommendResult(
            plugin.instance.platform,
            true,
        );
        return { pluginHash, pluginName: plugin.name, pinned, groups };
    } catch (e: any) {
        devLog(
            "error",
            "获取插件推荐歌单失败",
            plugin.name,
            e?.message ?? e,
        );
        pluginReliability.recordRecommendResult(
            plugin.instance.platform,
            false,
        );
        return null;
    }
}

/**
 * 每日缓存版插件推荐歌单（首页横滑区 + 推荐歌单二级页共用）：
 * 当天已拉取 → 直接复用缓存（不再请求插件）；跨天 → 拉取；
 * 拉取失败/为空 → 回退上一次缓存（默认保证功能可用）。
 *
 * allowStaleFallback=false 时（"择优"场景）：跨天旧缓存不再作为结果返回，
 * 返回 null 让调用方继续尝试下一个更健康的插件，避免首个插件失败即被旧缓存截胡。
 */
export async function getCachedPluginRecommend(
    pluginHash: string,
    options?: { allowStaleFallback?: boolean },
): Promise<IPluginRecommendSheets | null> {
    const allowStaleFallback = options?.allowStaleFallback ?? true;
    const cached = readCache(pluginHash);
    const now = new Date();

    if (cached && sameDay(cached.fetchedAt, now)) {
        // 今天已拉取过，直接复用（避免每次进入都请求插件）
        return cached.data;
    }

    const fresh = await fetchPluginRecommendSheets(pluginHash);
    if (fresh) {
        writeCache(pluginHash, fresh);
        return fresh;
    }

    // 拉取失败/为空 → 回退上一次数据（即使过期，保证功能可用）
    if (allowStaleFallback) {
        return cached?.data ?? null;
    }
    return null;
}

/**
 * 强制刷新指定插件的推荐歌单（绕过每日缓存，直接拉取并覆盖缓存）
 * 供"推荐歌单"标题行刷新按钮使用
 */
export async function refreshCachedPluginRecommend(
    pluginHash: string,
): Promise<IPluginRecommendSheets | null> {
    const fresh = await fetchPluginRecommendSheets(pluginHash);
    if (fresh) {
        writeCache(pluginHash, fresh);
    }
    return fresh;
}

/**
 * 遍历所有具备 getRecommendSheetTags 能力的已启用插件，
 * 返回第一个成功返回数据的插件（失败自动尝试下一个）。带每日缓存。
 *
 * 择优规则：按"推荐歌单专用可用率"降序尝试（可用率高的源优先展示；
 * 无数据默认 0.5 排在最后），而不是按插件安装顺序——避免
 * "能搜索但推荐歌单拉胯"的源抢占首页推荐位。
 *
 * 手动指定来源（plugin.recommendSource，推荐歌单刷新按钮 → 来源三级浮窗）：
 * 指定源优先——该源可用则直接用其数据；失败/禁用/不再具备能力时
 * 自动回退到可用率择优（单选优先 + 择优兜底）。
 */
export async function getFirstAvailablePluginRecommend(): Promise<IPluginRecommendSheets | null> {
    // 排序前确保推荐可用率统计已加载，避免启动初期所有源平权 0.5 导致择优失效
    await ensureRecommendLoaded();
    const plugins = PluginManager.getSortedPluginsWithAbility(
        "getRecommendSheetTags",
    )
        .slice()
        .sort(
            (a, b) =>
                getRecommendReliabilitySync(b.instance.platform) -
                getRecommendReliabilitySync(a.instance.platform),
        );

    // 手动指定的来源优先（仅在指定源仍启用且具备能力时生效）
    const manualHash = Config.getConfig("plugin.recommendSource");
    if (manualHash) {
        const manual = plugins.find(p => p.hash === manualHash);
        if (manual) {
            const data = await getCachedPluginRecommend(manualHash, {
                // 跨天旧缓存不截胡：指定源已失效则继续走择优，避免旧数据长期占据首页
                allowStaleFallback: false,
            });
            if (data) {
                return data;
            }
            // 指定源失败 → 回退择优（下面的循环继续）
        }
    }

    for (const plugin of plugins) {
        const data = await getCachedPluginRecommend(plugin.hash, {
            // 跨天旧缓存不截胡：失败即继续尝试下一个更健康的插件
            allowStaleFallback: false,
        });
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
