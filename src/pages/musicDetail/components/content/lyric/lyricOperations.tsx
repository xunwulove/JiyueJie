import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { iconSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import { showPanel } from "@/components/panels/usePanel";
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
import PersistStatus from "@/utils/persistStatus";
import ThemeText from "@/components/base/themeText";

/** 倍速文字按钮：显示当前倍速（如 1.0x / 1.25x），点击弹倍速三级浮窗 */
function RateButton() {
    const colors = useColors();
    const rate = PersistStatus.useValue("music.rate", 100);
    const text =
        (() => {
            const n = (rate as number) / 100;
            const s = n
                .toFixed(n % 1 === 0 ? 1 : 2)
                .replace(/0+$/, "")
                .replace(/\.$/, "");
            return s + "x";
        })();
    return (
        <ThemeText
            fontSize="content"
            fontWeight={rate !== 100 ? "semibold" : "regular"}
            color={rate !== 100 ? colors.primary : colors.textSecondary}
            onPress={() => {
                showDialog("PlayRateDialog");
            }}>
            {text}
        </ThemeText>
    );
}

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

    return (
        <View style={styles.container}>
            {orientation === "vertical" ? <HeartIcon /> : null}
            {/* 倍速：显示当前倍速文字（点击弹三级浮窗；非 1.0x 时高亮 primary） */}
            <RateButton />
            {/* 定时关闭（三级浮窗） */}
            <Icon
                name="alarm-outline"
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
                name="speaker-wave"
                size={iconSizeConst.normal}
                color={colors.textSecondary}
                onPress={() => {
                    showDialog("VolumeSettingDialog");
                }}
            />
            {/* 横屏操作行显示"我喜欢"爱心（竖屏顶部已有 HeartIcon，不重复） */}
            {orientation !== "vertical" ? <HeartIcon /> : null}
            {/* 下载：未下载显示下载箭头（弹音质选择）；已下载显示灰色对勾 */}
            {isLocal ? (
                <Icon
                    name="check-circle-outline"
                    size={iconSizeConst.normal}
                    color={colors.textSecondary}
                    onPress={() => {
                        Toast.success(t("toast.settingSuccess"));
                    }}
                />
            ) : (
                <Icon
                    name="arrow-down-tray"
                    size={iconSizeConst.normal}
                    color={colors.textSecondary}
                    onPress={() => {
                        if (!currentMusic) {
                            return;
                        }
                        showPanel("MusicQuality", {
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
