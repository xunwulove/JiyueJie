import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import timeformat from "@/utils/timeformat";
import TrackPlayer, { useProgress } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import { fontSizeConst } from "@/constants/uiConst";

interface ITimeLabelProps {
    time: number;
}

function TimeLabel(props: ITimeLabelProps) {
    const colors = useColors();
    return (
        <Text style={[style.text, { color: colors.textSecondary }]}>
            {timeformat(Math.max(props.time, 0))}
        </Text>
    );
}

export default function SeekBar() {
    const progress = useProgress(1000);
    const [tmpProgress, setTmpProgress] = useState<number | null>(null);
    const slidingRef = useRef(false);
    const colors = useColors();

    return (
        <View style={style.wrapper}>
            <TimeLabel time={tmpProgress ?? progress.position} />
            <Slider
                style={style.slider}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={
                    colors.surfaceVariant ?? "rgba(0,0,0,0.12)"
                }
                thumbTintColor={colors.primary}
                minimumValue={0}
                maximumValue={progress.duration}
                onSlidingStart={() => {
                    slidingRef.current = true;
                }}
                onValueChange={val => {
                    if (slidingRef.current) {
                        setTmpProgress(val);
                    }
                }}
                onSlidingComplete={val => {
                    slidingRef.current = false;
                    setTmpProgress(null);
                    if (val >= progress.duration - 2) {
                        val = progress.duration - 2;
                    }
                    TrackPlayer.seekTo(val);
                }}
                value={progress.position}
            />
            <TimeLabel time={progress.duration} />
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        // 收紧进度条高度，让歌词区更大
        height: 28,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
    },
    slider: {
        width: "73%",
        height: 28,
    },
    text: {
        fontSize: fontSizeConst.caption, // 对齐 APlayer 进度时间 11sp（=caption 档位）
        includeFontPadding: false,
    },
});
