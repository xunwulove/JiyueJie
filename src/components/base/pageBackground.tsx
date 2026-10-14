import React, { memo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import Image from "./image";
import useColors from "@/hooks/useColors";
import Theme from "@/core/theme";
import useAlbumTintColor from "@/hooks/useAlbumTintColor";

/**
 * 页面背景层：
 * - 全局（entry/index.tsx）：无 screenInsets → 相对自身容器铺满（全屏），渐变 + 可选自定义背景图。
 * - 二级页面覆盖层（SubPageOverlay/FullOverlay，平板）：覆盖层只占"内容区"（TabBar 下方 + 左播放面板右侧），
 *   若直接 absoluteFill 渲染背景图，同一张图会以不同容器基准 cover 缩放/裁切 → 与全局背景错位。
 *   因此传入 screenInsets（覆盖层左上角相对屏幕的偏移）后，渐变与背景图按**整屏几何**渲染
 *   （负偏移扩展到全屏宽高），与全局背景完全重叠，视觉 100% 一致。
 */
const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;

function PageBackground({
    screenInsets,
}: {
    screenInsets?: { top?: number; left?: number };
}) {
    const theme = Theme.useTheme();
    const background = Theme.useBackground();
    const colors = useColors();
    // 播放封面氛围取色（方案B）：仅白天浅色模式叠加极浅 tint 渐变
    const tint = useAlbumTintColor();

    const isLight = !theme.dark;
    const top = (colors as any).pageBackgroundTop;

    // 整屏几何基准：覆盖层左上角相对屏幕偏移 (insetLeft, insetTop)，
    // 渲染区向左上扩展至屏幕原点、尺寸取整屏 → 与全局背景层覆盖完全相同的区域
    const wrapStyle =
        screenInsets && (screenInsets.top || screenInsets.left)
            ? {
                  position: "absolute" as const,
                  top: -(screenInsets.top ?? 0),
                  left: -(screenInsets.left ?? 0),
                  width: SCREEN_W,
                  height: SCREEN_H,
              }
            : style.wrapper;

    return (
        <>
            {/* 页面底色渐变：白天顶部 pageBackground（白）→ 底部微品牌蓝；深色顶部深黑 → 底部深蓝灰。
                方向一致（从下到上逐渐变亮/变深至顶部基色）；无渐变端点时回退单色 */}
            {top ? (
                <LinearGradient
                    colors={[
                        colors?.pageBackground ?? colors.background,
                        top,
                    ]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={wrapStyle}
                />
            ) : (
                <View
                    style={[
                        wrapStyle,
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
                    style={wrapStyle}
                    pointerEvents="none"
                />
            ) : null}
            {/* 自定义背景（2026-10-14 恢复：不限主题，浅/深色下同样渲染，模糊+透明度可调） */}
            {background?.url ? (
                <Image
                    uri={background.url}
                    style={[
                        wrapStyle,
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
