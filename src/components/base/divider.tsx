import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import useColors from "@/hooks/useColors";

interface IDividerProps {
    vertical?: boolean;
    style?: StyleProp<ViewStyle>;
}
export default function Divider(props: IDividerProps) {
    const { vertical, style } = props;
    const colors = useColors();

    return (
        <View
            style={[
                vertical ? css.dividerVertical : css.divider,
                {
                    backgroundColor: colors.divider ?? "#999999",
                },
                style,
            ]}
        />
    );
}

interface IListDividerProps {
    /** 左侧缩进，默认 60（封面 48 + gap 12），与列表标题文字对齐 */
    marginLeft?: number;
    style?: StyleProp<ViewStyle>;
}

/**
 * 列表行分隔线：hairline 细线 + 左侧缩进对齐封面，颜色取 colors.divider。
 * 供各列表页在相邻行之间使用，替代全宽 Divider。
 */
export function ListDivider(props: IListDividerProps) {
    const { marginLeft = 60, style } = props;
    const colors = useColors();

    return (
        <View
            style={[
                css.listDivider,
                {
                    marginLeft,
                    backgroundColor: colors.divider ?? "#999999",
                },
                style,
            ]}
        />
    );
}

const css = StyleSheet.create({
    divider: {
        width: "100%",
        height: 1,
    },
    dividerVertical: {
        height: "100%",
        width: 1,
    },
    listDivider: {
        width: "100%",
        height: StyleSheet.hairlineWidth,
    },
});
