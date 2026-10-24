import React, { useMemo, useState } from "react";
import SongCover from "@/components/base/songCover";
import useOrientation from "@/hooks/useOrientation";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useCurrentMusic } from "@/core/trackPlayer";
import globalStyle from "@/constants/globalStyle";
import { StyleSheet, View } from "react-native";
import { showDialog } from "@/components/dialogs/useDialog";

interface IProps {
    onTurnPageClick?: () => void;
}

export default function AlbumCover(props: IProps) {
    const { onTurnPageClick } = props;

    const musicItem = useCurrentMusic();
    const orientation = useOrientation();

    /* 右侧大封面区实际尺寸（onLayout 实测），驱动横屏封面弹性计算 */
    const [paneSize, setPaneSize] = useState<{
        w: number;
        h: number;
    }>({ w: 0, h: 0 });

    const artworkStyle = useMemo(() => {
        if (orientation === "vertical") {
            return {
                width: 240, // 对齐 APlayer 手机封面 240dp
                height: 240,
                borderRadius: 20, // 对齐 APlayer 圆角 20dp
            };
        }
        return null;
    }, [orientation]);

    const isHorizontal = orientation === "horizontal";

    /* 横屏封面：正方形，尺寸 = min(区宽×88%, 区高×92%)——高度预算兜底，
       矮窗（如手机横屏）下自动缩小，不再因 aspectRatio 固定高度溢出 */
    const horizontalCover = useMemo(() => {
        const { w, h } = paneSize;
        if (w <= 0 || h <= 0) {
            return null;
        }
        const size = Math.min(w * 0.88, h * 0.92);
        return { width: size, height: size };
    }, [paneSize]);

    const longPress = Gesture.LongPress()
        .onStart(() => {
            if (musicItem?.artwork) {
                showDialog("ImageViewerDialog", {
                    url: musicItem.artwork,
                });
            }
        })
        .runOnJS(true);

    const tap = Gesture.Tap()
        .onStart(() => {
            onTurnPageClick?.();
        })
        .runOnJS(true);

    const combineGesture = Gesture.Race(tap, longPress);

    return (
        <>
            <GestureDetector gesture={combineGesture}>
                <View
                    style={globalStyle.fullCenter}
                    onLayout={e => {
                        const { width, height } = e.nativeEvent.layout;
                        if (
                            width > 0 &&
                            height > 0 &&
                            (width !== paneSize.w || height !== paneSize.h)
                        ) {
                            setPaneSize({ w: width, h: height });
                        }
                    }}>
                    {isHorizontal ? (
                        <View
                            style={[
                                styles.horizontalWrapper,
                                horizontalCover ?? null,
                            ]}>
                            <SongCover
                                musicItem={musicItem}
                                style={styles.fullImage}
                                resizeMode="contain"
                            />
                        </View>
                    ) : (
                        <SongCover
                            musicItem={musicItem}
                            style={artworkStyle}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </GestureDetector>
        </>
    );
}

const styles = StyleSheet.create({
    fullImage: {
        width: "100%",
        height: "100%",
    },
    horizontalWrapper: {
        // 宽高由 horizontalCover 动态提供（min(区宽×88%, 区高×92%)，矮窗自动缩小）
        // 不用 aspectRatio:1 —— Yoga 双向钳制（maxHeight/高度预算）时会变形为矩形
        borderRadius: 28, // 对齐 APlayer 平板封面圆角 28dp
        overflow: "hidden",
    },
});
