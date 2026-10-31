import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Slider from "@react-native-community/slider";
import rpx from "@/utils/rpx";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import ListItem from "@/components/base/listItem";
import { ListDivider } from "@/components/base/divider";
import { iconSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import PersistStatus from "@/utils/persistStatus";
import TrackPlayer from "@/core/trackPlayer";
import Config from "@/core/appConfig";
import { useAppConfig } from "@/core/appConfig";
import ThemeSwitch from "@/components/base/switch";
import ThemeText from "@/components/base/themeText";
import {
    applyDdc,
    applyEqEnabled,
    applyEqPreset,
    applyPostGainEnabled,
    applyReverb,
    ddcCustomList,
    REVERB_ENGINE_CONVOLVER,
} from "@/core/soundEffect";
import {
    setBassBoost,
    setCrossfeed,
    setPostGain,
    setStereoEnhancement,
    setVacuumTube,
    resetAll as resetJamesDsp,
    CROSSFEED_MODES,
    DDC_HEADPHONES,
    IR_PRESETS,
} from "@/core/jamesdsp";

/** 倍速档位（沿用原倍速弹窗数据） */
const RATES = [
    { label: "0.5x", value: 50 },
    { label: "0.75x", value: 75 },
    { label: "1.0x", value: 100 },
    { label: "1.25x", value: 125 },
    { label: "1.5x", value: 150 },
    { label: "2.0x", value: 200 },
];

/** 预设 tab：均衡器开关 + 4 内置预设 + 自定义（EQ_PRESETS 索引：0摇滚 1流行 2爵士 7人声） */
const EQ_ROWS = [
    { label: "流行", index: 1 },
    { label: "摇滚", index: 0 },
    { label: "爵士", index: 2 },
    { label: "人声", index: 7 },
    { label: "自定义", index: -1 },
];

type TabKey = "rate" | "eq" | "reverb" | "other";
const TABS: { key: TabKey; label: string }[] = [
    { key: "rate", label: "倍速" },
    { key: "eq", label: "预设" },
    { key: "reverb", label: "混响" },
    { key: "other", label: "其他" },
];

/**
 * 全屏播放页音效快捷入口（audio-lines）三级浮窗：4 tab 播放设置。
 * 每 tab 6 行等高（48dp）、零滚动，切 tab 高度不跳变。
 * 点选即生效、不自动关弹窗；底部按钮栏「恢复默认 + 完成」。
 */
export default function SoundEffectQuickDialog() {
    const colors = useColors();
    const { t } = useI18N();
    const [activeTab, setActiveTab] = useState<TabKey>("rate");
    // 倍速当前值（弹窗内点选后即时刷新高亮）
    const [rate, setRate] = useState(() =>
        PersistStatus.get("music.rate") ?? 100,
    );

    // ===== 预设 =====
    const eqEnabled = useAppConfig("sound.eqEnabled") ?? false;
    const eqPreset = useAppConfig("sound.eqPreset") ?? -1;

    // ===== 混响（卷积） =====
    const convolverEnabled = useAppConfig("jdsp.convolverEnabled") ?? false;
    const convolverPreset = useAppConfig("jdsp.convolverPreset") ?? 0;

    // ===== 其他 =====
    const postGainEnabled = useAppConfig("jdsp.postGainEnabled") ?? true;
    const postGain = useAppConfig("jdsp.postGain") ?? 0;
    const bassEnabled = useAppConfig("jdsp.bassEnabled") ?? false;
    const bassGain = useAppConfig("jdsp.bassGain") ?? 6;
    const stereoEnabled = useAppConfig("jdsp.stereoEnabled") ?? false;
    const stereoMix = useAppConfig("jdsp.stereoMix") ?? 0.3;
    const tubeEnabled = useAppConfig("jdsp.tubeEnabled") ?? false;
    const tubeGain = useAppConfig("jdsp.tubeGain") ?? 6;
    const crossfeedEnabled = useAppConfig("jdsp.crossfeedEnabled") ?? false;
    const crossfeedMode = useAppConfig("jdsp.crossfeedMode") ?? 0;
    const ddcEnabled = useAppConfig("jdsp.ddcEnabled") ?? false;
    const ddcHeadphone = useAppConfig("jdsp.ddcHeadphone") ?? 0;

    /** 耳机补偿当前选中名称（内置或导入款） */
    const ddcName = (() => {
        if (!ddcEnabled) return undefined;
        const builtins = DDC_HEADPHONES.length;
        if (ddcHeadphone < builtins) return DDC_HEADPHONES[ddcHeadphone]?.name;
        return ddcCustomList()[ddcHeadphone - builtins]?.name;
    })();

    /** 恢复默认：关闭全部音效 + 原生直通（倍速不动） */
    const onResetAll = () => {
        Config.setConfig("sound.eqEnabled", false);
        Config.setConfig("jdsp.postGainEnabled", false);
        Config.setConfig("jdsp.postGain", 0);
        Config.setConfig("jdsp.bassEnabled", false);
        Config.setConfig("jdsp.stereoEnabled", false);
        Config.setConfig("jdsp.reverbEnabled", false);
        Config.setConfig("jdsp.tubeEnabled", false);
        Config.setConfig("jdsp.crossfeedEnabled", false);
        Config.setConfig("jdsp.convolverEnabled", false);
        Config.setConfig("jdsp.ddcEnabled", false);
        resetJamesDsp();
    };

    /** 选中行高亮（含勾选图标） */
    const checkMark = (active: boolean) =>
        active ? (
            <ListItem.ListItemIcon
                icon="check"
                iconSize={iconSizeConst.light}
                color={colors.primary}
            />
        ) : null;

    /** 选中标题文字 */
    const rowTitle = (label: string, active: boolean) => (
        <ThemeText
            fontSize="content"
            fontWeight={active ? "semibold" : "regular"}
            fontColor={active ? "primary" : undefined}>
            {label}
        </ThemeText>
    );

    /** 其他 tab：滑杆行（开关+行内滑杆+值） */
    const sliderRow = (
        key: string,
        title: string,
        enabled: boolean,
        switchEl: React.ReactNode,
        sliderEl: React.ReactNode | null,
    ) => (
        <View key={key}>
            <ListItem withHorizontalPadding heightType="small">
                <ListItem.Content title={title} />
                {enabled ? sliderEl : null}
                {switchEl}
            </ListItem>
            <ListDivider marginLeft={16} />
        </View>
    );

    /** 其他 tab：纯开关行（开启后行内显示当前档位小字） */
    const toggleRow = (
        key: string,
        title: string,
        enabled: boolean,
        desc: string | undefined,
        switchEl: React.ReactNode,
    ) => (
        <View key={key}>
            <ListItem withHorizontalPadding heightType="small">
                <ListItem.Content title={title} description={desc} />
                {switchEl}
            </ListItem>
            <ListDivider marginLeft={16} />
        </View>
    );

    return (
        <Dialog>
            <Dialog.Title>{t("panel.playbackSetting.title")}</Dialog.Title>
            <Dialog.Content>
                {/* 4 tab 切换 */}
                <View style={styles.tabBar}>
                    {TABS.map(item => {
                        const active = activeTab === item.key;
                        return (
                            <Pressable
                                key={item.key}
                                style={[
                                    styles.tabChip,
                                    active
                                        ? { backgroundColor: colors.primary }
                                        : { backgroundColor: colors.listActive },
                                ]}
                                onPress={() => setActiveTab(item.key)}>
                                <ThemeText
                                    fontSize="content"
                                    fontWeight={
                                        active ? "semibold" : "regular"
                                    }
                                    color={
                                        active ? "white" : colors.textSecondary
                                    }>
                                    {item.label}
                                </ThemeText>
                            </Pressable>
                        );
                    })}
                </View>

                {activeTab === "rate" ? (
                    // ===== 倍速：6 档单选，即点即生效、不关弹窗 =====
                    <View>
                        {RATES.map((r, i) => {
                            const active = rate === r.value;
                            return (
                                <View key={r.value}>
                                    <ListItem
                                        withHorizontalPadding
                                        heightType="small"
                                        onPress={() => {
                                            PersistStatus.set(
                                                "music.rate",
                                                r.value,
                                            );
                                            TrackPlayer.setRate(r.value / 100);
                                            setRate(r.value);
                                        }}>
                                        <ListItem.Content
                                            title={rowTitle(r.label, active)}
                                        />
                                        {checkMark(active)}
                                    </ListItem>
                                    {i < RATES.length - 1 ? (
                                        <ListDivider marginLeft={16} />
                                    ) : null}
                                </View>
                            );
                        })}
                    </View>
                ) : null}

                {activeTab === "eq" ? (
                    // ===== 预设：均衡器开关 + 4 预设 + 自定义 =====
                    <View>
                        <View>
                            <ListItem
                                withHorizontalPadding
                                heightType="small">
                                <ListItem.Content title="均衡器" />
                                <ThemeSwitch
                                    value={eqEnabled}
                                    onValueChange={applyEqEnabled}
                                />
                            </ListItem>
                            <ListDivider marginLeft={16} />
                        </View>
                        {EQ_ROWS.map((row, i) => {
                            const active =
                                eqEnabled && eqPreset === row.index;
                            return (
                                <View key={row.label}>
                                    <ListItem
                                        withHorizontalPadding
                                        heightType="small"
                                        onPress={() =>
                                            applyEqPreset(row.index)
                                        }>
                                        <ListItem.Content
                                            title={rowTitle(
                                                row.label,
                                                active,
                                            )}
                                        />
                                        {checkMark(active)}
                                    </ListItem>
                                    {i < EQ_ROWS.length - 1 ? (
                                        <ListDivider marginLeft={16} />
                                    ) : null}
                                </View>
                            );
                        })}
                    </View>
                ) : null}

                {activeTab === "reverb" ? (
                    // ===== 混响：卷积混响开关 + 5 IR 预设 =====
                    <View>
                        <View>
                            <ListItem
                                withHorizontalPadding
                                heightType="small">
                                <ListItem.Content title="卷积混响" />
                                <ThemeSwitch
                                    value={convolverEnabled}
                                    onValueChange={v =>
                                        applyReverb(
                                            v,
                                            REVERB_ENGINE_CONVOLVER,
                                            convolverPreset,
                                        )
                                    }
                                />
                            </ListItem>
                            <ListDivider marginLeft={16} />
                        </View>
                        {IR_PRESETS.map((p, i) => {
                            const active =
                                convolverEnabled && convolverPreset === i;
                            return (
                                <View key={p.file}>
                                    <ListItem
                                        withHorizontalPadding
                                        heightType="small"
                                        onPress={() =>
                                            applyReverb(
                                                true,
                                                REVERB_ENGINE_CONVOLVER,
                                                i,
                                            )
                                        }>
                                        <ListItem.Content
                                            title={rowTitle(p.name, active)}
                                        />
                                        {checkMark(active)}
                                    </ListItem>
                                    {i < IR_PRESETS.length - 1 ? (
                                        <ListDivider marginLeft={16} />
                                    ) : null}
                                </View>
                            );
                        })}
                    </View>
                ) : null}

                {activeTab === "other" ? (
                    // ===== 其他：输出增益/动态低音/立体声增强/电子管 4 滑杆行 + 交叉馈送/耳机补偿 2 纯开关行 =====
                    <View>
                        {sliderRow(
                            "postGain",
                            "输出增益",
                            postGainEnabled,
                            <ThemeSwitch
                                style={styles.switchWrap}
                                value={postGainEnabled}
                                onValueChange={applyPostGainEnabled}
                            />,
                            <>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={-12}
                                    maximumValue={12}
                                    step={0.5}
                                    value={postGain}
                                    onValueChange={v => {
                                        Config.setConfig("jdsp.postGain", v);
                                        setPostGain(v);
                                    }}
                                    minimumTrackTintColor={colors.primary}
                                    thumbTintColor={colors.primary}
                                />
                                <ThemeText
                                    style={styles.sliderValue}
                                    fontSize="caption"
                                    fontColor="textSecondary">
                                    {postGain > 0 ? "+" : ""}
                                    {postGain.toFixed(1)}dB
                                </ThemeText>
                            </>,
                        )}
                        {sliderRow(
                            "bass",
                            "动态低音 DBB",
                            bassEnabled,
                            <ThemeSwitch
                                style={styles.switchWrap}
                                value={bassEnabled}
                                onValueChange={v => {
                                    Config.setConfig("jdsp.bassEnabled", v);
                                    setBassBoost(v, bassGain);
                                }}
                            />,
                            <>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={15}
                                    step={0.5}
                                    value={bassGain}
                                    onValueChange={v => {
                                        Config.setConfig("jdsp.bassGain", v);
                                        setBassBoost(true, v);
                                    }}
                                    minimumTrackTintColor={colors.primary}
                                    thumbTintColor={colors.primary}
                                />
                                <ThemeText
                                    style={styles.sliderValue}
                                    fontSize="caption"
                                    fontColor="textSecondary">
                                    {bassGain.toFixed(1)}dB
                                </ThemeText>
                            </>,
                        )}
                        {sliderRow(
                            "stereo",
                            "立体声增强",
                            stereoEnabled,
                            <ThemeSwitch
                                style={styles.switchWrap}
                                value={stereoEnabled}
                                onValueChange={v => {
                                    Config.setConfig("jdsp.stereoEnabled", v);
                                    setStereoEnhancement(v, stereoMix);
                                }}
                            />,
                            <>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={1}
                                    step={0.05}
                                    value={stereoMix}
                                    onValueChange={v => {
                                        Config.setConfig("jdsp.stereoMix", v);
                                        setStereoEnhancement(true, v);
                                    }}
                                    minimumTrackTintColor={colors.primary}
                                    thumbTintColor={colors.primary}
                                />
                                <ThemeText
                                    style={styles.sliderValue}
                                    fontSize="caption"
                                    fontColor="textSecondary">
                                    {Math.round(stereoMix * 100)}%
                                </ThemeText>
                            </>,
                        )}
                        {sliderRow(
                            "tube",
                            "电子管模拟",
                            tubeEnabled,
                            <ThemeSwitch
                                style={styles.switchWrap}
                                value={tubeEnabled}
                                onValueChange={v => {
                                    Config.setConfig("jdsp.tubeEnabled", v);
                                    setVacuumTube(v, tubeGain);
                                }}
                            />,
                            <>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={24}
                                    step={1}
                                    value={tubeGain}
                                    onValueChange={v => {
                                        Config.setConfig("jdsp.tubeGain", v);
                                        setVacuumTube(true, v);
                                    }}
                                    minimumTrackTintColor={colors.primary}
                                    thumbTintColor={colors.primary}
                                />
                                <ThemeText
                                    style={styles.sliderValue}
                                    fontSize="caption"
                                    fontColor="textSecondary">
                                    {tubeGain}dB
                                </ThemeText>
                            </>,
                        )}
                        {toggleRow(
                            "crossfeed",
                            "交叉馈送",
                            crossfeedEnabled,
                            crossfeedEnabled
                                ? `当前：${CROSSFEED_MODES[crossfeedMode]}`
                                : undefined,
                            <ThemeSwitch
                                style={styles.switchWrap}
                                value={crossfeedEnabled}
                                onValueChange={v => {
                                    Config.setConfig(
                                        "jdsp.crossfeedEnabled",
                                        v,
                                    );
                                    setCrossfeed(v, crossfeedMode);
                                }}
                            />,
                        )}
                        {toggleRow(
                            "ddc",
                            "耳机补偿 DDC",
                            ddcEnabled,
                            ddcName ? `当前：${ddcName}` : undefined,
                            <ThemeSwitch
                                style={styles.switchWrap}
                                value={ddcEnabled}
                                onValueChange={v =>
                                    applyDdc(v, ddcHeadphone)
                                }
                            />,
                        )}
                    </View>
                ) : null}
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: "恢复默认",
                        type: "normal",
                        onPress: onResetAll,
                    },
                    {
                        title: t("common.done"),
                        type: "primary",
                        onPress: hideDialog,
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: "row",
        marginBottom: rpx(8),
    },
    tabChip: {
        flex: 1,
        height: rpx(64),
        borderRadius: rpx(32),
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: rpx(5),
    },
    slider: {
        width: rpx(170),
        height: 40,
    },
    sliderValue: {
        width: rpx(60),
        textAlign: "right",
        marginLeft: rpx(4),
    },
    switchWrap: {
        marginLeft: rpx(6),
    },
});
