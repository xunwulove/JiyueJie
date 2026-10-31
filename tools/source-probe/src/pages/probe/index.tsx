/**
 * 源鉴页（独立 App「源鉴」根页面）
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
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    BackHandler,
    Pressable,
    StyleSheet,
    View,
    FlatList,
    ScrollView,
    TextInput,
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
import type { Plugin } from "@/core/pluginManager/plugin";
import { ROUTE_PATH } from "@/core/router";
import useColors from "@/hooks/useColors";
import {
    IProbeResult,
    loadProbeResult,
    runProbe,
    SEARCH_TYPES,
    deleteProbeResult,
} from "@/core/probe";
import {
    buildProbeReport,
    exportProbeReport,
    buildConclusionList,
    saveReportSnapshot,
    loadLastSnapshot,
    buildHistoryDiff,
    tierOf,
    SourceTier,
} from "@/core/probe/report";
import {
    currentPrimaryKeyword,
    saveKeywordOverride,
    resetKeywordOverrides,
} from "@/core/probe/settings";
import { TIER_COLORS } from "@/pages/probeDetail";
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
    sheetsFirst: boolean | null;
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
    sheetsFirst: null,
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
    { key: "sheetsFirst", label: "歌单首曲可解析", get: r => !!r.sheetsFirstOk },
    { key: "sheetTags", label: "标签歌单可拉取", get: r => !!r.sheetTagsOk },
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
    const [reportVisible, setReportVisible] = useState(false);
    const signalRef = useRef({ cancelled: false });

    /** 手机版新增：分级 chips / 选中模式 / 关键词设置 / 删除确认 */
    const [tierChip, setTierChip] = useState<SourceTier | null>(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [keywordVisible, setKeywordVisible] = useState(false);
    const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);

    /** 弹窗返回键拦截：弹窗打开时返回手势/返回键 = 关闭最上层弹窗，不触发导航返回/退出。
     *  四个自绘弹窗（筛选/关键词/删除确认/报告）为绝对定位覆盖层，无 Dialog base 的 BackHandler，
     *  若不拦截，返回手势会直接落到导航栈底退出 App。优先级按渲染叠放（后渲染的在上）。 */
    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            if (deleteTargets) {
                setDeleteTargets(null);
                return true;
            }
            if (keywordVisible) {
                setKeywordVisible(false);
                return true;
            }
            if (reportVisible) {
                setReportVisible(false);
                return true;
            }
            if (filterVisible) {
                setFilterVisible(false);
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [deleteTargets, keywordVisible, reportVisible, filterVisible]);

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
            // 手机版分级 chips 过滤（叠加在筛选条件之上）
            if (tierChip !== null) {
                if (tierOf(r) !== tierChip) return false;
            }
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
    }, [plugins, results, filter, tierChip]);

    const filterCount = FILTER_DIMS.filter(d => filter[d.key] !== null).length +
        (filter.enabled !== null ? 1 : 0);

    /** 报告文本（基于当前结果实时生成） */
    const reportMd = useMemo(() => {
        if (hasResult === 0) return "";
        return buildProbeReport(plugins, results, new Date());
    }, [plugins, results, hasResult]);

    /** 结论清单（一键复制：建议保留/卸载） */
    const conclusionList = useMemo(() => {
        if (hasResult === 0) return "";
        return buildConclusionList(plugins, results);
    }, [plugins, results, hasResult]);

    const startProbe = async (targets?: Plugin[]) => {
        if (running) return;
        const list = targets && targets.length > 0 ? targets : plugins;
        setRunning(true);
        setResults({});
        setProgress({ finished: 0, total: list.length });
        signalRef.current.cancelled = false;
        await runProbe(list, signalRef.current, p => {
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
        // 结束后落历史快照（供下次"与上次对比"）
        const finalResults: Record<string, IProbeResult> = {};
        plugins.forEach(p => {
            const s = loadProbeResult(p.hash);
            if (s) finalResults[p.hash] = s;
        });
        saveReportSnapshot(plugins, finalResults);
        setRunning(false);
        setProgress({ finished: 0, total: 0 });
        setSelectMode(false);
        setSelected(new Set());
    };

    const stopProbe = () => {
        signalRef.current.cancelled = true;
    };

    /** 长按进入选择模式（手机版） */
    const enterSelectMode = (hash: string) => {
        if (running) return;
        setSelectMode(true);
        setSelected(prev => new Set(prev).add(hash));
    };

    const toggleSelected = (hash: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(hash)) {
                next.delete(hash);
            } else {
                next.add(hash);
            }
            return next;
        });
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelected(new Set());
    };

    /** 删除所选源（卸载插件 + 清探测结果缓存） */
    const removeSelected = async () => {
        if (!deleteTargets || deleteTargets.length === 0) return;
        for (const hash of deleteTargets) {
            try {
                await pluginManager.uninstallPlugin(hash);
            } catch {}
            deleteProbeResult(hash);
        }
        Toast.success(`已删除 ${deleteTargets.length} 个音源`);
        setDeleteTargets(null);
        setSelected(new Set());
        setSelectMode(false);
        // 清掉已删源的本地结果，避免残留
        setResults(prev => {
            const next = { ...prev };
            deleteTargets.forEach(h => delete next[h]);
            return next;
        });
    };

    /** 各档数量（chips 角标） */
    const tierCounts = useMemo(() => {
        const c: Record<SourceTier, number> = {
            全通: 0,
            可解析不可播: 0,
            半可用: 0,
            歌单型: 0,
            死源: 0,
        };
        plugins.forEach(p => {
            const r = results[p.hash];
            if (r) c[tierOf(r)]++;
            else c["死源"]++; // 未探测视为无结果
        });
        return c;
    }, [plugins, results]);

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
                        源鉴
                    </ThemeText>
                    <View style={styles.topBarActions}>
                        <Pressable
                            style={styles.topBarBtn}
                            onPress={() => setKeywordVisible(true)}
                            hitSlop={8}>
                            <ThemeText
                                fontSize="subTitle"
                                fontColor="primary"
                                fontWeight="medium">
                                关键词
                            </ThemeText>
                        </Pressable>
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
                        <Pressable
                            style={styles.topBarBtn}
                            onPress={() =>
                                navigation.navigate(ROUTE_PATH.ABOUT)
                            }
                            hitSlop={8}>
                            <ThemeText
                                fontSize="subTitle"
                                fontColor="primary"
                                fontWeight="medium">
                                关于
                            </ThemeText>
                        </Pressable>
                    </View>
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

            {/* 手机版：分级 chips 常驻（全部/全通/可解析不可播/半可用/歌单型/死源） */}
            <View
                style={[
                    styles.chipsRow,
                    { borderBottomColor: colors.border },
                ]}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsContent}>
                    {(
                        [
                            null,
                            "全通",
                            "可解析不可播",
                            "半可用",
                            "歌单型",
                            "死源",
                        ] as (SourceTier | null)[]
                    ).map(t => {
                        const active = tierChip === t;
                        const count =
                            t === null ? total : tierCounts[t];
                        return (
                            <Pressable
                                key={t ?? "all"}
                                style={[
                                    styles.chip,
                                    {
                                        borderColor: active
                                            ? colors.primary
                                            : colors.border,
                                        backgroundColor: active
                                            ? colors.primary + "1A"
                                            : "transparent",
                                    },
                                ]}
                                onPress={() => setTierChip(active ? null : t)}>
                                <View
                                    style={[
                                        styles.chipDot,
                                        {
                                            backgroundColor:
                                                t === null
                                                    ? colors.textSecondary
                                                    : TIER_COLORS[t],
                                        },
                                    ]}
                                />
                                <ThemeText
                                    fontSize="caption"
                                    fontWeight={active ? "bold" : "medium"}
                                    fontColor={
                                        active ? "primary" : "textSecondary"
                                    }>
                                    {t ?? "全部"} {count}
                                </ThemeText>
                            </Pressable>
                        );
                    })}
                </ScrollView>
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
                    const tier = r ? tierOf(r) : null;
                    const isSelected = selectMode && selected.has(item.hash);
                    return (
                        <Pressable
                            onPress={() => {
                                if (selectMode) {
                                    toggleSelected(item.hash);
                                    return;
                                }
                                if (r) {
                                    navigation.navigate(ROUTE_PATH.PROBE_DETAIL, {
                                        result: r,
                                    });
                                }
                            }}
                            onLongPress={() => enterSelectMode(item.hash)}
                            delayLongPress={350}>
                            <View style={styles.rowWrap}>
                                {/* 手机版：左缘分级色条 */}
                                {tier ? (
                                    <View
                                        style={[
                                            styles.tierBar,
                                            { backgroundColor: TIER_COLORS[tier] },
                                        ]}
                                    />
                                ) : null}
                                {/* 选择模式勾选圈 */}
                                {selectMode ? (
                                    <View
                                        style={[
                                            styles.checkCircle,
                                            {
                                                borderColor: isSelected
                                                    ? colors.primary
                                                    : colors.border,
                                                backgroundColor: isSelected
                                                    ? colors.primary
                                                    : "transparent",
                                            },
                                        ]}>
                                        {isSelected ? (
                                            <ThemeText
                                                fontSize="caption"
                                                fontWeight="bold"
                                                fontColor="background">
                                                ✓
                                            </ThemeText>
                                        ) : null}
                                    </View>
                                ) : null}
                                <View style={[styles.row, { height: rowHeight, flex: 1 }]}>
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
                            </View>
                        </Pressable>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="textSecondary">
                            {plugins.length === 0
                                ? "还没有安装音源"
                                : "没有符合条件的音源"}
                        </ThemeText>
                        {plugins.length === 0 ? (
                            <Pressable
                                style={[
                                    styles.emptyBtn,
                                    { borderColor: colors.primary },
                                ]}
                                onPress={() =>
                                    navigation.navigate(ROUTE_PATH.PLUGIN_SOURCES)
                                }>
                                <ThemeText
                                    fontSize="subTitle"
                                    fontWeight="medium"
                                    fontColor="primary">
                                    去装音源
                                </ThemeText>
                            </Pressable>
                        ) : (
                            <Pressable
                                style={[
                                    styles.emptyBtn,
                                    { borderColor: colors.primary },
                                ]}
                                onPress={() => {
                                    setTierChip(null);
                                    setFilter(DEFAULT_FILTER);
                                }}>
                                <ThemeText
                                    fontSize="subTitle"
                                    fontWeight="medium"
                                    fontColor="primary">
                                    清除筛选
                                </ThemeText>
                            </Pressable>
                        )}
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
                    {selectMode ? (
                        <>
                            <Pressable
                                style={styles.actionBtn}
                                onPress={exitSelectMode}>
                                <ThemeText
                                    fontSize="subTitle"
                                    fontColor="textSecondary"
                                    fontWeight="medium">
                                    取消
                                </ThemeText>
                            </Pressable>
                            <Pressable
                                style={styles.actionBtn}
                                onPress={() => {
                                    const targets = plugins.filter(p =>
                                        selected.has(p.hash),
                                    );
                                    void startProbe(targets);
                                }}>
                                <ThemeText
                                    fontSize="subTitle"
                                    fontColor="primary"
                                    fontWeight="medium">
                                    重测所选（{selected.size}）
                                </ThemeText>
                            </Pressable>
                            <Pressable
                                style={styles.actionBtn}
                                onPress={() => {
                                    if (selected.size === 0) {
                                        Toast.warn("未选中任何音源");
                                        return;
                                    }
                                    setDeleteTargets(
                                        plugins
                                            .filter(p => selected.has(p.hash))
                                            .map(p => p.hash),
                                    );
                                }}>
                                <ThemeText
                                    fontSize="subTitle"
                                    fontColor="textSecondary"
                                    fontWeight="medium">
                                    删除所选
                                </ThemeText>
                            </Pressable>
                        </>
                    ) : (
                        <>
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
                                    onPress={() => void startProbe()}>
                                    <ThemeText
                                        fontSize="subTitle"
                                        fontColor="primary"
                                        fontWeight="medium">
                                        {hasResult > 0 ? "重新探测" : "开始探测"}
                                    </ThemeText>
                                </Pressable>
                            )}
                        </>
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
            {keywordVisible ? (
                <KeywordDialog onClose={() => setKeywordVisible(false)} />
            ) : null}
            {deleteTargets ? (
                <ConfirmDeleteDialog
                    count={deleteTargets.length}
                    onCancel={() => setDeleteTargets(null)}
                    onConfirm={removeSelected}
                />
            ) : null}
            {reportVisible && reportMd ? (
                <ReportDialog
                    md={reportMd}
                    conclusion={conclusionList}
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

/** 探测报告弹窗：预览 + 对比上次 + 复制结论/全文 + 分享导出（md） */
function ReportDialog(props: {
    md: string;
    conclusion: string;
    onClose: () => void;
}) {
    const { md, conclusion, onClose } = props;
    const colors = useColors();
    const [copied, setCopied] = useState(false);
    const [sharing, setSharing] = useState(false);
    /** 预览模式：md / diff（与上次对比） / conclusion（处置清单） */
    const [mode, setMode] = useState<"md" | "diff" | "conclusion">("md");
    const [diffText, setDiffText] = useState<string | null>(null);
    const [diffChanged, setDiffChanged] = useState(0);

    const copy = async () => {
        const text =
            mode === "conclusion" ? conclusion : mode === "diff" ? diffText ?? "" : md;
        if (!text) return;
        await Clipboard.setString(text);
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

    /** 对比上次探测（进入 diff 预览模式） */
    const compareLast = () => {
        const cur = loadLastSnapshot();
        if (!cur) {
            Toast.warn("尚无历史记录，先完成一次全量探测");
            return;
        }
        const d = buildHistoryDiff(cur);
        setDiffText(d.text);
        setDiffChanged(d.changed);
        setMode("diff");
    };

    const previewText =
        mode === "conclusion" ? conclusion : mode === "diff" ? diffText ?? "" : md;

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
                {/* 模式切换：报告 / 与上次对比 / 处置清单 */}
                <View style={[styles.metaRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.reportTabs}>
                        <Pressable
                            style={[
                                styles.reportTab,
                                mode === "md" && { backgroundColor: colors.primary + "1A" },
                            ]}
                            onPress={() => setMode("md")}>
                            <ThemeText
                                fontSize="description"
                                fontWeight={mode === "md" ? "bold" : "medium"}
                                fontColor={mode === "md" ? "primary" : "textSecondary"}>
                                报告
                            </ThemeText>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.reportTab,
                                mode === "diff" && { backgroundColor: colors.primary + "1A" },
                            ]}
                            onPress={compareLast}>
                            <ThemeText
                                fontSize="description"
                                fontWeight={mode === "diff" ? "bold" : "medium"}
                                fontColor={mode === "diff" ? "primary" : "textSecondary"}>
                                对比上次{diffChanged > 0 ? `（${diffChanged}）` : ""}
                            </ThemeText>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.reportTab,
                                mode === "conclusion" && { backgroundColor: colors.primary + "1A" },
                            ]}
                            onPress={() => setMode("conclusion")}>
                            <ThemeText
                                fontSize="description"
                                fontWeight={mode === "conclusion" ? "bold" : "medium"}
                                fontColor={mode === "conclusion" ? "primary" : "textSecondary"}>
                                处置清单
                            </ThemeText>
                        </Pressable>
                    </View>
                    <ThemeText
                        fontSize="caption"
                        fontColor="textSecondary"
                        style={styles.reportTabHint}>
                        {mode === "diff"
                            ? "对比上次探测：变好/变坏/新增/卸载"
                            : mode === "conclusion"
                                ? "建议保留/卸载，一键复制到主 App 操作"
                                : "分享为 .md（可直接投喂 AI）"}
                    </ThemeText>
                </View>
                <ScrollView
                    style={styles.reportBody}
                    contentContainerStyle={styles.reportBodyContent}>
                    <ThemeText
                        fontSize="caption"
                        fontColor="textSecondary"
                        style={styles.reportText}>
                        {previewText}
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
                            {copied
                                ? "已复制"
                                : mode === "conclusion"
                                    ? "复制结论"
                                    : mode === "diff"
                                        ? "复制对比"
                                        : "复制全文"}
                        </ThemeText>
                    </Pressable>
                    {mode === "md" ? (
                        <>
                            <Pressable style={styles.dialogActionBtn} onPress={share}>
                                <ThemeText
                                    fontSize="subTitle"
                                    fontWeight="medium"
                                    fontColor="primary">
                                    {sharing ? "分享中…" : "分享 .md"}
                                </ThemeText>
                            </Pressable>
                        </>
                    ) : null}
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

/** 关键词设置弹窗（探测关键词可配置，三级弹窗规范） */
function KeywordDialog(props: { onClose: () => void }) {
    const { onClose } = props;
    const colors = useColors();
    const [values, setValues] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        SEARCH_TYPES.forEach(t => {
            init[t] = currentPrimaryKeyword(t);
        });
        return init;
    });

    const save = () => {
        SEARCH_TYPES.forEach(t => {
            saveKeywordOverride(t, values[t] ?? "");
        });
        Toast.success("关键词已保存");
        onClose();
    };

    const reset = () => {
        resetKeywordOverrides();
        const init: Record<string, string> = {};
        SEARCH_TYPES.forEach(t => {
            init[t] = currentPrimaryKeyword(t);
        });
        setValues(init);
        Toast.success("已恢复默认关键词");
    };

    const LABELS: Record<string, string> = {
        music: "歌曲",
        album: "专辑",
        artist: "歌手",
        sheet: "歌单",
        lyric: "歌词",
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
                        探测关键词
                    </ThemeText>
                </LinearGradient>
                <View style={[styles.metaRow, { borderBottomColor: colors.border }]}>
                    <ThemeText fontSize="description" fontColor="textSecondary">
                        每类型首词用自定义词探测，无结果自动补默认词
                    </ThemeText>
                </View>
                <ScrollView style={{ maxHeight: 360 }}>
                    {SEARCH_TYPES.map((t, idx) => (
                        <View key={t}>
                            {idx > 0 ? <ListDivider marginLeft={16} /> : null}
                            <View style={styles.kwRow}>
                                <ThemeText fontSize="content" style={{ width: 56 }}>
                                    {LABELS[t]}
                                </ThemeText>
                                <TextInput
                                    style={[
                                        styles.kwInput,
                                        {
                                            borderColor: colors.border,
                                            color: colors.text,
                                            backgroundColor: colors.background,
                                        },
                                    ]}
                                    value={values[t] ?? ""}
                                    onChangeText={v =>
                                        setValues(prev => ({ ...prev, [t]: v }))
                                    }
                                    placeholder="留空恢复默认"
                                    placeholderTextColor={colors.textSecondary}
                                    maxLength={20}
                                />
                            </View>
                        </View>
                    ))}
                </ScrollView>
                <View
                    style={[
                        styles.dialogActions,
                        { borderTopColor: colors.border },
                    ]}>
                    <Pressable style={styles.dialogActionBtn} onPress={reset}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor="textSecondary">
                            恢复默认
                        </ThemeText>
                    </Pressable>
                    <Pressable style={styles.dialogActionBtn} onPress={save}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor="primary">
                            保存
                        </ThemeText>
                    </Pressable>
                    <Pressable style={styles.dialogActionBtn} onPress={onClose}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor="textSecondary">
                            取消
                        </ThemeText>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

/** 删除所选确认弹窗（三级弹窗规范） */
function ConfirmDeleteDialog(props: {
    count: number;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const { count, onCancel, onConfirm } = props;
    const colors = useColors();
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
                        删除音源
                    </ThemeText>
                </LinearGradient>
                <View style={[styles.metaRow, { borderBottomColor: colors.border }]}>
                    <ThemeText fontSize="content" fontColor="textSecondary">
                        确认删除选中的 {count} 个音源？将同时卸载插件文件，不可恢复。
                    </ThemeText>
                </View>
                <View
                    style={[
                        styles.dialogActions,
                        { borderTopColor: colors.border },
                    ]}>
                    <Pressable style={styles.dialogActionBtn} onPress={onCancel}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor="textSecondary">
                            取消
                        </ThemeText>
                    </Pressable>
                    <Pressable style={styles.dialogActionBtn} onPress={onConfirm}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor="primary">
                            确认删除
                        </ThemeText>
                    </Pressable>
                </View>
            </View>
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
    topBarActions: {
        flexDirection: "row",
        alignItems: "center",
    },
    /** 手机版：分级 chips 行 */
    chipsRow: {
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    chipsContent: {
        paddingHorizontal: 16,
        flexDirection: "row",
        gap: 8,
    },
    chip: {
        height: 30,
        paddingHorizontal: 12,
        borderRadius: 15,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    chipDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    /** 手机版：左缘分级色条 */
    rowWrap: {
        flexDirection: "row",
        alignItems: "stretch",
    },
    tierBar: {
        width: 4,
        borderRadius: 2,
        marginVertical: 12,
        marginLeft: 10,
    },
    checkCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        marginLeft: 10,
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
    },
    emptyBtn: {
        marginTop: 16,
        height: 36,
        paddingHorizontal: 24,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    /** 报告弹窗：模式 tabs */
    reportTabs: {
        flexDirection: "row",
        marginBottom: 6,
    },
    reportTab: {
        height: 28,
        paddingHorizontal: 12,
        borderRadius: 14,
        marginRight: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    reportTabHint: {
        marginBottom: 2,
    },
    /** 关键词设置弹窗 */
    kwRow: {
        height: 52,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    kwInput: {
        flex: 1,
        height: 36,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
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
