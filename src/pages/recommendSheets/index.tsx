import AppBar from "@/components/base/appBar";
import StatusBar from "@/components/base/statusBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import MusicBar from "@/components/musicBar";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { TabBar, TabView } from "react-native-tab-view";
import PluginManager from "@/core/pluginManager";
import { fontWeightConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import NoPlugin from "@/components/base/noPlugin";
import rpx, { vw } from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Image from "@/components/base/image";
import { ImgAsset } from "@/constants/assetsConst";
import PlaylistCard from "@/components/mediaItem/playlistCard";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import {
    IPluginRecommendSheets,
    getCachedPluginRecommend,
    fetchRecommendSheetsByTag,
    isRealSheetItem,
} from "@/core/pluginRecommend";
import useOrientation from "@/hooks/useOrientation";
import ListEmpty from "@/components/base/listEmpty";
import { RequestStateCode } from "@/constants/commonConst";
import Color from "color";
import LinearGradient from "react-native-linear-gradient";
import { getRecommendReliabilitySync } from "@/core/pluginReliability";
import Toast from "@/utils/toast";
import Config from "@/core/appConfig";
import { showPanel, hidePanel } from "@/components/panels/usePanel";

/**
 * 推荐歌单二级页（插件版）
 * 数据链路 = MusicFree 官方"推荐歌单"：
 * 插件 getRecommendSheetTags → pinned + 分组歌单 → 点击进插件歌单详情（getMusicSheetInfo，可直接播放）
 * 每个具备该能力的已启用插件一个 Tab。
 *
 * 择优：Tab 按"推荐歌单专用可用率"降序排列（无数据 0.5 排后），
 * 默认停靠可用率最高的源；当前 Tab 加载失败/空壳 → 自动切换下一个源。
 * 手动指定来源（plugin.recommendSource，与首页刷新按钮同键）时该源置顶。
 */
export default function RecommendSheets() {
    const { t } = useI18N();
    const manualHash = Config.getConfig("plugin.recommendSource");
    const routes = PluginManager.getSortedPluginsWithAbility(
        "getRecommendSheetTags",
    )
        .slice()
        .sort((a, b) => {
            // 手动指定源置顶（该源优先展示；失败时仍走 handleAutoSwitch 自动切换）
            if (manualHash) {
                if (a.hash === manualHash) {
                    return -1;
                }
                if (b.hash === manualHash) {
                    return 1;
                }
            }
            return (
                getRecommendReliabilitySync(b.instance.platform) -
                getRecommendReliabilitySync(a.instance.platform)
            );
        })
        .map(_ => ({
            key: _.hash,
            title: _.name,
        }));
    const [index, setIndex] = useState(0);
    const colors = useColors();

    /** 当前 Tab 加载失败 → 自动切到下一个可用率次高的源 */
    const handleAutoSwitch = useCallback(() => {
        setIndex(prev => {
            if (prev + 1 < routes.length) {
                Toast.warn("该音源推荐歌单不可用，已切换到下一个音源");
                return prev + 1;
            }
            return prev;
        });
    }, [routes.length]);

    const renderScene = useCallback(
        ({ route }: { route: { key: string } }) => (
            <RecommendPanel
                hash={route.key}
                onAutoSwitch={handleAutoSwitch}
            />
        ),
        [handleAutoSwitch],
    );

    if (!routes?.length) {
        return (
            <VerticalSafeAreaView style={globalStyle.fwflex1}>
                <StatusBar />
                <AppBar>{t("recommendSheet.title")}</AppBar>
                <NoPlugin notSupportType={t("recommendSheet.title")} />
                <MusicBar />
            </VerticalSafeAreaView>
        );
    }

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar>{t("recommendSheet.title")}</AppBar>
            <TabView
                lazy
                navigationState={{ index, routes }}
                renderTabBar={p => (
                    <TabBar
                        {...p}
                        style={styles.tabBarStyle}
                        tabStyle={styles.tabStyle}
                        scrollEnabled
                        pressColor="transparent"
                        inactiveColor={colors.text}
                        activeColor={colors.primary}
                        renderLabel={({ route, focused, color }) => (
                            <Text
                                numberOfLines={1}
                                style={{
                                    width: 120,
                                    fontWeight: focused
                                        ? fontWeightConst.bolder
                                        : fontWeightConst.medium,
                                    color,
                                    textAlign: "center",
                                }}>
                                {route.title}
                            </Text>
                        )}
                        indicatorStyle={{
                            backgroundColor: colors.primary,
                            height: rpx(4),
                        }}
                    />
                )}
                renderScene={renderScene}
                onIndexChange={setIndex}
                initialLayout={{ width: vw(100) }}
            />
            <MusicBar />
        </VerticalSafeAreaView>
    );
}

/* ---------------- 单个插件面板 ---------------- */

interface IRecommendPanelProps {
    hash: string;
    /** 加载失败/空壳时由父组件自动切换下一个源 */
    onAutoSwitch?: () => void;
}

/** 默认标签（"默认"胶囊 → 打开更多标签面板；也作为无 pinned 时的兜底） */
const DEFAULT_TAG: ICommon.IUnique = { title: "", id: "" };

function RecommendPanel({ hash, onAutoSwitch }: IRecommendPanelProps) {
    const navigate = useNavigate();
    const { t } = useI18N();

    /** getRecommendSheetTags 结果（pinned = 固定标签/推荐歌单，groups = 更多标签分组） */
    const [tagsData, setTagsData] = useState<IPluginRecommendSheets | null>(null);
    const [state, setState] = useState(RequestStateCode.PENDING_FIRST_PAGE);

    /** 当前选中标签 */
    const [selectedTag, setSelectedTag] = useState<ICommon.IUnique>(DEFAULT_TAG);
    /** 标签下已加载的歌单 */
    const [sheets, setSheets] = useState<IMusic.IMusicSheetItemBase[]>([]);
    const [sheetsState, setSheetsState] = useState(RequestStateCode.IDLE);
    const pageRef = useRef(0);
    const isEndRef = useRef(false);
    const currentTagIdRef = useRef("");

    /* -------- 标签源加载 -------- */
    const load = useCallback(async () => {
        setState(RequestStateCode.PENDING_FIRST_PAGE);
        const result = await getCachedPluginRecommend(hash);
        if (!result) {
            setState(RequestStateCode.ERROR);
            onAutoSwitch?.();
            return;
        }
        setTagsData(result);
        setState(RequestStateCode.FINISHED);
        // 默认选中第一个标签（pinned 无封面项即标签；pinned 为空则默认标签）
        const firstTag = (result.pinned ?? []).find(
            item => !isRealSheetItem(item),
        );
        if (firstTag) {
            selectTag({ id: firstTag.id, title: firstTag.title });
        } else {
            selectTag(DEFAULT_TAG);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hash, onAutoSwitch]);

    useEffect(() => {
        load();
    }, [load]);

    /* -------- 标签 → 歌单加载（getRecommendSheetsByTag） -------- */
    const selectTag = useCallback(
        async (tag: ICommon.IUnique) => {
            setSelectedTag(tag);
            const tagId = tag?.id ?? tag?.title ?? "";
            if (tagId === currentTagIdRef.current && pageRef.current > 0) {
                return;
            }
            currentTagIdRef.current = tagId;
            pageRef.current = 0;
            isEndRef.current = false;
            setSheets([]);
            setSheetsState(RequestStateCode.PENDING_FIRST_PAGE);
            await appendPage(tag, true);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const appendPage = useCallback(
        async (tag: ICommon.IUnique, reset: boolean) => {
            if (isEndRef.current && !reset) {
                return;
            }
            const nextPage = reset ? 1 : pageRef.current + 1;
            const res = await fetchRecommendSheetsByTag(hash, tag, nextPage);
            if (res && res.data?.length) {
                pageRef.current = nextPage;
                isEndRef.current = !!res.isEnd;
                setSheets(prev =>
                    reset
                        ? (res.data ?? [])
                        : [...prev, ...(res.data ?? [])],
                );
                setSheetsState(
                    res.isEnd
                        ? RequestStateCode.FINISHED
                        : RequestStateCode.PARTLY_DONE,
                );
            } else if (reset) {
                // 首屏标签歌单拉取失败/空 → 展示可重试空态（不切源：标签失败不代表插件整体不可用）
                setSheetsState(RequestStateCode.ERROR);
            }
        },
        [hash],
    );

    /* -------- 更多标签面板（groups → SheetTags） -------- */
    const openMoreTags = useCallback(() => {
        showPanel("SheetTags", {
            tags: tagsData?.groups ?? [],
            onTagPressed: (tag: ICommon.IUnique) => {
                selectTag(tag);
                hidePanel();
            },
        });
    }, [tagsData, selectTag]);

    /* -------- 分页加载（ScrollView 滚动接近底部） -------- */
    const onScroll = useCallback(
        (e: any) => {
            const { layoutMeasurement, contentOffset, contentSize } =
                e.nativeEvent;
            if (
                contentSize.height -
                    layoutMeasurement.height -
                    contentOffset.y <
                200
            ) {
                appendPage(selectedTag, false);
            }
        },
        [appendPage, selectedTag],
    );

    if (state !== RequestStateCode.FINISHED) {
        return <ListEmpty state={state} onRetry={load} />;
    }

    // pinned 里有封面的项 = 真实推荐歌单（直接展示横滑卡；官方协议下 pinned 为标签，兼容部分插件直接返回歌单）
    const recommendSheets = (tagsData?.pinned ?? []).filter(isRealSheetItem);
    // 标签列表 = pinned 无封面项（即标签）+ 默认入口
    const tagList = (tagsData?.pinned ?? []).filter(item => !isRealSheetItem(item));

    return (
        <ScrollView
            contentContainerStyle={styles.panelContent}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}>
            {recommendSheets.length ? (
                <View style={styles.block}>
                    <GroupTitle title={t("recommendSheet.recommended")} />
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.cardRow}>
                        {recommendSheets.map(sheet => (
                            <PlaylistCard
                                key={`${sheet.platform}-${sheet.id}`}
                                title={sheet.title ?? ""}
                                artwork={sheet.coverImg ?? sheet.artwork}
                                playCount={sheet.playCount}
                                subtitle={sheet.artist}
                                onPress={() =>
                                    navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, {
                                        pluginHash: hash,
                                        sheetInfo: sheet,
                                    })
                                }
                            />
                        ))}
                    </ScrollView>
                </View>
            ) : null}

            {/* 标签 Tab：默认（更多标签面板）+ pinned 标签 */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagRow}>
                <TagCapsule
                    title={t("recommendSheet.allTags")}
                    selected={!selectedTag?.id}
                    onPress={openMoreTags}
                />
                {tagList.map(item => (
                    <TagCapsule
                        key={`tag-${item.id}-${item.title}`}
                        title={item.title ?? ""}
                        selected={selectedTag?.id === item.id}
                        onPress={() =>
                            selectTag({ id: item.id, title: item.title })
                        }
                    />
                ))}
            </ScrollView>

            {/* 标签下的歌单网格 */}
            <View style={styles.gridWrap}>
                <SheetGrid
                    sheets={sheets}
                    state={sheetsState}
                    pluginHash={hash}
                    onRetry={() => selectTag(selectedTag)}
                    onLoadMore={() => appendPage(selectedTag, false)}
                />
            </View>
        </ScrollView>
    );
}

/** 标签胶囊（对齐 APlayer 分类胶囊：选中 primary 底白字） */
function TagCapsule({
    title,
    selected,
    onPress,
}: {
    title: string;
    selected: boolean;
    onPress: () => void;
}) {
    const colors = useColors();
    const primary = colors.primary;
    const surfaceVariant = colors.surfaceVariant ?? colors.card;
    return (
        <View
            style={[
                styles.tagCapsule,
                { backgroundColor: selected ? primary : surfaceVariant },
            ]}>
            <ThemeText
                fontSize="body"
                fontWeight={selected ? "bold" : "regular"}
                color={selected ? "#FFFFFF" : undefined}
                fontColor={selected ? undefined : "textSecondary"}
                onPress={onPress}>
                {title}
            </ThemeText>
        </View>
    );
}

function GroupTitle({ title }: { title: string }) {
    return (
        <ThemeText
            fontSize="content"
            fontWeight="bold"
            style={styles.groupTitle}>
            {title}
        </ThemeText>
    );
}

/** 分组歌单网格（对齐 apiSheets 网格规范：竖屏3列 / 横屏4列） */
function SheetGrid({
    sheets,
    state,
    pluginHash,
    onRetry,
}: {
    sheets: IMusic.IMusicSheetItemBase[];
    state: RequestStateCode;
    pluginHash: string;
    onRetry: () => void;
    onLoadMore: () => void;
}) {
    const orientation = useOrientation();
    const columns = orientation === "vertical" ? 3 : 4;

    if (!sheets.length && state !== RequestStateCode.PENDING_FIRST_PAGE) {
        return <ListEmpty state={state} onRetry={onRetry} />;
    }

    return (
        <View style={styles.grid}>
            {sheets.map((sheet, index) => (
                <View
                    key={`${sheet.platform}-${sheet.id}-${index}`}
                    style={{ width: `${100 / columns}%` }}>
                    <SheetGridCard sheet={sheet} pluginHash={pluginHash} />
                </View>
            ))}
        </View>
    );
}

function SheetGridCard({
    sheet,
    pluginHash,
}: {
    sheet: IMusic.IMusicSheetItemBase;
    pluginHash?: string;
}) {
    const colors = useColors();
    const navigate = useNavigate();
    const goSheetDetail = (item: IMusic.IMusicSheetItemBase) =>
        navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, {
            pluginHash,
            sheetInfo: item,
        });

    return (
        <Pressable
            style={({ pressed }) => [
                styles.gridCard,
                pressed ? { opacity: 0.7 } : null,
            ]}
            onPress={() => goSheetDetail(sheet)}>
            {sheet.coverImg ?? sheet.artwork ? (
                <Image
                    style={styles.gridCover}
                    uri={sheet.coverImg ?? sheet.artwork}
                    emptySrc={ImgAsset.albumDefault}
                />
            ) : (
                <LinearGradient
                    colors={[
                        colors.primary,
                        Color(colors.primary).alpha(0.35).toString(),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gridCover}
                />
            )}
            <ThemeText
                fontSize="normal"
                fontWeight="medium"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.gridTitle}>
                {sheet.title ?? "未知"}
            </ThemeText>
            <ThemeText
                fontSize="caption"
                fontColor="textSecondary"
                numberOfLines={1}
                ellipsizeMode="tail">
                {sheet.worksNum ? `${sheet.worksNum} 首` : ""}
            </ThemeText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    tabBarStyle: {
        backgroundColor: "transparent",
        shadowColor: "transparent",
        borderColor: "transparent",
    },
    tabStyle: {
        width: "auto",
    },
    panelContent: {
        paddingTop: rpx(24),
        paddingBottom: rpx(48),
    },
    block: {
        marginBottom: rpx(28),
    },
    groupTitle: {
        marginBottom: rpx(14),
        paddingHorizontal: rpx(24),
    },
    cardRow: {
        paddingHorizontal: rpx(24),
        columnGap: rpx(24),
    },
    tagRow: {
        paddingHorizontal: rpx(24),
        columnGap: rpx(12),
        marginBottom: rpx(24),
    },
    tagCapsule: {
        height: 54,
        paddingHorizontal: 24,
        borderRadius: 27,
        alignItems: "center",
        justifyContent: "center",
    },
    gridWrap: {
        paddingBottom: rpx(24),
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: rpx(24),
        rowGap: rpx(24),
    },
    gridCard: {
        paddingHorizontal: rpx(8),
    },
    gridCover: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 14,
    },
    gridTitle: {
        marginTop: 6,
    },
});
