import repeatModeConst, {
    MusicRepeatMode,
} from "@/constants/repeatModeConst";
import React from "react";
import {
    InteractionManager,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
} from "react-native";

import Icon from "@/components/base/icon.tsx";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useMusicState, useRepeatMode } from "@/core/trackPlayer";
import useOrientation from "@/hooks/useOrientation";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import delay from "@/utils/delay";
import { musicIsPaused } from "@/utils/trackUtils";

/** 与 trackPlayer.toggleRepeatMapping 一致的循环顺序：列表循环→随机→单曲→列表循环 */
const NEXT_REPEAT: Record<MusicRepeatMode, MusicRepeatMode> = {
    [MusicRepeatMode.QUEUE]: MusicRepeatMode.SHUFFLE,
    [MusicRepeatMode.SINGLE]: MusicRepeatMode.QUEUE,
    [MusicRepeatMode.SHUFFLE]: MusicRepeatMode.SINGLE,
};

/**
 * 全屏播放控制行 - 对齐 APlayer PlayingPage：
 * 平板：模式 32dp primary / 上一首 44dp / 播放 80dp 圆(40dp 图标) / 下一首 44dp / 队列 32dp
 * 手机：模式 26dp / 上一首 34dp / 播放 56dp 圆(30dp 图标) / 下一首 34dp / 队列 26dp
 * 矮横屏（窗口高 <600dp）：走手机档尺寸，防止固定大按钮在矮屏堆叠溢出
 */
export default function PlayControl() {
    const repeatMode = useRepeatMode();
    const musicState = useMusicState();
    const colors = useColors();

    const orientation = useOrientation();
    const isTablet = orientation === "horizontal";
    const { height: winH } = useWindowDimensions();
    const compact = winH < 600;

    const modeSize = isTablet && !compact ? 32 : 26;
    const sideSize = isTablet && !compact ? 44 : 34;
    const playBtnSize = isTablet && !compact ? 80 : 56;
    const playIconSize = isTablet && !compact ? 40 : 30;
    const queueSize = isTablet && !compact ? 32 : 26;

    return (
        <View style={style.wrapper}>
            <Icon
                color={colors.primary}
                name={repeatModeConst[repeatMode].icon}
                size={modeSize}
                hitSlop={{ top: 9, bottom: 9, left: 9, right: 9 }}
                onPress={async () => {
                    InteractionManager.runAfterInteractions(async () => {
                        await delay(20, false);
                        TrackPlayer.toggleRepeatMode();
                        const nextMode = NEXT_REPEAT[repeatMode];
                        Toast.success(
                            `已切换为：${repeatModeConst[nextMode].text}`,
                        );
                    });
                }}
            />
            <Icon
                color={colors.text}
                name={"skip-left"}
                size={sideSize}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                onPress={() => {
                    TrackPlayer.skipToPrevious();
                }}
            />
            <Pressable
                style={[
                    style.playBtn,
                    {
                        width: playBtnSize,
                        height: playBtnSize,
                        borderRadius: playBtnSize / 2,
                        backgroundColor: colors.primary,
                    },
                ]}
                onPress={() => {
                    if (musicIsPaused(musicState)) {
                        TrackPlayer.play();
                    } else {
                        TrackPlayer.pause();
                    }
                }}>
                <Icon
                    color={"#FFFFFF"}
                    name={musicIsPaused(musicState) ? "play" : "pause"}
                    size={playIconSize}
                />
            </Pressable>
            <Icon
                color={colors.text}
                name={"skip-right"}
                size={sideSize}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                onPress={() => {
                    TrackPlayer.skipToNext();
                }}
            />
            <Icon
                color={colors.textSecondary}
                name={"playlist"}
                size={queueSize}
                hitSlop={{ top: 9, bottom: 9, left: 9, right: 9 }}
                onPress={() => {
                    showPanel("PlayList");
                }}
            />
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingHorizontal: 24,
    },
    playBtn: {
        alignItems: "center",
        justifyContent: "center",
    },
});
