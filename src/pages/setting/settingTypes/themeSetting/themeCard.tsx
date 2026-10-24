import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import Image from "@/components/base/image";
import { ImgAsset } from "@/constants/assetsConst";

interface IThemeCardProps {
    selected?: boolean;
    preview?: string;
    onPress?: () => void;
    title?: string;
}
export default function ThemeCard(props: IThemeCardProps) {
    const { selected, preview, onPress, title } = props;

    const isPreviewColor = preview?.startsWith("#") ? true : false;

    const colors = useColors();

    return (
        <View>
            <Pressable
                onPress={onPress}
                style={[
                    styles.borderContainer,
                    selected
                        ? {
                            borderWidth: 2,
                            borderStyle: "solid",
                            borderColor: colors.primary,
                        }
                        : null,
                ]}>
                <View
                    style={[
                        styles.container,
                        // 色块不加常驻细框：浅色选中态由外层 primary 选中框标示（浅色下可见），
                        // 深色模式下浅色白块天然可见（2026-10-14 按用户要求去除细框）
                        isPreviewColor
                            ? {
                                backgroundColor: preview,
                            }
                            : null,
                    ]}>
                    {isPreviewColor ? null : (
                        <Image
                            style={styles.image}
                            uri={preview}
                            emptySrc={ImgAsset.add}
                        />
                    )}
                </View>
            </Pressable>
            <ThemeText
                numberOfLines={1}
                fontSize="subTitle"
                style={styles.title}
                fontColor={selected ? "primary" : "text"}>
                {title}
            </ThemeText>
        </View>
    );
}

const styles = StyleSheet.create({
    borderContainer: {
        width: rpx(112),
        height: rpx(112),
        borderRadius: rpx(18),
        marginRight: rpx(16),
        justifyContent: "center",
        alignItems: "center",
    },
    container: {
        width: rpx(96),
        height: rpx(96),
        borderRadius: rpx(10),
    },
    title: {
        textAlign: "center",
        marginTop: rpx(8),
        width: rpx(112),
    },
    image: {
        width: "100%",
        height: "100%",
        borderRadius: rpx(10),
    },
});
