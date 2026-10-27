import { ROUTE_PATH, useNavigate } from "@/core/router";
import React from "react";
import {
    Pressable,
    StyleSheet,
    View,
} from "react-native";
import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import ThemeText from "@/components/base/themeText";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import MusicSheet from "@/core/musicSheet";
import {
    getCachedRecommendSheetsByTag,
    getFirstAvailablePluginRecommend,
} from "@/core/pluginRecommend";

/** 首页金刚区入口卡（复刻 APlayer EntryCard：渐变底 + 左渐变图标块 + 右文字 + 平板右下水印）
 *  对齐旧项目 4 入口：每日推荐/排行榜/我的喜欢/最近播放（旧图标 Today/LocalFireDepartment/Favorite/History；
 *  每日推荐用 calendar-days（Today 语义）、排行榜用 trophy、我的喜欢 heart、最近播放 clock-outline） */
export default function Operations() {
    const navigate = useNavigate();
    const colors = useColors();
    const isTablet = useIsTablet();

    const primary = colors.primary;

    const actionButtons: Array<{
        iconName: IIconName;
        title: string;
        action: () => void;
    }> = [
        {
            iconName: "calendar-days",
            title: "每日推荐",
            action() {
                // 对齐官方两级结构：getRecommendSheetTags 返回的是"标签"（无封面、不可直接解析歌单），
                // 真实歌单需调 getRecommendSheetsByTag 获取（带封面 artwork、可解析播放）。
                // 每日推荐 = 随机抽一个标签 → 拉真实歌单 → 随机抽一首歌单进入详情（封面可显示、可播放）。
                getFirstAvailablePluginRecommend().then(async data => {
                    const pluginHash = data?.pluginHash;
                    if (!data || !pluginHash) {
                        // 数据不可用 → 兜底进推荐歌单页
                        navigate(ROUTE_PATH.RECOMMEND_SHEETS);
                        return;
                    }
                    const tags = (data.groups ?? [])
                        .flatMap(g => g?.data ?? [])
                        .filter(Boolean);
                    if (tags.length) {
                        const tag =
                            tags[Math.floor(Math.random() * tags.length)];
                        const sheets = await getCachedRecommendSheetsByTag(
                            pluginHash,
                            tag,
                        );
                        if (sheets?.length) {
                            const picked =
                                sheets[
                                    Math.floor(Math.random() * sheets.length)
                                ];
                            navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, {
                                sheetInfo: picked,
                                pluginHash,
                            });
                            return;
                        }
                    }
                    // 兜底 1：pinned 中有封面的真实歌单项
                    const withCover = (data.pinned ?? []).filter(
                        it => it?.artwork || it?.coverImg,
                    );
                    if (withCover.length) {
                        navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, {
                            sheetInfo:
                                withCover[
                                    Math.floor(
                                        Math.random() * withCover.length,
                                    )
                                ],
                            pluginHash,
                        });
                        return;
                    }
                    // 兜底 2：推荐歌单页
                    navigate(ROUTE_PATH.RECOMMEND_SHEETS);
                });
            },
        },
        {
            iconName: "trophy",
            title: "排行榜单",
            action() {
                navigate(ROUTE_PATH.TOP_LIST);
            },
        },
        {
            iconName: "heart",
            title: "我的喜欢",
            action() {
                navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, {
                    id: MusicSheet.defaultSheet.id,
                });
            },
        },
        {
            iconName: "clock-outline",
            title: "最近播放",
            action() {
                navigate(ROUTE_PATH.HISTORY);
            },
        },
    ];

    return (
        <View
            style={[
                styles.container,
                isTablet ? styles.containerTablet : null,
            ]}>
            {actionButtons.map(action => (
                <Pressable
                    key={action.title}
                    style={({ pressed }) => [
                        styles.card,
                        {
                            backgroundColor: pressed
                                ? Color(primary).alpha(0.06).toString()
                                : "transparent",
                            // 平板 4 卡等宽均分占满一行（对齐 APlayer weight(1f)）；手机两行两列
                            flex: isTablet ? 1 : undefined,
                            width: isTablet ? undefined : "48%",
                            borderRadius: isTablet ? 18 : 16, // 对齐 APlayer 手机 16dp 圆角
                        },
                    ]}
                    onPress={action.action}>
                    <LinearGradient
                        colors={[
                            Color(primary).alpha(0.14).toString(),
                            Color(primary).alpha(0.03).toString(),
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.cardBg,
                            isTablet ? styles.cardBgTablet : null,
                            {
                                borderColor: Color(
                                    (colors as any).divider ?? "#E2E8F0",
                                )
                                    .alpha(0.35)
                                    .toString(),
                            },
                        ]}>
                        {isTablet ? (
                            <Icon
                                name={action.iconName}
                                size={34}
                                color={Color("#808080")
                                    .alpha(0.35)
                                    .toString()}
                                style={styles.watermark}
                            />
                        ) : null}
                        <View style={styles.cardRow}>
                            <LinearGradient
                                colors={[
                                    primary,
                                    Color(primary).alpha(0.75).toString(),
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.iconBox}>
                                <Icon
                                    name={action.iconName}
                                    size={38}
                                    color="#FFFFFF"
                                />
                            </LinearGradient>
                            <ThemeText
                                fontSize="title"
                                fontWeight="bold"
                                style={styles.cardText}>
                                {action.title}
                            </ThemeText>
                        </View>
                    </LinearGradient>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        marginVertical: 20,
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: 10, // 对齐 APlayer Arrangement.spacedBy(10.dp)
        rowGap: 10,
    },
    containerTablet: {
        flexWrap: "nowrap",
    },
    card: {
        borderRadius: 18,
        overflow: "hidden",
    },
    cardBg: {
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 16,
        minHeight: 84, // 4 卡纵横比方案：手机 84（横长条 ≈2:1）
        justifyContent: "center",
        borderWidth: 0.5, // 椒盐细边框（outline α0.35，颜色动态随主题）
    },
    cardBgTablet: {
        minHeight: 96, // 平板 96
    },
    cardRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconBox: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    cardText: {
        flex: 1,
    },
    watermark: {
        position: "absolute",
        right: 8,
        bottom: 6,
    },
});
