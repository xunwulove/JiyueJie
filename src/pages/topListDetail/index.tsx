import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import AppBar from "@/components/base/appBar";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import FastImage from "@/components/base/fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import useColors from "@/hooks/useColors";
import Color from "color";
import TrackPlayer from "@/core/trackPlayer";
import { useParams } from "@/core/router";
import useTopListDetail from "./hooks/useTopListDetail";
import { RequestStateCode } from "@/constants/commonConst";
import Loading from "@/components/base/loading";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import { ListDivider } from "@/components/base/divider";
import globalStyle from "@/constants/globalStyle";
import StatusBar from "@/components/base/statusBar";
import MusicBar from "@/components/musicBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";

/** 毫秒 → mm:ss（对齐 APlayer formatMs） */
function formatMs(ms: number | string | undefined): string {
    const totalSec = Math.floor(Number(ms ?? 0) / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * 排行详情（榜单歌曲列表）- 对齐 APlayer RankPage 的 RankSongRow：
 * 行 padding 16/8；序号 13sp textSecondary 宽 32；封面 48 圆角8（无封面 → surfaceVariant 底 + musical-note 18 α0.4）；
 * 歌名 15sp Medium；副行 12sp（歌手 · mm:ss，空值过滤）；ListDivider 缩进 92（序号32+封面48+间距12）；点击播放（整榜作队列）
 */
export default function TopListDetail() {
    const { pluginHash, topList } = useParams<"top-list-detail">();
    const [topListDetail, state, loadMore] = useTopListDetail(
        topList,
        pluginHash,
    );
    const colors = useColors();

    const musicList = topListDetail?.musicList ?? [];
    const title = topListDetail?.title ?? topList?.title ?? "排行榜";

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar>
                <ThemeText
                    fontSize="title"
                    fontWeight="bold"
                    numberOfLines={1}>
                    {title}
                </ThemeText>
            </AppBar>
            {state === RequestStateCode.PENDING_FIRST_PAGE ? (
                <Loading />
            ) : musicList.length === 0 ? (
                <View style={styles.empty}>
                    <Icon
                        name="music"
                        size={64}
                        color={Color(colors.textSecondary)
                            .alpha(0.3)
                            .toString()}
                    />
                    <ThemeText
                        fontSize="subTitle"
                        fontColor="textSecondary"
                        style={styles.emptyText}>
                        榜单加载失败或暂无歌曲
                    </ThemeText>
                </View>
            ) : (
                <HorizontalSafeAreaView style={globalStyle.flex1}>
                    <FlashList
                        data={musicList}
                        estimatedItemSize={64}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item, index }) => (
                            <View>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.row,
                                        pressed
                                            ? {
                                                backgroundColor:
                                                      Color(colors.primary)
                                                          .alpha(0.06)
                                                          .toString(),
                                            }
                                            : null,
                                    ]}
                                    onPress={() =>
                                        TrackPlayer.playWithReplacePlayList(
                                            item,
                                            musicList,
                                        )
                                    }>
                                    <ThemeText
                                        fontSize="normal"
                                        fontColor="textSecondary"
                                        style={styles.index}>
                                        {index + 1}
                                    </ThemeText>
                                    <View style={styles.coverWrap}>
                                        {item.artwork ? (
                                            <FastImage
                                                style={styles.cover}
                                                source={{ uri: item.artwork }}
                                                placeholderSource={
                                                    ImgAsset.albumDefault
                                                }
                                            />
                                        ) : (
                                            <Image
                                                source={ImgAsset.albumDefault}
                                                style={styles.cover}
                                                resizeMode="cover"
                                            />
                                        )}
                                    </View>
                                    <View style={styles.info}>
                                        <ThemeText
                                            fontSize="body"
                                            fontWeight="medium"
                                            numberOfLines={1}>
                                            {item.title ?? "未知歌曲"}
                                        </ThemeText>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="textSecondary"
                                            numberOfLines={1}>
                                            {[
                                                item.artist,
                                                item.duration
                                                    ? formatMs(item.duration)
                                                    : "",
                                            ]
                                                .filter(it => it?.trim())
                                                .join(" · ")}
                                        </ThemeText>
                                    </View>
                                </Pressable>
                                {/* marginLeft = 序号 32 + 封面 48 + 间距 12，与歌名文字左缘对齐 */}
                                <ListDivider marginLeft={92} />
                            </View>
                        )}
                        onEndReached={() => {
                            if (
                                state === RequestStateCode.PARTLY_DONE
                            ) {
                                loadMore();
                            }
                        }}
                        onEndReachedThreshold={0.3}
                    />
                </HorizontalSafeAreaView>
            )}
            <MusicBar />
        </VerticalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: 0,
    },
    index: {
        width: 32,
        textAlign: "center",
    },
    coverWrap: {
        width: 48,
        height: 48,
        borderRadius: 8,
        overflow: "hidden",
    },
    cover: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    info: {
        flex: 1,
        marginLeft: 12,
    },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        marginTop: 12,
    },
});
