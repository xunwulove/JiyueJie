import React, { useEffect, useState } from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import Slider from "@react-native-community/slider";
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
import {
    applyBandLevel,
    applyBassBoost,
    applyEqEnabled,
    applyEqPreset,
    applyVirtualizer,
    getSoundEffectInfo,
    initBandsIfNeeded,
} from "@/core/soundEffect";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";

interface ISoundEffectInfo {
    bands: number;
    centerFreqs: number[];
    presets: string[];
    levelMin: number;
    levelMax: number;
}

/** 音效设置（均衡器/低音增强/环绕声）——独立二级页，即改即生效 */
export default function SoundEffectSetting() {
    const { t } = useI18N();
    const colors = useColors();

    const eqEnabled = useAppConfig("sound.eqEnabled");
    const eqPreset = useAppConfig("sound.eqPreset") ?? -1;
    const eqBands = useAppConfig("sound.eqBands") ?? [];
    const bassBoost = useAppConfig("sound.bassBoost") ?? 0;
    const virtualizer = useAppConfig("sound.virtualizer") ?? 0;

    const [info, setInfo] = useState<ISoundEffectInfo | null>(null);

    useEffect(() => {
        (async () => {
            const i = await getSoundEffectInfo();
            setInfo(i);
            if (i) {
                initBandsIfNeeded(i.bands);
            }
        })();
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
    const presets = info?.presets ?? [];
    const levelMin = info?.levelMin ?? -1500;
    const levelMax = info?.levelMax ?? 1500;

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

                            {/* 预设胶囊（手动 + 系统预设） */}
                            <View style={style.presetArea}>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="textSecondary">
                                    {t("soundEffect.preset")}
                                </ThemeText>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={style.chipRow}>
                                    {["手动", ...presets].map((name, idx) => {
                                        const presetIndex = idx - 1; // 0 -> -1(手动)
                                        const active =
                                            eqPreset === presetIndex;
                                        return (
                                            <Pressable
                                                key={idx}
                                                onPress={() =>
                                                    applyEqPreset(presetIndex)
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
                                    })}
                                </ScrollView>
                            </View>
                            <ListDivider marginLeft={16} />

                            {/* EQ 频段滑块网格 */}
                            {bands > 0 ? (
                                <View style={style.eqGrid}>
                                    {Array.from({ length: bands }).map(
                                        (_, i) => {
                                            const freq =
                                                info?.centerFreqs?.[i] ?? 0;
                                            const level =
                                                (eqBands as number[])?.[i] ??
                                                0;
                                            return (
                                                <View
                                                    key={i}
                                                    style={style.eqColumn}>
                                                    <ThemeText
                                                        fontSize="caption"
                                                        fontColor="textSecondary">
                                                        {freq >= 1000
                                                            ? `${(freq / 1000).toFixed(1)}k`
                                                            : `${freq}`}
                                                    </ThemeText>
                                                    <View
                                                        style={
                                                            style.eqSliderWrap
                                                        }>
                                                        <Slider
                                                            style={
                                                                style.eqSlider
                                                            }
                                                            minimumValue={
                                                                levelMin
                                                            }
                                                            maximumValue={
                                                                levelMax
                                                            }
                                                            step={50}
                                                            value={level}
                                                            minimumTrackTintColor={
                                                                colors.primary
                                                            }
                                                            maximumTrackTintColor={
                                                                colors.divider
                                                            }
                                                            thumbTintColor={
                                                                colors.primary
                                                            }
                                                            onValueChange={v =>
                                                                applyBandLevel(
                                                                    i,
                                                                    Math.round(
                                                                        v,
                                                                    ),
                                                                )
                                                            }
                                                        />
                                                    </View>
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
                                                </View>
                                            );
                                        },
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
                            {/* 低音增强 */}
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
                                        {Math.round((bassBoost / 10))}%
                                    </ThemeText>
                                </View>
                                <Slider
                                    style={style.slider}
                                    minimumValue={0}
                                    maximumValue={100}
                                    step={1}
                                    value={Math.round(bassBoost / 10)}
                                    minimumTrackTintColor={colors.primary}
                                    maximumTrackTintColor={colors.divider}
                                    thumbTintColor={colors.primary}
                                    onValueChange={v =>
                                        applyBassBoost(Math.round(v * 10))
                                    }
                                />
                            </View>
                            <ListDivider marginLeft={16} />
                            {/* 环绕声 */}
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
                                    minimumTrackTintColor={colors.primary}
                                    maximumTrackTintColor={colors.divider}
                                    thumbTintColor={colors.primary}
                                    onValueChange={v =>
                                        applyVirtualizer(Math.round(v * 10))
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
        paddingTop: rpx(12),
        paddingBottom: rpx(16),
    },
    chipRow: {
        gap: rpx(10),
        paddingTop: rpx(10),
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
    eqGrid: {
        flexDirection: "row",
        paddingHorizontal: rpx(16),
        paddingVertical: rpx(20),
        gap: rpx(4),
    },
    eqColumn: {
        flex: 1,
        alignItems: "center",
    },
    eqSliderWrap: {
        height: rpx(150),
        justifyContent: "center",
        marginVertical: rpx(6),
    },
    eqSlider: {
        width: rpx(150),
        transform: [{ rotate: "-90deg" }],
    },
    eqGridHint: {
        padding: rpx(24),
        alignItems: "center",
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
