import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { iconSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import { showDialog } from "@/components/dialogs/useDialog";
import useOrientation from "@/hooks/useOrientation";
import HeartIcon from "../heartIcon";
import Icon from "@/components/base/icon.tsx";
import { useScheduleCloseCountDown } from "@/utils/scheduleClose";
import { useCurrentMusic } from "@/core/trackPlayer";
import LocalMusicSheet from "@/core/localMusicSheet";
import downloader from "@/core/downloader";
import Toast from "@/utils/toast";
import { useI18N } from "@/core/i18n";
import { useAppConfig } from "@/core/appConfig";

interface ILyricOperationsProps {
    scrollToCurrentLrcItem: () => void;
}

export default function LyricOperations(_props: ILyricOperationsProps) {
    const colors = useColors();
    const orientation = useOrientation();
    const { t } = useI18N();

    // 定时关闭倒计时状态：激活时按钮高亮 primary（对齐旧项目 Timer 按钮 timerRunning 高亮）
    const countDown = useScheduleCloseCountDown();

    // 当前播放歌曲（响应式）+ 是否已下载（响应式）
    const currentMusic = useCurrentMusic();
    const isLocal = LocalMusicSheet.useIsLocal(currentMusic);

    // 任一音效开启 → 入口图标高亮 primary（输出增益 0dB 直通不算开启）
    const eqOn = useAppConfig("sound.eqEnabled");
    const convolverOn = useAppConfig("jdsp.convolverEnabled");
    const bassOn = useAppConfig("jdsp.bassEnabled");
    const stereoOn = useAppConfig("jdsp.stereoEnabled");
    const tubeOn = useAppConfig("jdsp.tubeEnabled");
    const crossfeedOn = useAppConfig("jdsp.crossfeedEnabled");
    const ddcOn = useAppConfig("jdsp.ddcEnabled");
    const postGainOn = useAppConfig("jdsp.postGainEnabled") ?? true;
    const postGain = useAppConfig("jdsp.postGain") ?? 0;
    const effectOn =
        eqOn ||
        convolverOn ||
        bassOn ||
        stereoOn ||
        tubeOn ||
        crossfeedOn ||
        ddcOn ||
        (postGainOn && postGain !== 0);

    return (
        <View style={styles.container}>
            {orientation === "vertical" ? <HeartIcon /> : null}
            {/* 音效快捷入口：audio-lines，任一音效开启高亮 primary（替代原倍速文字按钮，弹播放设置三级浮窗） */}
            <Icon
                name="audio-lines"
                size={iconSizeConst.normal}
                color={effectOn ? colors.primary : colors.textSecondary}
                onPress={() => {
                    showDialog("SoundEffectQuickDialog");
                }}
            />
            {/* 定时关闭（三级浮窗） */}
            <Icon
                name="alarm-clock"
                size={iconSizeConst.normal}
                color={
                    countDown !== null
                        ? colors.primary
                        : colors.textSecondary
                }
                onPress={() => {
                    showDialog("TimingCloseDialog");
                }}
            />
            {/* 音量：弹音量调节三级浮窗（播放调节类，紧跟定时关闭） */}
            <Icon
                name="volume-2"
                size={iconSizeConst.normal}
                color={colors.textSecondary}
                onPress={() => {
                    showDialog("VolumeSettingDialog");
                }}
            />
            {/* 横屏操作行显示"我喜欢"爱心（竖屏顶部已有 HeartIcon，不重复） */}
            {orientation !== "vertical" ? <HeartIcon /> : null}
            {/* 下载：非本地歌曲显示下载箭头（弹音质选择）；本地歌曲显示灰色对勾，
                点击提示"已是本地音乐"（原误用"设置成功"文案） */}
            {isLocal ? (
                <Icon
                    name="circle-check"
                    size={iconSizeConst.normal}
                    color={colors.textSecondary}
                    onPress={() => {
                        Toast.success(t("toast.musicIsLocal"));
                    }}
                />
            ) : (
                <Icon
                    name="download"
                    size={iconSizeConst.normal}
                    color={colors.textSecondary}
                    onPress={() => {
                        if (!currentMusic) {
                            return;
                        }
                        showDialog("MusicQualityDialog", {
                            musicItem: currentMusic,
                            type: "download",
                            async onQualityPress(quality) {
                                downloader.download(currentMusic, quality);
                            },
                        });
                    }}
                />
            )}
            {/* 三点菜单已移入顶栏（主题设置图标右侧），功能区不再保留 */}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        // 收紧功能区高度与底部间距，让歌词区更大
        height: 48,
        marginBottom: rpx(4),
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
    },
});
