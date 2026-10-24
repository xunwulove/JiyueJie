import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AppBar from "@/components/base/appBar";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import { useParams } from "@/core/router";
import { useSheetItem } from "@/core/musicSheet";
import useColors from "@/hooks/useColors";
import TrackPlayer from "@/core/trackPlayer";
import { showDialog } from "@/components/dialogs/useDialog";
import {
    localMusicSheetId,
    musicHistorySheetId,
} from "@/constants/commonConst";

/**
 * 歌单详情顶栏 - 对齐 APlayer PlaylistDetailPage（标题按用户要求统一 18sp Bold）：
 * 返回 + 两行标题（歌单名 18sp Bold + "N 首歌曲" 12sp）+ 有歌时右侧播放全部（PlayArrow primary）
 * + 三点菜单（B9：编辑歌单详情入口 EditSheetDetailDialog）
 * 内置歌单（我的喜欢/本地歌曲/最近播放）为系统固定身份，不显示编辑菜单
 */
export default function () {
    const { id = "favorite" } = useParams<"local-sheet-detail">();
    const musicSheet = useSheetItem(id);
    const colors = useColors();

    const count = musicSheet?.musicList?.length ?? 0;
    // 内置歌单：禁止编辑歌单信息（改名/改封面）
    const isBuiltinSheet =
        id === "favorite" ||
        id === localMusicSheetId ||
        id === musicHistorySheetId;

    return (
        <AppBar
            actionComponent={
                <View style={styles.actions}>
                    {count > 0 ? (
                        <Pressable
                            hitSlop={8}
                            style={styles.iconBtn}
                            onPress={() =>
                                TrackPlayer.playWithReplacePlayList(
                                    musicSheet.musicList[0],
                                    musicSheet.musicList,
                                )
                            }>
                            <Icon
                                name="play"
                                size={24}
                                color={colors.primary}
                            />
                        </Pressable>
                    ) : null}
                    {!isBuiltinSheet ? (
                        <Pressable
                            hitSlop={8}
                            style={styles.iconBtn}
                            onPress={() =>
                                showDialog("EditSheetDetailDialog", {
                                    musicSheet,
                                })
                            }>
                            <Icon
                                name="ellipsis-vertical"
                                size={24}
                                color={colors.textSecondary}
                            />
                        </Pressable>
                    ) : null}
                </View>
            }>
            <View style={styles.titleWrap}>
                <ThemeText
                    fontSize="title"
                    fontWeight="bold"
                    numberOfLines={1}>
                    {musicSheet?.title ?? "歌单详情"}
                </ThemeText>
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    numberOfLines={1}>
                    {count} 首歌曲
                </ThemeText>
            </View>
        </AppBar>
    );
}

const styles = StyleSheet.create({
    titleWrap: {
        flex: 1,
        justifyContent: "center",
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconBtn: {
        paddingHorizontal: 8,
    },
});
