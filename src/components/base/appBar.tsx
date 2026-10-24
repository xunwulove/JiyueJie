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
import Theme from "@/core/theme";
import Image from "./image";

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
    const background = Theme.useBackground();

    // 顶栏背景 = 页面背景同款（2026-10-14 修复：换自定义背景图后标题行不再留白底）：
    // 无自定义背景时保持 pageBackground 色（与现状一致、遮挡滚动内容）；
    // 有自定义背景时渲染同一张图（模糊+透明度与页面一致），标题行透出背景图
    const contentColor = _color ?? colors.text;

    return (
        <>
            {withStatusBar ? <StatusBar /> : null}
            <View
                style={[
                    styles.container,
                    containerStyle,
                ]}>
                {background?.url ? (
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
                            fontSize="appbar"
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
