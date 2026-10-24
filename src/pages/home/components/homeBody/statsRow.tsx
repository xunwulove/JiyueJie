import Icon, { IIconName } from "@/components/base/icon.tsx";
import ThemeText from "@/components/base/themeText";
import { usePlayEvents } from "@/core/playEvents";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
import Color from "color";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";

/**
 * 首页统计三卡 - 复刻 APlayer TabletStatCard / PhoneStatCard：
 * 平板：左 50dp 渐变图标块 + 右大数字 22sp Bold/小标签 14sp（min 高 110dp、右下灰水印）
 * 手机：竖排（32dp 图标块 + 18sp 数字 + 11sp 标签，圆角 16，无水印）
 * 数据：今日 = playedAt >= 今日 0 点；最常听 = playCount 最大
 */
export default function StatsRow() {
    const navigate = useNavigate();
    const isTablet = useIsTablet();

    const playEvents = usePlayEvents();

    const stats = useMemo(() => {
        const today0 = new Date();
        today0.setHours(0, 0, 0, 0);
        const todayTs = today0.getTime();

        // 三卡与统计页完全同源（播放事件流）同口径（短播<30s 不入流）：
        // 今日听歌 = 今日事件真实收听秒数 Σ → 分钟；今日播放 = 今日事件数；
        // 最常听 = 全时段按 key 聚合事件次数取 top1 —— 修复原先首页用 musicHistory
        // （歌曲标称时长、含短播）导致与统计页数字不符
        const todayEvents = (playEvents ?? []).filter(
            e => (e.ts ?? 0) >= todayTs,
        );
        const totalSeconds = todayEvents.reduce(
            (sum, e) => sum + (e.listenedSec ?? 0),
            0,
        );
        const minutes = Math.floor(totalSeconds / 60);

        // 最常听：全时段按 key 聚合事件次数取 top1
        const countMap = new Map<
            string,
            { title?: string; count: number }
        >();
        for (const e of playEvents ?? []) {
            const rec = countMap.get(e.key) ?? {
                title: e.title,
                count: 0,
            };
            rec.count += 1;
            countMap.set(e.key, rec);
        }
        const mostPlayed = Array.from(countMap.values()).sort(
            (a, b) => b.count - a.count,
        )[0];

        return {
            todayMinutes: minutes,
            todayPlays: todayEvents.length,
            mostPlayed: mostPlayed?.title ?? "--",
            mostPlayedCount: mostPlayed?.count ?? 0,
        };
    }, [playEvents]);

    const formatDuration = (min: number) => {
        if (min <= 0) {
            return "0 分钟";
        }
        if (min < 60) {
            return `${min} 分钟`;
        }
        const h = Math.floor(min / 60);
        const m = min % 60;
        return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
    };

    const cards: Array<{
        icon: IIconName;
        label: string;
        value: string;
        color: string;
        /** 点卡进入统计页的初始时段：今日两卡 → 今日；最常听 → 全部（口径与卡片一致） */
        initialPeriod: "DAY" | "ALL";
    }> = [
        {
            icon: "clock-outline",
            label: "今日听歌",
            value: formatDuration(stats.todayMinutes),
            color: "#2F6FED",
            initialPeriod: "DAY",
        },
        {
            icon: "play-circle-outline",
            label: "今日播放",
            value: `${stats.todayPlays} 次`,
            color: "#2F6FED",
            initialPeriod: "DAY",
        },
        {
            icon: "fire",
            label:
                stats.mostPlayedCount > 0
                    ? `最常听 · ${stats.mostPlayedCount} 次`
                    : "最常听",
            value: stats.mostPlayed,
            color: "#2F6FED",
            initialPeriod: "ALL",
        },
    ];

    const primary = useColors().primary;

    return (
        <View style={styles.row}>
            {cards.map(card => (
                <Pressable
                    key={card.label}
                    style={({ pressed }) => [
                        styles.card,
                        { flex: 1 },
                        pressed
                            ? {
                                backgroundColor: Color(primary)
                                    .alpha(0.06)
                                    .toString(),
                            }
                            : null,
                    ]}
                    onPress={() =>
                        navigate(ROUTE_PATH.STATISTICS, {
                            period: card.initialPeriod,
                        })
                    }>
                    <LinearGradient
                        colors={[
                            Color(primary).alpha(0.14).toString(),
                            Color(primary).alpha(0.03).toString(),
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.cardBg,
                            isTablet ? styles.cardBgTablet : styles.cardBgPhone,
                        ]}>
                        {isTablet ? (
                            <Icon
                                name={card.icon}
                                size={52}
                                color={Color("#808080")
                                    .alpha(0.35)
                                    .toString()}
                                style={styles.watermark}
                            />
                        ) : null}
                        {isTablet ? (
                            <View style={styles.rowInner}>
                                <LinearGradient
                                    colors={[
                                        primary,
                                        Color(primary).alpha(0.75).toString(),
                                    ]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.iconBoxTablet}>
                                    <Icon
                                        name={card.icon}
                                        size={46}
                                        color="#FFFFFF"
                                    />
                                </LinearGradient>
                                <View style={styles.textCol}>
                                    <ThemeText
                                        fontSize="large"
                                        fontWeight="bold"
                                        numberOfLines={1}
                                        ellipsizeMode="tail">
                                        {card.value}
                                    </ThemeText>
                                    <ThemeText
                                        fontSize="subTitle"
                                        fontColor="textSecondary">
                                        {card.label}
                                    </ThemeText>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.colInner}>
                                <LinearGradient
                                    colors={[
                                        primary,
                                        Color(primary).alpha(0.75).toString(),
                                    ]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.iconBoxPhone}>
                                    <Icon
                                        name={card.icon}
                                        size={17}
                                        color="#FFFFFF"
                                    />
                                </LinearGradient>
                                <ThemeText
                                    fontSize="title"
                                    fontWeight="bold"
                                    numberOfLines={2}
                                    ellipsizeMode="tail"
                                    style={styles.valuePhone}>
                                    {card.value}
                                </ThemeText>
                                <ThemeText
                                    fontSize="caption"
                                    fontColor="textSecondary">
                                    {card.label}
                                </ThemeText>
                            </View>
                        )}
                    </LinearGradient>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        marginTop: 20,
        columnGap: 10,
    },
    card: {
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 20,
    },
    cardBg: {
        borderRadius: 18,
        justifyContent: "center",
    },
    cardBgTablet: {
        minHeight: 110, // 对齐 APlayer 110dp
        paddingVertical: 14,
        paddingHorizontal: 12,
    },
    cardBgPhone: {
        minHeight: 96,
        paddingVertical: 13,
        paddingHorizontal: 10,
        alignItems: "center",
        borderRadius: 16, // 对齐 APlayer 手机 16dp 圆角
    },
    rowInner: {
        flexDirection: "row",
        alignItems: "center",
    },
    colInner: {
        alignItems: "center",
    },
    iconBoxTablet: {
        width: 50,
        height: 50,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    iconBoxPhone: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    textCol: {
        flex: 1,
    },
    valuePhone: {
        marginTop: 2,
    },
    watermark: {
        position: "absolute",
        right: 8,
        bottom: 6,
    },
});
