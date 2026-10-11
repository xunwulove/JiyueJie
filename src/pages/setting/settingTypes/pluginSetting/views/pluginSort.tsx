import AppBar from "@/components/base/appBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import SortableFlatList from "@/components/base/SortableFlatList";
import ThemeText from "@/components/base/themeText";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import PluginManager, { Plugin, useSortedPlugins } from "@/core/pluginManager";
import pluginReliability from "@/core/pluginReliability";
import { platformMatches } from "@/core/playMatcher";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import React, { useEffect, useMemo, useState } from "react";
import {
    FlatList,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

const ITEM_HEIGHT = 48;
// 拖拽基准：AppBar(56) + 排序方式行（chips 行约 56dp）+ 状态栏
const marginTop = rpx(112) + (StatusBar.currentHeight ?? 0);

/** 排序方式：手动 / 通用可用率 / 歌单可用率 / 按平台 */
type SortMode = "manual" | "reliability" | "recommend" | "platform";

/** 平台徽章（分组/标识用） */
function platformBadge(plugin: Plugin): { text: string; color: string } {
    const p = (plugin.instance.platform ?? "").toLowerCase();
    if (platformMatches(p, "网易云")) {
        return { text: "网易", color: "#C20C0C" };
    }
    if (platformMatches(p, "QQ音乐")) {
        return { text: "QQ", color: "#31C27C" };
    }
    if (p.includes("bilibili") || p.includes("哔哩")) {
        return { text: "B站", color: "#FB7299" };
    }
    return {
        text: (plugin.instance.platform ?? "其他").slice(0, 2),
        color: "#808080",
    };
}

export default function PluginSort() {
    const plugins = useSortedPlugins();
    const [sortingPlugins, setSortingPlugins] = useState([...plugins]);
    const [sortMode, setSortMode] = useState<SortMode>("manual");

    // 插件异步加载完成后同步到拖动列表（避免进入页面时 plugins 为空导致列表空白）
    useEffect(() => {
        if (!sortingPlugins.length && plugins.length) {
            setSortingPlugins([...plugins]);
        }
    }, [plugins]);

    const colors = useColors();
    const { t } = useI18N();

    /** 非手动模式的排序结果 */
    const sortedView = useMemo(() => {
        if (sortMode === "reliability") {
            // 通用可用率 高→低；暂无数据的源排最后
            return [...plugins].sort((a, b) => {
                const ra = pluginReliability.hasRecordSync(a.instance.platform)
                    ? pluginReliability.getReliabilitySync(a.instance.platform)
                    : -1;
                const rb = pluginReliability.hasRecordSync(b.instance.platform)
                    ? pluginReliability.getReliabilitySync(b.instance.platform)
                    : -1;
                return rb - ra;
            });
        }
        if (sortMode === "recommend") {
            // 歌单可用率 高→低；暂无数据的源排最后
            return [...plugins].sort((a, b) => {
                const ra = pluginReliability.hasRecommendRecordSync(
                    a.instance.platform,
                )
                    ? pluginReliability.getRecommendReliabilitySync(
                          a.instance.platform,
                      )
                    : -1;
                const rb = pluginReliability.hasRecommendRecordSync(
                    b.instance.platform,
                )
                    ? pluginReliability.getRecommendReliabilitySync(
                          b.instance.platform,
                      )
                    : -1;
                return rb - ra;
            });
        }
        if (sortMode === "platform") {
            const netease: Plugin[] = [];
            const qq: Plugin[] = [];
            const rest: Plugin[] = [];
            plugins.forEach(p => {
                const pl = p.instance.platform ?? "";
                if (platformMatches(pl, "网易云")) {
                    netease.push(p);
                } else if (platformMatches(pl, "QQ音乐")) {
                    qq.push(p);
                } else {
                    rest.push(p);
                }
            });
            return [...netease, ...qq, ...rest];
        }
        return sortingPlugins;
    }, [sortMode, plugins, sortingPlugins]);

    function renderItem({ item }: { item: Plugin }) {
        const badge = platformBadge(item);
        // 行右侧可用率跟随当前排序模式：歌单模式显示歌单可用率，其余显示通用可用率
        const hasData =
            sortMode === "recommend"
                ? pluginReliability.hasRecommendRecordSync(
                      item.instance.platform,
                  )
                : pluginReliability.hasRecordSync(item.instance.platform);
        const rel = hasData
            ? sortMode === "recommend"
                ? pluginReliability.getRecommendReliabilitySync(
                      item.instance.platform,
                  )
                : pluginReliability.getReliabilitySync(item.instance.platform)
            : null;
        const relText = rel === null ? "暂无数据" : `${Math.round(rel * 100)}%`;
        return (
            <View style={style.sortItem}>
                <View style={style.sortItemMain}>
                    <View style={[style.platformBadge, { backgroundColor: badge.color }]}>
                        <ThemeText
                            fontSize="caption"
                            fontWeight="bold"
                            style={style.platformBadgeText}>
                            {badge.text}
                        </ThemeText>
                    </View>
                    <ThemeText numberOfLines={1} style={style.sortItemName}>
                        {item.name}
                    </ThemeText>
                </View>
                <ThemeText fontSize="description" fontColor="textSecondary">
                    {relText}
                </ThemeText>
            </View>
        );
    }

    function saveOrder() {
        PluginManager.setPluginOrder(sortingPlugins);
        Toast.success(t("toast.saveSuccess"));
    }

    return (
        <>
            <AppBar
                actionComponent={
                    sortMode === "manual" ? (
                        <TouchableOpacity
                            style={style.doneButton}
                            onPress={saveOrder}>
                            <ThemeText fontWeight="bold">
                                {t("common.done")}
                            </ThemeText>
                        </TouchableOpacity>
                    ) : null
                }>
                {t("pluginSetting.menu.sort")}
            </AppBar>
            <HorizontalSafeAreaView style={style.modeRow}>
                {(
                    [
                        { key: "manual", label: "拖动排序" },
                        { key: "reliability", label: "通用可用率" },
                        { key: "recommend", label: "歌单可用率" },
                        { key: "platform", label: "按平台" },
                    ] as Array<{ key: SortMode; label: string }>
                ).map(mode => {
                    const active = sortMode === mode.key;
                    return (
                        <TouchableOpacity
                            key={mode.key}
                            style={[
                                style.modeChip,
                                active
                                    ? { backgroundColor: colors.primary }
                                    : { backgroundColor: colors.placeholder },
                            ]}
                            onPress={() => setSortMode(mode.key)}>
                            <ThemeText
                                fontSize="normal"
                                fontWeight={active ? "bold" : "regular"}
                                color={active ? "#FFFFFF" : undefined}>
                                {mode.label}
                            </ThemeText>
                        </TouchableOpacity>
                    );
                })}
            </HorizontalSafeAreaView>
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                {sortMode === "manual" ? (
                    <SortableFlatList
                        data={sortingPlugins}
                        activeBackgroundColor={colors.placeholder}
                        marginTop={marginTop}
                        renderItem={renderItem}
                        itemHeight={ITEM_HEIGHT}
                        itemJustifyContent={"space-between"}
                        onSortEnd={data => {
                            setSortingPlugins(data);
                        }}
                    />
                ) : (
                    <FlatList
                        data={sortedView}
                        keyExtractor={item => item.hash}
                        renderItem={renderItem}
                    />
                )}
            </HorizontalSafeAreaView>
        </>
    );
}

const style = StyleSheet.create({
    modeRow: {
        flexDirection: "row",
        gap: rpx(6),
        marginHorizontal: rpx(12),
        marginTop: rpx(24),
        marginBottom: rpx(8),
    },
    modeChip: {
        paddingHorizontal: rpx(8),
        paddingVertical: rpx(8),
        borderRadius: rpx(24),
    },
    doneButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    sortItem: {
        height: ITEM_HEIGHT,
        paddingLeft: rpx(24),
        paddingRight: rpx(24),
        flexDirection: "row",
        alignItems: "center",
        // 左对齐：徽章+名称在左，可用率在右（两端分布，铺满整行）
        justifyContent: "space-between",
    },
    sortItemMain: {
        flexDirection: "row",
        alignItems: "center",
        flexShrink: 1,
        gap: rpx(12),
    },
    platformBadge: {
        borderRadius: rpx(6),
        paddingHorizontal: rpx(8),
        paddingVertical: rpx(2),
    },
    platformBadgeText: {
        color: "#FFFFFF",
        fontSize: 11,
        includeFontPadding: false,
    },
    sortItemName: {
        flexShrink: 1,
    },
});
