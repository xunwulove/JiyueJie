import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { iconSizeConst } from "@/constants/uiConst";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import Slider from "@react-native-community/slider";
import RNTrackPlayer from "react-native-track-player";
import useColors from "@/hooks/useColors";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
/**
 * 音量调节三级浮窗（全屏功能区"音量"按钮）：
 * 显示当前音量百分比 + 滑块实时调节（0-100%，拖动即生效）
 */
export default function VolumeSettingDialog() {
    const colors = useColors();
    // null = 正在读取，避免打开瞬间闪现默认 100%
    const [volume, setVolume] = useState<number | null>(null);
    // 打开时读取当前播放音量（异步 API，读取完成后才渲染滑块）
    useEffect(() => {
        let mounted = true;
        RNTrackPlayer.getVolume()
            .then(v => {
                if (mounted) {
                    setVolume(v ?? 1);
                }
            })
            .catch(() => {
                if (mounted) {
                    setVolume(1);
                }
            });
        return () => {
            mounted = false;
        };
    }, []);
    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>音量</Dialog.Title>
            <Dialog.Content>
                <View style={styles.container}>
                    <Icon
                        name="speaker-wave"
                        size={iconSizeConst.normal}
                        color={colors.textSecondary}
                    />
                    {volume === null ? (
                        <ThemeText style={styles.loadingText}>读取中…</ThemeText>
                    ) : (
                        <>
                            <Slider
                                style={styles.sliderContainer}
                                thumbTintColor={colors.primary}
                                minimumTrackTintColor={colors.primary}
                                maximumTrackTintColor={
                                    colors.surfaceVariant ??
                                    "rgba(0,0,0,0.12)"
                                }
                                value={volume}
                                step={0.05}
                                minimumValue={0}
                                maximumValue={1}
                                onValueChange={val => {
                                    setVolume(val);
                                    RNTrackPlayer.setVolume(val);
                                }}
                            />
                            <ThemeText style={styles.percent}>
                                {Math.round(volume * 100)}%
                            </ThemeText>
                        </>
                    )}
                </View>
            </Dialog.Content>
        </Dialog>
    );
}
const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        paddingHorizontal: rpx(8),
        marginTop: rpx(16),
        marginBottom: rpx(8),
    },
    sliderContainer: {
        flex: 1,
        height: 40,
        marginHorizontal: 12,
    },
    loadingText: {
        flex: 1,
        textAlign: "center",
        opacity: 0.6,
        marginVertical: rpx(16),
    },
    percent: {
        minWidth: rpx(96),
        textAlign: "right",
    },
});
