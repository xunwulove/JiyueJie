import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import { useParams } from "@/core/router";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import { useSheetItem } from "@/core/musicSheet";
import useColors from "@/hooks/useColors";
import Color from "color";
import TrackPlayer from "@/core/trackPlayer";
import { showDialog } from "@/components/dialogs/useDialog";

/**
 * 歌单歌曲列表 - 对齐 APlayer PlaylistDetailPage：
 * 序号块行（48dp 圆角8 surfaceVariant 底、序号 14sp primary）+ 歌名 15sp Medium + 歌手 12sp；
 * 行高 64（序号块48 + paddingVertical8×2），与共享 MusicItem 的 64 行高/48dp 左槽视觉一致；
 * contentPadding 16/8、行距 2；点击播放（歌单作为播放队列）；空态 64dp 图标 + "歌单暂无歌曲" + 提示 12sp
 */
export default function SheetMusicList() {
    const { id = "favorite" } = useParams<"local-sheet-detail">();
    const musicSheet = useSheetItem(id);
    const colors = useColors();

    const musicList = musicSheet?.musicList ?? [];

    if (musicList.length === 0) {
        return (
            <View style={styles.empty}>
                <Icon
                    name="playlist"
                    size={64}
                    color={Color(colors.textSecondary).alpha(0.3).toString()}
                />
                <ThemeText
                    fontSize="subTitle"
                    fontColor="textSecondary"
                    style={styles.emptyText}>
                    歌单暂无歌曲
                </ThemeText>
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    opacity={0.7}
                    style={styles.emptyHint}>
                    在播放页点“收藏”可将歌曲加入我喜欢的音乐
                </ThemeText>
            </View>
        );
    }

    return (
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            <FlashList
                data={musicList}
                estimatedItemSize={64}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => (
                    <View style={styles.separator} />
                )}
                renderItem={({ item, index }) => (
                    <Pressable
                        style={({ pressed }) => [
                            styles.row,
                            pressed
                                ? {
                                    backgroundColor: Color(
                                        colors.primary,
                                    )
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
                        <View
                            style={[
                                styles.indexBlock,
                                {
                                    backgroundColor:
                                        colors.surfaceVariant ??
                                        colors.card,
                                },
                            ]}>
                            <ThemeText
                                fontSize="subTitle"
                                fontColor="primary">
                                {index + 1}
                            </ThemeText>
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
                                {item.artist ?? "未知歌手"}
                            </ThemeText>
                        </View>
                        {/* B6：歌单歌曲行补三点菜单（MusicItemOptions，传 musicSheet 以显示删除） */}
                        <Pressable
                            hitSlop={8}
                            style={styles.moreBtn}
                            onPress={() =>
                                showDialog("MusicItemOptionsDialog", {
                                    musicItem: item,
                                    musicSheet,
                                })
                            }>
                            <Icon
                                name="ellipsis-vertical"
                                size={24}
                                color={colors.textSecondary}
                            />
                        </Pressable>
                    </Pressable>
                )}
            />
        </HorizontalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    separator: {
        height: 2,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 0,
        borderRadius: 0,
    },
    indexBlock: {
        width: 48,
        height: 48,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    info: {
        flex: 1,
    },
    moreBtn: {
        paddingHorizontal: 8,
        paddingVertical: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        marginTop: 12,
    },
    emptyHint: {
        marginTop: 4,
    },
});
