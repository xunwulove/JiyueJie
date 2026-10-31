/**
 * 源鉴·音源详情（二级页，独立 App「源鉴」手机版）
 *
 * 从探测页点击源卡片进入：能力矩阵（声明 vs 实测）+ 失败原因人话化 +
 * 建议动作 + 样本信息 + 一键试听（简单播放，真实出声，可停止）。
 */
import { useMemo, useState } from "react";
import {
    FlatList,
    Pressable,
    StyleSheet,
    View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import { ListDivider } from "@/components/base/divider";
import Toast from "@/utils/toast";
import { SEARCH_TYPES, explainError } from "@/core/probe";
import { tierOf, SourceTier } from "@/core/probe/report";
import {
    playSample,
    stopSample,
} from "@/core/probe/playback";
import pluginManager from "@/core/pluginManager";
import { useParams } from "@/core/router";

/** 五档配色（与探测页色条一致） */
export const TIER_COLORS: Record<SourceTier, string> = {
    全通: "#22C55E",
    可解析不可播: "#F59E0B",
    半可用: "#EAB308",
    歌单型: "#8B5CF6",
    死源: "#EF4444",
};

export default function ProbeDetailPage() {
    const colors = useColors();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const params = useParams<"probe-detail">();
    const result = params.result;

    const [sampleState, setSampleState] = useState<
        "idle" | "loading" | "playing" | "error"
    >("idle");
    const [sampleError, setSampleError] = useState("");

    const isTablet = width >= 600;
    const contentWidth = isTablet ? Math.min(width * 0.6, 720) : width;
    const tier = tierOf(result);

    const rows: {
        label: string;
        declared: boolean;
        actual: boolean;
        note?: string;
    }[] = useMemo(() => {
        return [
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
            { label: "歌单首曲可解析", declared: result.abilities.musicSheetInfo && result.abilities.mediaSource, actual: result.sheetsFirstOk ?? false, note: result.sheetsOk ? "首曲解析出播放地址" : "无歌单，跳过" },
            { label: "歌单详情", declared: result.abilities.musicSheetInfo, actual: result.abilities.musicSheetInfo, note: "声明即可用" },
            { label: "歌单标签可拉取", declared: result.abilities.recommendSheetTags || result.abilities.recommendSheetsByTag, actual: result.sheetTagsOk ?? false, note: result.sheetTagsError },
            { label: "榜单详情", declared: result.abilities.topListDetail, actual: result.abilities.topListDetail, note: "声明即可用" },
            { label: "歌手作品", declared: result.abilities.artistWorks, actual: result.artistWorksOk, note: result.artistWorksError },
            { label: "专辑", declared: result.abilities.albumInfo, actual: result.albumOk, note: result.albumError },
            { label: "评论", declared: result.abilities.musicComments, actual: result.commentsOk, note: result.commentsError },
            { label: "导入歌单", declared: result.abilities.importMusicSheet, actual: result.abilities.importMusicSheet, note: "声明即可用" },
        ];
    }, [result]);

    /** 失败原因人话（汇总播放/解析/搜索） */
    const failureHuman = useMemo(() => {
        const raw = result.playError || result.mediaSourceError || result.searchError;
        return explainError(raw);
    }, [result]);

    /** 一键试听：用样本歌曲重新搜索 → 解析 → 真实播放（可停止） */
    const toggleSample = async () => {
        if (sampleState === "playing") {
            await stopSample();
            setSampleState("idle");
            return;
        }
        if (!result.sampleTitle) {
            Toast.warn("该源无样本歌曲，无法试听");
            return;
        }
        const plugin = pluginManager.getByHash(result.hash);
        if (!plugin?.methods.search || !plugin.methods.getMediaSource) {
            Toast.warn("该源未实现搜索/解析，无法试听");
            return;
        }
        setSampleState("loading");
        setSampleError("");
        try {
            const kw = result.sampleTitle;
            const r = await plugin.methods.search(kw, 1, "music");
            const first = r?.data?.[0];
            if (!first?.id && !first?.url) {
                throw new Error("未找到可试听歌曲");
            }
            const src = await plugin.methods.getMediaSource(first, "standard");
            if (!src?.url) {
                throw new Error("解析播放地址失败");
            }
            await playSample(src.url, src.headers);
            setSampleState("playing");
        } catch (e) {
            setSampleError(explainError(e instanceof Error ? e.message : String(e)));
            setSampleState("error");
        }
    };

    /** 退出时停止试听，避免残留出声 */
    const close = () => {
        void stopSample();
        navigation.goBack();
    };

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <LinearGradient
                colors={[
                    Color(colors.primary).alpha(0.14).toString(),
                    Color(colors.primary).alpha(0.04).toString(),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.topBar, { paddingTop: insets.top }]}>
                <View style={[styles.topBarRow, { width: contentWidth, alignSelf: "center" }]}>
                    <Pressable style={styles.backBtn} onPress={close} hitSlop={8}>
                        <ThemeText fontSize="title" fontColor="textSecondary">
                            ‹
                        </ThemeText>
                    </Pressable>
                    <ThemeText fontSize="title" fontWeight="bold" numberOfLines={1} style={styles.title}>
                        {result.name}
                    </ThemeText>
                    <View style={styles.tierPillWrap}>
                        <View style={[styles.tierPill, { backgroundColor: TIER_COLORS[tier] + "22" }]}>
                            <View style={[styles.tierDot, { backgroundColor: TIER_COLORS[tier] }]} />
                            <ThemeText fontSize="caption" fontWeight="medium" fontColor="textSecondary">
                                {tier}
                            </ThemeText>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            <View style={[styles.content, { width: contentWidth, alignSelf: "center" }]}>
                {/* meta 行 */}
                <View style={[styles.metaRow, { borderBottomColor: colors.border }]}>
                    <ThemeText fontSize="description" fontColor="textSecondary">
                        耗时 {result.durationMs}ms · {result.enabled ? "已启用" : "未启用"} · 样本：
                        {result.sampleTitle
                            ? `${result.sampleTitle}${result.sampleArtist ? ` - ${result.sampleArtist}` : ""}`
                            : "无"}
                    </ThemeText>
                </View>

                {/* 建议动作 / 人话原因 */}
                {failureHuman ? (
                    <View style={[styles.adviceCard, { backgroundColor: colors.primary + "0D" }]}>
                        <ThemeText fontSize="content" fontColor="textSecondary">
                            {failureHuman}
                        </ThemeText>
                    </View>
                ) : null}

                {/* 能力矩阵 */}
                <FlatList
                    data={rows.map((r, idx) => ({ ...r, id: idx }))}
                    keyExtractor={item => String(item.id)}
                    style={{ flex: 1 }}
                    ItemSeparatorComponent={() => <ListDivider marginLeft={16} />}
                    renderItem={({ item }) => (
                        <View style={styles.matrixRow}>
                            <ThemeText fontSize="content" style={{ flex: 1, marginRight: 8 }} numberOfLines={1}>
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
            </View>

            {/* 底部试听栏 */}
            <LinearGradient
                colors={[
                    Color(colors.primary).alpha(0.10).toString(),
                    Color(colors.primary).alpha(0.07).toString(),
                    "rgba(0,0,0,0.016)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.sampleBar, { paddingBottom: insets.bottom }]}>
                <View style={[styles.sampleBarInner, { width: contentWidth }]}>
                    <ThemeText fontSize="caption" fontColor="textSecondary" numberOfLines={1} style={{ flex: 1, marginRight: 8 }}>
                        {sampleState === "loading"
                            ? "正在解析并试听…"
                            : sampleState === "playing"
                                ? "试听中：真实出声（样本歌曲）"
                                : sampleState === "error"
                                    ? `试听失败：${sampleError}`
                                    : "试听样本歌曲（真实播放，可停止）"}
                    </ThemeText>
                    <Pressable
                        style={[
                            styles.sampleBtn,
                            {
                                borderColor: sampleState === "playing" ? colors.primary : colors.border,
                                backgroundColor: sampleState === "playing" ? colors.primary + "1A" : "transparent",
                            },
                        ]}
                        disabled={sampleState === "loading"}
                        onPress={toggleSample}>
                        <ThemeText
                            fontSize="subTitle"
                            fontWeight="medium"
                            fontColor={sampleState === "playing" ? "primary" : "textSecondary"}>
                            {sampleState === "playing" ? "停止" : "试听"}
                        </ThemeText>
                    </Pressable>
                </View>
            </LinearGradient>
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

const styles = StyleSheet.create({
    root: { flex: 1 },
    topBar: {
        paddingHorizontal: 8,
    },
    topBarRow: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
    },
    backBtn: {
        width: 36,
        height: 36,
        justifyContent: "center",
    },
    title: {
        flex: 1,
        marginLeft: 4,
    },
    tierPillWrap: {
        marginLeft: 8,
    },
    tierPill: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        height: 26,
        borderRadius: 13,
    },
    tierDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    content: {
        flex: 1,
    },
    metaRow: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    adviceCard: {
        marginHorizontal: 16,
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
    },
    matrixRow: {
        minHeight: 52,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    matrixDotWrap: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 12,
    },
    matrixDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
    },
    sampleBar: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(128,128,128,0.3)",
    },
    sampleBarInner: {
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
    },
    sampleBtn: {
        height: 36,
        paddingHorizontal: 20,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
});
