import React, { useState } from "react";
import {
    LayoutChangeEvent,
    StyleSheet,
    View,
} from "react-native";
import FastImage from "@/components/base/fastImage";
import ThemeText from "@/components/base/themeText";
import Dialog from "./base";
import { hideDialog } from "../useDialog";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Slider from "@react-native-community/slider";

interface ICoverBasePositionDialogProps {
    /** 底图 uri */
    path: string;
    /** 图片固有宽高（Image.getSize 取得） */
    imgW: number;
    imgH: number;
    /** 初始取图位置 0~1 */
    initialOffset?: number;
    /** 确认回调（offset 0~1，沿长边方向） */
    onConfirm?: (offset: number) => void;
}

/**
 * 取图位置选择 - 三级浮窗：预览底图（contain 完整显示），叠加"最大内接正方形"
 * 选框（边长=短边），滑块沿图片长边方向（竖图沿高、横图沿宽）滑动选择截取位置。
 */
export default function CoverBasePositionDialog(
    props: ICoverBasePositionDialogProps,
) {
    const { path, imgW, imgH, initialOffset, onConfirm } = props ?? {};
    const { t } = useI18N();
    const colors = useColors();
    const [offset, setOffset] = useState(initialOffset ?? 0.5);
    const [pane, setPane] = useState({ w: 0, h: 0 });

    /* 预览几何：contain 缩放 → 最大内接正方形 + 选框定位（沿长边偏移） */
    const geo = (() => {
        if (pane.w <= 0 || pane.h <= 0 || imgW <= 0 || imgH <= 0) {
            return null;
        }
        const scale = Math.min(pane.w / imgW, pane.h / imgH);
        const dispW = imgW * scale;
        const dispH = imgH * scale;
        const sq = Math.min(dispW, dispH);
        let left: number;
        let top: number;
        if (dispW === dispH) {
            left = (pane.w - sq) / 2;
            top = (pane.h - sq) / 2;
        } else if (dispH > dispW) {
            // 竖图：沿高取位置
            left = (pane.w - dispW) / 2;
            top = (pane.h - dispH) / 2 + (dispH - sq) * offset;
        } else {
            // 横图：沿宽取位置
            top = (pane.h - dispH) / 2;
            left = (pane.w - dispW) / 2 + (dispW - sq) * offset;
        }
        return { dispW, dispH, sq, left, top };
    })();

    const onLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (
            width > 0 &&
            height > 0 &&
            (width !== pane.w || height !== pane.h)
        ) {
            setPane({ w: width, h: height });
        }
    };

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title stringContent>
                {t("coverBase.position")}
            </Dialog.Title>
            <Dialog.Content
                needScroll
                style={{ paddingHorizontal: 0, paddingTop: 12, paddingBottom: 12 }}>
                <View
                    style={[styles.preview, { backgroundColor: colors.background }]}
                    onLayout={onLayout}>
                    <FastImage
                        style={StyleSheet.absoluteFill}
                        source={path}
                        resizeMode="contain"
                    />
                    {geo ? (
                        <View
                            style={[
                                styles.frame,
                                {
                                    width: geo.sq,
                                    height: geo.sq,
                                    left: geo.left,
                                    top: geo.top,
                                    borderColor: colors.primary,
                                },
                            ]}
                        />
                    ) : null}
                </View>
                <View style={styles.sliderWrap}>
                    <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={1}
                        value={offset}
                        onValueChange={setOffset}
                        disabled={!geo || geo.dispW === geo.dispH}
                    />
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.hint}>
                        {t("coverBase.position.hint")}
                    </ThemeText>
                </View>
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress() {
                            hideDialog();
                        },
                    },
                    {
                        title: t("common.confirm"),
                        type: "primary",
                        onPress() {
                            onConfirm?.(offset);
                            hideDialog();
                        },
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    preview: {
        width: "100%",
        height: rpx(280),
        overflow: "hidden",
    },
    frame: {
        position: "absolute",
        borderWidth: 2,
        borderRadius: 4,
    },
    sliderWrap: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 4,
    },
    slider: {
        width: "100%",
        height: 32,
    },
    hint: {
        textAlign: "center",
        paddingTop: 4,
    },
});
