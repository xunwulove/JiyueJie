import React, { useEffect, useState } from "react";

import useColors from "@/hooks/useColors";
import { Plugin } from "@/core/pluginManager";
import pluginReliability from "@/core/pluginReliability";
import probeService, { ProbeDim } from "@/core/probeService";

import { useI18N } from "@/core/i18n";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import ThemeText from "@/components/base/themeText";
import { View, StyleSheet } from "react-native";
import { ListDivider } from "@/components/base/divider";
import { fontSizeConst } from "@/constants/uiConst";

interface IPluginReliabilityDialogProps {
    plugin: Plugin;
}

/** 维度中文名（展示用） */
const DIM_LABELS: Record<ProbeDim, string> = {
    search: "搜索",
    parse: "解析",
    play: "播放",
    lyric: "歌词",
    sheet: "歌单",
};

/** 合成权重说明（对齐 pluginReliability 合成口径） */
const WEIGHT_NOTE =
    "合成可用率 = 播放60% + 解析30% + 搜索10%，缺失维度按比例归一化；歌词源显示歌词行、纯歌单源显示歌单行";

/** 时间戳格式化：今天 → HH:mm；今年 → M月d日；更早 → yyyy/M/d */
function formatProbeTime(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    if (sameDay) {
        return `${String(d.getHours()).padStart(2, "0")}:${String(
            d.getMinutes(),
        ).padStart(2, "0")}`;
    }
    if (d.getFullYear() === now.getFullYear()) {
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    }
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 音源可用率详情 - 三级浮窗（Dialog 版）。
 * 点击音源管理卡片可用率标签弹出。三类源差异化展示：
 * - 普通源：合成可用率大字 + 搜索/解析/播放（有歌词数据再加歌词）维度行
 * - 歌词源：歌词维度率大字 + 歌词行（歌词千寻类：不可搜索/解析）
 * - 纯歌单源：推荐歌单可用率大字 + 歌单行（只提供推荐歌单，不可搜索/解析）
 * 每行：名称 + 成功率进度条 + 成功/失败计数 + 百分比 + 最后探测时间；
 * 底部：推荐歌单区（有数据才显示）+ 权重注释。纯展示不改写。
 */
export default function PluginReliabilityDialog(
    props: IPluginReliabilityDialogProps,
) {
    const { plugin } = props ?? {};
    const { t } = useI18N();
    const colors = useColors();

    const platform = plugin.instance.platform;

    /** 通用分维度统计（search/parse/play/lyric；不含 sheet——sheet 走推荐歌单专用统计） */
    const [record, setRecord] = useState<
        Partial<Record<ProbeDim, { success: number; fail: number }>> | null
    >(null);
    /** 推荐歌单专用统计（sheet） */
    const [sheetRecord, setSheetRecord] = useState<{
        ok: number;
        fail: number;
        latency: number | null;
    } | null>(null);
    /** 各维度最后探测时间戳 */
    const [lastRuns, setLastRuns] = useState<
        Partial<Record<ProbeDim, number>> | null
    >(null);

    useEffect(() => {
        let alive = true;
        const refresh = () => {
            if (!alive) {
                return;
            }
            setRecord(pluginReliability.getRecordSync(platform));
            const sr = pluginReliability.getRecommendRecordSync(platform);
            setSheetRecord(
                sr
                    ? {
                        ok: sr.ok,
                        fail: sr.fail,
                        latency: pluginReliability.getRecommendLatencySync(
                            platform,
                        ),
                    }
                    : null,
            );
            setLastRuns(probeService.getLastProbeRuns(platform));
        };
        pluginReliability.getReliabilityRecord(platform).then(() => {
            refresh();
        });
        // 统计变更实时刷新：弹窗打开期间播放/探测写入统计，大字与明细同步更新
        const unsub = pluginReliability.subscribeReliability(refresh);
        return () => {
            alive = false;
            unsub();
        };
    }, [platform]);

    // 歌词源判定：能取歌词但不可搜索/解析（纯歌词插件）
    const isLyricSource =
        plugin.supportedMethods.has("getLyric") &&
        !plugin.supportedMethods.has("search") &&
        !plugin.supportedMethods.has("getMediaSource");
    // 纯歌单源判定：只提供推荐歌单，不可搜索/解析
    const isPureSheetSource =
        plugin.supportedMethods.has("getRecommendSheetTags") &&
        !plugin.supportedMethods.has("search") &&
        !plugin.supportedMethods.has("getMediaSource");

    /** 合成可用率（普通源） */
    const synthetic = record
        ? pluginReliability.getReliabilitySync(platform)
        : null;
    const syntheticColor = (rate: number | null) =>
        rate === null
            ? colors.textSecondary
            : rate >= 0.8
                ? "#4CAF50"
                : rate >= 0.5
                    ? colors.primary
                    : "#E53935";

    /** 单维度计数（无数据显示 null） */
    const dim = (key: ProbeDim) => {
        const d = record?.[key];
        return d && d.success + d.fail > 0 ? d : null;
    };

    /**
     * 顶部大字：普通源 = 合成可用率；歌词源 = 歌词维度率；纯歌单源 = 推荐歌单可用率。
     * 无数据 → "暂无数据"
     */
    let headlineRate: number | null = null;
    if (isLyricSource) {
        const lyricCount = dim("lyric");
        headlineRate =
            lyricCount !== null
                ? lyricCount.success / (lyricCount.success + lyricCount.fail)
                : null;
    } else if (isPureSheetSource) {
        headlineRate =
            sheetRecord !== null
                ? sheetRecord.ok / (sheetRecord.ok + sheetRecord.fail)
                : null;
    } else {
        headlineRate = synthetic;
    }
    const headlineLabel = isLyricSource
        ? t("pluginSetting.reliabilityDialog.lyric")
        : isPureSheetSource
            ? t("pluginSetting.reliabilityDialog.sheet")
            : t("pluginSetting.reliabilityDialog.synthetic");
    const headlineWeight = isLyricSource
        ? "歌词可用率（独立统计）"
        : isPureSheetSource
            ? "歌单可用率（推荐歌单）"
            : "播放60·解析30·搜索10";

    /** 展示的维度行：普通源 搜索/解析/播放（有歌词数据再加歌词）；歌词源 歌词；歌单源 歌单 */
    const visibleDims: Array<{ key: ProbeDim; count: { success: number; fail: number } | null }> =
        isLyricSource
            ? [{ key: "lyric", count: dim("lyric") }]
            : isPureSheetSource
                ? [
                    {
                        key: "sheet",
                        count: sheetRecord
                            ? {
                                success: sheetRecord.ok,
                                fail: sheetRecord.fail,
                            }
                            : null,
                    },
                ]
                : [
                    { key: "search", count: dim("search") },
                    { key: "parse", count: dim("parse") },
                    { key: "play", count: dim("play") },
                    ...(dim("lyric")
                        ? [{ key: "lyric" as ProbeDim, count: dim("lyric") }]
                        : []),
                    ...(sheetRecord
                        ? [
                            {
                                key: "sheet" as ProbeDim,
                                count: {
                                    success: sheetRecord.ok,
                                    fail: sheetRecord.fail,
                                },
                            },
                        ]
                        : []),
                ];

    const lastTimeOf = (key: ProbeDim) =>
        lastRuns && typeof lastRuns[key] === "number"
            ? formatProbeTime(lastRuns[key]!)
            : null;

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title stringContent>
                {plugin.name} · {t("pluginSetting.reliabilityDialog.title")}
            </Dialog.Title>
            <Dialog.Content
                needScroll
                style={{ paddingHorizontal: 0, paddingTop: 12, paddingBottom: 12 }}>
                {/* 顶部大字：合成/歌词/歌单可用率 */}
                <View style={styles.syntheticRow}>
                    <ThemeText
                        fontWeight="bold"
                        style={[
                            styles.syntheticValue,
                            { color: syntheticColor(headlineRate) },
                        ]}>
                        {headlineRate === null
                            ? t("pluginSetting.reliabilityDialog.noData")
                            : `${Math.round(headlineRate * 100)}%`}
                    </ThemeText>
                    <ThemeText
                        fontSize="content"
                        fontColor="textSecondary"
                        style={styles.syntheticLabel}>
                        {headlineLabel}
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.syntheticWeight}>
                        {headlineWeight}
                    </ThemeText>
                </View>
                <ListDivider marginLeft={0} />

                {/* 维度明细行 */}
                {visibleDims.map((d, i) => {
                    const count = d.count;
                    const rate = count
                        ? count.success / (count.success + count.fail)
                        : null;
                    const rateColor =
                        rate === null
                            ? colors.textSecondary
                            : rate >= 0.8
                                ? "#4CAF50"
                                : rate >= 0.5
                                    ? colors.primary
                                    : "#E53935";
                    const barColor =
                        rate === null
                            ? colors.divider ?? "#EEF1F4"
                            : rate >= 0.8
                                ? "#4CAF50"
                                : colors.primary;
                    const last = lastTimeOf(d.key);
                    return (
                        <View key={d.key}>
                            <View style={styles.dimRow}>
                                <ThemeText
                                    fontSize="content"
                                    style={styles.dimLabel}>
                                    {DIM_LABELS[d.key]}
                                </ThemeText>
                                {/* 成功率进度条 */}
                                <View style={styles.dimBarTrack}>
                                    <View
                                        style={[
                                            styles.dimBarFill,
                                            {
                                                width: `${
                                                    rate === null
                                                        ? 0
                                                        : Math.round(
                                                            rate * 100,
                                                        )
                                                }%`,
                                                backgroundColor: barColor,
                                            },
                                        ]}
                                    />
                                </View>
                                {count ? (
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary"
                                        numberOfLines={1}
                                        style={styles.dimCount}>
                                        成功{count.success} · 失败{count.fail}
                                    </ThemeText>
                                ) : (
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary"
                                        style={styles.dimCount}>
                                        {t(
                                            "pluginSetting.reliabilityDialog.noData",
                                        )}
                                    </ThemeText>
                                )}
                                <ThemeText
                                    fontSize="content"
                                    fontWeight="bold"
                                    style={[
                                        styles.dimRate,
                                        { color: rateColor },
                                    ]}>
                                    {rate === null
                                        ? "--"
                                        : `${Math.round(rate * 100)}%`}
                                </ThemeText>
                            </View>
                            {last ? (
                                <View style={styles.dimLastRow}>
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary">
                                        最后探测：{last}
                                    </ThemeText>
                                </View>
                            ) : null}
                            {i < visibleDims.length - 1 ? (
                                <ListDivider marginLeft={0} />
                            ) : null}
                        </View>
                    );
                })}

                {/* 权重注释 */}
                <View style={styles.noteBox}>
                    <ThemeText fontSize="description" fontColor="textSecondary">
                        {WEIGHT_NOTE}
                    </ThemeText>
                </View>
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.done"),
                        type: "normal",
                        onPress: hideDialog,
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    syntheticRow: {
        flexDirection: "row",
        alignItems: "baseline",
        paddingVertical: 6,
        paddingHorizontal: 24,
    },
    syntheticValue: {
        fontSize: 34,
        includeFontPadding: false,
    },
    syntheticLabel: {
        marginLeft: 10,
    },
    syntheticWeight: {
        marginLeft: "auto",
        fontSize: fontSizeConst.description,
    },
    dimRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 8,
    },
    dimLabel: {
        width: 48,
        flexShrink: 0,
    },
    dimBarTrack: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#EEF1F4",
        overflow: "hidden",
    },
    dimBarFill: {
        height: "100%",
        borderRadius: 3,
    },
    dimCount: {
        marginLeft: 10,
        maxWidth: "36%",
    },
    dimRate: {
        width: 42,
        textAlign: "right",
        marginLeft: 8,
        flexShrink: 0,
    },
    dimLastRow: {
        paddingHorizontal: 24,
        paddingBottom: 6,
    },
    noteBox: {
        marginTop: 10,
        marginHorizontal: 24,
    },
});
