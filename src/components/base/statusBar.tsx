import React from "react";
import { StatusBar, StatusBarProps, View } from "react-native";
import useColors from "@/hooks/useColors";
import Theme from "@/core/theme";

interface IStatusBarProps extends StatusBarProps {}

export default function (props: IStatusBarProps) {
    const colors = useColors();
    const theme = Theme.useTheme();
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
                    // 默认跟随页面背景色（对齐旧项目：状态栏区域 = 页面背景，不出现强调色长条）
                    backgroundColor:
                        backgroundColor ?? colors.background,
                    width: "100%",
                    height: StatusBar.currentHeight,
                }}
            />
        </>
    );
}
