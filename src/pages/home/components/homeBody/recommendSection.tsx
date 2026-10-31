import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import PlaylistCard from "@/components/mediaItem/playlistCard";
import IconButton from "@/components/base/iconButton";
import Loading from "@/components/base/loading";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import {
    IPluginRecommendSheets,
    getFirstAvailablePluginRecommend,
    getCachedPluginRecommendSyncFirst,
    refreshCachedPluginRecommend,
    getCachedRecommendSheetsByTag,
    isRealSheetItem,
} from "@/core/pluginRecommend";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import { useI18N } from "@/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";
import Config from "@/core/appConfig";
import { usePlugins } from "@/core/pluginManager";

/** 首页横滑区胶囊：直接歌单（推荐）或 标签（选中后拉取歌单） */
interface ITagItem {
    key: string;
    label: string;
    /** 直接展示的歌单（推荐胶囊，来自 pinned 有封面项） */
    sheets?: IMusic.IMusicSheetItemBase[];
    /** 标签（pinned 无封面项 / groups 展开的标签） */
    tag?: ICommon.IUnique;
}

/**
 * 首页"推荐歌单"横滑区 - 对齐 APlayer HomePage：
 * 分类圆角胶囊 Tab（选中 primary 底白字，未选 surfaceVariant 底）+ 当前分类横滑歌单卡
 * 数据链路对齐官方协议：
 *   pinned 有封面项 → "推荐"胶囊直接展示（真实歌单，有封面）；
 *   pinned 无封面项 / groups 标签 → 标签胶囊，选中后调 getRecommendSheetsByTag 拉真实歌单（每日缓存）。
 * 点击歌单 → 插件歌单详情（getMusicSheetInfo，歌曲由插件自身解析播放）
 *
 * 标题行右端刷新按钮：点击打开"推荐歌单来源"三级浮窗（选择/恢复默认），
 * 应用后按新来源强制刷新数据（指定源强制拉取，失败自动回退择优）。
 */
/** 构建胶囊列表：pinned 有封面 → 推荐胶囊；pinned 标签 + groups 标签 → 标签胶囊（模块级纯函数，供首帧同步初始化与异步刷新共用） */
function buildTagListFromData(
    data: IPluginRecommendSheets,
    t: ReturnType<typeof useI18N>["t"],
): ITagItem[] {
    const pinned = data?.pinned ?? [];
    const directSheets = pinned.filter(isRealSheetItem);
    const pinnedTags = pinned.filter(item => !isRealSheetItem(item));
    const tags = pinnedTags.length
        ? pinnedTags
        : (data?.groups ?? []).flatMap(g => g?.data ?? []);
    const list: ITagItem[] = [];
    if (directSheets.length) {
        list.push({
            key: "recommend",
            label: t("recommendSheet.recommended"),
            sheets: directSheets,
        });
    }
    tags.forEach((item, index) => {
        list.push({
            key: `tag-${item.id ?? index}-${item.title ?? index}`,
            label: item.title ?? t("common.unknownName"),
            // 展开原始标签项：保留 digest 等插件自定义字段（念心等源 getRecommendSheetsByTag 依赖 digest 分支）
            tag: { ...item },
        });
    });
    return list;
}

export default function RecommendSection() {
    const navigate = useNavigate();
    const colors = useColors();
    const { t } = useI18N();
    // 订阅插件列表：冷启动首帧插件异步加载未完成时，
    // 插件就绪（列表从空变非空）会触发重渲染，用于补渲染推荐歌单
    const plugins = usePlugins();

    // 首帧同步读取当日缓存：有缓存立即渲染（MMKV 同步 API，零网络、零异步），
    // 修复"有缓存但首帧不显示、切 tab 才显示"；无缓存走下方异步 load 拉取
    const [initState] = useState<{
        tagList: ITagItem[];
        hash: string;
    } | null>(() => {
        const data = getCachedPluginRecommendSyncFirst();
        if (!data) {
            return null;
        }
        return {
            tagList: buildTagListFromData(data, t),
            hash: data.pluginHash,
        };
    });

    const [tagList, setTagList] = useState<ITagItem[]>(
        initState?.tagList ?? [],
    );
    const [selected, setSelected] = useState(0);
    const [feed, setFeed] = useState<IMusic.IMusicSheetItemBase[]>([]);
    const [loaded, setLoaded] = useState(!!initState);
    const [refreshing, setRefreshing] = useState(false);
    // 记录推荐歌单来自哪个插件，跳详情时携带 pluginHash
    const [pluginHash, setPluginHash] = useState<string | undefined>(
        initState?.hash,
    );

    /** 构建胶囊列表：pinned 有封面 → 推荐胶囊；pinned 标签 + groups 标签 → 标签胶囊 */
    const buildTagList = useCallback(
        (data: IPluginRecommendSheets): ITagItem[] =>
            buildTagListFromData(data, t),
        [t],
    );

    /** 切换胶囊：推荐直接展示；标签拉取（每日缓存）。异步完成时校验当前选中，避免覆盖用户已切换的胶囊 */
    const selectedTagRef = useRef<string>();
    const loadFeedForItem = useCallback(
        async (
            list: ITagItem[],
            index: number,
            hash?: string,
        ) => {
            const item = list[index];
            if (!item) {
                setFeed([]);
                return;
            }
            if (item.sheets) {
                setFeed(item.sheets);
                return;
            }
            if (item.tag && hash) {
                const tagId = item.tag.id ?? item.tag.title ?? "";
                selectedTagRef.current = tagId;
                const sheets = await getCachedRecommendSheetsByTag(
                    hash,
                    item.tag,
                );
                // 加载期间用户已切到其他胶囊 → 丢弃本次结果，避免覆盖
                if (selectedTagRef.current === tagId) {
                    setFeed(sheets ?? []);
                }
            } else {
                setFeed([]);
            }
        },
        [],
    );

    const selectItem = useCallback(
        (list: ITagItem[], index: number, hash?: string) => {
            setSelected(index);
            loadFeedForItem(list, index, hash);
        },
        [loadFeedForItem],
    );

    const applyFeed = useCallback(
        (data: IPluginRecommendSheets) => {
            setPluginHash(data.pluginHash);
            const list = buildTagList(data);
            setTagList(list);
            setSelected(0);
            // 首屏立即渲染胶囊（不阻塞）；首个标签歌单异步加载——修复"有缓存但首页不显示，切tab才显示"
            setLoaded(true);
            loadFeedForItem(list, 0, data.pluginHash);
        },
        [buildTagList, loadFeedForItem],
    );

    useEffect(() => {
        // 首帧同步缓存命中时：立即拉取首个胶囊的真实歌单（横滑卡）
        if (initState) {
            loadFeedForItem(initState.tagList, 0, initState.hash);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 根因修复（v2）：冷启动首帧插件列表为空 → 同步读缓存拿不到 → load() 排序列表也空 → 永不渲染。
    // 关键：load() 在插件就绪前失败会 setLoaded(true) 锁死状态 → 用 loaded 判断会漏补。
    // 改为以 tagList.length 为准：只要还没有内容，插件一旦就绪（0→N）就补——
    // 有当日缓存 → 同步渲染（插件列表非空后能真正读到缓存）；无缓存 → 异步 load。
    // 覆盖冷启动首次与二次打开（二次打开插件加载同样晚于首帧同步读）。
    useEffect(() => {
        if (tagList.length > 0) {
            return;
        }
        if (plugins.length > 0) {
            const data = getCachedPluginRecommendSyncFirst();
            if (data) {
                applyFeed(data);
            } else {
                load();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plugins.length, tagList.length]);

    const load = useCallback(async () => {
        const data: IPluginRecommendSheets | null =
            await getFirstAvailablePluginRecommend();
        if (data) {
            await applyFeed(data);
        } else {
            setLoaded(true);
        }
    }, [applyFeed]);

    useEffect(() => {
        load();
    }, [load]);

    /**
     * 来源应用后的强制刷新：
     * 指定了来源 → 绕过每日缓存强制拉取该源；失败提示并回退择优；
     * 未指定（自动择优）→ 走择优路径（当天缓存直接复用）。
     */
    const handleSourceApplied = useCallback(async () => {
        if (refreshing) {
            return;
        }
        setRefreshing(true);
        try {
            const manualHash = Config.getConfig("plugin.recommendSource");
            let data: IPluginRecommendSheets | null = null;
            if (manualHash) {
                data = await refreshCachedPluginRecommend(manualHash);
                if (!data) {
                    Toast.warn(t("recommendSheet.sourceUnavailable"));
                }
            }
            if (!data) {
                data = await getFirstAvailablePluginRecommend();
            }
            if (data) {
                await applyFeed(data);
                Toast.success(t("recommendSheet.sourceApplied"));
            }
        } finally {
            setRefreshing(false);
        }
    }, [refreshing, t, applyFeed]);

    /* 标题行右端刷新按钮：打开"推荐歌单来源"三级浮窗（确认/恢复默认后自动刷新） */
    const onRefresh = useCallback(() => {
        showDialog("RecommendSourceDialog", {
            onApplied: handleSourceApplied,
        });
    }, [handleSourceApplied]);

    if (!loaded || !tagList.length) {
        return null; // 无插件支持时整个模块隐藏（对齐 APlayer feedLoading/empty 处理）
    }

    const primary = colors.primary;
    const surfaceVariant = colors.surfaceVariant ?? colors.card;

    return (
        <View style={styles.container}>
            <View style={styles.sectionTitleRow}>
                <ThemeText
                    fontSize="content"
                    fontWeight="bold"
                    style={styles.sectionTitle}>
                    {t("home.recommendSheet")}
                </ThemeText>
                {refreshing ? (
                    <View style={styles.refreshLoading}>
                        <Loading showText={false} color={colors.textSecondary} />
                    </View>
                ) : (
                    <IconButton
                        name="refresh-cw"
                        sizeType="small"
                        color={colors.textSecondary}
                        onPress={onRefresh}
                    />
                )}
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tagRow}
                contentContainerStyle={styles.tagRowContent}>
                {tagList.map((item, index) => {
                    const isSelected = index === selected;
                    return (
                        <View
                            key={item.key}
                            style={[
                                styles.tag,
                                {
                                    backgroundColor: isSelected
                                        ? primary
                                        : surfaceVariant,
                                },
                            ]}>
                            <ThemeText
                                fontSize="body"
                                fontWeight={
                                    isSelected ? "bold" : "regular"
                                }
                                color={isSelected ? "#FFFFFF" : undefined}
                                fontColor={
                                    isSelected ? undefined : "textSecondary"
                                }
                                onPress={() => selectItem(tagList, index, pluginHash)}>
                                {item.label}
                            </ThemeText>
                        </View>
                    );
                })}
            </ScrollView>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardRow}>
                {feed.map(sheet => (
                    <PlaylistCard
                        key={`${sheet.platform}-${sheet.id}`}
                        title={sheet.title ?? ""}
                        artwork={sheet.coverImg ?? sheet.artwork}
                        playCount={sheet.playCount}
                        subtitle={sheet.artist}
                        onPress={() => {
                            navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, {
                                pluginHash,
                                sheetInfo: sheet,
                            });
                        }}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
        paddingHorizontal: 16,
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
        paddingRight: 4,
    },
    sectionTitle: {
        marginBottom: 0,
    },
    refreshLoading: {
        width: 24,
        height: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    tagRow: {
        flexGrow: 0,
        marginBottom: 8,
    },
    tagRowContent: {
        paddingRight: 16,
        columnGap: 8, // 对齐 APlayer Arrangement.spacedBy(8.dp)
    },
    /* 分类标签胶囊：全设备统一固定 dp，消除 rpx 在 600dp 临界的跳变 */
    tag: {
        height: 36,
        paddingHorizontal: 16,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },
    cardRow: {
        paddingRight: 16,
        columnGap: 12,
    },
});
