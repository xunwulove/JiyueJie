import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Slider from "@react-native-community/slider";
import useColors from "@/hooks/useColors";
import Icon from "@/components/base/icon.tsx";
import ThemeText from "@/components/base/themeText";
import FastImage from "@/components/base/fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import TrackPlayer, {
    useCurrentMusic,
    useMusicState,
    useProgress,
    useRepeatMode,
} from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import { showPanel } from "@/components/panels/usePanel";
import { fullPlayingAtom } from "@/core/tabletNav";
import { useSetAtom } from "jotai";
import lyricManager, {
    useCurrentLyricItem,
    useLyricState,
} from "@/core/lyricManager";
import repeatModeConst from "@/constants/repeatModeConst";
import timeformat from "@/utils/timeformat";

/** 时段问候（对齐旧项目：播放页顶部仅问候，无时间；天气后续再做占位） */
function getGreeting(): string {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) {
        return "上午好";
    }
    if (h >= 12 && h < 18) {
        return "下午好";
    }
    return "晚上好";
}

/**
 * 平板左播放面板（30% 栏）- 对齐 APlayer TabletNowPlayingPanel：
 * 背景 surface；顶部问候 + Logo；中部封面 200dp 圆角24 + 歌名 20sp + 歌手 15sp + 歌词弹性区（单击进全屏）；
 * 底部进度条 + 胶囊控制栏（surfaceVariant 底圆角28：循环20/上一首24/播放44圆/下一首24/队列20）
 */
export default function TabletPanel() {
    const colors = useColors();
    const musicItem = useCurrentMusic();
    const musicState = useMusicState();
    const progress = useProgress();
    const repeatMode = useRepeatMode();
    const setFullPlaying = useSetAtom(fullPlayingAtom);

    const isPaused = musicIsPaused(musicState);
    /* 歌词：当前播放行（无歌/无歌词时显示占位） */
    const { lyrics, loading } = useLyricState();
    const currentLrcItem = useCurrentLyricItem();
    const currentLrc = currentLrcItem?.lrc;
    /* 多行歌词：当前行上下各 4 行（弱化显示） */
    const curIndex = currentLrcItem?.index ?? -1;
    const sideCount = 4;
    const upLines: { text: string; key: string }[] = [];
    for (let i = sideCount; i >= 1; i--) {
        const idx = curIndex - i;
        upLines.push({
            key: `up-${i}`,
            text: idx >= 0 && idx < lyrics.length ? lyrics[idx].lrc : "",
        });
    }
    const downLines: { text: string; key: string }[] = [];
    for (let i = 1; i <= sideCount; i++) {
        const idx = curIndex + i;
        downLines.push({
            key: `down-${i}`,
            text: idx >= 0 && idx < lyrics.length ? lyrics[idx].lrc : "",
        });
    }

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor:
                        (colors as any).surface ?? colors.background,
                },
            ]}>
            {/* 顶部：品牌图标 + 时段问候（与内容区 4 tab 同层；问候水平居中） */}
            <View style={styles.header}>
                <FastImage
                    style={styles.logo}
                    source={ImgAsset.brandLogo}
                />
                <ThemeText
                    fontSize="title"
                    fontColor="textSecondary"
                    style={[styles.greeting, { fontSize: 32 }]}>
                    {getGreeting()}
                </ThemeText>
            </View>

            {/* 中部播放内容：始终渲染组件（无歌曲时占位封面 + "--"），单击进入全屏播放页 */}
            <Pressable
                style={styles.playContent}
                onPress={() => setFullPlaying(true)}>
                {musicItem ? (
                    <FastImage
                        style={styles.cover}
                        source={musicItem.artwork}
                        placeholderSource={ImgAsset.albumDefault}
                    />
                ) : (
                    /* 无歌曲占位封面（对齐 APlayer 空态：灰卡 + ♪） */
                    <View
                        style={[
                            styles.cover,
                            styles.emptyCover,
                            {
                                backgroundColor:
                                    colors.surfaceVariant ??
                                    colors.card,
                            },
                        ]}>
                        <ThemeText
                            fontSize="large"
                            fontColor="textSecondary"
                            opacity={0.3}>
                            ♪
                        </ThemeText>
                    </View>
                )}
                {/* 歌名 20sp Bold（无歌显示 "--"，对齐 APlayer） */}
                <ThemeText
                    fontWeight="bold"
                    numberOfLines={1}
                    style={styles.title}>
                    {musicItem?.title ?? "--"}
                </ThemeText>
                {/* 歌手 15sp */}
                <ThemeText
                    fontSize="body"
                    fontColor="textSecondary"
                    numberOfLines={1}>
                    {musicItem?.artist ?? "未知歌手"}
                </ThemeText>
                {/* 歌词弹性区：多行歌词居中显示（当前行放大与歌名同尺寸，上下行弱化） */}
                <View style={styles.lyricPlaceholder}>
                    {!musicItem ? null : loading && !lyrics.length ? (
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="textSecondary"
                            style={styles.lyricText}>
                            歌词加载中…
                        </ThemeText>
                    ) : currentLrc ? (
                        <>
                            {upLines.map(l => (
                                <ThemeText
                                    key={l.key}
                                    fontSize="body"
                                    fontColor="textSecondary"
                                    numberOfLines={1}
                                    style={styles.lyricSideText}>
                                    {l.text}
                                </ThemeText>
                            ))}
                            <ThemeText
                                fontWeight="bold"
                                numberOfLines={1}
                                style={styles.lyricCurrentText}>
                                {currentLrc}
                            </ThemeText>
                            {downLines.map(l => (
                                <ThemeText
                                    key={l.key}
                                    fontSize="body"
                                    fontColor="textSecondary"
                                    numberOfLines={1}
                                    style={styles.lyricSideText}>
                                    {l.text}
                                </ThemeText>
                            ))}
                        </>
                    ) : (
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="textSecondary"
                            style={styles.lyricText}>
                            暂无歌词
                        </ThemeText>
                    )}
                </View>
            </Pressable>

            {/* 底部：进度条 + 胶囊控制栏（无歌时禁用进度条、播放键显示 play） */}
            <View style={styles.bottom}>
                <View style={styles.progressRow}>
                    <Slider
                        style={styles.slider}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={
                            colors.surfaceVariant ??
                            "rgba(0,0,0,0.12)"
                        }
                        thumbTintColor={colors.primary}
                        minimumValue={0}
                        maximumValue={progress?.duration ?? 0}
                        value={progress?.position ?? 0}
                        disabled={!musicItem}
                        onSlidingComplete={val =>
                            TrackPlayer.seekTo(val)
                        }
                    />
                    <ThemeText
                        fontSize="caption"
                        fontColor="textSecondary"
                        style={styles.durationText}>
                        {timeformat(progress?.duration ?? 0)}
                    </ThemeText>
                </View>
                {/* 胶囊控制栏：循环/上一首/播放/下一首/队列 */}
                <View
                    style={[
                        styles.controlBar,
                        {
                            backgroundColor:
                                colors.surfaceVariant ??
                                colors.card,
                        },
                    ]}>
                    <Icon
                        name={repeatModeConst[repeatMode].icon}
                        size={20}
                        color={colors.primary}
                        onPress={() =>
                            TrackPlayer.toggleRepeatMode()
                        }
                    />
                    <Icon
                        name="skip-left"
                        size={24}
                        color={colors.text}
                        onPress={() => TrackPlayer.skipToPrevious()}
                    />
                    <Pressable
                        style={[
                            styles.playBtn,
                            { backgroundColor: colors.primary },
                        ]}
                        onPress={() => {
                            if (isPaused) {
                                TrackPlayer.play();
                            } else {
                                TrackPlayer.pause();
                            }
                        }}>
                        <Icon
                            name={
                                musicItem && !isPaused
                                    ? "pause"
                                    : "play"
                            }
                            size={26}
                            color="#FFFFFF"
                        />
                    </Pressable>
                    <Icon
                        name="skip-right"
                        size={24}
                        color={colors.text}
                        onPress={() => TrackPlayer.skipToNext()}
                    />
                    <Icon
                        name="playlist"
                        size={20}
                        color={colors.textSecondary}
                        onPress={() => showPanel("PlayList")}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20, // 对齐 APlayer padding(horizontal 20)
        paddingBottom: 16,
        alignItems: "stretch",
    },
    /* 顶部品牌行：与内容区 tab 栏同高同顶，字号 content 同层 */
    header: {
        width: "100%",
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        position: "relative",
    },
    logo: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
    },
    greeting: {
        // 问候水平居中（品牌图标留在左侧）
        position: "absolute",
        left: 0,
        right: 0,
        textAlign: "center",
    },
    playContent: {
        width: "100%",
        alignItems: "center",
        flex: 1,
    },
    cover: {
        width: 200, // 对齐 APlayer 封面 200dp
        height: 200,
        borderRadius: 24, // 对齐 APlayer 圆角 24dp
        marginBottom: 16,
    },
    title: {
        width: "100%",
        marginBottom: 4,
        textAlign: "center", // 歌名水平居中
        fontSize: 20, // 对齐 APlayer 歌名 20sp
    },
    lyricPlaceholder: {
        flex: 1,
        width: "100%",
        marginTop: 8,
        alignItems: "center",
        justifyContent: "center", // 歌词区占满歌手与底部控制之间，歌词垂直居中
    },
    lyricText: {
        textAlign: "center",
    },
    /* 当前演唱行：与歌名同尺寸（20sp Bold），突出显示 */
    lyricCurrentText: {
        fontSize: 20,
        textAlign: "center",
        marginVertical: 6,
    },
    /* 上下行歌词：小字弱化 */
    lyricSideText: {
        textAlign: "center",
        opacity: 0.7,
        marginVertical: 2,
    },
    bottom: {
        width: "100%",
        paddingVertical: 12,
    },
    progressRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    slider: {
        flex: 1,
        height: 28, // 对齐 APlayer Slider height 28dp
    },
    durationText: {
        marginLeft: 8,
    },
    controlBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-evenly",
        borderRadius: 28, // 对齐 APlayer 胶囊圆角 28dp
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 4,
    },
    playBtn: {
        width: 44, // 对齐 APlayer 播放钮 44dp
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyWrap: {
        flex: 1,
        alignItems: "center",
        paddingTop: 24,
    },
    emptyCover: {
        alignItems: "center",
        justifyContent: "center",
    },
});
