import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import useColors from "@/hooks/useColors";
import StatusBar from "./statusBar";
import color from "color";
import IconButton from "./iconButton";
import globalStyle from "@/constants/globalStyle";
import ThemeText from "./themeText";
import { IIconName } from "@/components/base/icon.tsx";
import { useGoBack } from "@/core/tabletNav";

interface IAppBarProps {
    titleTextOpacity?: number;
    withStatusBar?: boolean;
    color?: string;
    actions?: Array<{
        icon: IIconName;
        onPress?: () => void;
    }>;
    children?: string | ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    actionComponent?: ReactNode;
    onBackPress?: () => void;
    /** 隐藏返回键（作为 tab 内容嵌入时使用） */
    hideBack?: boolean;
}

export default function AppBar(props: IAppBarProps) {
    const {
        titleTextOpacity = 1,
        withStatusBar,
        color: _color,
        actions = [],
        containerStyle,
        contentStyle,
        children,
        actionComponent,
        onBackPress,
        hideBack,
    } = props;

    const colors = useColors();
    const goBack = useGoBack();

    // 对齐旧项目：顶栏 = 页面背景色（surface），内容用常规文字色
    const bgColor = colors.background;
    const contentColor = _color ?? colors.text;

    return (
        <>
            {withStatusBar ? <StatusBar backgroundColor={bgColor} /> : null}
            <View
                style={[
                    styles.container,
                    { backgroundColor: bgColor },
                    containerStyle,
                ]}>
                {hideBack ? null : (
                    <IconButton
                        name="arrow-left"
                        sizeType="normal"
                        color={contentColor}
                        style={globalStyle.notShrink}
                        onPress={
                            onBackPress ||
                            (() => {
                                goBack();
                            })
                        }
                    />
                )}
                <View style={[globalStyle.grow, styles.content, contentStyle]}>
                    {typeof children === "string" ? (
                        <ThemeText
                            fontSize="title"
                            fontWeight="bold"
                            numberOfLines={1}
                            color={
                                titleTextOpacity !== 1
                                    ? color(contentColor)
                                        .alpha(titleTextOpacity)
                                        .toString()
                                    : contentColor
                            }>
                            {children}
                        </ThemeText>
                    ) : (
                        children
                    )}
                </View>
                {actions.map((action, index) => (
                    <IconButton
                        key={index}
                        name={action.icon}
                        sizeType="normal"
                        color={contentColor}
                        style={[globalStyle.notShrink, styles.rightButton]}
                        onPress={action.onPress}
                    />
                ))}
                {actionComponent ?? null}
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        zIndex: 10000,
        height: 56, // 对齐 APlayer 顶栏 56dp
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
    },
    content: {
        flexDirection: "row",
        flexBasis: 0,
        alignItems: "center",
        paddingHorizontal: 12,
    },
    rightButton: {
        marginLeft: 16,
    },
});
