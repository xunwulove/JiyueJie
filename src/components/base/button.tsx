import {
    GestureResponderEvent,
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    ViewStyle,
} from "react-native";
import useColors from "@/hooks/useColors.ts";
import ThemeText from "@/components/base/themeText.tsx";
import React from "react";

export function Button(props: {
    type?: "normal" | "primary";
    text: string;
    style?: StyleProp<ViewStyle>;
    onPress?: (evt: GestureResponderEvent) => void;
}) {
    const { type = "normal", text, style, onPress } = props;
    const colors = useColors();

    return (
        <TouchableOpacity
            activeOpacity={0.6}
            onPress={onPress}
            style={[
                styles.bottomBtn,
                {
                    backgroundColor:
                        type === "normal" ? colors.placeholder : colors.primary,
                },
                style,
            ]}>
            <ThemeText color={type === "normal" ? undefined : "white"}>
                {text}
            </ThemeText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    bottomBtn: {
        borderRadius: 12,
        flexShrink: 0,
        justifyContent: "center",
        alignItems: "center",
        height: 48, // 对齐 APlayer 按钮高度
    },
});
