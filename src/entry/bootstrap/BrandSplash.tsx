import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useAtomValue } from "jotai";
import bootstrapAtom from "./bootstrap.atom";
import { ImgAsset } from "@/constants/assetsConst";

/**
 * RN 自绘启动页（BrandSplash）
 * 原生窗口背景（windowBackground=splashscreen_brand_window）已先显示品牌整图（渐变+图标+行楷"极悦界"），
 * 此组件用同一张整图 + 同一渐变无缝接管（对齐网易云/QQ音乐实测：品牌图放窗口背景，App 首帧同图承接）：
 *  - 渐变与窗口背景/主界面完全一致（底部 #EAF0FA 浅蓝 → 顶部 #F8F9FA 白，从下到上）
 *  - 整图 contain 全图适配（与原生 windowBackground 的 fitCenter 同效果，切换无大小跳变）
 *  - bootstrap 完成后至少展示 MIN_DISPLAY_MS 再淡出（行楷字标可感知，对齐网易云自绘启动页）
 */
/** 最小展示时长（ms）：bootstrap 完成后仍保持展示，确保行楷字标可感知（对齐网易云自绘启动页停留） */
const MIN_DISPLAY_MS = 1500;

export default function BrandSplash() {
    const bootstrapState = useAtomValue(bootstrapAtom);
    const [visible, setVisible] = useState(true);
    const [bootstrapDoneAt, setBootstrapDoneAt] = useState<number | null>(null);
    const fadeOpacity = React.useRef(new Animated.Value(1)).current;
    // 接管过渡：整图从轻微缩小平滑放大到 100%，配合全程一致的渐变底
    const iconScale = React.useRef(new Animated.Value(0.92)).current;

    useEffect(() => {
        // 首帧接管：整图放大（仅一次）
        Animated.spring(iconScale, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* 记录 bootstrap 完成时刻（只记一次） */
    useEffect(() => {
        if (
            bootstrapState.state !== "Loading" &&
            bootstrapDoneAt === null
        ) {
            setBootstrapDoneAt(Date.now());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bootstrapState.state]);

    /* 淡出：bootstrap 完成后至少再展示 MIN_DISPLAY_MS 才淡出（让行楷字标清晰可见） */
    useEffect(() => {
        if (bootstrapDoneAt === null) {
            return;
        }
        const elapsed = Date.now() - bootstrapDoneAt;
        const delay = Math.max(0, MIN_DISPLAY_MS - elapsed);
        const timer = setTimeout(() => {
            Animated.timing(fadeOpacity, {
                toValue: 0,
                duration: 350,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) {
                    setVisible(false);
                }
            });
        }, delay);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bootstrapDoneAt]);

    if (!visible) {
        return null;
    }

    return (
        <Animated.View
            style={[styles.container, { opacity: fadeOpacity }]}
            pointerEvents={bootstrapState.state === "Loading" ? "auto" : "none"}>
            <LinearGradient
                colors={["#EAF0FA", "#F8F9FA"]}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={styles.gradient}>
                <View style={styles.center}>
                    <Animated.Image
                        source={ImgAsset.splashBrand}
                        style={[styles.brand, { transform: [{ scale: iconScale }] }]}
                        resizeMode="contain"
                    />
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
    brand: {
        flex: 1,
        alignSelf: "stretch",
    },
});
