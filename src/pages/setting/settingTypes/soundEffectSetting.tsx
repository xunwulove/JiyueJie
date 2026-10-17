import React, { useEffect, useState } from "react";
import {
    DeviceEventEmitter,
    NativeModules,
    Platform,
    Pressable,
    requireNativeComponent,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import Slider from "@react-native-community/slider";
import AppBar from "@/components/base/appBar";
import Icon from "@/components/base/icon.tsx";
import { ListDivider } from "@/components/base/divider";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import ListItem from "@/components/base/listItem";
import StatusBar from "@/components/base/statusBar";
import ThemeText from "@/components/base/themeText";
import ThemeSwitch from "@/components/base/switch";
import { showDialog } from "@/components/dialogs/useDialog";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import { useAppConfig } from "@/core/appConfig";
import Config from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import ReactNativeTrackPlayer, {
    Event,
} from "react-native-track-player";
import {
    applyBandLevel,
    applyDdc,
    applyEqEnabled,
    applyEqPreset,
    applyReverb,
    ddcCustomList,
    deleteDdcPreset,
    ensureSoundEffectAttached,
    EQ_PRESETS,
    getOutputDevice,
    getSoundEffectInfo,
    importDdcPreset,
    initBandsIfNeeded,
    isSoundEffectAttached,
} from "@/core/soundEffect";
import {
    setPostGain,
    setBassBoost as setJamesDspBass,
    setStereoEnhancement,
    setVacuumTube,
    setCrossfeed,
    resetAll as resetJamesDsp,
    REVERB_PRESETS,
    CROSSFEED_MODES,
    IR_PRESETS,
    DDC_HEADPHONES,
} from "@/core/jamesdsp";
import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
import rpx from "@/utils/rpx";
import { iconSizeConst } from "@/constants/uiConst";

interface ISoundEffectInfo {
    bands: number;
    centerFreqs: number[];
    presets: string[];
    levelMin: number;
    levelMax: number;
    bassSupported: boolean;
    virtualizerSupported: boolean;
    loudnessSupported: boolean;
    presetReverbSupported: boolean;
    envReverbSupported: boolean;
    dynamicsSupported: boolean;
}

/** 单 View 参数 EQ 高度：手机 ≈180dp（顶部增益+曲线区+底部频率），平板 280dp */
const EQ_VIEW_H_PHONE = rpx(360);
const EQ_VIEW_H_TABLET = 280;

/** 单 View 参数 EQ（原生：网格+曲线+圆球+标签一体，setLayerType 软件层防卡顿） */
const NativeEqCurve = requireNativeComponent<any>("RCTEqCurve");

/** 音效设置（均衡器/低音增强/环绕声）——独立二级页，即改即生效 */
export default function SoundEffectSetting() {
    const { t } = useI18N();
    const colors = useColors();
    // 宽屏（平板/车机）左右布局；窄屏（手机）上下布局，避免 10 段拇指重叠
    const isWide = useIsTablet();

    const eqEnabled = useAppConfig("sound.eqEnabled");
    const eqPreset = useAppConfig("sound.eqPreset") ?? -1;

    // info 仅用于驱动下方 initBandsIfNeeded（i.bands）；能力字段已随旧 AudioEffect UI 下线，故不读取 info 值
    const [, setInfo] = useState<ISoundEffectInfo | null>(null);
    // 当前输出设备（音效页诊断用）
    const [outputDevice, setOutputDevice] = useState<{
        type: string;
        name: string;
    } | null>(null);
    // 原生 DSP 实际状态（JamesDSPModule.getDspDiagnostics + JamesDspConfigChanged 事件）
    const [dspDiag, setDspDiag] = useState<{
        active?: boolean;
        inputEncoding?: string;
        sampleRate?: number;
        bypassed?: boolean;
        bypassReason?: string;
    } | null>(null);

    // ===== JamesDSP 进阶音效状态（config 持久化） =====
    const jdspPostGain = useAppConfig("jdsp.postGain") ?? 0;
    const jdspBassEnabled = useAppConfig("jdsp.bassEnabled") ?? false;
    const jdspBassGain = useAppConfig("jdsp.bassGain") ?? 6;
    const jdspStereoEnabled = useAppConfig("jdsp.stereoEnabled") ?? false;
    const jdspStereoMix = useAppConfig("jdsp.stereoMix") ?? 0.3;
    const jdspReverbEnabled = useAppConfig("jdsp.reverbEnabled") ?? false;
    const jdspReverbPreset = useAppConfig("jdsp.reverbPreset") ?? 1;
    const jdspReverbEngine = useAppConfig("jdsp.reverbEngine") ?? 0;
    const jdspTubeEnabled = useAppConfig("jdsp.tubeEnabled") ?? false;
    const jdspTubeGain = useAppConfig("jdsp.tubeGain") ?? 6;
    const jdspCrossfeedEnabled = useAppConfig("jdsp.crossfeedEnabled") ?? false;
    const jdspCrossfeedMode = useAppConfig("jdsp.crossfeedMode") ?? 0;
    const jdspConvolverEnabled = useAppConfig("jdsp.convolverEnabled") ?? false;
    const jdspConvolverPreset = useAppConfig("jdsp.convolverPreset") ?? 0;
    const jdspDdcEnabled = useAppConfig("jdsp.ddcEnabled") ?? false;
    const jdspDdcHeadphone = useAppConfig("jdsp.ddcHeadphone") ?? 0;
    const jdspDdcCustom = useAppConfig("jdsp.ddcCustom") ?? [];
    // JamesDSP 固定 15 段 EQ 自定义增益（必须与其它 Hook 一起在平台早退之前调用，避免条件 Hook）
    const eqBands15 = useAppConfig("jdsp.eqBands") ?? new Array(15).fill(0);

    /** 打开文件选择器导入耳机补偿 IR（三级浮窗 + 说明文字） */
    const onImportDdc = () => {
        showDialog("FileSelectorDialog", {
            fileType: "file",
            multi: false,
            actionText: "导入",
            description:
                "请导入 48kHz 采样率的 WAV 脉冲响应（IR）文件作为耳机频响补偿。非 48kHz 文件可能加载失败或效果异常。",
            matchExtension: p => p.toLowerCase().endsWith(".wav"),
            async onAction(selected) {
                const path = selected[0]?.path;
                if (path) {
                    const ok = await importDdcPreset(path);
                    if (ok) {
                        // 导入成功：自动选中并生效（最后一项）
                        const idx =
                            DDC_HEADPHONES.length + ddcCustomList().length - 1;
                        applyDdc(true, idx);
                    } else {
                        showDialog("SimpleDialog", {
                            title: "导入失败",
                            content: "导入失败：请确认选择的是 WAV 文件。",
                        });
                    }
                }
                return true;
            },
        });
    };

    /** 长按导入款 → 确认删除 */
    const onDeleteDdcCustom = (ci: number) => {
        const item = jdspDdcCustom[ci];
        showDialog("SimpleDialog", {
            title: "删除耳机预设",
            content: `确定删除「${item?.name ?? ""}」？该文件将从应用内移除。`,
            onOk: () => deleteDdcPreset(ci),
        });
    };

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
        getOutputDevice().then(setOutputDevice);
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

    // 原生 DSP 状态诊断：挂载查一次 + 监听原生配置变化事件刷新；
    // 模块/方法不可用（非 Android、旧构建）时静默降级，不报错、不渲染该行
    useEffect(() => {
        if (Platform.OS !== "android") {
            return;
        }
        const refreshDsp = async () => {
            try {
                const mod = (NativeModules as any)?.JamesDSPModule;
                const diag = await mod?.getDspDiagnostics?.();
                if (diag) {
                    setDspDiag(diag);
                }
            } catch {
                // 静默降级
            }
        };
        refreshDsp();
        const dspSub = DeviceEventEmitter.addListener(
            "JamesDspConfigChanged",
            (payload: any) => {
                if (payload) {
                    setDspDiag(payload);
                }
            },
        );
        return () => {
            dspSub.remove();
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

    // JamesDSP 固定 15 段 EQ，不依赖系统 AudioEffect
    const bands = 15;
    // 预设列表固定用内置预设（不依赖设备系统预设，跨设备统一）
    const presets = EQ_PRESETS.map(p => p.name);
    // 滑块范围：毫分贝 -1200..1200（显示时 ÷100 = dB），保持精度
    const levelMin = -1200;
    const levelMax = 1200;
    // 旧 10 段毫分贝预设 → 15 段毫分贝（线性插值）
    const presetTo15 = (oldBands: number[]): number[] => {
        const result = new Array(15).fill(0);
        for (let i = 0; i < 15; i++) {
            const pos = (i / 14) * (oldBands.length - 1);
            const idx = Math.floor(pos);
            const frac = pos - idx;
            const v0 = oldBands[idx] ?? 0;
            const v1 = oldBands[Math.min(idx + 1, oldBands.length - 1)] ?? 0;
            result[i] = v0 + (v1 - v0) * frac;
        }
        return result;
    };
    // 均衡器关闭：滑块归中（0 dB）；开启且选中预设：跟随预设；否则：自定义 15段 dB→毫分贝
    // 防御性计算：任何异常（config 中 jdsp.eqBands 非数组 / 含 null / NaN）都回退全 0，
    // 保证滑块区始终可渲染，不会因 displayBands 计算抛错/NaN 而整块消失
    const displayBands: number[] = (() => {
        const safe = () => Array.from({ length: bands }, () => 0);
        if (!eqEnabled) return safe();
        try {
            if (eqPreset >= 0) {
                const p = EQ_PRESETS[eqPreset];
                return p ? presetTo15(p.bands) : safe();
            }
            const src: unknown = eqBands15;
            if (!Array.isArray(src)) return safe();
            const out: number[] = new Array(bands).fill(0);
            for (let i = 0; i < bands; i++) {
                const v = (src as unknown[])[i];
                out[i] = typeof v === "number" && Number.isFinite(v) ? v * 100 : 0;
            }
            return out;
        } catch {
            return safe();
        }
    })();

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar>{t("soundEffect.title")}</AppBar>
            <HorizontalSafeAreaView style={style.wrapper}>
                <ScrollView contentContainerStyle={style.scrollContent}>
                    {/* 音效实时生效提示（大白话） */}
                    <View style={style.hintRow}>
                        <ThemeText fontSize="caption" fontColor="textSecondary">
                            {t("soundEffect.hint")}
                        </ThemeText>
                    </View>
                    {/* ===== 均衡器 ===== */}
                    <View style={style.group}>
                        <View style={style.groupHeader}>
                            <ThemeText
                                fontSize="subTitle"
                                fontColor="primary"
                                fontWeight="bold">
                                {t("soundEffect.sectionEq")}
                            </ThemeText>
                            <ThemeText
                                fontSize="caption"
                                fontColor="textSecondary"
                                style={style.descLine}>
                                {t("soundEffect.eqDesc")}
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
                                                        style.chipLarge,
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
                                                        fontSize="body"
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

                            {/* EQ 频段：单 View 参数 EQ（网格+曲线+圆球+标签一体）；平板 450dp 居中全显示，手机全宽 */}
                            {bands > 0 ? (
                                <View style={[style.eqBody, style.eqBodyColumn]}>
                                    {isWide ? (
                                        <NativeEqCurve
                                            style={{
                                                width: 450,
                                                height: EQ_VIEW_H_TABLET,
                                                alignSelf: "center",
                                            }}
                                            values={displayBands}
                                            minimumValue={levelMin}
                                            maximumValue={levelMax}
                                            progressColor={colors.primary}
                                            trackColor={colors.divider}
                                            disabled={!eqEnabled}
                                            onUserValue={(e: any) =>
                                                applyBandLevel(
                                                    e.nativeEvent.index,
                                                    e.nativeEvent.value,
                                                )
                                            }
                                        />
                                    ) : (
                                        <NativeEqCurve
                                            style={{
                                                width: "100%",
                                                height: EQ_VIEW_H_PHONE,
                                            }}
                                            values={displayBands}
                                            minimumValue={levelMin}
                                            maximumValue={levelMax}
                                            progressColor={colors.primary}
                                            trackColor={colors.divider}
                                            disabled={!eqEnabled}
                                            onUserValue={(e: any) =>
                                                applyBandLevel(
                                                    e.nativeEvent.index,
                                                    e.nativeEvent.value,
                                                )
                                            }
                                        />
                                    )}
                                </View>
                            ) : (
                                <View style={style.eqGridHint}>
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary">
                                        {t("soundEffect.eqWaitPlay")}
                                    </ThemeText>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ===== 进阶音效（JamesDSP 核心库） ===== */}
                    <View style={style.group}>
                        <View style={style.groupHeader}>
                            <ThemeText fontSize="subTitle" fontColor="primary" fontWeight="bold">
                                进阶音效
                            </ThemeText>
                        </View>
                        <View style={[style.card, { backgroundColor: colors.card }]}>
                            {/* 输出增益 */}
                            <ListItem withHorizontalPadding heightType="small">
                                <ListItem.Content title="输出增益" description={t("soundEffect.gainDesc")} />
                                <View style={{ width: rpx(200) }}>
                                    <Slider
                                        minimumValue={-12}
                                        maximumValue={12}
                                        step={0.5}
                                        value={jdspPostGain}
                                        onValueChange={v => {
                                            Config.setConfig("jdsp.postGain", v); setPostGain(v); 
                                        }}
                                        minimumTrackTintColor={colors.primary}
                                        thumbTintColor={colors.primary}
                                    />
                                </View>
                                <ThemeText fontSize="caption" fontColor="textSecondary">
                                    {jdspPostGain > 0 ? "+" : ""}{jdspPostGain.toFixed(1)}dB
                                </ThemeText>
                            </ListItem>
                            <ListDivider marginLeft={16} />
                            {/* 低音增强 DBB */}
                            <ListItem withHorizontalPadding heightType="small">
                                <ListItem.Content title="动态低音 (DBB)" description={t("soundEffect.dbbDesc")} />
                                <ThemeSwitch
                                    value={jdspBassEnabled}
                                    onValueChange={v => {
                                        Config.setConfig("jdsp.bassEnabled", v); setJamesDspBass(v, jdspBassGain); 
                                    }}
                                />
                            </ListItem>
                            {jdspBassEnabled && (
                                <>
                                    <ListDivider marginLeft={16} />
                                    <ListItem withHorizontalPadding heightType="small">
                                        <ListItem.Content title="低音强度" />
                                        <View style={{ width: rpx(200) }}>
                                            <Slider
                                                minimumValue={0}
                                                maximumValue={15}
                                                step={0.5}
                                                value={jdspBassGain}
                                                onValueChange={v => {
                                                    Config.setConfig("jdsp.bassGain", v); setJamesDspBass(true, v); 
                                                }}
                                                minimumTrackTintColor={colors.primary}
                                                thumbTintColor={colors.primary}
                                            />
                                        </View>
                                        <ThemeText fontSize="caption" fontColor="textSecondary">
                                            {jdspBassGain.toFixed(1)}dB
                                        </ThemeText>
                                    </ListItem>
                                </>
                            )}
                            <ListDivider marginLeft={16} />
                            {/* 立体声增强 */}
                            <ListItem withHorizontalPadding heightType="small">
                                <ListItem.Content title="立体声增强" description={t("soundEffect.stereoDesc")} />
                                <ThemeSwitch
                                    value={jdspStereoEnabled}
                                    onValueChange={v => {
                                        Config.setConfig("jdsp.stereoEnabled", v); setStereoEnhancement(v, jdspStereoMix); 
                                    }}
                                />
                            </ListItem>
                            {jdspStereoEnabled && (
                                <>
                                    <ListDivider marginLeft={16} />
                                    <ListItem withHorizontalPadding heightType="small">
                                        <ListItem.Content title="增强强度" />
                                        <View style={{ width: rpx(200) }}>
                                            <Slider
                                                minimumValue={0}
                                                maximumValue={1}
                                                step={0.05}
                                                value={jdspStereoMix}
                                                onValueChange={v => {
                                                    Config.setConfig("jdsp.stereoMix", v); setStereoEnhancement(true, v); 
                                                }}
                                                minimumTrackTintColor={colors.primary}
                                                thumbTintColor={colors.primary}
                                            />
                                        </View>
                                        <ThemeText fontSize="caption" fontColor="textSecondary">
                                            {Math.round(jdspStereoMix * 100)}%
                                        </ThemeText>
                                    </ListItem>
                                </>
                            )}
                            <ListDivider marginLeft={16} />
                            {/* 混响（算法 Progenitor2 与卷积 Convolver 合并为单一入口，段内二选一） */}
                            <ListItem withHorizontalPadding heightType="small">
                                <ListItem.Content title="混响" />
                                <ThemeSwitch
                                    value={jdspReverbEnabled || jdspConvolverEnabled}
                                    onValueChange={v => applyReverb(
                                        v,
                                        jdspReverbEngine,
                                        jdspReverbEngine === 0 ? jdspReverbPreset : jdspConvolverPreset,
                                    )}
                                />
                            </ListItem>
                            {(jdspReverbEnabled || jdspConvolverEnabled) && (
                                <>
                                    <ListDivider marginLeft={16} />
                                    {/* 引擎类型分段：算法混响 | 卷积混响 */}
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={{ paddingHorizontal: rpx(16), paddingVertical: rpx(8) }}
                                        contentContainerStyle={{ gap: rpx(8) }}>
                                        <Pressable
                                            onPress={() => applyReverb(true, 0, jdspReverbPreset)}
                                            style={[style.chipLarge, { backgroundColor: jdspReverbEngine === 0 ? colors.primary : (colors.surfaceVariant ?? colors.card) }]}>
                                            <ThemeText fontSize="body" fontWeight={jdspReverbEngine === 0 ? "medium" : "regular"} color={jdspReverbEngine === 0 ? "#FFFFFF" : (colors as any).onSurfaceVariant ?? colors.textSecondary}>
                                                算法混响
                                            </ThemeText>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => applyReverb(true, 1, jdspConvolverPreset)}
                                            style={[style.chipLarge, { backgroundColor: jdspReverbEngine === 1 ? colors.primary : (colors.surfaceVariant ?? colors.card) }]}>
                                            <ThemeText fontSize="body" fontWeight={jdspReverbEngine === 1 ? "medium" : "regular"} color={jdspReverbEngine === 1 ? "#FFFFFF" : (colors as any).onSurfaceVariant ?? colors.textSecondary}>
                                                卷积混响
                                            </ThemeText>
                                        </Pressable>
                                    </ScrollView>
                                    <ThemeText fontSize="caption" fontColor="textSecondary" style={[style.descLine, { paddingHorizontal: rpx(24), paddingBottom: rpx(4) }]}>
                                        {jdspReverbEngine === 0
                                            ? t("soundEffect.reverbDesc")
                                            : t("soundEffect.convolverDesc")}
                                    </ThemeText>
                                    <ListDivider marginLeft={16} />
                                    {jdspReverbEngine === 0 ? (
                                        /* 算法混响预设 */
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            style={{ paddingHorizontal: rpx(16), paddingVertical: rpx(8) }}
                                            contentContainerStyle={{ gap: rpx(8) }}>
                                            {REVERB_PRESETS.map((name, idx) => (
                                                <Pressable
                                                    key={idx}
                                                    onPress={() => applyReverb(true, 0, idx)}
                                                    style={[style.chipLarge, { backgroundColor: jdspReverbEnabled && jdspReverbPreset === idx ? colors.primary : colors.background }]}>
                                                    <ThemeText fontSize="body" fontColor={jdspReverbEnabled && jdspReverbPreset === idx ? "text" : "textSecondary"}>
                                                        {name}
                                                    </ThemeText>
                                                </Pressable>
                                            ))}
                                        </ScrollView>
                                    ) : (
                                        /* 卷积混响预设（真实录音 IR） */
                                        <View>
                                            <ScrollView
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                style={{ paddingHorizontal: rpx(16), paddingVertical: rpx(8) }}
                                                contentContainerStyle={{ gap: rpx(8) }}>
                                                {IR_PRESETS.map((preset, idx) => (
                                                    <Pressable
                                                        key={idx}
                                                        onPress={() => applyReverb(true, 1, idx)}
                                                        style={[style.chipLarge, { backgroundColor: jdspConvolverEnabled && jdspConvolverPreset === idx ? colors.primary : colors.background }]}>
                                                        <ThemeText fontSize="body" fontColor={jdspConvolverEnabled && jdspConvolverPreset === idx ? "text" : "textSecondary"}>
                                                            {preset.name}
                                                        </ThemeText>
                                                    </Pressable>
                                                ))}
                                            </ScrollView>
                                            <ThemeText fontSize="caption" fontColor="textSecondary" style={{ paddingHorizontal: rpx(24), paddingBottom: rpx(8) }}>
                                                真实空间录音
                                            </ThemeText>
                                        </View>
                                    )}
                                </>
                            )}
                            <ListDivider marginLeft={16} />
                            {/* 电子管模拟 */}
                            <ListItem withHorizontalPadding heightType="small">
                                <ListItem.Content title="电子管模拟" description={t("soundEffect.tubeDesc")} />
                                <ThemeSwitch
                                    value={jdspTubeEnabled}
                                    onValueChange={v => {
                                        Config.setConfig("jdsp.tubeEnabled", v); setVacuumTube(v, jdspTubeGain); 
                                    }}
                                />
                            </ListItem>
                            {jdspTubeEnabled && (
                                <>
                                    <ListDivider marginLeft={16} />
                                    <ListItem withHorizontalPadding heightType="small">
                                        <ListItem.Content title="驱动增益" />
                                        <View style={{ width: rpx(200) }}>
                                            <Slider
                                                minimumValue={0}
                                                maximumValue={24}
                                                step={0.5}
                                                value={jdspTubeGain}
                                                onValueChange={v => {
                                                    Config.setConfig("jdsp.tubeGain", v); setVacuumTube(true, v); 
                                                }}
                                                minimumTrackTintColor={colors.primary}
                                                thumbTintColor={colors.primary}
                                            />
                                        </View>
                                        <ThemeText fontSize="caption" fontColor="textSecondary">
                                            {jdspTubeGain.toFixed(1)}dB
                                        </ThemeText>
                                    </ListItem>
                                </>
                            )}
                            <ListDivider marginLeft={16} />
                            {/* 交叉馈送 */}
                            <ListItem withHorizontalPadding heightType="small">
                                <ListItem.Content title="交叉馈送 (Crossfeed)" description={t("soundEffect.crossfeedDesc")} />
                                <ThemeSwitch
                                    value={jdspCrossfeedEnabled}
                                    onValueChange={v => {
                                        Config.setConfig("jdsp.crossfeedEnabled", v); setCrossfeed(v, jdspCrossfeedMode); 
                                    }}
                                />
                            </ListItem>
                            {jdspCrossfeedEnabled && (
                                <>
                                    <ListDivider marginLeft={16} />
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={{ paddingHorizontal: rpx(16), paddingVertical: rpx(8) }}
                                        contentContainerStyle={{ gap: rpx(8) }}>
                                        {CROSSFEED_MODES.map((name, idx) => (
                                            <Pressable
                                                key={idx}
                                                onPress={() => {
                                                    Config.setConfig("jdsp.crossfeedMode", idx); setCrossfeed(true, idx); 
                                                }}
                                                style={[style.chipLarge, { backgroundColor: jdspCrossfeedMode === idx ? colors.primary : colors.background }]}>
                                                <ThemeText fontSize="body" fontColor={jdspCrossfeedMode === idx ? "text" : "textSecondary"}>
                                                    {name}
                                                </ThemeText>
                                            </Pressable>
                                        ))}
                                    </ScrollView>
                                </>
                            )}
                            <ListDivider marginLeft={16} />
                            {/* ViPER-DDC 耳机补偿（与卷积混响互斥，共用 Convolver） */}
                            <ListItem withHorizontalPadding heightType="small">
                                <ListItem.Content title="ViPER-DDC 耳机补偿" description={t("soundEffect.ddcDesc")} />
                                <ThemeSwitch
                                    value={jdspDdcEnabled}
                                    onValueChange={v => applyDdc(v, jdspDdcHeadphone as number)}
                                />
                            </ListItem>
                            {jdspDdcEnabled && (
                                <>
                                    <ListDivider marginLeft={16} />
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={{ paddingHorizontal: rpx(16), paddingVertical: rpx(8) }}
                                        contentContainerStyle={{ gap: rpx(8) }}>
                                        {DDC_HEADPHONES.map((hp, idx) => (
                                            <Pressable
                                                key={`builtin-${idx}`}
                                                onPress={() => applyDdc(true, idx)}
                                                style={[style.chipLarge, { backgroundColor: jdspDdcHeadphone === idx ? colors.primary : colors.background }]}>
                                                <ThemeText fontSize="body" fontColor={jdspDdcHeadphone === idx ? "text" : "textSecondary"}>
                                                    {hp.name}
                                                </ThemeText>
                                            </Pressable>
                                        ))}
                                        {jdspDdcCustom.map((item, ci) => {
                                            const globalIdx = DDC_HEADPHONES.length + ci;
                                            return (
                                                <Pressable
                                                    key={`custom-${ci}`}
                                                    onPress={() => applyDdc(true, globalIdx)}
                                                    onLongPress={() => onDeleteDdcCustom(ci)}
                                                    style={[style.chipLarge, { backgroundColor: jdspDdcHeadphone === globalIdx ? colors.primary : colors.background }]}>
                                                    <ThemeText fontSize="body" fontColor={jdspDdcHeadphone === globalIdx ? "text" : "textSecondary"}>
                                                        {item.name}
                                                    </ThemeText>
                                                </Pressable>
                                            );
                                        })}
                                        <Pressable
                                            onPress={onImportDdc}
                                            style={[style.chipLarge, style.importChip, { borderColor: colors.primary }]}>
                                            <Icon name="plus" size={iconSizeConst.light} color={colors.primary} />
                                            <ThemeText fontSize="body" fontColor="primary">
                                                导入
                                            </ThemeText>
                                        </Pressable>
                                    </ScrollView>
                                </>
                            )}
                            <ListDivider marginLeft={16} />
                            {/* 全部重置 */}
                            <ListItem withHorizontalPadding heightType="small" onPress={() => {
                                Config.setConfig("jdsp.postGain", 0);
                                Config.setConfig("jdsp.bassEnabled", false);
                                Config.setConfig("jdsp.stereoEnabled", false);
                                Config.setConfig("jdsp.reverbEnabled", false);
                                Config.setConfig("jdsp.tubeEnabled", false);
                                Config.setConfig("jdsp.crossfeedEnabled", false);
                                Config.setConfig("jdsp.convolverEnabled", false);
                                Config.setConfig("jdsp.ddcEnabled", false);
                                // 原生 EQ 已随 resetJamesDsp 关闭，同步复位 UI 开关状态
                                Config.setConfig("sound.eqEnabled", false);
                                resetJamesDsp();
                            }}>
                                <ListItem.Content title="重置全部 JamesDSP" />
                                <ThemeText fontSize="content" fontColor="primary">重置</ThemeText>
                            </ListItem>
                        </View>
                    </View>

                    {/* 设备与效果器状态诊断（只读小字，宽屏一行/窄屏自动换行） */}
                    <View style={style.diagRow}>
                        <ThemeText
                            fontSize="caption"
                            fontColor="textSecondary">
                            {`${t("soundEffect.diagDeviceLabel")}：${
                                outputDevice?.type === "headset"
                                    ? t("soundEffect.deviceHeadset")
                                    : outputDevice?.type === "bluetooth"
                                        ? t("soundEffect.deviceBluetooth")
                                        : outputDevice?.type === "usb"
                                            ? t("soundEffect.deviceUsb")
                                            : outputDevice?.type === "speaker"
                                                ? t("soundEffect.deviceSpeaker")
                                                : t("soundEffect.deviceUnknown")
                            }`}
                        </ThemeText>
                        <ThemeText
                            fontSize="caption"
                            fontColor="textSecondary">
                            音效引擎：JamesDSP
                        </ThemeText>
                        <ThemeText
                            fontSize="caption"
                            fontColor="textSecondary">
                            {isSoundEffectAttached()
                                ? "已就绪"
                                : "播放后生效"}
                        </ThemeText>
                        {dspDiag ? (
                            <ThemeText
                                fontSize="caption"
                                fontColor="textSecondary">
                                {dspDiag.bypassed
                                    ? `DSP：已旁路（${dspDiag.bypassReason ?? ""}）`
                                    : `DSP：已激活（${dspDiag.inputEncoding ?? ""} · ${
                                        dspDiag.sampleRate
                                            ? `${dspDiag.sampleRate}Hz`
                                            : ""
                                    }）`}
                            </ThemeText>
                        ) : null}
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
    /* 顶部音效生效提示行 */
    hintRow: {
        paddingHorizontal: rpx(24),
        paddingTop: rpx(8),
        paddingBottom: rpx(4),
    },
    /* 术语通俗副标题（caption 小字） */
    descLine: {
        marginTop: rpx(4),
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
    /* 混响页胶囊放大版（引擎分段 + 算法/卷积预设） */
    chipLarge: {
        height: rpx(54),
        paddingHorizontal: rpx(24),
        borderRadius: rpx(27),
        alignItems: "center",
        justifyContent: "center",
    },
    importChip: {
        borderWidth: rpx(1.5),
        borderStyle: "dashed",
        flexDirection: "row",
        gap: rpx(4),
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
        flexDirection: "row",
        alignItems: "flex-start",
        gap: rpx(4),
        paddingHorizontal: rpx(4),
    },
    eqColumn: {
        flex: 1,
        alignItems: "center",
    },
    /* 平板：滑块区居中，宽度容纳 15 条（30dp×15=450dp+间距），全显示不滚动 */
    eqLeftWide: {
        maxWidth: 480,
        alignSelf: "center",
    },
    /* 平板：曲线区与滑块区同宽 */
    eqRightWide: {
        maxWidth: 480,
        alignSelf: "center",
        width: "100%",
        height: rpx(120),
    },
    /* 竖向滑块（原生 SeekBar 旋转270度） */
    /* 增益曲线区（宽屏=右列拉伸；窄屏=下方等高整行） */
    eqRight: {
        justifyContent: "center",
        paddingHorizontal: rpx(4), // 与滑块列 eqLeft 的 padding 对齐，保证曲线横线同宽
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
    /* 设备与效果器状态诊断行：宽屏一行 / 窄屏自动换行，浅色小字只读 */
    diagRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: rpx(12),
        paddingHorizontal: rpx(24),
        paddingTop: rpx(8),
        paddingBottom: rpx(4),
    },
});
