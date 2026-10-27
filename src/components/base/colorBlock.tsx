import React from "react";
import { Image, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { ImgAsset } from "@/constants/assetsConst";

interface IColorBlockProps {
    color: string;
}
export default function ColorBlock(props: IColorBlockProps) {
    const { color } = props;

    return (
        <View style={[styles.showBar]}>
            <Image
                resizeMode="repeat"
                source={ImgAsset.transparentBg}
                style={styles.transparentBg}
            />
            <View
                style={[
                    styles.showBarContent,
                    {
                        backgroundColor: color,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    showBar: {
        // 2026-10-27 悬浮歌词颜色块缩小：76×50 → 44×28 + 圆角 6（原尺寸占行偏高，对齐设置项紧凑风格）
        width: rpx(44),
        height: rpx(28),
        borderRadius: 6,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "#ccc",
        overflow: "hidden",
    },
    showBarContent: {
        width: "100%",
        height: "100%",
        position: "absolute",
        left: 0,
        top: 0,
    },
    transparentBg: {
        position: "absolute",
        zIndex: -1,
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
    },
});
