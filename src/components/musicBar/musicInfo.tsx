import React, { memo, useLayoutEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSetAtom } from "jotai";
import FastImage from "../base/fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import Color from "color";
import ThemeText from "../base/themeText";
import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { fullPlayingAtom } from "@/core/tabletNav";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import TrackPlayer, { useMusicQuality, usePlayList } from "@/core/trackPlayer";
import LocalMusicSheet from "@/core/localMusicSheet";
import Animated, {
    SharedValue,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { timingConfig } from "@/constants/commonConst";
import { getNextQuality, qualityText } from "@/utils/qualities";

interface IBarMusicItemProps {
    musicItem: IMusic.IMusicItem | null;
    activeIndex: number; // 当前展示的是0/1/2
    transformSharedValue: SharedValue<number>;
}
function _BarMusicItem(props: IBarMusicItemProps) {
    const { musicItem, activeIndex, transformSharedValue } = props;
    const colors = useColors();
    const safeAreaInsets = useSafeAreaInsets();
    const quality = useMusicQuality();

    const animatedStyles = useAnimatedStyle(() => {
        return {
            left: `${(transformSharedValue.value + activeIndex) * 100}%`,
        };
    }, [activeIndex]);

    if (!musicItem) {
        return null;
    }

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    paddingLeft: 12 + safeAreaInsets.left,
                },
                animatedStyles,
            ]}>
            <FastImage
                style={styles.artworkImg}
                source={musicItem.artwork}
                placeholderSource={ImgAsset.albumDefault}
            />
            <Text
                ellipsizeMode="tail"
                accessible={false}
                style={styles.textWrapper}
                numberOfLines={1}>
                <ThemeText fontSize="content" fontColor="musicBarText">
                    {musicItem?.title}
                </ThemeText>
                {/* 当前音质标识（QQ 音乐式带框标签）：`标题 ·高音质`，description 小字、musicBarText 半透明；
                    点击自动切换到下一个音质（low→standard→high→super 循环），不弹面板；本地音乐无多音质不显示 */}
                {musicItem && quality && !LocalMusicSheet.isLocalMusic(musicItem) && (
                    <ThemeText
                        fontSize="description"
                        color={Color(colors.musicBarText)
                            .alpha(0.6)
                            .toString()}
                        style={{
                            borderWidth: StyleSheet.hairlineWidth,
                            borderRadius: 4,
                            paddingHorizontal: 4,
                            borderColor: Color(colors.musicBarText)
                                .alpha(0.35)
                                .toString(),
                        }}
                        onPress={() => {
                            TrackPlayer.changeQuality(getNextQuality(quality));
                        }}>
                        {" "}·{qualityText[quality]}
                    </ThemeText>
                )}
                {musicItem?.artist && (
                    <ThemeText
                        fontSize="description"
                        color={Color(colors.musicBarText)
                            .alpha(0.6)
                            .toString()}>
                        {" "}
                        -{musicItem.artist}
                    </ThemeText>
                )}
            </Text>
        </Animated.View>
    );
}

const BarMusicItem = memo(
    _BarMusicItem,
    (prev, curr) =>
        prev.musicItem === curr.musicItem &&
        prev.activeIndex === curr.activeIndex,
);

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        width: "100%",
        alignItems: "center",
        position: "absolute",
    },
    textWrapper: {
        flexGrow: 1,
        flexShrink: 1,
    },
    artworkImg: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginRight: 12,
    },
});

interface IMusicInfoProps {
    musicItem: IMusic.IMusicItem | null;
    paddingLeft?: number;
}

function skipMusicItem(direction: number) {
    if (direction === -1) {
        TrackPlayer.skipToNext();
    } else if (direction === 1) {
        TrackPlayer.skipToPrevious();
    }
}

export default function MusicInfo(props: IMusicInfoProps) {
    const { musicItem } = props;
    const navigate = useNavigate();
    const setFullPlaying = useSetAtom(fullPlayingAtom);
    const isTablet = useIsTablet();
    const playLists = usePlayList();
    const siblingMusicItems = useMemo(() => {
        if (!musicItem) {
            return {
                prev: null,
                next: null,
            };
        }
        return {
            prev: TrackPlayer.previousMusic,
            next: TrackPlayer.nextMusic,
        };
    }, [musicItem, playLists]);

    // +- 1
    const transformSharedValue = useSharedValue(0);

    const musicItemWidthValue = useSharedValue(0);

    const tapGesture = Gesture.Tap()
        .onStart(() => {
            // 平板：进入全屏播放层（与 tabletPanel 单击一致），不走覆盖层栈叠一层 music-detail
            if (isTablet) {
                setFullPlaying(true);
            } else {
                navigate(ROUTE_PATH.MUSIC_DETAIL);
            }
        })
        .runOnJS(true);

    useLayoutEffect(() => {
        transformSharedValue.value = 0;
    }, [musicItem]);

    const panGesture = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onUpdate(e => {
            if (musicItemWidthValue.value) {
                transformSharedValue.value =
                    e.translationX / musicItemWidthValue.value;
            }
        })
        .onEnd((e, success) => {
            if (!success) {
                // 还原到原始位置
                transformSharedValue.value = withTiming(
                    0,
                    timingConfig.animationFast,
                );
            } else {
                // fling
                const deltaX = e.translationX;
                const vX = e.velocityX;

                let skip = 0;
                if (musicItemWidthValue.value) {
                    const rate = deltaX / musicItemWidthValue.value;

                    if (Math.abs(rate) > 0.3) {
                        // 先判断距离
                        skip = vX > 0 ? 1 : -1;
                        transformSharedValue.value = withTiming(
                            skip,
                            timingConfig.animationFast,
                            () => {
                                runOnJS(skipMusicItem)(skip);
                            },
                        );
                    } else if (Math.abs(vX) > 1500) {
                        // 再判断速度
                        skip = vX > 0 ? 1 : -1;
                        transformSharedValue.value = skip;
                        runOnJS(skipMusicItem)(skip);
                    } else {
                        transformSharedValue.value = withTiming(
                            0,
                            timingConfig.animationFast,
                        );
                    }
                } else {
                    transformSharedValue.value = 0;
                }
            }
        });

    const gesture = Gesture.Race(panGesture, tapGesture);

    return (
        <GestureDetector gesture={gesture}>
            <View
                style={musicInfoStyles.infoContainer}
                onLayout={e => {
                    musicItemWidthValue.value = e.nativeEvent.layout.width;
                }}>
                <BarMusicItem
                    transformSharedValue={transformSharedValue}
                    musicItem={siblingMusicItems.prev}
                    activeIndex={-1}
                />
                <BarMusicItem
                    transformSharedValue={transformSharedValue}
                    musicItem={musicItem}
                    activeIndex={0}
                />
                <BarMusicItem
                    transformSharedValue={transformSharedValue}
                    musicItem={siblingMusicItems.next}
                    activeIndex={1}
                />
            </View>
        </GestureDetector>
    );
}

const musicInfoStyles = StyleSheet.create({
    infoContainer: {
        flex: 1,
        height: "100%",
        alignItems: "center",
        flexDirection: "row",
        overflow: "hidden",
    },
});
