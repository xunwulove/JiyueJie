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

interface ICategorySheets {
    category: string;
    sheets: IMusic.IMusicSheetItemBase[];
}

/**
 * 首页"推荐歌单"横滑区 - 对齐 APlayer HomePage：
 * 分类圆角胶囊 Tab（选中 primary 底白字，未选 surfaceVariant 底）+ 当前分类横滑歌单卡
 * 数据：插件推荐歌单（getRecommendSheetTags，首选支持该能力的插件）
 * 点击歌单 → 插件歌单详情（getMusicSheetInfo，歌曲由插件自身解析播放）
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

    const load = useCallback(async () => {
        const data: IPluginRecommendSheets | null =
            await getFirstAvailablePluginRecommend();
        if (data) {
            setPluginHash(data.pluginHash);
            const categories: ICategorySheets[] = [
                ...(data.pinned?.length
                    ? [{ category: "推荐", sheets: data.pinned }]
                    : []),
                ...(data.groups ?? []).map(g => ({
                    category: g.title ?? "",
                    sheets: g.data,
                })),
            ];
            setFeed(categories);
        }
        setLoaded(true);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    /* 标题行右端刷新按钮：绕过每日缓存强制拉取当前插件数据 */
    const onRefresh = useCallback(async () => {
        if (refreshing || !pluginHash) {
            return;
        }
        setRefreshing(true);
        try {
            const data = await refreshCachedPluginRecommend(pluginHash);
            if (data) {
                const categories: ICategorySheets[] = [
                    ...(data.pinned?.length
                        ? [{ category: "推荐", sheets: data.pinned }]
                        : []),
                    ...(data.groups ?? []).map(g => ({
                        category: g.title ?? "",
                        sheets: g.data,
                    })),
                ];
                setFeed(categories);
                setSelected(0);
                Toast.success("推荐歌单已刷新");
            } else {
                Toast.warn("刷新失败，请稍后重试");
            }
        } finally {
            setRefreshing(false);
        }
    }, [refreshing, pluginHash]);

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
                            key={`tag-${item.category}`}
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
