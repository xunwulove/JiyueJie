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

const ITEM_HEIGHT = rpx(96);
const marginTop = rpx(188) + (StatusBar.currentHeight ?? 0);

/** 排序方式 */
type SortMode = "manual" | "reliability" | "platform";

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
            return [...plugins].sort(
                (a, b) =>
                    pluginReliability.getReliabilitySync(
                        b.instance.platform,
                    ) -
                    pluginReliability.getReliabilitySync(
                        a.instance.platform,
                    ),
            );
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
        const rel = pluginReliability.getReliabilitySync(
            item.instance.platform,
        );
        const relText =
            rel === pluginReliability.RELIABILITY_DEFAULT
                ? "暂无数据"
                : `${Math.round(rel * 100)}%`;
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
            <AppBar>{t("pluginSetting.menu.sort")}</AppBar>
            <HorizontalSafeAreaView style={style.sortWrapper}>
                <>
                    <ThemeText fontWeight="bold">{t("pluginSetting.menu.sort")}</ThemeText>
                    {sortMode === "manual" ? (
                        <TouchableOpacity onPress={saveOrder}>
                            <ThemeText>{t("common.done")}</ThemeText>
                        </TouchableOpacity>
                    ) : (
                        <View />
                    )}
                </>
            </HorizontalSafeAreaView>
            <HorizontalSafeAreaView style={style.modeRow}>
                {(
                    [
                        { key: "manual", label: "拖动排序" },
                        { key: "reliability", label: "按可用率" },
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
    sortWrapper: {
        marginHorizontal: rpx(24),
        marginTop: rpx(36),
        justifyContent: "space-between",
        height: rpx(64),
        alignItems: "center",
        flexDirection: "row",
    },
    modeRow: {
        flexDirection: "row",
        gap: rpx(16),
        marginHorizontal: rpx(24),
        marginTop: rpx(8),
        marginBottom: rpx(8),
    },
    modeChip: {
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(8),
        borderRadius: rpx(24),
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
