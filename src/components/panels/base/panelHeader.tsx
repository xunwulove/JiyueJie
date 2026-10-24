import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import ThemeText from "@/components/base/themeText";
import Divider from "@/components/base/divider";
import i18n from "@/core/i18n";
import useColors from "@/hooks/useColors";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";

interface IPanelHeaderProps {
    title: string;
    cancelText?: string;
    okText?: string;
    onCancel?: () => void;
    onOk?: () => void;
    hideButtons?: boolean;
    hideDivider?: boolean;
    style?: StyleProp<ViewStyle>;
}
export default function PanelHeader(props: IPanelHeaderProps) {
    const {
        title,
        cancelText,
        okText,
        onOk,
        onCancel,
        hideButtons,
        hideDivider,
        style,
    } = props;
    const colors = useColors();

    return (
        <>
            <LinearGradient
                colors={[
                    Color(colors.primary).alpha(0.14).toString(),
                    Color(colors.primary).alpha(0.04).toString(),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, style]}>
                {hideButtons ? null : (
                    <TouchableOpacity style={styles.button} onPress={onCancel}>
                        <ThemeText fontWeight="medium" fontSize="subTitle">
                            {cancelText || i18n.t("common.cancel")}
                        </ThemeText>
                    </TouchableOpacity>
                )}
                <ThemeText
                    style={styles.title}
                    fontWeight="bold"
                    fontSize="title"
                    numberOfLines={1}>
                    {title}
                </ThemeText>
                {hideButtons ? null : (
                    <TouchableOpacity
                        style={[styles.button, styles.rightButton]}
                        onPress={onOk}>
                        <ThemeText fontWeight="medium" fontColor="primary" fontSize="subTitle">
                            {okText || i18n.t("common.confirm")}
                        </ThemeText>
                    </TouchableOpacity>
                )}
            </LinearGradient>
            {hideDivider ? null : <Divider />}
        </>
    );
}

const styles = StyleSheet.create({
    header: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        height: 56, // 对齐 APlayer 弹窗标题行高度
    },
    button: {
        width: 72,
        height: "100%",
        justifyContent: "center",
    },
    rightButton: {
        alignItems: "flex-end",
    },
    title: {
        flex: 1,
        textAlign: "center",
    },
});
