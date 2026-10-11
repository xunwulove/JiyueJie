import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import Image from "./image";
import useColors from "@/hooks/useColors";
import Theme from "@/core/theme";
import useAlbumTintColor from "@/hooks/useAlbumTintColor";

function PageBackground() {
    const theme = Theme.useTheme();
    const background = Theme.useBackground();
    const colors = useColors();
    // 播放封面氛围取色（方案B）：仅白天浅色模式叠加极浅 tint 渐变
    const tint = useAlbumTintColor();

    const isLight = !theme.dark;
    const top = (colors as any).pageBackgroundTop;

    return (
        <>
            {/* 方案A：白天顶部 pageBackground（白）→ 底部微品牌蓝（从下到上逐渐变白）；深色保持单色 */}
            {isLight && top ? (
                <LinearGradient
                    colors={[
                        colors?.pageBackground ?? colors.background,
                        top,
                    ]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={style.wrapper}
                />
            ) : (
                <View
                    style={[
                        style.wrapper,
                        {
                            backgroundColor:
                                colors?.pageBackground ??
                                colors.background,
                        },
                    ]}
                />
            )}
            {/* 方案B：播放封面主色氛围层（极浅 α0.05 → 0，只作用于白天，无封面/取色失败自动跳过）
                方向与方案A一致：顶部无、底部带封面氛围 */}
            {isLight && tint ? (
                <LinearGradient
                    colors={[
                        Color(tint).alpha(0).toString(),
                        Color(tint).alpha(0.05).toString(),
                    ]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={style.wrapper}
                    pointerEvents="none"
                />
            ) : null}
            {!theme.id.startsWith("p-") && background?.url ? (
                <Image
                    uri={background.url}
                    style={[
                        style.wrapper,
                        {
                            opacity: background?.opacity ?? 0.6,
                        },
                    ]}
                    blurRadius={background?.blur ?? 20}
                />
            ) : null}
        </>
    );
}
export default memo(PageBackground);

const style = StyleSheet.create({
    wrapper: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
    },
});
