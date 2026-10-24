import React from "react";
import {
    ColorValue,
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";

interface ITypeTagProps {
    title: string;
    selected?: boolean;
    onPress?: () => void;
    backgroundColor?: ColorValue;
    style?: StyleProp<ViewStyle>;
}

export default function TypeTag(props: ITypeTagProps) {
    const {
        title,
        onPress,
        selected = false,
        // backgroundColor,
        style: _style,
    } = props;
    const colors = useColors();
    return (
        <TouchableOpacity onPress={onPress}>
            <View
                style={[
                    style.wrapper,
                    {
                        // 对齐 APlayer 分类 Tab：选中 primary 底 + onPrimary 字；未选中 surfaceVariant 底 + onSurfaceVariant 字
                        backgroundColor: selected
                            ? colors.primary
                            : colors.surfaceVariant ??
                              colors.card,
                        borderColor: selected
                            ? colors.primary
                            : "transparent",
                    },
                    _style,
                ]}>
                <ThemeText
                    fontSize="description"
                    fontWeight={selected ? "bold" : "regular"}
                    color={
                        selected ? "#FFFFFF" : (colors as any).onSurfaceVariant ?? colors.text
                    }>
                    {title}
                </ThemeText>
            </View>
        </TouchableOpacity>
    );
}

const style = StyleSheet.create({
    wrapper: {
        flexGrow: 0,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        marginHorizontal: 4,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: "solid",
    },
});
