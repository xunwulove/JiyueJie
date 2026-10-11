import React from "react";
import { Pressable, StyleSheet } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import { iconSizeConst } from "@/constants/uiConst";
import Icon, { IIconName } from "@/components/base/icon.tsx";

interface IFabProps {
    icon?: IIconName;
    onPress?: () => void;
}
export default function Fab(props: IFabProps) {
    const { icon, onPress } = props;

    const colors = useColors();

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.container,
                {
                    backgroundColor: colors.backdrop,
                    shadowColor: colors.shadow,
                },
            ]}>
            {icon ? (
                <Icon
                    name={icon}
                    color={colors.text}
                    size={iconSizeConst.normal}
                />
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 56,
        height: 56,
        borderRadius: 28,
        position: "absolute",
        zIndex: 10010,
        right: 24,
        bottom: 16,
        justifyContent: "center",
        alignItems: "center",
        shadowOffset: {
            width: 0,
            height: 5,
        },
        shadowOpacity: 0.34,
        shadowRadius: 6.27,

        elevation: 10,
    },
});
