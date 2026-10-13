import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Image from "@/components/base/image";
import Slider from "@react-native-community/slider";
import useColors from "@/hooks/useColors";
import Theme from "@/core/theme";
import { showDialog } from "@/components/dialogs/useDialog";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"];

/**
 * 主题设置 - 自定义背景（B3 恢复：自定义取色已去除，背景自定义保留并重新开放入口）。
 * 支持：选择本地图片 / 背景模糊滑块 / 背景透明度滑块 / 清除背景。
 * 写入链路：Theme.setBackground（store + 持久化 theme.background / backgroundBlur / backgroundOpacity）。
 */
export default function BackgroundCustom() {
    const colors = useColors();
    const background = Theme.useBackground();

    const url = background?.url;
    const blur = background?.blur ?? 20;
    const opacity = background?.opacity ?? 0.6;

    const pickLocalImage = () => {
        // 文件选择浮窗会替换当前主题浮窗（对话框全局单值）；确认/取消后重开主题浮窗，保持"主题浮窗 → 选图 → 回到主题浮窗"闭环
        const reopenThemeDialog = () => {
            showDialog("ThemeSettingDialog");
        };
        showDialog("FileSelectorDialog", {
            fileType: "file",
            actionText: "设为背景",
            matchExtension: path =>
                IMAGE_EXTENSIONS.some(ext =>
                    path.toLowerCase().endsWith(ext),
                ),
            onAction: files => {
                const file = files?.[0];
                if (file?.path) {
                    Theme.setBackground({
                        url: `file://${file.path}`,
                    });
                }
                reopenThemeDialog();
                return true;
            },
            onCancel: reopenThemeDialog,
        });
    };

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

            {/* 当前背景预览 */}
            <View style={style.previewWrapper}>
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
            </View>

            {/* 选择本地图片 */}
            <View style={style.sectionWrapper}>
                {actionRow("选择本地图片", pickLocalImage)}
                {actionRow("清除背景", clearBackground, true)}
            </View>

            {/* 背景模糊 */}
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

            {/* 背景透明度 */}
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
