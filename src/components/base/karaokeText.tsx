import React from "react";
import {
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    View,
} from "react-native";

interface IKaraokeTextProps {
    /** 完整歌词文本（可含 \n 多行，如 歌词+翻译） */
    text: string;
    /** 当前行高亮颜色 */
    sungColor: string;
    fontSize?: number;
    lineHeight?: number;
    fontWeight?: TextStyle["fontWeight"];
    /** 行级样式（宽度/内边距等），作用于外层容器 */
    style?: StyleProp<TextStyle> | StyleProp<TextStyle>[];
    onLayout?: (event: any) => void;
}

/**
 * 歌词当前行渲染组件：整行直接用 sungColor 高亮（当前行主题色突出）。
 * 支持多行文本（歌词+翻译）；不订阅播放进度、零额外重渲染。
 * （原逐字进度染色 ProgressKaraokeText 已于 2026-10-15 清理，三处调用方均为整行高亮模式）
 */
export default function KaraokeText(props: IKaraokeTextProps) {
    const {
        text,
        sungColor,
        fontSize,
        lineHeight,
        fontWeight,
        style,
        onLayout,
    } = props;

    const textStyle: TextStyle = {
        fontSize,
        lineHeight,
        fontWeight,
        color: sungColor,
    };
    const lines = text.split("\n");
    return (
        <View onLayout={onLayout} style={[styles.container, style]}>
            {lines.map((line, li) => (
                <View key={li} style={styles.row}>
                    <Text style={textStyle}>{line}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
    },
    row: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
});
