import React from "react";
import { StyleSheet, Text } from "react-native";
import rpx from "@/utils/rpx";
import timeformat from "@/utils/timeformat";
import { fontSizeConst } from "@/constants/uiConst";
import { useProgress } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";

export default function DraggingTime(props: { time: number }) {
    const progress = useProgress();
    const colors = useColors();

    return (
        <Text
            style={[style.draggingTimeText, { color: colors.textSecondary }]}>
            {timeformat(
                Math.max(Math.min(props.time, progress.duration ?? 0), 0),
            )}
        </Text>
    );
}

const style = StyleSheet.create({
    draggingTimeText: {
        paddingHorizontal: rpx(8),
        paddingVertical: rpx(6),
        borderRadius: rpx(12),
        backgroundColor: "rgba(255,255,255,0.1)",
        fontSize: fontSizeConst.description,
    },
});
