import React, { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    StyleSheet,
    View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import useColors from "@/hooks/useColors";
import Theme from "@/core/theme";
import useAlbumTintColor from "@/hooks/useAlbumTintColor";

/**
 * 全屏播放页背景：
 * - 白天：底部纯 pageBackground 兜底 + 当前歌曲封面主色氛围渐变（顶部 α0.14 → 中部 α0.05 → 底部白），
 *   氛围层带缓慢"呼吸"（opacity 0.72 ↔ 1，周期约 8s，原生驱动零成本）；切歌取色更新、动画不中断；
 * - 取色失败/无封面自动回退纯底色（方案A）；
 * - 深色：保持纯深色单色（不叠加封面氛围）。
 */
export default function Background() {
    const theme = Theme.useTheme();
    const colors = useColors();
    const tint = useAlbumTintColor();
    const isLight = !theme.dark;

    /* 呼吸动画：氛围层 opacity 0.72 ↔ 1（原生驱动，GPU 合成，无 JS 每帧开销） */
    const breatheAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(breatheAnim, {
                    toValue: 0.72,
                    duration: 4200,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(breatheAnim, {
                    toValue: 1,
                    duration: 4200,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [breatheAnim]);

    return (
        <>
            {/* 兜底纯色：pageBackground（白天）/ 深色单色 */}
            <View
                style={[
                    style.background,
                    {
                        backgroundColor:
                            colors.pageBackground ?? colors.background,
                    },
                ]}
            />
            {/* 封面取色氛围层（仅白天）：顶部"封面主色混白28%" → 中部混白12% → 底部白，
                用混白而非 α 叠加：深色封面也能呈现可见的浅色调，不会把背景压黑；
                氛围层整体缓慢呼吸（opacity 0.72 ↔ 1），不抢歌词/控件可读性 */}
            {isLight && tint ? (
                <Animated.View
                    style={[
                        style.background,
                        { opacity: breatheAnim },
                    ]}>
                    <LinearGradient
                        colors={[
                            Color(tint)
                                .mix(
                                    Color(
                                        colors.pageBackground ??
                                            "#F8F9FA",
                                    ),
                                    0.72,
                                )
                                .toString(),
                            Color(tint)
                                .mix(
                                    Color(
                                        colors.pageBackground ??
                                            "#F8F9FA",
                                    ),
                                    0.88,
                                )
                                .toString(),
                            colors.pageBackground ?? "#F8F9FA",
                        ]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={style.background}
                    />
                </Animated.View>
            ) : null}
        </>
    );
}

const style = StyleSheet.create({
    background: {
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
});
