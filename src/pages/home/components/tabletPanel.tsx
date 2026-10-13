import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
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
import { IParsedLrcItem } from "@/utils/lrcParser";
import repeatModeConst from "@/constants/repeatModeConst";
import timeformat from "@/utils/timeformat";
import KaraokeText from "@/components/base/karaokeText";
import {
    TP_ARTIST_H,
    TP_BOTTOM_H,
    TP_COVER_MAX,
    TP_COVER_MB,
    TP_COVER_MIN,
    TP_COVER_RADIUS,
    TP_HEADER_H,
    TP_HEADER_MB,
    TP_LYRIC_MARGIN_TOP,
    TP_LYRIC_MAX_ROWS,
    TP_LYRIC_ROW_H,
    TP_PAD_H,
    TP_TITLE_H,
    TP_TITLE_MB,
    calcLyricRows,
} from "./tabletPanelBudget";

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
    const curIndex = currentLrcItem?.index ?? -1;

    /* 面板实际尺寸（onLayout 实测，驱动封面弹性计算） */
    const [panelSize, setPanelSize] = useState<{
        w: number;
        h: number;
    }>({ w: 0, h: 0 });

    /* 封面弹性尺寸（方案 B）：歌词区先按固定行高×自适应行数(3~7)预算，
       剩余高度给封面——大屏稳定 7 行歌词，边界小屏自动减行不溢出 */
    const coverSize = useMemo(() => {
        const { w, h } = panelSize;
        if (w <= 0 || h <= 0) {
            return TP_COVER_MAX;
        }
        const panelInnerW = w - TP_PAD_H * 2;
        const playContentH = h - TP_HEADER_H - TP_HEADER_MB - TP_BOTTOM_H;
        const lyricRows = calcLyricRows(playContentH);
        const lyricAreaH = lyricRows * TP_LYRIC_ROW_H;
        const coverBudget =
            playContentH -
            TP_TITLE_H -
            TP_TITLE_MB -
            TP_ARTIST_H -
            lyricAreaH -
            TP_COVER_MB -
            TP_LYRIC_MARGIN_TOP;
        return Math.max(
            TP_COVER_MIN,
            Math.min(panelInnerW, coverBudget, TP_COVER_MAX),
        );
    }, [panelSize]);

    /* 歌词滚动（对齐全屏播放页）：当前行始终垂直居中，随播放平滑滚动 */
    const lyricListRef = useRef<FlatList<IParsedLrcItem> | null>(null);
    const [lyricAreaH, setLyricAreaH] = useState<number>();
    const lyricItemH = TP_LYRIC_ROW_H;
    const lyricBlankH = useMemo(
        () =>
            lyricAreaH
                ? Math.max((lyricAreaH - lyricItemH) / 2, 0)
                : 0,
        [lyricAreaH],
    );
    useEffect(() => {
        const idx = curIndex;
        const len = lyrics.length;
        if (idx < 0 || len === 0) {
            return;
        }
        lyricListRef.current?.scrollToIndex({
            index: Math.min(idx, len - 1),
            viewPosition: 0.5,
            animated: true,
        });
    }, [curIndex, lyrics.length]);

    return (
        <View
            style={[
                styles.container,
                {
                    // 背景透明：透出全局 PageBackground（白天 A+B 渐变 / 深色纯色），
                    // 与内容区整屏统一；不再用 surface 不透明底色盖住渐变
                    backgroundColor: "transparent",
                },
            ]}
            onLayout={e => {
                const { width, height } = e.nativeEvent.layout;
                if (
                    width > 0 &&
                    height > 0 &&
                    (width !== panelSize.w || height !== panelSize.h)
                ) {
                    setPanelSize({ w: width, h: height });
                }
            }}>
            {/* 顶部：品牌图标 + 时段问候（与内容区 4 tab 同层；问候水平居中） */}
            <View style={styles.header}>
                <FastImage
                    style={styles.logo}
                    source={ImgAsset.brandLogo}
                />
                <ThemeText
                    fontSize="xlarge"
                    fontColor="textSecondary"
                    style={styles.greeting}>
                    {getGreeting()}
                </ThemeText>
            </View>

            {/* 中部播放内容：始终渲染组件（无歌曲时占位封面 + "--"），单击进入全屏播放页 */}
            <Pressable
                style={styles.playContent}
                onPress={() => setFullPlaying(true)}>
                {musicItem ? (
                    <FastImage
                        style={[
                            styles.cover,
                            {
                                width: coverSize,
                                height: coverSize,
                            },
                        ]}
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
                                width: coverSize,
                                height: coverSize,
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
                {/* 歌名 20sp Bold（无歌显示 "--"，对齐 APlayer）；行高固定使高度预算精确 */}
                <ThemeText
                    fontWeight="bold"
                    numberOfLines={1}
                    style={[
                        styles.title,
                        { lineHeight: TP_TITLE_H },
                    ]}>
                    {musicItem?.title ?? "--"}
                </ThemeText>
                {/* 歌手 15sp，行高固定 */}
                <ThemeText
                    fontSize="body"
                    fontColor="textSecondary"
                    numberOfLines={1}
                    style={{ lineHeight: TP_ARTIST_H }}>
                    {musicItem?.artist ?? "未知歌手"}
                </ThemeText>
                {/* 歌词弹性区：FlatList 滚动（对齐全屏播放页）——当前行始终居中，随播放平滑滚动 */}
                <View
                    style={styles.lyricPlaceholder}
                    onLayout={e =>
                        setLyricAreaH(e.nativeEvent.layout.height)
                    }>
                    {!musicItem ? null : loading && !lyrics.length ? (
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="textSecondary"
                            style={styles.lyricText}>
                            歌词加载中…
                        </ThemeText>
                    ) : lyrics.length ? (
                        <FlatList
                            ref={lyricListRef}
                            data={lyrics}
                            keyExtractor={(_, i) => `tp-${i}`}
                            showsVerticalScrollIndicator={false}
                            overScrollMode="never"
                            initialNumToRender={30}
                            /* 边缘渐隐（对齐全屏播放页 fadingEdgeLength） */
                            fadingEdgeLength={120}
                            style={styles.lyricList}
                            onScrollToIndexFailed={({ index }) => {
                                setTimeout(() => {
                                    lyricListRef.current?.scrollToIndex({
                                        index: Math.min(
                                            index,
                                            lyrics.length - 1,
                                        ),
                                        viewPosition: 0.5,
                                        animated: true,
                                    });
                                }, 120);
                            }}
                            ListHeaderComponent={
                                <View style={{ height: lyricBlankH }} />
                            }
                            ListFooterComponent={
                                <View style={{ height: lyricBlankH }} />
                            }
                            renderItem={({ item, index }) => (
                                <View
                                    style={[
                                        styles.lyricRow,
                                        { height: lyricItemH },
                                    ]}>
                                    {index === curIndex ? (
                                        /* 当前行整体主题色（uniform：不做进度染色） */
                                        <KaraokeText
                                            text={item.lrc ?? ""}
                                            startTime={item.time}
                                            endTime={
                                                index + 1 < lyrics.length
                                                    ? lyrics[index + 1].time
                                                    : item.time + 15000
                                            }
                                            uniform
                                            sungColor={colors.primary}
                                            unsungColor={
                                                colors.textSecondary ??
                                                colors.text
                                            }
                                            fontSize={20}
                                            lineHeight={lyricItemH}
                                        />
                                    ) : (
                                        <ThemeText
                                            fontSize="body"
                                            fontColor="textSecondary"
                                            numberOfLines={1}
                                            style={[
                                                styles.lyricSideText,
                                                { lineHeight: lyricItemH },
                                            ]}>
                                            {item.lrc}
                                        </ThemeText>
                                    )}
                                </View>
                            )}
                        />
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
        height: TP_HEADER_H,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: TP_HEADER_MB,
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
        // 宽高由 coverSize 动态提供（高屏 200dp / 矮屏按预算缩小）
        borderRadius: TP_COVER_RADIUS, // 对齐 APlayer 圆角 24dp
        marginBottom: TP_COVER_MB,
    },
    title: {
        width: "100%",
        marginBottom: TP_TITLE_MB,
        textAlign: "center", // 歌名水平居中
        fontSize: 20, // 对齐 APlayer 歌名 20sp
    },
    lyricPlaceholder: {
        flex: 1,
        width: "100%",
        marginTop: TP_LYRIC_MARGIN_TOP,
        alignItems: "center",
        justifyContent: "center", // 歌词区占满歌手与底部控制之间，歌词垂直居中
    },
    lyricText: {
        textAlign: "center",
    },
    /* FlatList 歌词流：占满弹性歌词区，滚动时当前行垂直居中 */
    lyricList: {
        flex: 1,
        width: "100%",
    },
    /* 歌词行容器：固定行高 + 垂直居中 */
    lyricRow: {
        alignItems: "center",
        justifyContent: "center",
    },
    /* 上下行歌词：小字弱化（行高由 lineHeight 控制） */
    lyricSideText: {
        textAlign: "center",
        opacity: 0.7,
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
