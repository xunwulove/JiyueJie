import React from "react";
import {
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    View,
} from "react-native";
import { useProgress } from "@/core/trackPlayer";

interface IKaraokeTextProps {
    /** 完整歌词文本（可含 \n 多行，如 歌词+翻译） */
    text: string;
    /** 本行开始时间（ms） */
    startTime: number;
    /** 本行结束时间（ms）= 下一行开始时间 */
    endTime: number;
    /** 已唱部分颜色（卡拉OK填充色 / uniform 模式下整行颜色） */
    sungColor: string;
    /** 未唱部分颜色（仅进度染色模式使用） */
    unsungColor: string;
    /** 未唱部分透明度（默认 1） */
    unsungOpacity?: number;
    /** true = 整行直接 sungColor，不做进度染色（当前行整体用主题色突出） */
    uniform?: boolean;
    fontSize?: number;
    lineHeight?: number;
    fontWeight?: TextStyle["fontWeight"];
    /** 行级样式（宽度/内边距等），作用于外层容器 */
    style?: StyleProp<TextStyle> | StyleProp<TextStyle>[];
    onLayout?: (event: any) => void;
}

/** 进度染色模式：随播放进度逐字染成 sungColor（原卡拉OK实现） */
function ProgressKaraokeText(props: IKaraokeTextProps) {
    const {
        text,
        startTime,
        endTime,
        sungColor,
        unsungColor,
        unsungOpacity = 1,
        fontSize,
        lineHeight,
        fontWeight,
        style,
        onLayout,
    } = props;

    const progress = useProgress(200);
    const position = progress?.position ?? 0;
    const duration = endTime - startTime;
    const ratio =
        duration > 0
            ? Math.min(Math.max((position - startTime) / duration, 0), 1)
            : 0;
    const total = text.length;
    const sungCount = total > 0 ? Math.round(ratio * total) : 0;

    const textStyle: TextStyle = { fontSize, lineHeight, fontWeight };

    // 多行（歌词+翻译）：染色字数按行顺序分配，逐行渲染"已唱段 + 未唱段"
    let remaining = sungCount;
    const lines = text.split("\n");
    return (
        <View onLayout={onLayout} style={[styles.container, style]}>
            {lines.map((line, li) => {
                const take = Math.min(Math.max(remaining, 0), line.length);
                remaining = Math.max(remaining - line.length, 0);
                const sungText = line.slice(0, take);
                const unsungText = line.slice(take);
                return (
                    <View key={li} style={styles.row}>
                        {sungText ? (
                            <Text
                                style={[textStyle, { color: sungColor }]}>
                                {sungText}
                            </Text>
                        ) : null}
                        {unsungText ? (
                            <Text
                                style={[
                                    textStyle,
                                    {
                                        color: unsungColor,
                                        opacity: unsungOpacity,
                                    },
                                ]}>
                                {unsungText}
                            </Text>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}

/** 整体着色模式：整行直接 sungColor（不订阅进度、不逐字染色，零重渲染） */
function UniformKaraokeText(props: IKaraokeTextProps) {
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

/**
 * 歌词当前行渲染组件：
 * - uniform=true：整行直接 sungColor（当前行整体用主题色突出，不做进度染色）
 * - 默认：卡拉OK进度染色（逐字染 sungColor，未唱保持 unsungColor）
 * 支持多行文本（歌词+翻译）；进度染色模式内部订阅播放进度（200ms 刷新），
 * uniform 模式不订阅进度、零额外重渲染。
 */
export default function KaraokeText(props: IKaraokeTextProps) {
    if (props.uniform) {
        return <UniformKaraokeText {...props} />;
    }
    return <ProgressKaraokeText {...props} />;
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
