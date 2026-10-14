import React, { useEffect, useRef, useState } from "react";
import {
    DeviceEventEmitter,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import Slider from "@react-native-community/slider";
import Svg, { Path } from "react-native-svg";
import AppBar from "@/components/base/appBar";
import { ListDivider } from "@/components/base/divider";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import ListItem from "@/components/base/listItem";
import StatusBar from "@/components/base/statusBar";
import ThemeText from "@/components/base/themeText";
import ThemeSwitch from "@/components/base/switch";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import Config, { useAppConfig } from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import ReactNativeTrackPlayer, {
    Event,
} from "react-native-track-player";
import {
    applyBandLevel,
    applyBassBoost,
    applyEqEnabled,
    applyEqPreset,
    applyVirtualizer,
    ensureSoundEffectAttached,
    EQ_PRESETS,
    getSoundEffectInfo,
    getSoundEffectLastError,
    initBandsIfNeeded,
} from "@/core/soundEffect";
import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
import rpx from "@/utils/rpx";

interface ISoundEffectInfo {
    bands: number;
    centerFreqs: number[];
    presets: string[];
    levelMin: number;
    levelMax: number;
    /** 设备是否支持低音增强（attach 时构造成功 = 支持） */
    bassSupported: boolean;
    /** 设备是否支持环绕声 */
    virtualizerSupported: boolean;
}

/** 增益曲线带高度（rpx，宽屏与滑块等高） */
const CURVE_H = rpx(220);
/** 窄屏（手机）曲线带高度（rpx，独立矮条省屏） */
const CURVE_H_NARROW = rpx(110);
/** 曲线纵向波动范围（viewBox 百分比）：波动行程 = 竖线高度的一半（rpx(110)）
 *  宽屏曲线区高 220rpx → 110rpx 波动 = 50%；窄屏曲线区高 110rpx → 110rpx 波动 = 100% */
const CURVE_RANGE_WIDE = 25;
const CURVE_RANGE_NARROW = 50;

/** 竖向滑块轨道高度（rpx） */
const EQ_SLIDER_H = rpx(220);
/** 拇指直径（dp，与横向 Slider / 系统 SeekBar 默认 thumb 一致） */
const EQ_THUMB_D = 20;
/** 轨道宽度（dp，与横向 Slider track 高度一致） */
const EQ_TRACK_W = 4;
/** 触摸热区宽度（dp，触控规范 44） */
const EQ_TOUCH_W = 44;

/** Catmull-Rom 平滑：折线点集 → 三次贝塞尔路径（跨过各频段增益点） */
function smoothEqPath(points: { x: number; y: number }[]): string {
    if (points.length < 2) return "";
    const d: string[] = [
        `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`,
    ];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        d.push(
            `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(
                2,
            )} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
        );
    }
    return d.join(" ");
}

/** 由各频段增益值生成曲线 Path（viewBox 0-100 坐标，preserveAspectRatio=none 拉伸到实际宽度；x 在曲线区均匀分布） */
function buildEqCurvePath(
    eqBands: number[] | undefined,
    bands: number,
    levelMin: number,
    levelMax: number,
    range: number,
): string {
    const n = Math.max(1, bands);
    const maxAbs = Math.max(
        Math.abs(levelMin),
        Math.abs(levelMax),
        1500,
    );
    const pts = (eqBands ?? []).slice(0, n).map((lv, i) => {
        const x = ((i + 0.5) / n) * 100;
        const y = 50 - (lv / maxAbs) * range;
        return { x, y };
    });
    // 少于 2 个点时退回直线/单点
    if (pts.length < 2) {
        return pts.length === 1
            ? `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
            : "";
    }
    return smoothEqPath(pts);
}

/** 自绘竖向滑块：上下手势直接映射增益值（替代旋转 Slider，修复"视觉竖条但手势横向"导致的拖不动） */
function EqSlider({
    value,
    min,
    max,
    color,
    trackColor,
    disabled,
    onChange,
}: {
    value: number;
    min: number;
    max: number;
    color?: string;
    trackColor?: string;
    disabled?: boolean;
    onChange: (v: number) => void;
}) {
    // 手势回调经 ref 读取最新 props，避免 PanResponder 首次创建闭包过期
    const propsRef = useRef({ min, max, disabled, onChange });
    propsRef.current = { min, max, disabled, onChange };

    const handlePan = (evt: any) => {
        const { min: lo, max: hi, disabled: off, onChange: cb } =
            propsRef.current;
        if (off) return; // 关闭状态不可滑动
        const y = evt.nativeEvent.locationY; // 相对触摸容器（高 = EQ_SLIDER_H）
        const ratio = Math.min(1, Math.max(0, 1 - y / EQ_SLIDER_H));
        const v = lo + ratio * (hi - lo);
        cb(Math.round(v / 50) * 50); // step 50
    };

    const pan = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: handlePan,
            onPanResponderMove: handlePan,
            onPanResponderTerminationRequest: () => false,
        }),
    ).current;

    const span = max - min || 1;
    const ratio = Math.min(1, Math.max(0, (value - min) / span)); // 0..1，1=最高增益
    const thumbTop = (1 - ratio) * (EQ_SLIDER_H - EQ_THUMB_D);

    return (
        <View
            style={[
                style.eqSliderTouch,
                { height: EQ_SLIDER_H },
            ]}
            {...pan.panHandlers}>
            <View
                style={[
                    style.eqSliderTrack,
                    { backgroundColor: trackColor ?? "#E5E7EB" },
                ]}
            />
            <View
                style={[
                    style.eqSliderFill,
                    {
                        backgroundColor: color ?? "#4055D4",
                        height: ratio * EQ_SLIDER_H,
                    },
                ]}
            />
            <View
                style={[
                    style.eqSliderThumb,
                    {
                        backgroundColor: color ?? "#4055D4",
                        width: EQ_THUMB_D,
                        height: EQ_THUMB_D,
                        borderRadius: EQ_THUMB_D / 2,
                        top: thumbTop,
                    },
                ]}
            />
        </View>
    );
}

/** 音效设置（均衡器/低音增强/环绕声）——独立二级页，即改即生效 */
export default function SoundEffectSetting() {
    const { t } = useI18N();
    const colors = useColors();
    // 宽屏（平板/车机）左右布局；窄屏（手机）上下布局，避免 10 段拇指重叠
    const isWide = useIsTablet();

    const eqEnabled = useAppConfig("sound.eqEnabled");
    const eqPreset = useAppConfig("sound.eqPreset") ?? -1;
    const eqBands = useAppConfig("sound.eqBands") ?? [];
    const bassBoost = useAppConfig("sound.bassBoost") ?? 0;
    const virtualizer = useAppConfig("sound.virtualizer") ?? 0;

    const [info, setInfo] = useState<ISoundEffectInfo | null>(null);

    useEffect(() => {
        // 进入页面先尝试绑定（本会话播放过 → 立即成功；从未播放 → 暂缓）
        (async () => {
            await ensureSoundEffectAttached().catch(() => undefined);
            const i = await getSoundEffectInfo();
            setInfo(i);
            if (i) {
                initBandsIfNeeded(i.bands);
            }
        })();
        // 播放发生时 session 就绪 → 自动补绑并刷新：
        // PlaybackActiveTrackChanged 只在切歌时触发，恢复播放（暂停→播放同一首）不触发，
        // 因此同时监听 PlaybackState（paused→playing 也触发），并用轮询兜底
        const refresh = async () => {
            await ensureSoundEffectAttached().catch(() => undefined);
            const i = await getSoundEffectInfo();
            if (i) {
                setInfo(i);
                initBandsIfNeeded(i.bands);
            }
        };
        const sub = ReactNativeTrackPlayer.addEventListener(
            Event.PlaybackActiveTrackChanged,
            refresh,
        );
        const subState = ReactNativeTrackPlayer.addEventListener(
            Event.PlaybackState,
            refresh,
        );
        // 音频路由变化（插拔耳机）：原生已重建效果器并失效缓存 → 立即重查（频段数 5↔10 等）
        const subRouting = DeviceEventEmitter.addListener(
            "SoundEffectReattached",
            refresh,
        );
        // 轮询兜底：每 3 秒重试，成功即停（覆盖一切时序：恢复播放/缓冲完成等）
        let tries = 0;
        const timer = setInterval(async () => {
            tries += 1;
            const i = await getSoundEffectInfo();
            if (i) {
                setInfo(i);
                initBandsIfNeeded(i.bands);
                clearInterval(timer);
            } else if (tries >= 20) {
                clearInterval(timer);
            }
        }, 3000);
        return () => {
            sub.remove();
            subState.remove();
            subRouting.remove();
            clearInterval(timer);
        };
    }, []);

    if (Platform.OS !== "android") {
        return (
            <VerticalSafeAreaView style={globalStyle.fwflex1}>
                <StatusBar />
                <AppBar>{t("soundEffect.title")}</AppBar>
                <View style={style.notSupport}>
                    <ThemeText fontSize="content" fontColor="textSecondary">
                        {t("soundEffect.androidOnly")}
                    </ThemeText>
                </View>
            </VerticalSafeAreaView>
        );
    }

    const bands = info?.bands ?? 0;
    // 预设列表固定用内置预设（不依赖设备系统预设，跨设备统一）
    const presets = EQ_PRESETS.map(p => p.name);
    const levelMin = info?.levelMin ?? -1500;
    const levelMax = info?.levelMax ?? 1500;
    // 均衡器关闭时：滑块全部归中（0 dB）、曲线为水平线；eqBands 数据保留，开启后恢复
    const displayBands = eqEnabled
        ? (eqBands as number[])
        : Array.from({ length: bands }, () => 0);
    // 设备对低音增强/环绕声的支持（info 为 null = 未绑定，保守可滑，等播放后绑定生效）
    const bassUnsupported = info != null && !info.bassSupported;
    const virtualizerUnsupported =
        info != null && !info.virtualizerSupported;

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar>{t("soundEffect.title")}</AppBar>
            <HorizontalSafeAreaView style={style.wrapper}>
                <ScrollView contentContainerStyle={style.scrollContent}>
                    {/* ===== 均衡器 ===== */}
                    <View style={style.group}>
                        <View style={style.groupHeader}>
                            <ThemeText
                                fontSize="subTitle"
                                fontColor="primary"
                                fontWeight="bold">
                                {t("soundEffect.sectionEq")}
                            </ThemeText>
                        </View>
                        <View
                            style={[
                                style.card,
                                { backgroundColor: colors.card },
                            ]}>
                            <ListItem withHorizontalPadding heightType="small">
                                <ListItem.Content
                                    title={t("soundEffect.eqEnable")}
                                />
                                <ThemeSwitch
                                    value={!!eqEnabled}
                                    onValueChange={() =>
                                        applyEqEnabled(!eqEnabled)
                                    }
                                />
                            </ListItem>
                            <ListDivider marginLeft={16} />

                            {/* 预设胶囊（自定义 + 内置预设） */}
                            <View style={style.presetArea}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={style.chipRow}>
                                    {["自定义", ...presets].map(
                                        (name, idx) => {
                                            const presetIndex = idx - 1; // 0 -> -1(自定义)
                                            const active =
                                                eqPreset === presetIndex;
                                            return (
                                                <Pressable
                                                    key={idx}
                                                    onPress={() =>
                                                        applyEqPreset(
                                                            presetIndex,
                                                        )
                                                    }
                                                    style={[
                                                        style.chip,
                                                        {
                                                            backgroundColor:
                                                                colors.divider,
                                                        },
                                                        active && {
                                                            backgroundColor:
                                                                colors.primary,
                                                        },
                                                    ]}>
                                                    <ThemeText
                                                        fontSize="description"
                                                        fontColor={
                                                            active
                                                                ? "text"
                                                                : "textSecondary"
                                                        }
                                                        style={
                                                            active
                                                                ? style.chipTextActive
                                                                : undefined
                                                        }>
                                                        {name}
                                                    </ThemeText>
                                                </Pressable>
                                            );
                                        },
                                    )}
                                </ScrollView>
                            </View>
                            <ListDivider marginLeft={16} />

                            {/* EQ 频段：宽屏左滑块+右曲线（均分）；窄屏滑块上+曲线下 */}
                            {bands > 0 ? (
                                <View
                                    style={[
                                        style.eqBody,
                                        isWide
                                            ? style.eqBodyRow
                                            : style.eqBodyColumn,
                                    ]}>
                                    {/* 左/上块：竖向滑块（数值在上 / 滑块 / 频段在下） */}
                                    <View style={style.eqLeft}>
                                        {Array.from({ length: bands }).map(
                                            (_, i) => {
                                                const freq =
                                                    info?.centerFreqs?.[i] ??
                                                    0;
                                                const level =
                                                    (displayBands as number[])?.[
                                                        i
                                                    ] ?? 0;
                                                return (
                                                    <View
                                                        key={i}
                                                        style={
                                                            style.eqColumn
                                                        }>
                                                        <ThemeText
                                                            fontSize="caption"
                                                            fontColor={
                                                                level === 0
                                                                    ? "textSecondary"
                                                                    : "text"
                                                            }>
                                                            {level > 0
                                                                ? `+${(level / 100).toFixed(1)}`
                                                                : (level / 100).toFixed(
                                                                      1,
                                                                  )}
                                                        </ThemeText>
                                                        <EqSlider
                                                            value={level}
                                                            min={levelMin}
                                                            max={levelMax}
                                                            color={
                                                                colors.primary
                                                            }
                                                            trackColor={
                                                                colors.divider
                                                            }
                                                            disabled={!eqEnabled}
                                                            onChange={v =>
                                                                applyBandLevel(
                                                                    i,
                                                                    v,
                                                                )
                                                            }
                                                        />
                                                        <ThemeText
                                                            fontSize="caption"
                                                            fontColor="textSecondary">
                                                            {freq >= 1000
                                                                ? `${(freq / 1000).toFixed(1)}k`
                                                                : `${freq}`}
                                                        </ThemeText>
                                                    </View>
                                                );
                                            },
                                        )}
                                    </View>
                                    {/* 右/下块：增益曲线（与滑块区等高，实时联动） */}
                                    <View
                                        style={[
                                            style.eqRight,
                                            isWide
                                                ? {
                                                      flex: 1,
                                                      borderLeftWidth:
                                                          StyleSheet
                                                              .hairlineWidth,
                                                      borderLeftColor:
                                                          colors.divider,
                                                  }
                                                : {
                                                      height:
                                                          CURVE_H_NARROW,
                                                      borderTopWidth:
                                                          StyleSheet
                                                              .hairlineWidth,
                                                      borderTopColor:
                                                          colors.divider,
                                                  },
                                        ]}>
                                        <Svg
                                            width="100%"
                                            height={CURVE_H_NARROW}
                                            viewBox="0 0 100 100"
                                            preserveAspectRatio="none">
                                            <Path
                                                d={buildEqCurvePath(
                                                    displayBands as number[],
                                                    bands,
                                                    levelMin,
                                                    levelMax,
                                                    isWide
                                                        ? CURVE_RANGE_WIDE
                                                        : CURVE_RANGE_NARROW,
                                                )}
                                                stroke={colors.primary}
                                                strokeWidth={2.5}
                                                fill="none"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </Svg>
                                    </View>
                                </View>
                            ) : (
                                <View style={style.eqGridHint}>
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary">
                                        {t("soundEffect.eqWaitPlay")}
                                    </ThemeText>
                                    {getSoundEffectLastError() ? (
                                        <ThemeText
                                            fontSize="caption"
                                            fontColor="textSecondary"
                                            style={style.eqErrText}>
                                            {`诊断: ${getSoundEffectLastError()}`}
                                        </ThemeText>
                                    ) : null}
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ===== 音效 ===== */}
                    <View style={style.group}>
                        <View style={style.groupHeader}>
                            <ThemeText
                                fontSize="subTitle"
                                fontColor="primary"
                                fontWeight="bold">
                                {t("soundEffect.sectionFx")}
                            </ThemeText>
                        </View>
                        <View
                            style={[
                                style.card,
                                { backgroundColor: colors.card },
                            ]}>
                            {/* 低音增强（设备不支持时禁用置灰） */}
                            <View style={style.sliderRow}>
                                <View style={style.sliderLabelRow}>
                                    <ThemeText
                                        fontSize="content"
                                        fontWeight="medium">
                                        {t("soundEffect.bass")}
                                    </ThemeText>
                                    <ThemeText
                                        fontSize="content"
                                        fontColor="textSecondary">
                                        {Math.round(bassBoost / 10)}%
                                    </ThemeText>
                                </View>
                                <Slider
                                    style={style.slider}
                                    minimumValue={0}
                                    maximumValue={100}
                                    step={1}
                                    value={Math.round(bassBoost / 10)}
                                    disabled={bassUnsupported}
                                    minimumTrackTintColor={
                                        bassUnsupported
                                            ? colors.textSecondary
                                            : colors.primary
                                    }
                                    maximumTrackTintColor={
                                        bassUnsupported
                                            ? colors.divider
                                            : colors.divider
                                    }
                                    thumbTintColor={
                                        bassUnsupported
                                            ? colors.textSecondary
                                            : colors.primary
                                    }
                                    onValueChange={v =>
                                        applyBassBoost(Math.round(v * 10))
                                    }
                                />
                            </View>
                            <ListDivider marginLeft={16} />
                            {/* 环绕声（设备不支持时禁用置灰） */}
                            <View style={style.sliderRow}>
                                <View style={style.sliderLabelRow}>
                                    <ThemeText
                                        fontSize="content"
                                        fontWeight="medium">
                                        {t("soundEffect.virtualizer")}
                                    </ThemeText>
                                    <ThemeText
                                        fontSize="content"
                                        fontColor="textSecondary">
                                        {Math.round(virtualizer / 10)}%
                                    </ThemeText>
                                </View>
                                <Slider
                                    style={style.slider}
                                    minimumValue={0}
                                    maximumValue={100}
                                    step={1}
                                    value={Math.round(virtualizer / 10)}
                                    disabled={virtualizerUnsupported}
                                    minimumTrackTintColor={
                                        virtualizerUnsupported
                                            ? colors.textSecondary
                                            : colors.primary
                                    }
                                    maximumTrackTintColor={
                                        virtualizerUnsupported
                                            ? colors.divider
                                            : colors.divider
                                    }
                                    thumbTintColor={
                                        virtualizerUnsupported
                                            ? colors.textSecondary
                                            : colors.primary
                                    }
                                    onValueChange={v =>
                                        applyVirtualizer(
                                            Math.round(v * 10),
                                        )
                                    }
                                />
                            </View>
                        </View>
                    </View>

                    <View style={style.footer}>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary">
                            {t("soundEffect.hint")}
                        </ThemeText>
                    </View>
                </ScrollView>
            </HorizontalSafeAreaView>
        </VerticalSafeAreaView>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    scrollContent: {
        paddingBottom: rpx(48),
    },
    notSupport: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    group: {
        marginTop: rpx(16),
    },
    groupHeader: {
        paddingHorizontal: rpx(24),
        paddingBottom: rpx(8),
    },
    card: {
        borderRadius: rpx(12),
        marginHorizontal: rpx(16),
        overflow: "hidden",
    },
    presetArea: {
        paddingHorizontal: rpx(16),
        paddingTop: rpx(8), // 去"预设"标签后收紧
        paddingBottom: rpx(16),
    },
    chipRow: {
        gap: rpx(10),
        paddingRight: rpx(16),
    },
    chip: {
        height: rpx(44),
        paddingHorizontal: rpx(18),
        borderRadius: rpx(22),
        alignItems: "center",
        justifyContent: "center",
    },
    chipTextActive: {
        color: "#FFFFFF",
    },
    /* ===== EQ 布局（宽屏左右 / 窄屏上下） ===== */
    eqBody: {
        paddingVertical: rpx(16),
        paddingHorizontal: rpx(8),
    },
    eqBodyRow: {
        flexDirection: "row",
        alignItems: "stretch",
    },
    eqBodyColumn: {
        flexDirection: "column",
        alignItems: "stretch",
    },
    /* 滑块列 */
    eqLeft: {
        flex: 1,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: rpx(4),
        paddingHorizontal: rpx(4),
    },
    eqColumn: {
        flex: 1,
        alignItems: "center",
    },
    /* 竖向滑块（自绘，手势上下映射；视觉与横向 Slider 一致：轨道 4dp / 拇指 20dp） */
    eqSliderTouch: {
        width: EQ_TOUCH_W,
        alignItems: "center",
        justifyContent: "flex-start",
        position: "relative",
        marginVertical: rpx(6),
    },
    eqSliderTrack: {
        position: "absolute",
        left: (EQ_TOUCH_W - EQ_TRACK_W) / 2,
        top: 0,
        bottom: 0,
        width: EQ_TRACK_W,
        borderRadius: EQ_TRACK_W / 2,
        overflow: "hidden",
    },
    eqSliderFill: {
        position: "absolute",
        left: (EQ_TOUCH_W - EQ_TRACK_W) / 2,
        bottom: 0,
        width: EQ_TRACK_W,
        borderRadius: EQ_TRACK_W / 2,
    },
    eqSliderThumb: {
        position: "absolute",
        left: (EQ_TOUCH_W - EQ_THUMB_D) / 2,
    },
    /* 增益曲线区（宽屏=右列拉伸；窄屏=下方等高整行） */
    eqRight: {
        justifyContent: "center",
        paddingHorizontal: rpx(12),
    },
    eqGridHint: {
        padding: rpx(24),
        alignItems: "center",
    },
    eqErrText: {
        marginTop: rpx(8),
        textAlign: "center",
    },
    sliderRow: {
        paddingHorizontal: rpx(16),
        paddingVertical: rpx(14),
    },
    sliderLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: rpx(6),
    },
    slider: {
        width: "100%",
        height: rpx(32),
    },
    footer: {
        paddingHorizontal: rpx(24),
        paddingTop: rpx(16),
    },
});
