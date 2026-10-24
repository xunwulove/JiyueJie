import React from "react";
import { StatusBar, StatusBarProps, StyleSheet, View } from "react-native";
import useColors from "@/hooks/useColors";
import Theme from "@/core/theme";
import Image from "./image";

interface IStatusBarProps extends StatusBarProps {}

export default function (props: IStatusBarProps) {
    const colors = useColors();
    const theme = Theme.useTheme();
    const background = Theme.useBackground();
    const { backgroundColor, barStyle } = props;

    return (
        <>
            <StatusBar
                backgroundColor={"rgba(0,0,0,0)"}
                // 未显式传 barStyle 时跟随主题（对齐一级页 HomeStatusBar）：
                // 浅色主题 -> 深色图标(dark-content)，深色/自定义主题 -> 浅色图标(light-content)
                barStyle={barStyle ?? (theme.dark ? "light-content" : "dark-content")}
            />
            <View
                style={{
                    zIndex: 10000,
                    position: "absolute",
                    top: 0,
                    // 显式传色（如沉浸式播放页）用传的颜色；默认跟随页面背景同款：
                    // 无自定义背景图 = pageBackground 色（与现状一致），有图 = 渲染同一张图（模糊+透明度），
                    // 避免换背景后状态栏区域留白底（2026-10-14 修复）
                    backgroundColor: backgroundColor ?? "transparent",
                    width: "100%",
                    height: StatusBar.currentHeight,
                }}>
                {backgroundColor ? null : background?.url ? (
                    <Image
                        uri={background.url}
                        style={[
                            StyleSheet.absoluteFill,
                            { opacity: background?.opacity ?? 0.6 },
                        ]}
                        blurRadius={background?.blur ?? 20}
                    />
                ) : (
                    <View
                        style={[
                            StyleSheet.absoluteFill,
                            { backgroundColor: colors.pageBackground },
                        ]}
                    />
                )}
            </View>
        </>
    );
}
