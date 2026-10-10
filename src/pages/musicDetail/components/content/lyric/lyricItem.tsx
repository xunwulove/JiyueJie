import React, { memo } from "react";
import { StyleSheet, Text } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import { fontSizeConst } from "@/constants/uiConst";

interface ILyricItemComponentProps {
    // 行号
    index?: number;
    // 显示
    light?: boolean;
    // 高亮
    highlight?: boolean;
    // 文本
    text?: string;
    // 字体大小
    fontSize?: number;

    onLayout?: (index: number, height: number) => void;
}

function _LyricItemComponent(props: ILyricItemComponentProps) {
    const { light, highlight, text, onLayout, index, fontSize } = props;

    const colors = useColors();

    return (
        <Text
            onLayout={({ nativeEvent }) => {
                if (index !== undefined) {
                    onLayout?.(index, nativeEvent.layout.height);
                }
            }}
            style={[
                lyricStyles.item,
                {
                    fontSize: fontSize || fontSizeConst.content,
                    color: colors.text,
                },
                highlight
                    ? [
                        lyricStyles.highlightItem,
                        {
                            color: colors.primary,
                        },
                    ]
                    : null,
                light
                    ? [lyricStyles.draggingItem, { color: colors.text }]
                    : null,
            ]}>
            {text}
        </Text>
    );
}
// 歌词
const LyricItemComponent = memo(
    _LyricItemComponent,
    (prev, curr) =>
        prev.light === curr.light &&
        prev.highlight === curr.highlight &&
        prev.text === curr.text &&
        prev.index === curr.index &&
        prev.fontSize === curr.fontSize,
);

export default LyricItemComponent;

const lyricStyles = StyleSheet.create({
    highlightItem: {
        opacity: 1,
    },
    item: {
        opacity: 0.6,
        paddingHorizontal: rpx(64),
        // 固定 dp：歌词行上下间距（原 rpx(14) 平板≈15dp/边，间距过大），手机/平板统一紧凑间距
        paddingVertical: 8,
        width: "100%",
        textAlign: "center",
        textAlignVertical: "center",
    },
    draggingItem: {
        opacity: 0.9,
    },
});
