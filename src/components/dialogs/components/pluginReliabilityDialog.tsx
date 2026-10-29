import React, { useEffect, useState } from "react";

import useColors from "@/hooks/useColors";
import { Plugin } from "@/core/pluginManager";
import pluginReliability from "@/core/pluginReliability";
import probeService, {
    ProbeDim,
    ProbeLastRuns,
} from "@/core/probeService";

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

/** 合成权重说明（对齐 pluginReliability 合成口径），逐点分段展示 */
const WEIGHT_NOTE_LINES = [
    "合成可用率 = 播放60% + 解析30% + 搜索10%，缺失维度按比例归一化",
    "歌词源显示歌词行、纯歌单源显示歌单行",
    "平均耗时 = 各维度探测单次耗时均值",
];

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
    /** 各维度最后探测时间戳 + 探测耗时 */
    const [lastRuns, setLastRuns] = useState<ProbeLastRuns | null>(null);

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
     * 顶部大字：能力强弱决定口径（合成/歌词/歌单可用率取最高，样本保护见
     * getBestDimensionSync）；无数据 → "暂无数据"。
     */
    const best = pluginReliability.getBestDimensionSync(platform);
    const headlineRate: number | null = best.rate;
    const headlineLabel =
        best.type === "lyric"
            ? t("pluginSetting.reliabilityDialog.lyric")
            : best.type === "sheet"
                ? t("pluginSetting.reliabilityDialog.sheet")
                : t("pluginSetting.reliabilityDialog.synthetic");

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

    /** 最近探测时间：探测时间全维度同轮一致，取任一有值的维度展示（统一一行） */
    const probeTime = (() => {
        if (!lastRuns) {
            return null;
        }
        const order: ProbeDim[] = ["search", "parse", "play", "lyric", "sheet"];
        for (const k of order) {
            const ts = lastRuns[k];
            if (typeof ts === "number") {
                return formatProbeTime(ts);
            }
        }
        return null;
    })();

    /** 维度平均耗时（s 字符串）：优先本轮探测耗时 dimMs；歌单兜底推荐歌单累计均值 */
    const dimLatency = (key: ProbeDim): string | null => {
        const ms = lastRuns?.dimMs?.[key];
        if (typeof ms === "number") {
            return `${(ms / 1000).toFixed(1)}s`;
        }
        if (key === "sheet" && sheetRecord?.latency != null) {
            // sheetRecord.latency 来自 getRecommendLatencySync，单位为毫秒
            return `${(sheetRecord.latency / 1000).toFixed(1)}s`;
        }
        return null;
    };

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
                </View>
                {/* 最近探测：探测时间全维度同轮一致，统一一行展示，不再逐行重复 */}
                {probeTime ? (
                    <View style={styles.probeTimeRow}>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.probeTimeText}>
                            最近探测：{probeTime}
                        </ThemeText>
                    </View>
                ) : null}
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
                    const latency = dimLatency(d.key);
                    return (
                        <View key={d.key}>
                            {/* 第一行：名称 + 进度条 + 百分比 */}
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
                            {/* 第二行：12/15 · 平均耗时，靠右显示、文本左对齐 */}
                            <View style={styles.dimMetaRow}>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="textSecondary"
                                    numberOfLines={1}
                                    style={styles.dimMetaText}>
                                    {count ? (
                                        `${count.success}/${count.success +
                                            count.fail}`
                                    ) : (
                                        t(
                                            "pluginSetting.reliabilityDialog.noData",
                                        )
                                    )}
                                    {latency ? ` · 平均 ${latency}` : ""}
                                </ThemeText>
                            </View>
                            {i < visibleDims.length - 1 ? (
                                <ListDivider marginLeft={0} />
                            ) : null}
                        </View>
                    );
                })}

                {/* 权重说明：合成口径 + 各类型源展示口径，逐点分段 */}
                <View style={styles.noteBox}>
                    {WEIGHT_NOTE_LINES.map(line => (
                        <ThemeText
                            key={line}
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.noteLine}>
                            · {line}
                        </ThemeText>
                    ))}
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
    dimRate: {
        width: 42,
        textAlign: "right",
        marginLeft: 8,
        flexShrink: 0,
    },
    /** 第二行元信息：12/15 · 平均耗时，靠右显示、文本左对齐 */
    dimMetaRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        paddingHorizontal: 24,
        paddingBottom: 8,
        paddingTop: 2,
    },
    dimMetaText: {
        textAlign: "left",
    },
    probeTimeRow: {
        paddingHorizontal: 24,
        paddingTop: 2,
        paddingBottom: 10,
    },
    probeTimeText: {
        fontSize: fontSizeConst.description,
    },
    noteBox: {
        marginTop: 10,
        marginHorizontal: 24,
    },
    noteLine: {
        lineHeight: 18,
    },
});
