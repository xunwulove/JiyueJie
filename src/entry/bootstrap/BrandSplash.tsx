import React, { useEffect, useState } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useAtomValue } from "jotai";
import bootstrapAtom from "./bootstrap.atom";
import { ImgAsset } from "@/constants/assetsConst";

/**
 * RN 自绘启动页（BrandSplash）
 * 原生层只显示渐变底（系统图标位已透明），此组件接管品牌图标展示：
 *  - 图标边长 = 屏幕短边 × ICON_RATIO（默认 40%），手机/平板统一按百分比自适应
 *  - 字标"极悦界"使用华文行楷（android/app/src/main/assets/fonts/STXINGKA.TTF）
 *  - bootstrap 完成后淡出
 */
const ICON_RATIO = 0.4; // 图标边长占屏幕短边比例（可调）

export default function BrandSplash() {
    const bootstrapState = useAtomValue(bootstrapAtom);
    const [visible, setVisible] = useState(true);
    const fadeOpacity = React.useRef(new Animated.Value(1)).current;
    // 接管过渡：图标从原生系统位视觉尺寸平滑放大到 40% 短边，字标随后淡入，
    // 配合全程一致的渐变底，观感是"同一画面逐渐成型"，而非切换画面
    const iconScale = React.useRef(new Animated.Value(0.55)).current;
    const textOpacity = React.useRef(new Animated.Value(0)).current;

    const shortEdge = Math.min(
        Dimensions.get("window").width,
        Dimensions.get("window").height,
    );
    const iconSize = shortEdge * ICON_RATIO;

    useEffect(() => {
        // 首帧接管：图标放大 + 字标淡入（仅一次）
        Animated.parallel([
            Animated.spring(iconScale, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.timing(textOpacity, {
                toValue: 1,
                duration: 280,
                delay: 180,
                useNativeDriver: true,
            }),
        ]).start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (bootstrapState.state !== "Loading") {
            // 淡出 350ms 后卸载
            Animated.timing(fadeOpacity, {
                toValue: 0,
                duration: 350,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) {
                    setVisible(false);
                }
            });
        }
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
                colors={["#D8E9FA", "#F0F8F3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}>
                <View style={styles.center}>
                    <Animated.Image
                        source={ImgAsset.logoTransparent}
                        style={{
                            width: iconSize,
                            height: iconSize,
                            transform: [{ scale: iconScale }],
                        }}
                        resizeMode="contain"
                    />
                    <Animated.Text
                        style={[
                            styles.brandText,
                            {
                                // 行楷三字近似方形：字号 = 图标宽×0.6÷3，宽度自然≈0.6×图标宽
                                fontSize: iconSize * 0.2,
                                opacity: textOpacity,
                            },
                        ]}>
                        极悦界
                    </Animated.Text>
                </View>
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
    gradient: {
        flex: 1,
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    brandText: {
        marginTop: 24,
        textAlign: "center",
        fontFamily: "STXINGKA",
        color: "#3D5A80",
        includeFontPadding: false,
    },
});
