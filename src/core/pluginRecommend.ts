import PluginManager from "@/core/pluginManager";
import { resetMediaItem } from "@/utils/mediaUtils";
import { devLog } from "@/utils/log";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import PersistStatus from "@/utils/persistStatus";
import pluginReliability, {
    getRecommendReliabilitySync,
    getRecommendLatencySync,
    ensureRecommendLoaded,
} from "@/core/pluginReliability";
import Config from "@/core/appConfig";
import { getQualityOrder } from "@/utils/qualities";

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
    // 拉取耗时统计：真实网络请求前计时（getByHash 为本地查找，不计入）
    const fetchStart = Date.now();
    const elapsed = () => Date.now() - fetchStart;
    try {
        // 超时保护：插件 getRecommendSheetTags 无超时约定，卡住的源会拖住首页推荐区
        // 串行择优（首次打开零缓存时逐个真请求）。对齐 getRecommendSheetsByTag 的 8s。
        const FETCH_TIMEOUT = 8000;
        const result = await Promise.race([
            plugin.methods.getRecommendSheetTags(),
            new Promise<null>(resolve =>
                setTimeout(() => resolve(null), FETCH_TIMEOUT),
            ),
        ]);
        if (!result) {
            // 超时视为失败：记 fail 返回 null，调用方继续尝试下一源
            pluginReliability.recordRecommendResult(
                plugin.instance.platform,
                false,
                elapsed(),
            );
            return null;
        }
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
                elapsed(),
            );
            return null;
        }
        // 2026-10-30 收紧口径：与探测一致——"能显示 + 歌单第一首可解析出播放地址"才算 ok，
        // 避免"拉到列表但歌曲解析不出"的源虚高占用推荐位；只影响可用率统计，不影响返回数据。
        // 整个验证块 8s 超时（对齐探测端单步超时），首曲解析不阻塞推荐页展示。
        const verifyFirstSong = async (): Promise<boolean> => {
            const firstWithCover = [
                ...pinned,
                ...groups.flatMap(g => g.data),
            ].find(it => it?.artwork || it?.coverImg);
            const firstItem =
                firstWithCover ?? pinned[0] ?? groups[0]?.data?.[0] ?? null;
            if (!firstItem) {
                return false;
            }
            const info = await plugin.methods.getMusicSheetInfo?.(
                firstItem as IMusic.IMusicSheetItem,
                1,
            );
            const firstSong = (info?.musicList ?? [])[0];
            if (!firstSong) {
                return false;
            }
            const qualityOrder = getQualityOrder(
                Config.getConfig("basic.defaultPlayQuality") ?? "standard",
                Config.getConfig("basic.playQualityOrder") ?? "desc",
            );
            for (const quality of qualityOrder) {
                const src =
                    (await plugin.methods.getMediaSource?.(
                        firstSong,
                        quality,
                    )) ?? null;
                if (src?.url) {
                    return true;
                }
            }
            return false;
        };
        const usable = await Promise.race([
            verifyFirstSong(),
            new Promise<false>(resolve =>
                setTimeout(() => resolve(false), 8000),
            ),
        ]);
        pluginReliability.recordRecommendResult(
            plugin.instance.platform,
            usable,
            elapsed(),
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
            elapsed(),
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
 * 每日勘探（方案 A）：选优成功后，中概率（40%）额外探测 1~2 个"次选源"做对比。
 * 目的：打破"首日赢者通吃"——首选源成功后其他源永远无数据（0.5）排最后；
 * 勘探让次选源也有机会真实拉取、积累可用率（成功记 ok / 失败记 fail 均在
 * fetchPluginRecommendSheets 内部完成，这里不重复记录），次日排序即可参与竞争。
 *
 * 规则：
 * - 每天最多勘探一轮（PersistStatus.app.recommendExploreDate 标记当天日期）；
 * - 40% 概率触发（Math.random() < 0.4）；
 * - 候选 = 本次排序结果中"非首选源"的插件，打乱后取 1~2 个；
 * - 后台探测（fire-and-forget，不阻塞推荐区返回）：当天已有缓存直接复用，
 *   无缓存/跨天才真实请求插件。
 */
async function exploreBackupSources(
    allPlugins: Array<{ hash: string }>,
    winnerHash: string,
): Promise<void> {
    try {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${
            today.getMonth() + 1
        }-${today.getDate()}`;
        if (PersistStatus.get("app.recommendExploreDate") === todayStr) {
            return;
        }
        PersistStatus.set("app.recommendExploreDate", todayStr);

        // 40% 概率触发
        if (Math.random() >= 0.4) {
            return;
        }

        const candidates = allPlugins.filter(p => p.hash !== winnerHash);
        if (!candidates.length) {
            return;
        }
        // 打乱后取 1~2 个（各 50%）
        const shuffled = [...candidates].sort(
            () => Math.random() - 0.5,
        );
        const count = Math.random() < 0.5 ? 1 : 2;
        for (const plugin of shuffled.slice(0, count)) {
            // allowStaleFallback 默认 true：当天已成功复用（不请求）；无缓存/跨天才真实探测并自动记 ok/fail
            await getCachedPluginRecommend(plugin.hash);
        }
    } catch (e: any) {
        devLog("error", "推荐歌单每日勘探失败", e?.message ?? e);
    }
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
    // 总预算：全源极端卡死时最多等这么久（每源另有 8s 超时），
    // 避免首次打开零缓存时串行请求拖住首页推荐区几十秒
    const startBudget = Date.now();
    const TOTAL_BUDGET = 20000;
    // 排序前确保推荐可用率统计已加载，避免启动初期所有源平权 0.5 导致择优失效
    await ensureRecommendLoaded();
    const plugins = PluginManager.getSortedPluginsWithAbility(
        "getRecommendSheetTags",
    )
        .slice()
        .sort((a, b) => {
            // 主排序：推荐歌单可用率降序（可用率高的源优先展示）
            const ra = getRecommendReliabilitySync(a.instance.platform);
            const rb = getRecommendReliabilitySync(b.instance.platform);
            if (ra !== rb) {
                return rb - ra;
            }
            // 次排序（成功率相同）：有平均耗时数据的优先、平均耗时短者优先，
            // 避免"能用但慢"的源与"快但无数据"的源混为一谈
            const la = getRecommendLatencySync(a.instance.platform);
            const lb = getRecommendLatencySync(b.instance.platform);
            if (la != null && lb != null) {
                return la - lb;
            }
            if (la != null) {
                return -1;
            }
            if (lb != null) {
                return 1;
            }
            return 0;
        });

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

    // 随机使用音源：优先从"当日已有缓存"的源里随机（零请求命中，实现换源）；
    // 无当日缓存时全量随机新拉；随机到的源失败 → 回退下面的可用率择优兜底
    if (manualHash === "random") {
        const now = new Date();
        const cachedPool = plugins.filter(p => {
            const c = readCache(p.hash);
            return c && sameDay(c.fetchedAt, now);
        });
        const pool = cachedPool.length ? cachedPool : plugins;
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        for (const plugin of shuffled) {
            if (Date.now() - startBudget > TOTAL_BUDGET) {
                break; // 总预算耗尽（极端全卡场景），不再尝试
            }
            const data = await getCachedPluginRecommend(plugin.hash, {
                allowStaleFallback: false,
            });
            if (data) {
                return data;
            }
        }
        // 随机全失败 → 落入下方择优循环兜底
    }

    // 自动择优：先复用"上次择优选中的源"的当日缓存（保持离开时的歌单，不重新择优换源）；
    // 缓存源已失效/被禁用 → 回退下方可用率择优重新选源。
    // 注：择优持久化用独立键 plugin.recommendSourceCache，不写 plugin.recommendSource，
    // 因此不会把"自动择优"变成"手动指定"（来源浮窗始终显示自动择优）。
    const cacheHash = Config.getConfig("plugin.recommendSourceCache");
    if (cacheHash) {
        const cachedPlugin = plugins.find(p => p.hash === cacheHash);
        if (cachedPlugin) {
            const cachedData = await getCachedPluginRecommend(cacheHash, {
                allowStaleFallback: false,
            });
            if (cachedData) {
                return cachedData;
            }
        }
    }

    // 自动择优：可用率并列最高的源池内随机首选（不再固定排序第一个），
    // 随机到的失败 → 回退次高可用率源 → 最终按可用率序兜底。
    // 成功后把该源持久化为"择优当前歌单来源"：下次进软件（一天内）优先读它的缓存，保持离开时的歌单。
    const topRel = plugins.length
        ? getRecommendReliabilitySync(plugins[0].instance.platform)
        : 0;
    const topPool = plugins.filter(
        p => getRecommendReliabilitySync(p.instance.platform) === topRel,
    );
    const primaryOrder =
        topPool.length > 1
            ? [...topPool].sort(() => Math.random() - 0.5)
            : topPool;
    const fallbackOrder = plugins.filter(p => !topPool.includes(p));
    for (const plugin of [...primaryOrder, ...fallbackOrder]) {
        if (Date.now() - startBudget > TOTAL_BUDGET) {
            break; // 总预算耗尽（极端全卡场景），不再尝试
        }
        const data = await getCachedPluginRecommend(plugin.hash, {
            // 跨天旧缓存不截胡：失败即继续尝试下一个更健康的插件
            allowStaleFallback: false,
        });
        if (data) {
            // 持久化择优当前歌单来源（独立键，不影响"手动指定/自动择优"语义）
            Config.setConfig("plugin.recommendSourceCache", plugin.hash);
            // 选优成功后：后台每日勘探（不阻塞本次返回）
            void exploreBackupSources(plugins, plugin.hash);
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

/**
 * 同步读取"当日已有缓存"的第一个插件推荐数据（零网络、零异步）。
 * 首页推荐区首帧渲染用：MMKV 读取为同步 API，首帧即可拿到缓存直接渲染，
 * 不再依赖异步 load() 完成（修复"有缓存但首帧不显示、切 tab 才显示"）。
 * 无当日缓存返回 null（此时走异步 load 拉取）。
 */
export function getCachedPluginRecommendSyncFirst(): IPluginRecommendSheets | null {
    try {
        const now = new Date();
        const plugins = PluginManager.getSortedPluginsWithAbility(
            "getRecommendSheetTags",
        );
        // 优先手动指定源：用户切换过来源（plugin.recommendSource=hash）后重进软件，
        // 应保持所选来源的歌单；否则会被"可用率最高"的源缓存截胡回初始歌单。
        // 手动源无当日缓存（如跨天/首次）→ 继续回退择优。
        const manualHash = Config.getConfig("plugin.recommendSource");
        if (manualHash && manualHash !== "random") {
            const manual = plugins.find(p => p.hash === manualHash);
            if (manual) {
                const c = readCache(manual.hash);
                if (c && sameDay(c.fetchedAt, now)) {
                    return c.data;
                }
            }
        }
        // 其次：自动择优持久化的歌单来源（plugin.recommendSourceCache）——保持离开时歌单
        const cacheHash = Config.getConfig("plugin.recommendSourceCache");
        if (cacheHash) {
            const cachedPlugin = plugins.find(p => p.hash === cacheHash);
            if (cachedPlugin) {
                const c = readCache(cachedPlugin.hash);
                if (c && sameDay(c.fetchedAt, now)) {
                    return c.data;
                }
            }
        }
        for (const p of plugins) {
            const c = readCache(p.hash);
            if (c && sameDay(c.fetchedAt, now)) {
                return c.data;
            }
        }
    } catch (e: any) {
        devLog("error", "同步读取推荐歌单缓存失败", e?.message ?? e);
    }
    return null;
}

/* ------------------------------------------------------------------ */
/* 标签歌单（getRecommendSheetsByTag）——推荐歌单二级页/首页横滑共用     */
/* 对齐官方协议：getRecommendSheetTags 返回的 data[].data 是"标签"，    */
/* 标签本身无封面；真实歌单需调 getRecommendSheetsByTag 获取（有封面）。 */
/* ------------------------------------------------------------------ */

const tagCacheStore = getOrCreateMMKV("Plugin.RecommendTagCache");

interface ITagCacheEntry {
    data: IMusic.IMusicSheetItemBase[];
    fetchedAt: number;
}

function readTagCache(pluginHash: string, tagId: string): ITagCacheEntry | null {
    const raw = tagCacheStore.getString(`${pluginHash}:${tagId}`);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw) as ITagCacheEntry;
    } catch {
        return null;
    }
}

function writeTagCache(
    pluginHash: string,
    tagId: string,
    data: IMusic.IMusicSheetItemBase[],
): void {
    tagCacheStore.set(
        `${pluginHash}:${tagId}`,
        JSON.stringify({ data, fetchedAt: Date.now() }),
    );
}

/**
 * 每日缓存版标签歌单（仿照推荐歌单 Plugin.RecommendCache）：
 * 当天已拉取 → 直接复用（不再请求插件）；跨天 → 拉取 getRecommendSheetsByTag 第一页；
 * 拉取失败/为空 → 回退上一次缓存（保证功能可用）。
 * 分页加载请直接调用 fetchRecommendSheetsByTag（缓存仅用于首屏/横滑区）。
 */
export async function getCachedRecommendSheetsByTag(
    pluginHash: string,
    tag: ICommon.IUnique,
): Promise<IMusic.IMusicSheetItemBase[] | null> {
    const plugin = PluginManager.getByHash(pluginHash);
    if (!plugin) {
        return null;
    }
    const tagId = tag?.id ?? tag?.title ?? "";
    if (!tagId) {
        return null;
    }
    const cached = readTagCache(pluginHash, tagId);
    const now = new Date();

    if (cached && sameDay(cached.fetchedAt, now)) {
        return cached.data;
    }

    try {
        // 超时保护：插件 getRecommendSheetsByTag 无超时约定，卡住会导致首页横滑区/首屏永久挂起
        const FETCH_TIMEOUT = 8000;
        const result = await Promise.race([
            plugin.methods.getRecommendSheetsByTag?.(tag, 1),
            new Promise<null>(resolve =>
                setTimeout(() => resolve(null), FETCH_TIMEOUT),
            ),
        ]);
        const list = result?.data ?? [];
        if (list.length) {
            writeTagCache(pluginHash, tagId, list);
            return list;
        }
    } catch (e: any) {
        devLog(
            "error",
            "获取插件标签歌单失败",
            plugin.name,
            tagId,
            e?.message ?? e,
        );
    }

    return cached?.data ?? null;
}

/**
 * 直接拉取某插件某标签下的推荐歌单（getRecommendSheetsByTag，分页）。
 * 供二级页标签歌单分页加载使用（不写每日缓存，避免覆盖首屏缓存）。
 */
export async function fetchRecommendSheetsByTag(
    pluginHash: string,
    tag: ICommon.IUnique,
    page: number,
): Promise<ICommon.PaginationResponse<IMusic.IMusicSheetItemBase> | null> {
    const plugin = PluginManager.getByHash(pluginHash);
    if (!plugin) {
        return null;
    }
    try {
        const result = await plugin.methods.getRecommendSheetsByTag?.(tag, page);
        return result ?? null;
    } catch (e: any) {
        devLog(
            "error",
            "获取插件标签歌单失败",
            plugin.name,
            tag?.id ?? tag?.title,
            page,
            e?.message ?? e,
        );
        return null;
    }
}

/**
 * 判定一个推荐歌单项是"真实歌单"还是"标签"：
 * 有封面（coverImg/artwork）→ 真实歌单（直接展示卡片）；
 * 无封面 → 标签（需调 getRecommendSheetsByTag 拉取歌单列表）。
 * 官方协议下 pinned/分组项多为标签（无封面属正常），部分插件直接返回歌单。
 */
export function isRealSheetItem(item: IMusic.IMusicSheetItemBase): boolean {
    return !!(item?.coverImg || item?.artwork);
}
