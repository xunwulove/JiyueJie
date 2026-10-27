import React, { useState } from "react";
import { GestureResponderEvent, StyleSheet, TextProps } from "react-native";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import openUrl from "@/utils/openUrl";
import ThemeText from "./themeText";
import Color from "color";
import useColors from "@/hooks/useColors";

type ILinkTextProps = TextProps & {
    fontSize?: keyof typeof fontSizeConst;
    fontWeight?: keyof typeof fontWeightConst;
    linkTo?: string;
    onPress?: (event: GestureResponderEvent) => void;
};

export default function LinkText(props: ILinkTextProps) {
    const [isPressed, setIsPressed] = useState(false);
    const colors = useColors();

    return (
        <ThemeText
            {...props}
            color={colors.primary}
            style={[
                style.linkText,
                isPressed
                    ? { color: Color(colors.primary).alpha(0.4).toString() }
                    : null,
            ]}
            onPressIn={() => {
                setIsPressed(true);
            }}
            onPress={evt => {
                if (props.onPress) {
                    props.onPress(evt);
                } else {
                    props?.linkTo && openUrl(props.linkTo);
                }
            }}
            onPressOut={() => {
                setIsPressed(false);
            }}>
            {props.children}
        </ThemeText>
    );
}

const style = StyleSheet.create({
    linkText: {
        textDecorationLine: "underline",
    },
});
