import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import FastImage from "./fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import { useCoverBase } from "@/core/coverBase";
import useColors from "@/hooks/useColors";

/**
 * 自制封面（方案一：仅界面展示，不生成真实图片文件）：
 * 无封面歌曲展示「用户底图」合成封面——纯底图（本地选图，未设回退默认占位），不叠加歌名。
 * 长图取图位置：底图按 cover 缩放铺满容器后，依配置 offset（0~1，沿长边方向）做
 * transform 平移——竖图沿高、横图沿宽（等价于以短边为边长取最大内接正方形、
 * 沿长边滑动截取位置），容器 overflow hidden 裁掉溢出一侧。
 *
 * 关键：FastImage 显示尺寸必须是「cover 缩放后的真实尺寸」（drawW×drawH），
 * 定位在左上角再由容器裁剪 + 平移；若用 absoluteFill（尺寸=容器 box），
 * 平移量（按真实图溢出算）会把只有 box 大小的 view 移出容器，露出背景 → 封面显示一半。
 */
interface IProps {
    style?: StyleProp<ViewStyle>;
}

export default function SyntheticCover(props: IProps) {
    const { style } = props;
    const colors = useColors();
    const base = useCoverBase();
    const [box, setBox] = useState({ w: 0, h: 0 });

    /* 取图位置：cover 缩放后（drawW×drawH）沿长边方向平移 offset；
       容器 overflow hidden 裁掉溢出一侧。正方形图无偏移、直接铺满 box。 */
    const translate = useMemo(() => {
        const { path, offset, imgW, imgH } = base;
        if (!path || imgW <= 0 || imgH <= 0 || box.w <= 0 || box.h <= 0) {
            return { width: box.w, height: box.h, transform: [] as never[] };
        }
        if (imgW === imgH) {
            return { width: box.w, height: box.h, transform: [] as never[] };
        }
        const scale = Math.max(box.w / imgW, box.h / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        if (imgH > imgW) {
            // 竖图：宽铺满 box.w，高溢出，沿垂直方向取 offset
            return {
                width: drawW,
                height: drawH,
                transform: [{ translateY: -(drawH - box.h) * offset }] as never[],
            };
        }
        // 横图：高铺满 box.h，宽溢出，沿水平方向取 offset
        return {
            width: drawW,
            height: drawH,
            transform: [{ translateX: -(drawW - box.w) * offset }] as never[],
        };
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
                style={[styles.image, translate]}
                source={base.path ?? ImgAsset.albumDefault}
                placeholderSource={ImgAsset.albumDefault}
                /* 有自选封面：cover 缩放 + translate 取图（translate 已按 drawW/drawH 计算）；
                   无自选封面（albumDefault 正方形音符图）：contain 完整显示，避免非正方形容器
                   cover 放大裁切导致音符占比过大 */
                resizeMode={base.path ? "cover" : "contain"}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: "hidden",
    },
    image: {
        position: "absolute",
        left: 0,
        top: 0,
    },
});
