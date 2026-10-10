import AppBar from "@/components/base/appBar";
import StatusBar from "@/components/base/statusBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import MusicBar from "@/components/musicBar";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import React, { useCallback, useEffect, useState } from "react";
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
} from "@/core/pluginRecommend";
import useOrientation from "@/hooks/useOrientation";
import ListEmpty from "@/components/base/listEmpty";
import { RequestStateCode } from "@/constants/commonConst";
import Color from "color";
import LinearGradient from "react-native-linear-gradient";

/**
 * 推荐歌单二级页（插件版）
 * 数据链路 = MusicFree 官方"推荐歌单"：
 * 插件 getRecommendSheetTags → pinned + 分组歌单 → 点击进插件歌单详情（getMusicSheetInfo，可直接播放）
 * 每个具备该能力的已启用插件一个 Tab（按用户排序）。
 */
export default function RecommendSheets() {
    const { t } = useI18N();
    const routes = PluginManager.getSortedPluginsWithAbility(
        "getRecommendSheetTags",
    ).map(_ => ({
        key: _.hash,
        title: _.name,
    }));
    const [index, setIndex] = useState(0);
    const colors = useColors();

    const renderScene = useCallback(
        ({ route }: { route: { key: string } }) => (
            <RecommendPanel hash={route.key} />
        ),
        [],
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
                                    width: rpx(160),
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

function RecommendPanel({ hash }: { hash: string }) {
    const navigate = useNavigate();
    const [data, setData] = useState<IPluginRecommendSheets | null>(null);
    const [state, setState] = useState(RequestStateCode.PENDING_FIRST_PAGE);

    const load = useCallback(async () => {
        setState(RequestStateCode.PENDING_FIRST_PAGE);
        const result = await getCachedPluginRecommend(hash);
        setData(result);
        setState(
            result ? RequestStateCode.FINISHED : RequestStateCode.ERROR,
        );
    }, [hash]);

    useEffect(() => {
        load();
    }, [load]);

    const goSheetDetail = (sheet: IMusic.IMusicSheetItemBase) =>
        navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, { pluginHash: hash, sheetInfo: sheet });

    if (!data) {
        return <ListEmpty state={state} onRetry={load} />;
    }

    return (
        <ScrollView
            contentContainerStyle={styles.panelContent}
            showsVerticalScrollIndicator={false}>
            {data.pinned?.length ? (
                <View style={styles.block}>
                    <GroupTitle title="推荐" />
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.cardRow}>
                        {data.pinned.map(sheet => (
                            <PlaylistCard
                                key={`${sheet.platform}-${sheet.id}`}
                                title={sheet.title ?? ""}
                                artwork={sheet.coverImg ?? sheet.artwork}
                                playCount={sheet.playCount}
                                subtitle={sheet.artist}
                                onPress={() =>
                                    goSheetDetail(sheet)
                                }
                            />
                        ))}
                    </ScrollView>
                </View>
            ) : null}
            {(data.groups ?? []).map(group => (
                <View key={`group-${group.title}`} style={styles.block}>
                    <GroupTitle title={group.title ?? ""} />
                    <SheetGrid sheets={group.data ?? []} />
                </View>
            ))}
        </ScrollView>
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
function SheetGrid({ sheets }: { sheets: IMusic.IMusicSheetItemBase[] }) {
    const orientation = useOrientation();
    const columns = orientation === "vertical" ? 3 : 4;
    return (
        <View style={styles.grid}>
            {sheets.map((sheet, index) => (
                <View
                    key={`${sheet.platform}-${sheet.id}-${index}`}
                    style={{ width: `${100 / columns}%` }}>
                    <SheetGridCard sheet={sheet} />
                </View>
            ))}
        </View>
    );
}

function SheetGridCard({ sheet }: { sheet: IMusic.IMusicSheetItemBase }) {
    const colors = useColors();
    const navigate = useNavigate();
    const goSheetDetail = (item: IMusic.IMusicSheetItemBase) =>
        navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, { sheetInfo: item });

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
        borderRadius: 12,
    },
    gridTitle: {
        marginTop: 6,
    },
});
