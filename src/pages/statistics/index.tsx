import AppBar from "@/components/base/appBar";
import ThemeText from "@/components/base/themeText";
import { useMusicHistory } from "@/core/musicHistory";
import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
import { normalizeDurationSec } from "@/utils/durationUtil";
import Color from "color";
import React, { useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import LinearGradient from "react-native-linear-gradient";
import StatusBar from "@/components/base/statusBar";
import Icon from "@/components/base/icon.tsx";

/** 统计页 - 对齐 APlayer StatisticsPage：
 * 顶栏"听歌统计"18sp Bold；维度 chips（今日/本周/今年 13sp，选中 primary α0.12 底）；
 * 2 张总览渐变卡（图标块 46 圆角14 图标26 白、value 22 Bold、label 14、subtitle 10 α0.7、min110 圆角18、平板右下水印52）；
 * 平板左 50% 排行（BarChart 18 primary + "最常听 TOP10" 15 Bold；32dp 圆块前3 primary 底白字、歌名14 Medium、副行12、右侧时长12）
 * 右 50% 日历卡（surfaceVariant 底圆角14 padding12、标题13 Bold、右侧/表头/格子 10sp、色阶 0→surfaceVariant α0.5 / 1-2→primary0.25 / 3-5→0.5 / 6-9→0.75 / ≥10→1）；手机：日历全宽在上、排行在下 */

type Period = "DAY" | "WEEK" | "YEAR";
const PERIODS: Array<{ key: Period; label: string }> = [
    { key: "DAY", label: "今日" },
    { key: "WEEK", label: "本周" },
    { key: "YEAR", label: "今年" },
];

/** 维度起点：今日0点 / 本周一0点 / 今年1月1日0点（对齐 APlayer periodStart） */
function periodStartMs(period: Period): number | null {
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === "DAY") return day.getTime();
    if (period === "WEEK") {
        const dow = (day.getDay() + 6) % 7; // 周一=0
        return day.getTime() - dow * 86400000;
    }
    if (period === "YEAR") return new Date(now.getFullYear(), 0, 1).getTime();
    return null;
}

/** 秒 → "0 分钟" / "x 分钟" / "x小时x分钟"（MusicFree IMusicItem.duration 单位为秒） */
function formatTotalTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    if (minutes <= 0) return "0 分钟";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}小时${mins}分钟` : `${mins} 分钟`;
}

/* 平板"TOP N 动态齐平"基准尺寸：
 * rankHeader ≈ 18 图标行高 22 + marginBottom 6 = 28
 * rankRow = rankBox 32 + paddingVertical 6×2 = 44 */
const RANK_HEADER_H = 28;
const RANK_ROW_H = 44;

export default function Statistics() {
    const colors = useColors();
    const history = useMusicHistory();
    const isTablet = useIsTablet();

    const [period, setPeriod] = useState<Period>("DAY");
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    /* 日历卡片实测高度（平板：决定 TOP N 条数，使左右底端齐平） */
    const [calendarHeight, setCalendarHeight] = useState(0);

    /* 平板 TOP N：按日历自然高度可容纳的整行数推导（clamp 3~10）；手机固定 10 */
    const topCount = useMemo(() => {
        if (!isTablet || calendarHeight <= 0) return 10;
        const n = Math.floor((calendarHeight - RANK_HEADER_H) / RANK_ROW_H);
        return Math.max(3, Math.min(10, n));
    }, [isTablet, calendarHeight]);

    /* 维度过滤 + 排行（对齐 APlayer：按播放次数倒序；平板显示动态 TOP N，手机满 10）
     * 累计时长 = 该时段全部播放歌曲时长（不再只算前 N 首，数值更完整） */
    const { ranked, totalMs, uniqueCount, periodLabel } = useMemo(() => {
        const fromMs = periodStartMs(period);
        const filtered = (history ?? []).filter(
            it =>
                !fromMs ||
                ((it as { playedAt?: number }).playedAt ?? 0) >= fromMs,
        );
        const countMap = new Map<
            string,
            { music: IMusic.IMusicItem; count: number }
        >();
        for (const item of filtered) {
            const key = `${item.platform}-${item.id}`;
            const prev = countMap.get(key);
            if (prev) {
                prev.count += 1;
            } else {
                countMap.set(key, { music: item, count: 1 });
            }
        }
        const ranked = Array.from(countMap.values()).sort(
            (a, b) => b.count - a.count,
        );
        const totalMs = ranked.reduce(
            (acc, it) =>
                acc +
                it.count * normalizeDurationSec(it.music.duration),
            0,
        );
        const label =
            PERIODS.find(p => p.key === period)?.label ?? "今日";
        return { ranked, totalMs, uniqueCount: countMap.size, periodLabel: label };
    }, [history, period]);

    const shown = ranked.slice(0, topCount);

    /* ===== 本月播放日历热力图（对齐 APlayer CalendarCard） ===== */
    const now = useMemo(() => new Date(), []);
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dailyCounts = useMemo(() => {
        const counts = new Array<number>(daysInMonth).fill(0);
        const monthStart = new Date(year, month, 1).getTime();
        const nextMonthStart = new Date(year, month + 1, 1).getTime();
        for (const item of history ?? []) {
            const ts = (item as { playedAt?: number }).playedAt;
            if (ts && ts >= monthStart && ts < nextMonthStart) {
                const day = new Date(ts).getDate();
                if (day >= 1 && day <= daysInMonth) {
                    counts[day - 1]++;
                }
            }
        }
        return counts;
    }, [history, daysInMonth, year, month]);

    const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7; // 周一=0
    const calendarRows = Math.ceil((leadingBlanks + daysInMonth) / 7);

    /** 色阶：0→surfaceVariant α0.5；1-2→primary α0.25；3-5→α0.5；6-9→α0.75；≥10→primary（对齐 APlayer） */
    const dayColor = (count: number) => {
        const surfaceVariant = colors.surfaceVariant ?? colors.card;
        if (count <= 0) return Color(surfaceVariant).alpha(0.5).toString();
        if (count <= 2) return Color(colors.primary).alpha(0.25).toString();
        if (count <= 5) return Color(colors.primary).alpha(0.5).toString();
        if (count <= 9) return Color(colors.primary).alpha(0.75).toString();
        return colors.primary;
    };

    const gradientColors = [
        Color(colors.primary).alpha(0.14).toString(),
        Color(colors.primary).alpha(0.03).toString(),
    ];

    /* 排行区（左 50% / 手机全宽；平板行弹性均分填满，与日历底端齐平） */
    const rankSection = (
        <>
            {/* RankHeader：BarChart 18 primary + 标题 15sp Bold */}
            <View style={styles.rankHeader}>
                <Icon
                    name="circle-stack"
                    size={18}
                    color={colors.primary}
                />
                <ThemeText
                    fontSize="body"
                    fontWeight="bold"
                    style={styles.rankHeaderText}>
                    {ranked.length
                        ? `最常听 TOP${topCount}`
                        : "最常听"}
                </ThemeText>
            </View>
            {ranked.length === 0 ? (
                <ThemeText
                    fontSize={isTablet ? "description" : "normal"}
                    fontColor="textSecondary"
                    style={styles.rankEmpty}>
                    该时段还没有播放记录，去听几首歌吧
                </ThemeText>
            ) : (
                shown.map((item, index) => (
                    <View
                        key={`${item.music.platform}-${item.music.id}`}
                        style={[
                            styles.rankRow,
                            isTablet ? styles.rankRowTablet : null,
                        ]}>
                        {/* 排名圆块：32dp 圆，前 3 primary 底白字 14sp Bold */}
                        <View
                            style={[
                                styles.rankBox,
                                {
                                    backgroundColor:
                                        index < 3
                                            ? colors.primary
                                            : colors.surfaceVariant ??
                                              colors.card,
                                },
                            ]}>
                            <ThemeText
                                fontSize="subTitle"
                                fontWeight="bold"
                                color={
                                    index < 3
                                        ? "#FFFFFF"
                                        : colors.textSecondary
                                }>
                                {index + 1}
                            </ThemeText>
                        </View>
                        <View style={styles.rankInfo}>
                            <ThemeText
                                fontSize="body"
                                fontWeight="medium"
                                numberOfLines={1}>
                                {item.music.title ?? "未知歌曲"}
                            </ThemeText>
                            <ThemeText
                                fontSize="description"
                                fontColor="textSecondary"
                                numberOfLines={1}>
                                {item.music.artist ?? ""} · 播放 {item.count} 次
                            </ThemeText>
                        </View>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary">
                            {formatTotalTime(
                                item.count * normalizeDurationSec(item.music.duration),
                            )}
                        </ThemeText>
                    </View>
                ))
            )}
        </>
    );

    /* 本月播放日历卡（对齐 APlayer CalendarCard；平板不拉伸、按内容自然高，onLayout 实测高度驱动 TOP N） */
    const calendarCard = (
        <View
            style={[
                styles.calendarCard,
                {
                    backgroundColor:
                        colors.surfaceVariant ?? colors.card,
                },
            ]}
            onLayout={e => {
                const h = e.nativeEvent.layout.height;
                if (h > 0 && h !== calendarHeight) {
                    setCalendarHeight(h);
                }
            }}>
            <View style={styles.calHeader}>
                <ThemeText
                    fontSize="normal"
                    fontWeight="bold"
                    fontColor="text">
                    本月播放日历
                </ThemeText>
                <ThemeText
                    fontSize="tag"
                    fontColor="textSecondary"
                    numberOfLines={1}
                    style={styles.calHeaderRight}>
                    {selectedDay != null &&
                    selectedDay >= 1 &&
                    selectedDay <= daysInMonth &&
                    dailyCounts[selectedDay - 1] > 0
                        ? `${selectedDay}日 · ${dailyCounts[selectedDay - 1]} 次`
                        : "点日期"}
                </ThemeText>
            </View>
            <View style={styles.calWeekRow}>
                {["一", "二", "三", "四", "五", "六", "日"].map(w => (
                    <ThemeText
                        key={w}
                        fontSize="tag"
                        fontColor="textSecondary"
                        style={styles.calWeekCell}
                        opacity={0.6}>
                        {w}
                    </ThemeText>
                ))}
            </View>
            {Array.from({ length: calendarRows }).map((_, r) => (
                <View key={r} style={styles.calGridRow}>
                    {Array.from({ length: 7 }).map((_, c) => {
                        const day = r * 7 + c - leadingBlanks + 1;
                        if (day < 1 || day > daysInMonth) {
                            return (
                                <View
                                    key={`${r}-${c}`}
                                    style={styles.calCell}
                                />
                            );
                        }
                        const count = dailyCounts[day - 1];
                        const isSelected = selectedDay === day;
                        return (
                            <Pressable
                                key={`${r}-${c}`}
                                style={[
                                    styles.calCell,
                                    { backgroundColor: dayColor(count) },
                                    isSelected
                                        ? {
                                              backgroundColor: colors.primary,
                                          }
                                        : null,
                                ]}
                                onPress={() =>
                                    setSelectedDay(
                                        selectedDay === day ? null : day,
                                    )
                                }>
                                <ThemeText
                                    fontSize="tag"
                                    fontWeight={
                                        count > 0 || isSelected
                                            ? "bold"
                                            : "regular"
                                    }
                                    color={
                                        count > 0 || isSelected
                                            ? "#FFFFFF"
                                            : undefined
                                    }
                                    fontColor={
                                        count > 0 || isSelected
                                            ? undefined
                                            : "textSecondary"
                                    }
                                    opacity={
                                        count > 0 || isSelected ? 1 : 0.5
                                    }>
                                    {day}
                                </ThemeText>
                            </Pressable>
                        );
                    })}
                </View>
            ))}
        </View>
    );

    /* 总览渐变卡（对齐 APlayer StatOverviewCard：min110 圆角18、图标块46圆角14图标26白、平板右下水印52） */
    const overviewCard = (
        iconName: "clock-outline" | "musical-note",
        value: string,
        label: string,
        subtitle: string,
    ) => (
        <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 220, y: 260 }}
            style={styles.overviewCard}>
            {isTablet ? (
                <Icon
                    name={iconName}
                    size={52}
                    color={Color("#808080").alpha(0.35).toString()}
                    style={styles.overviewWatermark}
                />
            ) : null}
            <View style={styles.overviewRow}>
                <LinearGradient
                    colors={[colors.primary, Color(colors.primary).alpha(0.75).toString()]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.overviewIconBox}>
                    <Icon name={iconName} size={26} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.overviewText}>
                    <ThemeText
                        fontSize="large"
                        fontWeight="bold"
                        numberOfLines={1}>
                        {value}
                    </ThemeText>
                    <ThemeText
                        fontSize="subTitle"
                        fontColor="textSecondary"
                        numberOfLines={1}>
                        {label}
                    </ThemeText>
                    <ThemeText
                        fontSize="tag"
                        fontColor="textSecondary"
                        opacity={0.7}
                        numberOfLines={1}>
                        {subtitle}
                    </ThemeText>
                </View>
            </View>
        </LinearGradient>
    );

    // 2026-10-14 修复：改 VerticalSafeAreaView（平板只保 bottom），与其他二级页标题栏高度一致
    return (
        <VerticalSafeAreaView style={styles.wrapper}>
            <StatusBar />
            <AppBar>
                <ThemeText fontSize="title" fontWeight="bold">
                    听歌统计
                </ThemeText>
            </AppBar>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                {/* 维度切换 chips（对齐 APlayer FilterChip：13sp、选中 primary α0.12 底 primary 字） */}
                <View style={styles.chipRow}>
                    {PERIODS.map(p => {
                        const selected = period === p.key;
                        return (
                            <Pressable
                                key={p.key}
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: selected
                                            ? Color(colors.primary)
                                                  .alpha(0.12)
                                                  .toString()
                                            : colors.surfaceVariant ??
                                              colors.card,
                                    },
                                ]}
                                onPress={() => {
                                    setPeriod(p.key);
                                    setSelectedDay(null);
                                }}>
                                <ThemeText
                                    fontSize="normal"
                                    fontWeight={selected ? "bold" : "regular"}
                                    color={
                                        selected ? colors.primary : undefined
                                    }
                                    fontColor={
                                        selected ? undefined : "textSecondary"
                                    }>
                                    {p.label}
                                </ThemeText>
                            </Pressable>
                        );
                    })}
                </View>

                {/* 总览 2 卡（对齐 APlayer spacedBy(10)） */}
                <View style={styles.overviewRowWrap}>
                    {overviewCard(
                        "clock-outline",
                        formatTotalTime(totalMs),
                        "累计听歌时长",
                        "按完整播放估算",
                    )}
                    {overviewCard(
                        "musical-note",
                        `${uniqueCount}`,
                        "播放过歌曲",
                        `${periodLabel}播放`,
                    )}
                </View>

                {isTablet ? (
                    /* 平板：排行（左50%，弹性均分填满）+ 日历（右50%，自然高）并排，底部齐平 */
                    <View style={styles.splitRow}>
                        <View style={styles.rankColumn}>
                            {rankSection}
                        </View>
                        <View style={styles.splitCol}>{calendarCard}</View>
                    </View>
                ) : (
                    /* 手机：日历全宽在上、排行全宽在下 */
                    <>
                        {calendarCard}
                        <View style={styles.mobileRankWrap}>{rankSection}</View>
                    </>
                )}
            </ScrollView>
        </VerticalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        width: "100%",
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    chipRow: {
        flexDirection: "row",
        columnGap: 8,
        marginBottom: 10,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
    },
    overviewRowWrap: {
        flexDirection: "row",
        columnGap: 10,
        marginBottom: 10,
    },
    overviewCard: {
        flex: 1,
        minHeight: 110,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 12,
        justifyContent: "center",
        overflow: "hidden",
    },
    overviewWatermark: {
        position: "absolute",
        right: 8,
        bottom: 6,
    },
    overviewRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    overviewIconBox: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    overviewText: {
        flex: 1,
    },
    splitRow: {
        flexDirection: "row",
        columnGap: 10,
        alignItems: "stretch",
    },
    splitCol: {
        flex: 1,
        minWidth: 0,
    },
    /* 平板：排行列撑满容器（= 日历自然高），行弹性均分 */
    rankColumn: {
        flex: 1,
        minWidth: 0,
    },
    rankHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },
    rankHeaderText: {
        marginLeft: 6,
    },
    rankEmpty: {
        textAlign: "center",
        paddingVertical: 24,
    },
    rankRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
    },
    /* 平板：行均分剩余高度，与日历底端精确齐平（min/max 兜底：
     * 行数不足 TOP N 时单行最高 60，避免 2~3 行撑满整列行距过大） */
    rankRowTablet: {
        flex: 1,
        minHeight: 40,
        maxHeight: 60,
    },
    rankBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    rankInfo: {
        flex: 1,
        marginRight: 12,
    },
    calendarCard: {
        borderRadius: 14,
        padding: 12,
    },
    calHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    calHeaderRight: {
        marginLeft: 8,
    },
    calWeekRow: {
        flexDirection: "row",
        marginTop: 8,
    },
    calWeekCell: {
        flex: 1,
        textAlign: "center",
    },
    calGridRow: {
        flexDirection: "row",
        gap: 3,
        marginTop: 3,
    },
    calCell: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: 5,
        alignItems: "center",
        justifyContent: "center",
    },
    mobileRankWrap: {
        marginTop: 4,
    },
});
