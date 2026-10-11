import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import PlaylistCard from "@/components/mediaItem/playlistCard";
import IconButton from "@/components/base/iconButton";
import Loading from "@/components/base/loading";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import {
    IPluginRecommendSheets,
    getFirstAvailablePluginRecommend,
    refreshCachedPluginRecommend,
} from "@/core/pluginRecommend";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import { useI18N } from "@/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";
import Config from "@/core/appConfig";

interface ICategorySheets {
    category: string;
    sheets: IMusic.IMusicSheetItemBase[];
}

/** 将某插件的推荐歌单结构平铺为 首页分类胶囊 Tab + 横滑歌单卡 */
function toCategories(data: IPluginRecommendSheets): ICategorySheets[] {
    return [
        ...(data.pinned?.length
            ? [{ category: "推荐", sheets: data.pinned }]
            : []),
        ...(data.groups ?? []).map(g => ({
            category: g.title ?? "",
            sheets: g.data,
        })),
    ];
}

/**
 * 首页"推荐歌单"横滑区 - 对齐 APlayer HomePage：
 * 分类圆角胶囊 Tab（选中 primary 底白字，未选 surfaceVariant 底）+ 当前分类横滑歌单卡
 * 数据：插件推荐歌单（getRecommendSheetTags；手动指定源优先，失败回退可用率择优）
 * 点击歌单 → 插件歌单详情（getMusicSheetInfo，歌曲由插件自身解析播放）
 *
 * 标题行右端刷新按钮：点击打开"推荐歌单来源"三级浮窗（选择/恢复默认），
 * 应用后按新来源强制刷新数据（指定源强制拉取，失败自动回退择优）。
 */
export default function RecommendSection() {
    const navigate = useNavigate();
    const colors = useColors();
    const { t } = useI18N();

    const [feed, setFeed] = useState<ICategorySheets[]>([]);
    const [selected, setSelected] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    // 与原版一致：记录推荐歌单来自哪个插件，跳详情时携带 pluginHash
    const [pluginHash, setPluginHash] = useState<string>();

    const applyFeed = useCallback((data: IPluginRecommendSheets) => {
        setPluginHash(data.pluginHash);
        setFeed(toCategories(data));
        setSelected(0);
    }, []);

    const load = useCallback(async () => {
        const data: IPluginRecommendSheets | null =
            await getFirstAvailablePluginRecommend();
        if (data) {
            applyFeed(data);
        }
        setLoaded(true);
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
                applyFeed(data);
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

    if (!loaded || !feed.length) {
        return null; // 无插件支持时整个模块隐藏（对齐 APlayer feedLoading/empty 处理）
    }

    const current = feed[selected] ?? feed[0];
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
                        name="arrow-path"
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
                {feed.map((item, index) => {
                    const isSelected = index === selected;
                    return (
                        <View
                            key={`tag-${index}-${item.category}`}
                            style={[
                                styles.tag,
                                {
                                    backgroundColor: isSelected
                                        ? primary
                                        : surfaceVariant,
                                },
                            ]}>
                            <ThemeText
                                fontSize="caption"
                                fontWeight={
                                    isSelected ? "bold" : "regular"
                                }
                                color={isSelected ? "#FFFFFF" : undefined}
                                fontColor={
                                    isSelected ? undefined : "textSecondary"
                                }
                                onPress={() => setSelected(index)}>
                                {item.category}
                            </ThemeText>
                        </View>
                    );
                })}
            </ScrollView>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardRow}>
                {current.sheets.map(sheet => (
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
    tag: {
        borderRadius: 16, // 对齐 APlayer RoundedCornerShape(16.dp)
        paddingHorizontal: 14,
        paddingVertical: 6,
        marginRight: 8,
    },
    cardRow: {
        paddingRight: 16,
        columnGap: 12,
    },
});
