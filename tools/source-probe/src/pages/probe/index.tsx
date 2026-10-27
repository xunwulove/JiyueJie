/**
 * 音源探测页（独立 App「音源探测」根页面）
 *
 * UI 规范与极悦界完全一致（同一套基础组件与规范值）：
 * - 顶栏：56dp 高 + 水平品牌渐变（primary α0.14→α0.04）+ 标题 18sp Bold + 右侧操作按钮 72dp
 * - 列表：ListItem 行高 64（big）/ 行间 ListDivider（marginLeft 16）/ 封面 48dp 圆角 8
 * - 底部操作行：52dp 渐变 + 上分割线 + 按钮 14sp Medium
 * - 弹窗：三级弹窗基座（渐变标题行 52dp / 等高选项行 / ListDivider / 底部按钮行）
 *
 * 探测能力（与 core/probe 双面对齐）：
 * 声明矩阵 13 项 + 实测（搜索 5 类型 / 播放解析 / 歌单 / 歌词与翻译 / 歌手作品 / 专辑 / 评论 / 歌单标签）
 * 筛选维度 12 项（三态：不限/是/否），弹窗内容可滚动。
 */
import React, { useMemo, useRef, useState } from "react";
import {
    Pressable,
    StyleSheet,
    View,
    FlatList,
    ScrollView,
    useWindowDimensions,
    Platform,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import Clipboard from "@react-native-clipboard/clipboard";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { ListDivider } from "@/components/base/divider";
import { useSortedPlugins } from "@/core/pluginManager";
import pluginManager from "@/core/pluginManager";
import { ROUTE_PATH } from "@/core/router";
import useColors from "@/hooks/useColors";
import {
    IProbeResult,
    loadProbeResult,
    runProbe,
    SearchType,
    SEARCH_TYPES,
} from "@/core/probe";
import { buildProbeReport, exportProbeReport } from "@/core/probe/report";
import Toast from "@/utils/toast";

/** 行内徽标（核心 5 项） */
function AbilityBadge(props: { ok?: boolean; label: string }) {
    const { ok, label } = props;
    const colors = useColors();
    return (
        <View
            style={[
                styles.badge,
                {
                    backgroundColor: ok
                        ? colors.primary + "22"
                        : colors.textSecondary + "1A",
                },
            ]}>
            <ThemeText
                fontSize="caption"
                fontColor={ok ? "primary" : "textSecondary"}
                fontWeight="medium">
                {label}
            </ThemeText>
        </View>
    );
}

interface IFilterState {
    search: boolean | null;
    searchAlbum: boolean | null;
    searchArtist: boolean | null;
    searchSheet: boolean | null;
    searchLyric: boolean | null;
    mediaSource: boolean | null;
    playable: boolean | null;
    sheets: boolean | null;
    sheetTags: boolean | null;
    lyric: boolean | null;
    translation: boolean | null;
    artistWorks: boolean | null;
    comments: boolean | null;
    enabled: boolean | null;
}

type FilterKey = keyof IFilterState;

const DEFAULT_FILTER: IFilterState = {
    search: null,
    searchAlbum: null,
    searchArtist: null,
    searchSheet: null,
    searchLyric: null,
    mediaSource: null,
    playable: null,
    sheets: null,
    sheetTags: null,
    lyric: null,
    translation: null,
    artistWorks: null,
    comments: null,
    enabled: null,
};

/** 筛选维度定义（label + 从结果取值） */
const FILTER_DIMS: { key: FilterKey; label: string; get: (r: IProbeResult) => boolean }[] = [
    { key: "search", label: "可搜索", get: r => r.searchOk },
    { key: "searchAlbum", label: "专辑搜索", get: r => r.searchTypesOk.album },
    { key: "searchArtist", label: "歌手搜索", get: r => r.searchTypesOk.artist },
    { key: "searchSheet", label: "歌单搜索", get: r => r.searchTypesOk.sheet },
    { key: "searchLyric", label: "歌词搜索", get: r => r.searchTypesOk.lyric },
    { key: "mediaSource", label: "可解析播放", get: r => r.mediaSourceOk },
    { key: "playable", label: "真能播放", get: r => r.playableOk },
    { key: "sheets", label: "有歌单", get: r => r.sheetsOk },
    { key: "sheetTags", label: "歌单标签", get: r => r.sheetTagsOk },
    { key: "lyric", label: "有歌词", get: r => r.lyricOk },
    { key: "translation", label: "歌词翻译", get: r => r.lyricTranslationOk },
    { key: "artistWorks", label: "歌手作品", get: r => r.artistWorksOk },
    { key: "comments", label: "评论", get: r => r.commentsOk },
];

export default function ProbePage() {
    const colors = useColors();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const plugins = useSortedPlugins();

    const [results, setResults] = useState<Record<string, IProbeResult>>(() => {
        const init: Record<string, IProbeResult> = {};
        plugins.forEach(p => {
            const cached = loadProbeResult(p.hash);
            if (cached) {
                init[p.hash] = cached;
            }
        });
        return init;
    });
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState<{
        finished: number;
        total: number;
        currentName?: string;
    }>({ finished: 0, total: 0 });
    const [filter, setFilter] = useState<IFilterState>(DEFAULT_FILTER);
    const [filterVisible, setFilterVisible] = useState(false);
    const [detailPlugin, setDetailPlugin] = useState<IProbeResult | null>(null);
    const [reportVisible, setReportVisible] = useState(false);
    const signalRef = useRef({ cancelled: false });

    const total = plugins.length;
    const hasResult = Object.keys(results).length;

    const stats = useMemo(() => {
        const s = { search: 0, sheets: 0, lyric: 0, media: 0, playable: 0 };
        Object.values(results).forEach(r => {
            if (r.searchOk) s.search++;
            if (r.sheetsOk) s.sheets++;
            if (r.lyricOk) s.lyric++;
            if (r.mediaSourceOk) s.media++;
            if (r.playableOk) s.playable++;
        });
        return s;
    }, [results]);

    const filteredPlugins = useMemo(() => {
        return plugins.filter(p => {
            const r = results[p.hash];
            for (const d of FILTER_DIMS) {
                const v = filter[d.key];
                if (v === null) continue;
                const actual = r ? d.get(r) : false;
                if (actual !== v) return false;
            }
            if (filter.enabled !== null) {
                const enabled = pluginManager.isPluginEnabled(p);
                if (enabled !== filter.enabled) return false;
            }
            return true;
        });
    }, [plugins, results, filter]);

    const filterCount = FILTER_DIMS.filter(d => filter[d.key] !== null).length +
        (filter.enabled !== null ? 1 : 0);

    /** 报告文本（基于当前结果实时生成） */
    const reportMd = useMemo(() => {
        if (hasResult === 0) return "";
        return buildProbeReport(plugins, results, new Date());
    }, [plugins, results, hasResult]);

    const startProbe = async () => {
        if (running) return;
        setRunning(true);
        setResults({});
        setProgress({ finished: 0, total });
        signalRef.current.cancelled = false;
        await runProbe(plugins, signalRef.current, p => {
            setProgress({
                finished: p.finished,
                total: p.total,
                currentName: p.currentName,
            });
            if (p.doneHash) {
                const saved = loadProbeResult(p.doneHash);
                if (saved) {
                    setResults(prev => ({ ...prev, [p.doneHash!]: saved }));
                }
            }
        });
        setRunning(false);
        setProgress({ finished: 0, total: 0 });
    };

    const stopProbe = () => {
        signalRef.current.cancelled = true;
    };

    const isTablet = width >= 600;
    const contentWidth = isTablet ? Math.min(width * 0.6, 720) : width;

    const rowHeight = 64;

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            {/* 顶栏 */}
            <LinearGradient
                colors={[
                    Color(colors.primary).alpha(0.14).toString(),
                    Color(colors.primary).alpha(0.04).toString(),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.topBar, { paddingTop: insets.top }]}>
                <View style={styles.topBarRow}>
                    <ThemeText fontSize="title" fontWeight="bold">
                        音源探测
                    </ThemeText>
                    <Pressable
                        style={styles.topBarBtn}
                        onPress={() =>
                            navigation.navigate(ROUTE_PATH.PLUGIN_SOURCES)
                        }
                        hitSlop={8}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="primary"
                            fontWeight="medium">
                            音源管理
                        </ThemeText>
                    </Pressable>
                </View>
            </LinearGradient>

            {/* 概览条 */}
            <View
                style={[
                    styles.statsRow,
                    {
                        backgroundColor: colors.background,
                        borderBottomColor: colors.border,
                    },
                ]}>
                <StatCell label="音源" value={total} />
                <StatCell label="可播放" value={stats.playable} highlight />
                <StatCell label="可搜索" value={stats.search} highlight />
                <StatCell label="可解析" value={stats.media} highlight />
                <StatCell label="有歌单" value={stats.sheets} highlight />
                <StatCell label="有歌词" value={stats.lyric} highlight />
            </View>

            {/* 探测进度：三行（行1 状态+计数 / 行2 进度条 / 行3 正在探测的插件名） */}
            {running ? (
                <View
                    style={[
                        styles.progressCard,
                        {
                            backgroundColor: colors.background,
                            borderBottomColor: colors.border,
                        },
                    ]}>
                    <View style={styles.progressRow1}>
                        <ThemeText fontSize="content" fontWeight="medium">
                            正在探测音源
                        </ThemeText>
                        <ThemeText
                            fontSize="content"
                            fontWeight="bold"
                            fontColor="primary">
                            {progress.finished}/{progress.total}
                        </ThemeText>
                    </View>
                    <View style={styles.progressRow2}>
                        <View
                            style={[
                                styles.progressTrack,
                                { backgroundColor: colors.border },
                            ]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${
                                            progress.total > 0
                                                ? Math.round(
                                                    (progress.finished /
                                                          progress.total) *
                                                          100,
                                                )
                                                : 0
                                        }%`,
                                        backgroundColor: colors.primary,
                                    },
                                ]}
                            />
                        </View>
                        <ThemeText
                            fontSize="caption"
                            fontColor="textSecondary"
                            style={styles.progressPct}>
                            {progress.total > 0
                                ? Math.round(
                                    (progress.finished / progress.total) *
                                          100,
                                )
                                : 0}
                            %
                        </ThemeText>
                    </View>
                    <View style={styles.progressRow3}>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary">
                            正在探测：
                        </ThemeText>
                        <ThemeText
                            fontSize="description"
                            fontWeight="medium"
                            numberOfLines={1}
                            style={styles.progressName}>
                            {progress.currentName ?? "准备中…"}
                        </ThemeText>
                    </View>
                </View>
            ) : null}

            {/* 列表 */}
            <FlatList
                data={filteredPlugins}
                keyExtractor={item => item.hash}
                style={{ width: contentWidth, alignSelf: "center" }}
                ItemSeparatorComponent={() => <ListDivider marginLeft={16} />}
                renderItem={({ item }) => {
                    const r = results[item.hash];
                    const probing = running && !r;
                    return (
                        <Pressable
                            onPress={() => {
                                if (r) setDetailPlugin(r);
                            }}>
                            <View style={[styles.row, { height: rowHeight }]}>
                                <LinearGradient
                                    colors={[
                                        colors.primary,
                                        Color(colors.primary).alpha(0.75).toString(),
                                    ]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.rowIcon}>
                                    <Icon
                                        name="musical-note"
                                        size={22}
                                        color="#FFFFFF"
                                    />
                                </LinearGradient>
                                <View style={styles.rowContent}>
                                    <ThemeText
                                        fontSize="content"
                                        fontWeight="medium"
                                        numberOfLines={1}>
                                        {item.name}
                                    </ThemeText>
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary"
                                        numberOfLines={1}>
                                        {probing
                                            ? "探测中…"
                                            : r
                                                ? summarize(r)
                                                : "点击开始探测后查看结果"}
                                    </ThemeText>
                                </View>
                                <View style={styles.rowBadges}>
                                    {r ? (
                                        <>
                                            <AbilityBadge
                                                ok={r.playableOk}
                                                label="播放"
                                            />
                                            <AbilityBadge
                                                ok={r.searchOk}
                                                label="搜索"
                                            />
                                            <AbilityBadge
                                                ok={r.mediaSourceOk}
                                                label="解析"
                                            />
                                        </>
                                    ) : probing ? (
                                        <ThemeText
                                            fontSize="caption"
                                            fontColor="textSecondary">
                                            …
                                        </ThemeText>
                                    ) : null}
                                </View>
                            </View>
                        </Pressable>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="textSecondary">
                            没有符合条件的音源
                        </ThemeText>
                    </View>
                }
            />

            {/* 底部操作行 */}
            <LinearGradient
                colors={[
                    Color(colors.primary).alpha(0.10).toString(),
                    Color(colors.primary).alpha(0.07).toString(),
                    "rgba(0,0,0,0.016)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.actionBar, { paddingBottom: insets.bottom }]}>
                <View style={[styles.actionBarInner, { width: contentWidth }]}>
                    <Pressable
                        style={styles.actionBtn}
                        onPress={() => setFilterVisible(true)}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="textSecondary"
                            fontWeight="medium">
                            筛选{filterCount > 0 ? `（${filterCount}）` : ""}
                        </ThemeText>
                    </Pressable>
                    {!running && hasResult > 0 ? (
                        <Pressable
                            style={styles.actionBtn}
                            onPress={() => setReportVisible(true)}>
                            <ThemeText
                                fontSize="subTitle"
                                fontColor="textSecondary"
                                fontWeight="medium">
                                报告
                            </ThemeText>
                        </Pressable>
                    ) : null}
                    {running ? (
                        <Pressable
                            style={styles.actionBtn}
                            onPress={stopProbe}>
                            <ThemeText
                                fontSize="subTitle"
                                fontColor="primary"
                                fontWeight="medium">
                                停止（{progress.finished}/{progress.total}）
                            </ThemeText>
                        </Pressable>
                    ) : (
                        <Pressable
                            style={styles.actionBtn}
                            onPress={startProbe}>
                            <ThemeText
                                fontSize="subTitle"
                                fontColor="primary"
                                fontWeight="medium">
                                {hasResult > 0 ? "重新探测" : "开始探测"}
                            </ThemeText>
                        </Pressable>
                    )}
                </View>
            </LinearGradient>

            {filterVisible ? (
                <FilterDialog
                    filter={filter}
                    filterCount={filterCount}
                    onClose={() => setFilterVisible(false)}
                    onChange={setFilter}
                />
            ) : null}
            {detailPlugin ? (
                <DetailDialog
                    result={detailPlugin}
                    onClose={() => setDetailPlugin(null)}
                />
            ) : null}
            {reportVisible && reportMd ? (
                <ReportDialog
                    md={reportMd}
                    onClose={() => setReportVisible(false)}
                />
            ) : null}
        </View>
    );
}

/** 描述行摘要 */
function summarize(r: IProbeResult): string {
    const parts: string[] = [];
    parts.push(`搜索:${SEARCH_TYPES.map(t => (r.searchTypesOk[t] ? t : `-${t}`)).join(" ")}`);
    parts.push(`解析:${r.mediaSourceOk ? "✓" : "✗"}`);
    parts.push(`播放:${r.playableOk ? "✓" : "✗"}`);
    parts.push(`歌单:${r.sheetsOk ? (r.sheetCount ?? "✓") : "✗"}`);
    parts.push(`歌词:${r.lyricOk ? (r.lyricTranslationOk ? "✓+翻译" : "✓") : "✗"}`);
    if (r.playError && !r.playableOk) {
        parts.push(r.playError);
    } else if (!r.searchOk && !r.sheetsOk && !r.lyricOk && r.lastError) {
        parts.push(r.lastError);
    }
    return parts.join(" · ");
}

function StatCell(props: {
    label: string;
    value: number;
    highlight?: boolean;
}) {
    const { label, value, highlight } = props;
    const colors = useColors();
    return (
        <View style={styles.statCell}>
            <ThemeText
                fontSize="content"
                fontWeight="bold"
                fontColor={highlight ? "primary" : undefined}>
                {value}
            </ThemeText>
            <ThemeText fontSize="caption" fontColor="textSecondary">
                {label}
            </ThemeText>
        </View>
    );
}

/** 筛选弹窗（三级弹窗基座 + 可滚动维度行） */
function FilterDialog(props: {
    filter: IFilterState;
    filterCount: number;
    onChange: (f: IFilterState) => void;
    onClose: () => void;
}) {
    const { filter, filterCount, onChange, onClose } = props;
    const colors = useColors();

    const setDim = (key: FilterKey, value: boolean | null) => {
        onChange({ ...filter, [key]: value });
    };

    return (
        <View style={styles.mask}>
            <View
                style={[
                    styles.dialog,
                    { backgroundColor: colors.background, borderColor: colors.border },
                ]}>
                <LinearGradient
                    colors={[
                        Color(colors.primary).alpha(0.10).toString(),
                        Color(colors.primary).alpha(0.07).toString(),
                        "rgba(0,0,0,0.016)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.dialogTitle}>
                    <ThemeText fontSize="title" fontWeight="bold">
                        筛选条件{filterCount > 0 ? `（${filterCount}）` : ""}
                    </ThemeText>
                </LinearGradient>

                <FlatList
                    data={FILTER_DIMS}
                    keyExtractor={d => d.key}
                    style={{ maxHeight: 390 }}
                    ItemSeparatorComponent={() => (
                        <ListDivider marginLeft={16} />
                    )}
                    renderItem={({ item }) => (
                        <OptionRow
                            label={item.label}
                            value={filter[item.key]}
                            onSelect={v => setDim(item.key, v)}
                        />
                    )}
                    ListFooterComponent={
                        <>
                            <ListDivider marginLeft={16} />
                            <OptionRow
                                label="已启用"
                                value={filter.enabled}
                                onSelect={v => setDim("enabled", v)}
                            />
                        </>
                    }
                />

                <View
                    style={[
                        styles.dialogActions,
                        { borderTopColor: colors.border },
                    ]}>
                    <Pressable
                        style={styles.dialogActionBtn}
                        onPress={() => {
                            onChange(DEFAULT_FILTER);
                            onClose();
                        }}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="textSecondary"
                            fontWeight="medium">
                            清除
                        </ThemeText>
                    </Pressable>
                    <Pressable
                        style={styles.dialogActionBtn}
                        onPress={onClose}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="primary"
                            fontWeight="medium">
                            确定
                        </ThemeText>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

/** 探测报告弹窗：预览 + 复制 + 分享导出 */
function ReportDialog(props: { md: string; onClose: () => void }) {
    const { md, onClose } = props;
    const colors = useColors();
    const [copied, setCopied] = useState(false);
    const [sharing, setSharing] = useState(false);

    const copy = async () => {
        await Clipboard.setString(md);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const share = async () => {
        if (sharing) return;
        setSharing(true);
        try {
            await exportProbeReport(md);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            Toast.warn(`分享失败：${msg}`);
        } finally {
            setSharing(false);
        }
    };

    return (
        <View style={styles.mask}>
            <View
                style={[
                    styles.dialog,
                    styles.reportDialog,
                    { backgroundColor: colors.background, borderColor: colors.border },
                ]}>
                <LinearGradient
                    colors={[
                        Color(colors.primary).alpha(0.10).toString(),
                        Color(colors.primary).alpha(0.07).toString(),
                        "rgba(0,0,0,0.016)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.dialogTitle}>
                    <ThemeText fontSize="title" fontWeight="bold">
                        探测报告
                    </ThemeText>
                </LinearGradient>
                <View style={[styles.metaRow, { borderBottomColor: colors.border }]}>
                    <ThemeText fontSize="description" fontColor="textSecondary">
                        可预览 · 复制全文 · 分享为 .md 文件（可直接投喂 AI）
                    </ThemeText>
                </View>
                <ScrollView
                    style={styles.reportBody}
                    contentContainerStyle={styles.reportBodyContent}>
                    <ThemeText
                        fontSize="caption"
                        fontColor="textSecondary"
                        style={styles.reportText}>
                        {md}
                    </ThemeText>
                </ScrollView>
                <View
                    style={[
                        styles.dialogActions,
                        { borderTopColor: colors.border },
                    ]}>
                    <Pressable style={styles.dialogActionBtn} onPress={copy}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor="textSecondary">
                            {copied ? "已复制" : "复制全文"}
                        </ThemeText>
                    </Pressable>
                    <Pressable style={styles.dialogActionBtn} onPress={share}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor="primary">
                            {sharing ? "分享中…" : "分享文件"}
                        </ThemeText>
                    </Pressable>
                    <Pressable style={styles.dialogActionBtn} onPress={onClose}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor="textSecondary">
                            关闭
                        </ThemeText>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

/** 能力矩阵详情弹窗 */
function DetailDialog(props: { result: IProbeResult; onClose: () => void }) {
    const { result, onClose } = props;
    const colors = useColors();

    const rows: { label: string; declared: boolean; actual: boolean; note?: string }[] = [
        { label: "搜索（music）", declared: result.abilities.search, actual: result.searchOk, note: result.searchError },
        ...SEARCH_TYPES.filter(t => t !== "music").map(t => ({
            label: `搜索（${t}）`,
            declared: result.abilities.searchTypes.includes(t),
            actual: result.searchTypesOk[t],
            note: undefined as string | undefined,
        })),
        { label: "解析播放地址", declared: result.abilities.mediaSource, actual: result.mediaSourceOk, note: result.mediaSourceError },
        { label: "深度播放验证", declared: result.abilities.mediaSource, actual: result.playableOk, note: result.playError ?? (result.playableOk ? `播放${result.playedSec ?? 2}s · 时长${Math.round(result.playDurationSec ?? 0)}s · ${result.playVerifyMs ?? 0}ms` : "未验证") },
        { label: "歌曲信息", declared: result.abilities.musicInfo, actual: true, note: "声明即可用" },
        { label: "歌词", declared: result.abilities.lyric, actual: result.lyricOk, note: result.lyricError },
        { label: "歌词翻译", declared: result.abilities.lyric, actual: result.lyricTranslationOk, note: "translation 非空" },
        { label: "歌单（getTopLists）", declared: result.abilities.topLists, actual: result.sheetsOk, note: result.sheetsError },
        { label: "歌单详情", declared: result.abilities.musicSheetInfo, actual: result.abilities.musicSheetInfo, note: "声明即可用" },
        { label: "歌单标签", declared: result.abilities.recommendSheetTags, actual: result.sheetTagsOk, note: result.sheetTagsError },
        { label: "按标签歌单", declared: result.abilities.recommendSheetsByTag, actual: result.abilities.recommendSheetsByTag, note: "声明即可用" },
        { label: "榜单详情", declared: result.abilities.topListDetail, actual: result.abilities.topListDetail, note: "声明即可用" },
        { label: "歌手作品", declared: result.abilities.artistWorks, actual: result.artistWorksOk, note: result.artistWorksError },
        { label: "专辑", declared: result.abilities.albumInfo, actual: result.albumOk, note: result.albumError },
        { label: "评论", declared: result.abilities.musicComments, actual: result.commentsOk, note: result.commentsError },
        { label: "导入歌单", declared: result.abilities.importMusicSheet, actual: result.abilities.importMusicSheet, note: "声明即可用" },
    ];

    const data = rows.map((r, idx) => ({ ...r, id: idx }));

    return (
        <View style={styles.mask}>
            <View
                style={[
                    styles.dialog,
                    { backgroundColor: colors.background, borderColor: colors.border },
                ]}>
                <LinearGradient
                    colors={[
                        Color(colors.primary).alpha(0.10).toString(),
                        Color(colors.primary).alpha(0.07).toString(),
                        "rgba(0,0,0,0.016)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.dialogTitle}>
                    <ThemeText fontSize="title" fontWeight="bold" numberOfLines={1}>
                        {result.name}
                    </ThemeText>
                </LinearGradient>

                <View style={[styles.metaRow, { borderBottomColor: colors.border }]}>
                    <ThemeText fontSize="description" fontColor="textSecondary">
                        耗时 {result.durationMs}ms ·{" "}
                        {result.enabled ? "已启用" : "未启用"} · 样本：
                        {result.sampleTitle
                            ? `${result.sampleTitle}${result.sampleArtist ? ` - ${result.sampleArtist}` : ""}`
                            : "无"}
                    </ThemeText>
                </View>

                <FlatList
                    data={data}
                    keyExtractor={item => String(item.id)}
                    style={{ maxHeight: 420 }}
                    ItemSeparatorComponent={() => (
                        <ListDivider marginLeft={16} />
                    )}
                    renderItem={({ item }) => (
                        <View style={styles.matrixRow}>
                            <ThemeText
                                fontSize="content"
                                style={{ flex: 1, marginRight: 8 }}
                                numberOfLines={1}>
                                {item.label}
                            </ThemeText>
                            <MatrixDot ok={item.declared} label="声明" />
                            <MatrixDot ok={item.actual} label="实测" />
                            <ThemeText
                                fontSize="caption"
                                fontColor="textSecondary"
                                numberOfLines={1}
                                style={{ marginLeft: 8, flex: 1 }}>
                                {item.note ?? ""}
                            </ThemeText>
                        </View>
                    )}
                />

                <View
                    style={[
                        styles.dialogActions,
                        { borderTopColor: colors.border },
                    ]}>
                    <Pressable
                        style={styles.dialogActionBtn}
                        onPress={onClose}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="primary"
                            fontWeight="medium">
                            关闭
                        </ThemeText>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

function MatrixDot(props: { ok: boolean; label: string }) {
    const colors = useColors();
    return (
        <View style={styles.matrixDotWrap}>
            <View
                style={[
                    styles.matrixDot,
                    { backgroundColor: props.ok ? colors.primary : colors.textSecondary },
                ]}
            />
            <ThemeText fontSize="caption" fontColor="textSecondary">
                {props.label}
            </ThemeText>
        </View>
    );
}

function OptionRow(props: {
    label: string;
    value: boolean | null;
    onSelect: (v: boolean | null) => void;
}) {
    const { label, value, onSelect } = props;
    const colors = useColors();
    return (
        <View style={styles.optionRow}>
            <ThemeText fontSize="content" style={{ flex: 1 }}>
                {label}
            </ThemeText>
            {[null, true, false].map(v => {
                const active = value === v;
                return (
                    <Pressable
                        key={String(v)}
                        style={[
                            styles.segBtn,
                            {
                                borderColor: active
                                    ? colors.primary
                                    : colors.border,
                                backgroundColor: active
                                    ? colors.primary + "1A"
                                    : "transparent",
                            },
                        ]}
                        onPress={() => onSelect(v)}>
                        <ThemeText
                            fontSize="caption"
                            fontWeight="medium"
                            fontColor={active ? "primary" : "textSecondary"}>
                            {v === null ? "不限" : v ? "是" : "否"}
                        </ThemeText>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    topBar: {
        paddingHorizontal: 16,
    },
    topBarRow: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    topBarBtn: {
        width: 72,
        height: 36,
        alignItems: "flex-end",
        justifyContent: "center",
    },
    statsRow: {
        flexDirection: "row",
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    statCell: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    /** 探测进度卡：三行（状态+计数 / 进度条 / 当前插件名） */
    progressCard: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 6,
    },
    progressRow1: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    progressRow2: {
        flexDirection: "row",
        alignItems: "center",
    },
    progressTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: "hidden",
    },
    progressFill: {
        height: 4,
        borderRadius: 2,
    },
    progressPct: {
        width: 44,
        textAlign: "right",
        marginLeft: 8,
    },
    progressRow3: {
        flexDirection: "row",
        alignItems: "center",
    },
    progressName: {
        flex: 1,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    rowIcon: {
        width: 48,
        height: 48,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    rowContent: {
        flex: 1,
        justifyContent: "center",
        marginRight: 8,
    },
    rowBadges: {
        flexDirection: "row",
        alignItems: "center",
    },
    badge: {
        paddingHorizontal: 6,
        height: 20,
        borderRadius: 10,
        marginLeft: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    empty: {
        paddingVertical: 48,
        alignItems: "center",
    },
    actionBar: {
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    actionBarInner: {
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
    },
    actionBtn: {
        flex: 1,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
    },
    mask: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.4)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
    },
    dialog: {
        width: "88%",
        maxWidth: 440,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: "hidden",
    },
    dialogTitle: {
        height: 52,
        paddingHorizontal: 24,
        justifyContent: "center",
    },
    reportDialog: {
        maxHeight: "78%",
    },
    reportBody: {
        maxHeight: 480,
    },
    reportBodyContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    reportText: {
        fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
        lineHeight: 18,
    },
    metaRow: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    optionRow: {
        height: 52,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    segBtn: {
        height: 28,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginLeft: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    dialogActions: {
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    dialogActionBtn: {
        flex: 1,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
    },
    matrixRow: {
        height: 52,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    matrixDotWrap: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 12,
    },
    matrixDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 4,
    },
});
