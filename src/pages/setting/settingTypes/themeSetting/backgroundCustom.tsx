import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Image from "@/components/base/image";
import Slider from "@react-native-community/slider";
import useColors from "@/hooks/useColors";
import Theme from "@/core/theme";

export const IMAGE_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
];

/**
 * 主题设置 - 自定义背景（B3 恢复：自定义取色已去除，背景自定义保留并重新开放入口）。
 * 支持：背景模糊滑块 / 背景透明度滑块 / 清除背景；选图由浮窗层统一提供（onPickImage）。
 * 写入链路：Theme.setBackground（store + 持久化 theme.background / backgroundBlur / backgroundOpacity）。
 */
export default function BackgroundCustom({
    onPickImage,
}: {
    onPickImage: () => void;
}) {
    const colors = useColors();
    const background = Theme.useBackground();

    const url = background?.url;
    const blur = background?.blur ?? 20;
    const opacity = background?.opacity ?? 0.6;

    const clearBackground = () => {
        Theme.setBackground({ url: undefined });
    };

    const actionRow = (
        title: string,
        onPress: () => void,
        danger = false,
    ) => (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                style.actionRow,
                {
                    backgroundColor: colors.card,
                    borderColor: colors.divider,
                },
                pressed && { opacity: 0.7 },
            ]}>
            <ThemeText
                fontSize="content"
                fontWeight="medium"
                style={danger ? style.dangerText : undefined}>
                {title}
            </ThemeText>
        </Pressable>
    );

    return (
        <View style={style.wrapper}>
            <ThemeText
                fontSize="subTitle"
                fontWeight="bold"
                fontColor="primary"
                style={style.header}>
                自定义背景
            </ThemeText>

            {/* 当前背景预览（点击整个预览框换图） */}
            <Pressable
                onPress={onPickImage}
                style={({ pressed }) => [
                    style.previewWrapper,
                    pressed && { opacity: 0.8 },
                ]}>
                {url ? (
                    <Image uri={url} style={style.preview} />
                ) : (
                    <View
                        style={[
                            style.preview,
                            { backgroundColor: colors.divider },
                        ]}
                    />
                )}
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    numberOfLines={1}
                    style={style.previewHint}>
                    {url ? "已设置背景" : "未设置背景"}
                </ThemeText>
                <ThemeText
                    fontSize="caption"
                    fontColor="textSecondary"
                    style={style.previewTapHint}>
                    点击选择图片
                </ThemeText>
            </Pressable>

            {/* 仅设置了背景时才显示：清除背景 + 模糊/透明度滑块（无图时无可调项，隐藏避免空控件） */}
            {url ? (
                <>
                    <View style={style.sectionWrapper}>
                        {actionRow("清除背景", clearBackground, true)}
                    </View>

                    <View style={style.sliderRow}>
                        <View style={style.sliderLabelRow}>
                            <ThemeText fontSize="content" fontWeight="medium">
                                背景模糊
                            </ThemeText>
                            <ThemeText
                                fontSize="content"
                                fontColor="textSecondary">
                                {Math.round(blur)}
                            </ThemeText>
                        </View>
                        <Slider
                            style={style.slider}
                            minimumValue={0}
                            maximumValue={100}
                            step={5}
                            value={blur}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={colors.divider}
                            thumbTintColor={colors.primary}
                            onValueChange={val =>
                                Theme.setBackground({ blur: val })
                            }
                        />
                    </View>

                    <View style={style.sliderRow}>
                        <View style={style.sliderLabelRow}>
                            <ThemeText fontSize="content" fontWeight="medium">
                                背景透明度
                            </ThemeText>
                            <ThemeText
                                fontSize="content"
                                fontColor="textSecondary">
                                {opacity.toFixed(2)}
                            </ThemeText>
                        </View>
                        <Slider
                            style={style.slider}
                            minimumValue={0.1}
                            maximumValue={1}
                            step={0.05}
                            value={opacity}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={colors.divider}
                            thumbTintColor={colors.primary}
                            onValueChange={val =>
                                Theme.setBackground({ opacity: val })
                            }
                        />
                    </View>
                </>
            ) : null}
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        paddingHorizontal: rpx(24),
        paddingBottom: rpx(32),
    },
    header: {
        marginTop: rpx(36),
        marginBottom: rpx(12),
    },
    previewWrapper: {
        alignItems: "center",
        gap: rpx(8),
    },
    preview: {
        width: rpx(260),
        height: rpx(150),
        borderRadius: rpx(12),
    },
    previewHint: {
        textAlign: "center",
    },
    previewTapHint: {
        textAlign: "center",
        marginTop: -4,
    },
    sectionWrapper: {
        marginTop: rpx(16),
        gap: rpx(12),
    },
    actionRow: {
        borderRadius: rpx(12),
        borderWidth: rpx(1),
        paddingVertical: rpx(20),
        paddingHorizontal: rpx(20),
        alignItems: "center",
    },
    actionText: {
        textAlign: "center",
    },
    dangerText: {
        textAlign: "center",
        color: "#E5484D",
    },
    sliderRow: {
        marginTop: rpx(28),
    },
    sliderLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: rpx(8),
    },
    slider: {
        width: "100%",
        height: rpx(36),
    },
});
