import React, { useEffect, useState } from "react";
import { Animated, Dimensions, Image, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useAtomValue } from "jotai";
import bootstrapAtom from "./bootstrap.atom";
import { ImgAsset } from "@/constants/assetsConst";

/**
 * RN 自绘启动页（BrandSplash）——路线 2：代码层弹性适配（对齐网易云/QQ 实测做法）
 * 显示（v2）：渐变背景（下 #EAF0FA 微品牌蓝 → 上 #F8F9FA 白，同软件内部 PageBackground 同款）
 *            + 圆角渐变容器（#4055D4→#B7CDFE，同桌面图标）
 *            + 容器内白色音符 + 黑色"极悦界"文字（透明底图）
 * 适配：容器/文字尺寸运行时按屏幕短边弹性计算（大屏大、小屏小，永不裁切/拉伸）：
 *   - 容器 = clamp(短边×0.42, 150, 420) dp（与原生 windowBackground dimens 分档对应）
 *   - 音符 = 容器×0.78（音符视觉≈屏短边 33%）
 *   - 文字 = clamp(短边×0.32, 120, 220) dp 宽（高=宽/3），容器下方
 * 动画：容器+音符从稍大 spring 收缩到目标（衔接窗口背景），文字淡入
 * 停留：bootstrap 完成立即淡出（无 MIN_DISPLAY_MS 强制停留，尽量减少启动时间）
 */
const BG_BOTTOM = "#EAF0FA"; // 背景渐变底部（微品牌蓝，同软件内部 pageBackgroundTop）
const BG_TOP = "#F8F9FA";    // 背景渐变顶部（白，同软件内部 pageBackground）
const BOX_FROM = "#4055D4";  // 容器渐变（左上）
const BOX_TO = "#B7CDFE";    // 容器渐变（右下）

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

export default function BrandSplash() {
    const bootstrapState = useAtomValue(bootstrapAtom);
    const [visible, setVisible] = useState(true);
    const fadeOpacity = React.useRef(new Animated.Value(1)).current;
    const boxScale = React.useRef(new Animated.Value(1.5)).current;
    const textOpacity = React.useRef(new Animated.Value(0)).current;

    // 运行时按屏幕短边弹性计算（大屏大、小屏小）
    const { width, height } = Dimensions.get("window");
    const short = Math.min(width, height);
    const containerSize = clamp(short * 0.42, 150, 420);
    const noteSize = containerSize * 0.78;
    const cornerRadius = containerSize * 0.22;
    const textWidth = clamp(short * 0.32, 120, 220);
    const textHeight = textWidth / 3; // 文字图 1200×400，字居中

    useEffect(() => {
        // 容器+音符从大收缩到目标（衔接窗口背景），文字随后淡入
        Animated.spring(boxScale, {
            toValue: 1,
            friction: 9,
            tension: 50,
            useNativeDriver: true,
        }).start();
        const t = setTimeout(() => {
            Animated.timing(textOpacity, {
                toValue: 1,
                duration: 320,
                useNativeDriver: true,
            }).start();
        }, 220);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* bootstrap 完成立即淡出（无强制停留） */
    useEffect(() => {
        if (bootstrapState.state === "Loading") {
            return;
        }
        Animated.timing(fadeOpacity, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                setVisible(false);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bootstrapState.state]);

    if (!visible) {
        return null;
    }

    return (
        <Animated.View
            style={[styles.container, { opacity: fadeOpacity }]}
            pointerEvents={bootstrapState.state === "Loading" ? "auto" : "none"}>
            <LinearGradient
                colors={[BG_BOTTOM, BG_TOP]}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.center}>
                <Animated.View
                    style={[styles.boxWrap, { transform: [{ scale: boxScale }] }]}>
                    <LinearGradient
                        colors={[BOX_FROM, BOX_TO]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.box,
                            {
                                width: containerSize,
                                height: containerSize,
                                borderRadius: cornerRadius,
                            },
                        ]}>
                        <Image
                            source={ImgAsset.splashIcon}
                            style={{ width: noteSize, height: noteSize }}
                            resizeMode="contain"
                        />
                    </LinearGradient>
                </Animated.View>
                <Animated.Image
                    source={ImgAsset.splashBrandText}
                    style={[
                        {
                            width: textWidth,
                            height: textHeight,
                            marginTop: 16,
                            opacity: textOpacity,
                        },
                    ]}
                    resizeMode="contain"
                />
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99999,
        elevation: 99999,
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    boxWrap: {
        alignItems: "center",
        justifyContent: "center",
    },
    box: {
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
});
