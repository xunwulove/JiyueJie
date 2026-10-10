import React from "react";
import { StyleSheet, View } from "react-native";
import useColors from "@/hooks/useColors";

/**
 * 全屏播放页背景 - 对齐 APlayer PlayingPage：纯 background 色（浅色），无模糊封面叠加
 */
export default function Background() {
    const colors = useColors();
    return <View style={[style.background, { backgroundColor: colors.background }]} />;
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
