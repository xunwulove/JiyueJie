import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import { Gesture, GestureDetector, TextInput } from "react-native-gesture-handler";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";

interface ILyricColorDialogProps {
    /** 标题（调用方传入：如 文本颜色 / 文本背景色） */
    title?: string;
    defaultColor?: string;
    onSelected?: (color: Color) => void;
}

/** 色板固定尺寸（标准固定值方案，避免 rpx 在平板/车机漂移） */
const areaSize = 200;

/**
 * 歌词颜色选择三级浮窗（悬浮歌词设置 → 文本颜色 / 文本背景色）。
 * 由原 ColorPicker 面板改造：底部滑出面板 → 居中缩放浮窗（渐变标题行 + 渐变操作行）。
 */
export default function LyricColorDialog(props: ILyricColorDialogProps) {
    const { title, defaultColor = "#66ccff", onSelected } = props;

    const { t } = useI18N();

    const [currentHue, setCurrentHue] = useState(Color(defaultColor).hue());
    const [currentSaturation, setCurrentSaturation] = useState(
        Color(defaultColor).saturationl(),
    );
    const [currentLightness, setCurrentLightness] = useState(
        Color(defaultColor).lightness(),
    );
    const [currentAlpha, setCurrentAlpha] = useState(
        Color(defaultColor).alpha(),
    );

    const [inputValue, setInputValue] = useState(() =>
        Color(defaultColor).rgb().hexa().toString(),
    );

    const hueColor = useMemo(
        () => Color.hsl(currentHue, 100, 50),
        [currentHue],
    );

    const currentColor = useMemo(
        () => Color.hsl(currentHue, currentSaturation, currentLightness),
        [currentHue, currentSaturation, currentLightness],
    );

    const currentColorWithAlpha = useMemo(
        () => currentColor.alpha(currentAlpha),
        [currentColor, currentAlpha],
    );

    const hueColorString = useMemo(() => hueColor.toString(), [hueColor]);
    const currentColorString = useMemo(() => currentColor.toString(), [currentColor]);
    const currentColorWithAlphaString = useMemo(() => currentColorWithAlpha.toString(), [currentColorWithAlpha]);
    const currentColorAlpha0String = useMemo(() => currentColor.alpha(0).toString(), [currentColor]);
    const colorHexString = useMemo(() => currentColorWithAlpha.rgb().hexa().toString(), [currentColorWithAlpha]);

    // 同步colorHexString到inputValue
    const syncInputValue = useCallback(() => {
        setInputValue(colorHexString);
    }, [colorHexString]);

    // 当颜色通过滑块改变时，同步输入框
    useEffect(() => {
        syncInputValue();
    }, [syncInputValue]);

    const slThumbStyle = useMemo(() => ({
        left: -7.5 + (currentSaturation / 100) * areaSize,
        bottom: -7.5 + (currentLightness / 100) * areaSize,
        backgroundColor: currentColorString,
    }), [currentSaturation, currentLightness, currentColorString]);

    const hueThumbStyle = useMemo(() => ({
        top: -3.5 + (currentHue / 360) * areaSize,
    }), [currentHue]);

    const alphaThumbStyle = useMemo(() => ({
        top: -3.5 + (1 - currentAlpha) * areaSize,
    }), [currentAlpha]);

    const handleSLUpdate = useCallback((x: number, y: number) => {
        const xRate = Math.min(1, Math.max(0, x / areaSize));
        const yRate = Math.min(1, Math.max(0, y / areaSize));
        setCurrentSaturation(xRate * 100);
        setCurrentLightness((1 - yRate) * 100);
    }, []);

    const handleHueUpdate = useCallback((y: number) => {
        const yRate = Math.min(1, Math.max(0, y / areaSize));
        setCurrentHue(yRate * 360);
    }, []);

    const handleAlphaUpdate = useCallback((y: number) => {
        const yRate = Math.min(1, Math.max(0, y / areaSize));
        setCurrentAlpha(1 - yRate);
    }, []);

    const slTap = Gesture.Tap()
        .onStart(event => {
            const { x, y } = event;
            handleSLUpdate(x, y);
        })
        .runOnJS(true);

    const lastTimestampRef = useRef(Date.now());
    const slPan = Gesture.Pan()
        .onUpdate(event => {
            const newTimeStamp = Date.now();
            if (newTimeStamp - lastTimestampRef.current > 32) {
                lastTimestampRef.current = newTimeStamp;
                const { x, y } = event;
                handleSLUpdate(x, y);
            }
        })
        .runOnJS(true);

    const slComposed = Gesture.Race(slTap, slPan);

    const hueTap = Gesture.Tap()
        .onStart(event => {
            const { y } = event;
            handleHueUpdate(y);
        })
        .runOnJS(true);

    const huePan = Gesture.Pan()
        .onUpdate(event => {
            const { y } = event;
            handleHueUpdate(y);
        })
        .runOnJS(true);

    const hueComposed = Gesture.Race(hueTap, huePan);

    const alphaTap = Gesture.Tap()
        .onStart(event => {
            const { y } = event;
            handleAlphaUpdate(y);
        })
        .runOnJS(true);

    const alphaPan = Gesture.Pan()
        .onUpdate(event => {
            const { y } = event;
            handleAlphaUpdate(y);
        })
        .runOnJS(true);

    const alphaComposed = Gesture.Race(alphaTap, alphaPan);

    const handleColorInputChange = useCallback((text: string) => {
        setInputValue(text);
    }, []);

    const handleColorInputSubmit = useCallback(() => {
        try {
            const color = Color(inputValue);
            const hsl = color.hsl();

            setCurrentHue(hsl.hue() || 0);
            setCurrentSaturation(hsl.saturationl());
            setCurrentLightness(hsl.lightness());
            setCurrentAlpha(color.alpha());
        } catch (error) {
            // 如果输入的颜色无效，恢复到当前颜色
            setInputValue(colorHexString);
        }
    }, [inputValue, colorHexString]);

    const handleColorInputBlur = useCallback(() => {
        handleColorInputSubmit();
    }, [handleColorInputSubmit]);

    /** 应用选中颜色（输入框与当前色不一致时以输入值为准）并关闭浮窗 */
    const applyColor = useCallback(() => {
        if (inputValue !== colorHexString) {
            try {
                const color = Color(inputValue);
                const hsl = color.hsl();

                setCurrentHue(hsl.hue() || 0);
                setCurrentSaturation(hsl.saturationl());
                setCurrentLightness(hsl.lightness());
                setCurrentAlpha(color.alpha());

                onSelected?.(color);
            } catch (error) {
                onSelected?.(currentColorWithAlpha);
            }
        } else {
            onSelected?.(currentColorWithAlpha);
        }
        hideDialog();
    }, [inputValue, colorHexString, currentColorWithAlpha, onSelected]);

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>{title ?? t("panel.colorPicker.title")}</Dialog.Title>
            <Dialog.Content
                style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
                <View style={styles.container}>
                    <GestureDetector gesture={slComposed}>
                        <View
                            style={[
                                styles.slContainer,
                                {
                                    backgroundColor: hueColorString,
                                },
                            ]}>
                            <LinearGradient
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                colors={["#808080", "rgba(0,0,0,0)"]}
                                style={[styles.slContainer, styles.layer1]}
                            />
                            <LinearGradient
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 1 }}
                                colors={["#fff", "rgba(0,0,0,0)", "#000"]}
                                style={[styles.slContainer, styles.layer2]}
                            />
                            <View
                                style={[
                                    styles.slThumb,
                                    slThumbStyle,
                                ]}
                            />
                        </View>
                    </GestureDetector>
                    <GestureDetector gesture={hueComposed}>
                        <LinearGradient
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            colors={[
                                "#f00",
                                "#ff0",
                                "#0f0",
                                "#0ff",
                                "#00f",
                                "#f0f",
                                "#f00",
                            ]}
                            style={styles.hueContainer}>
                            <View
                                style={[
                                    styles.hueThumb,
                                    hueThumbStyle,
                                ]}
                            />
                        </LinearGradient>
                    </GestureDetector>
                    <GestureDetector gesture={alphaComposed}>
                        <LinearGradient
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            colors={[
                                currentColorString,
                                currentColorAlpha0String,
                            ]}
                            style={[
                                styles.hueContainer,
                                styles.alphaContainer,
                            ]}>
                            <View
                                style={[
                                    styles.hueThumb,
                                    alphaThumbStyle,
                                ]}
                            />
                            <Image
                                resizeMode="repeat"
                                source={ImgAsset.transparentBg}
                                style={styles.transparentBg}
                            />
                        </LinearGradient>
                    </GestureDetector>
                </View>
                <View style={styles.showArea}>
                    <View style={[styles.showBar]}>
                        <Image
                            resizeMode="repeat"
                            source={ImgAsset.transparentBg}
                            style={styles.transparentBg}
                        />
                        <View
                            style={[
                                styles.showBarContent,
                                {
                                    backgroundColor: currentColorWithAlphaString,
                                },
                            ]}
                        />
                    </View>
                    <TextInput
                        style={styles.colorInput}
                        value={inputValue}
                        onChangeText={handleColorInputChange}
                        onSubmitEditing={handleColorInputSubmit}
                        onBlur={handleColorInputBlur}
                        placeholder="#RRGGBBAA"
                        placeholderTextColor="#999"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="done"
                    />
                </View>
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress: hideDialog,
                    },
                    {
                        title: t("common.confirm"),
                        type: "primary",
                        onPress: applyColor,
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        paddingHorizontal: 20,
        paddingTop: 18,
        flexDirection: "row",
        justifyContent: "center",
    },
    slContainer: {
        width: areaSize,
        height: areaSize,
    },
    layer1: {
        position: "absolute",
        zIndex: 1,
        left: 0,
        top: 0,
    },
    layer2: {
        position: "absolute",
        zIndex: 2,
        left: 0,
        top: 0,
    },
    hueContainer: {
        width: 22,
        height: areaSize,
        marginLeft: 14,
    },
    alphaContainer: {
        marginLeft: 12,
    },
    slThumb: {
        position: "absolute",
        width: 15,
        height: 15,
        borderRadius: 7.5,
        borderWidth: 1.5,
        borderStyle: "solid",
        borderColor: "#ccc",
        zIndex: 3,
    },
    hueThumb: {
        position: "absolute",
        width: 28,
        height: 4,
        left: -3,
        top: 0,
        borderWidth: 1.5,
        borderStyle: "solid",
        borderColor: "#ccc",
    },
    showBar: {
        width: 38,
        height: 25,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "#ccc",
    },
    showBarContent: {
        width: "100%",
        height: "100%",
        position: "absolute",
        left: 0,
        top: 0,
    },
    showArea: {
        width: "100%",
        marginTop: 18,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    transparentBg: {
        position: "absolute",
        zIndex: -1,
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
    },
    colorInput: {
        marginLeft: 12,
        minWidth: 84,
        height: 20,
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 2,
        paddingHorizontal: 6,
        paddingVertical: 0,
        fontSize: 14,
        color: "#333",
        backgroundColor: "#fff",
    },
});
