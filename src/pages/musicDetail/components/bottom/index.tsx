import React from "react";
import { StyleSheet, View } from "react-native";
import SeekBar from "./seekBar";
import PlayControl from "./playControl";

export default function Bottom() {
    return (
        <View style={style.wrapper}>
            <SeekBar />
            <PlayControl />
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        // 收紧底部留白：播放条与控制行挨得更近，让歌词区更大
        paddingVertical: 4,
        paddingHorizontal: 16,
    },
});
