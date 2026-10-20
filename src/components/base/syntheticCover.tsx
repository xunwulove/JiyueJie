import React, { useMemo, useState } from "react";
import {
    LayoutChangeEvent,
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";
import FastImage from "./fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import { useCoverBase } from "@/core/coverBase";
import useColors from "@/hooks/useColors";

/**
 * 自制封面（方案一：仅界面展示，不生成真实图片文件）：
 * 无封面歌曲展示「用户底图 + 歌名」合成封面——底图（本地选图，未设回退默认占位）、
 * 底部压暗遮罩保文字可读、歌名单行/两行自适应字号（随容器宽度）。
 * 长图取图位置：底图按 cover 铺满容器后，依配置 offset（0~1，沿长边方向）做
 * transform 平移——竖图沿高、横图沿宽（等价于以短边为边长取最大内接正方形、
 * 沿长边滑动截取位置），容器 overflow hidden 裁掉溢出一侧。
 * 集成点通过 SongCover 统一分发（有封面→FastImage，无封面→本组件）。
 */
interface IProps {
    title?: string;
    style?: StyleProp<ViewStyle>;
}

export default function SyntheticCover(props: IProps) {
    const { title, style } = props;
    const colors = useColors();
    const base = useCoverBase();
    const [box, setBox] = useState({ w: 0, h: 0 });

    /* 歌名字号自适应：容器宽度 × 0.18，夹在 16~56 */
    const fontSize = useMemo(() => {
        if (box.w <= 0) {
            return 24;
        }
        return Math.max(16, Math.min(56, Math.round(box.w * 0.18)));
    }, [box.w]);

    /* 取图位置：cover 铺满后按 offset（沿长边方向）平移；容器 overflow hidden 裁掉溢出一侧。
       竖图(imgH>imgW)沿垂直、横图(imgW>imgH)沿水平、正方形无偏移 */
    const translate = useMemo(() => {
        const { path, offset, imgW, imgH } = base;
        if (!path || imgW <= 0 || imgH <= 0 || box.w <= 0 || box.h <= 0) {
            return null;
        }
        if (imgW === imgH) {
            return null;
        }
        const scale = Math.max(box.w / imgW, box.h / imgH);
        const overX = imgW * scale - box.w;
        const overY = imgH * scale - box.h;
        if (imgH > imgW) {
            // 竖图：宽先铺满 box.w，高溢出，沿垂直方向取 offset
            return { transform: [{ translateY: -(overY * offset) }] };
        }
        // 横图：高先铺满 box.h，宽溢出，沿水平方向取 offset
        return { transform: [{ translateX: -(overX * offset) }] };
    }, [base, box]);

    const onLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0 && (width !== box.w || height !== box.h)) {
            setBox({ w: width, h: height });
        }
    };

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: colors.surfaceVariant ?? colors.card },
                style,
            ]}
            onLayout={onLayout}>
            <FastImage
                style={[StyleSheet.absoluteFill, translate]}
                source={base.path ?? ImgAsset.albumDefault}
                placeholderSource={ImgAsset.albumDefault}
            />
            {/* 底部压暗遮罩 + 歌名（pointerEvents none 不挡点击） */}
            <View
                style={StyleSheet.absoluteFill}
                pointerEvents="none">
                <View style={styles.titleWrap}>
                    <Text
                        numberOfLines={2}
                        ellipsizeMode="tail"
                        style={[styles.title, { fontSize }]}>
                        {title ?? ""}
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: "hidden",
    },
    titleWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
        paddingTop: 22,
        paddingBottom: 8,
        backgroundColor: "rgba(0,0,0,0.36)",
    },
    title: {
        color: "#fff",
        fontWeight: "600",
        textAlign: "center",
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowRadius: 4,
        textShadowOffset: { width: 0, height: 1 },
    },
});
