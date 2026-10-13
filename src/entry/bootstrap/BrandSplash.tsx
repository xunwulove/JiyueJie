import React, { useEffect, useState } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";
import { useAtomValue } from "jotai";
import bootstrapAtom from "./bootstrap.atom";
import { ImgAsset } from "@/constants/assetsConst";

/**
 * RN 自绘启动页（BrandSplash）——路线 2：代码层弹性适配（对齐网易云/QQ 实测做法）
 * 显示：浅蓝纯色底（#F1F4FA，与窗口背景同色无缝）+ 品牌图标 + 行楷"极悦界"文字
 * 适配：图标/文字尺寸运行时按屏幕短边弹性计算（大屏大、小屏小，永不裁切）：
 *   - 图标 = clamp(短边×0.42, 160, 280) dp
 *   - 文字 = clamp(短边×0.32, 120, 220) dp 宽
 * 动画：图标从稍大 spring 收缩到目标（衔接窗口背景 fitCenter 大图标），文字淡入
 * 停留：bootstrap 完成立即淡出（无 MIN_DISPLAY_MS 强制停留，尽量减少启动时间）
 */
const BG_COLOR = "#F1F4FA";

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

export default function BrandSplash() {
    const bootstrapState = useAtomValue(bootstrapAtom);
    const [visible, setVisible] = useState(true);
    const fadeOpacity = React.useRef(new Animated.Value(1)).current;
    const iconScale = React.useRef(new Animated.Value(1.5)).current;
    const textOpacity = React.useRef(new Animated.Value(0)).current;

    // 运行时按屏幕短边弹性计算（大屏大、小屏小）
    const { width, height } = Dimensions.get("window");
    const short = Math.min(width, height);
    const iconSize = clamp(short * 0.42, 160, 280);
    const textWidth = clamp(short * 0.32, 120, 220);
    const textHeight = textWidth / 3; // 文字图 1200×400，字居中

    useEffect(() => {
        // 图标从大收缩到目标（衔接窗口背景 fitCenter 大图标），文字随后淡入
        Animated.spring(iconScale, {
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
            <View style={[styles.center, { backgroundColor: BG_COLOR }]}>
                <Animated.Image
                    source={ImgAsset.splashIcon}
                    style={[
                        {
                            width: iconSize,
                            height: iconSize,
                            transform: [{ scale: iconScale }],
                        },
                    ]}
                    resizeMode="contain"
                />
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
            </View>
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
});
