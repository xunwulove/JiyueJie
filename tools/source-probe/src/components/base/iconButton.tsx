import React from "react";
import { ColorKey, colorMap, iconSizeConst } from "@/constants/uiConst";
import { TapGestureHandler } from "react-native-gesture-handler";
import { StyleSheet, View } from "react-native";
import useColors from "@/hooks/useColors";
import { SvgProps } from "react-native-svg";
import Icon, { IIconName } from "@/components/base/icon.tsx";

interface IIconButtonProps extends SvgProps {
    name: IIconName;
    style?: SvgProps["style"];
    sizeType?: keyof typeof iconSizeConst;
    /** 精确尺寸覆盖（优先级高于 sizeType，对齐需求中出现的非档位尺寸，如 18） */
    size?: number;
    fontColor?: ColorKey;
    color?: string;
    onPress?: () => void;
    accessibilityLabel?: string;
}
export function IconButtonWithGesture(props: IIconButtonProps) {
    const {
        name,
        sizeType: size = "normal",
        fontColor = "normal",
        onPress,
        style,
        accessibilityLabel,
    } = props;
    const colors = useColors();
    const textSize = props.size ?? iconSizeConst[size];
    const color = colors[colorMap[fontColor]];
    return (
        <TapGestureHandler onActivated={onPress}>
            <View>
                <Icon
                    accessible
                    accessibilityLabel={accessibilityLabel}
                    name={name}
                    color={color}
                    style={[{ minWidth: textSize }, styles.textCenter, style]}
                    size={textSize}
                />
            </View>
        </TapGestureHandler>
    );
}

export default function IconButton(props: IIconButtonProps) {
    const { sizeType = "normal", fontColor = "normal", style, color } = props;
    const colors = useColors();
    const size = props.size ?? iconSizeConst[sizeType];

    return (
        <Icon
            {...props}
            color={color ?? colors[colorMap[fontColor]]}
            style={[{ minWidth: size }, styles.textCenter, style]}
            size={size}
        />
    );
}

const styles = StyleSheet.create({
    // 仅做交叉轴居中：原 height:"100%" + textAlignVertical（Text 专属，对 SVG 无效且干扰渲染高度）
    // 导致 SVG 图标在部分列表行中垂直偏移（实测偏下），改为 alignSelf 居中兜底
    textCenter: {
        alignSelf: "center",
    },
});
