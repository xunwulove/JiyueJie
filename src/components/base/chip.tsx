import React, { ReactNode } from "react";
import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "./themeText";
import useColors from "@/hooks/useColors";
import IconButton from "./iconButton";

interface IChipProps {
    containerStyle?: StyleProp<ViewStyle>;
    children?: ReactNode;
    onPress?: () => void;
    onClose?: () => void;
}
export default function Chip(props: IChipProps) {
    const { containerStyle, children, onPress, onClose } = props;
    const colors = useColors();

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.container,
                {
                    backgroundColor: colors.placeholder,
                },
                containerStyle,
            ]}>
            {typeof children === "string" ? (
                <ThemeText fontSize="subTitle" numberOfLines={1}>
                    {children}
                </ThemeText>
            ) : (
                children
            )}
            <IconButton
                onPress={onClose}
                name="x-mark"
                sizeType="small"
                hitSlop={6}
                style={styles.icon}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 40,
        paddingHorizontal: 14,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    icon: {
        marginLeft: rpx(8),
    },
});
