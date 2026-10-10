import React, { useMemo } from "react";
import { ImgAsset } from "@/constants/assetsConst";
import FastImage from "@/components/base/fastImage";
import useOrientation from "@/hooks/useOrientation";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useCurrentMusic } from "@/core/trackPlayer";
import globalStyle from "@/constants/globalStyle";
import { StyleSheet, View } from "react-native";
import { showPanel } from "@/components/panels/usePanel.ts";

interface IProps {
    onTurnPageClick?: () => void;
}

export default function AlbumCover(props: IProps) {
    const { onTurnPageClick } = props;

    const musicItem = useCurrentMusic();
    const orientation = useOrientation();

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

    const longPress = Gesture.LongPress()
        .onStart(() => {
            if (musicItem?.artwork) {
                showPanel("ImageViewer", {
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
                <View style={globalStyle.fullCenter}>
                    {isHorizontal ? (
                        <View style={styles.horizontalWrapper}>
                            <FastImage
                                style={styles.fullImage}
                                source={musicItem?.artwork}
                                placeholderSource={ImgAsset.albumDefault}
                            />
                        </View>
                    ) : (
                        <FastImage
                            style={artworkStyle}
                            source={musicItem?.artwork}
                            placeholderSource={ImgAsset.albumDefault}
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
        width: "88%",
        aspectRatio: 1,
        borderRadius: 28, // 对齐 APlayer 平板封面圆角 28dp
        overflow: "hidden",
    },
});
