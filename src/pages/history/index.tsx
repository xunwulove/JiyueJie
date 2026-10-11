import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import StatusBar from "@/components/base/statusBar";
import musicHistory, { useMusicHistory } from "@/core/musicHistory";
import MusicBar from "@/components/musicBar";
import AppBar from "@/components/base/appBar";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import Color from "color";
import { FlashList } from "@shopify/flash-list";

/**
 * 最近播放 - 对齐 APlayer RecentPlayPage（标题按用户要求统一 18sp Bold）：
 * 顶栏 56dp：返回 + 标题 18sp Bold + 有记录时右侧清空按钮（直接按钮，非三点菜单）
 * 空态：64dp 图标 α0.3 + "暂无播放记录" 14sp
 * 列表：contentPadding 16/8、行距 2；自绘行 = 44dp 圆角8 surfaceVariant 字符块（首字符 18sp primary）
 *      + 歌名 15sp Medium + 歌手 12sp，点击整行播放（无序号/无封面图/无更多按钮）
 */
export default function History() {
    const musicHistoryList = useMusicHistory();

    const colors = useColors();

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar
                actions={
                    musicHistoryList.length
                        ? [
                              {
                                  icon: "trash-outline",
                                  onPress() {
                                      musicHistory.clearMusic();
                                  },
                              },
                          ]
                        : []
                }>
                <ThemeText
                    fontSize="title"
                    fontWeight="bold"
                    numberOfLines={1}>
                    最近播放
                </ThemeText>
            </AppBar>
            {musicHistoryList.length ? (
                <FlashList
                    data={musicHistoryList}
                    estimatedItemSize={64}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => (
                        <View style={styles.separator} />
                    )}
                    renderItem={({ item }) => (
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
                                    musicHistoryList,
                                )
                            }>
                            <View
                                style={[
                                    styles.charBlock,
                                    {
                                        backgroundColor:
                                            colors.surfaceVariant ??
                                            colors.card,
                                    },
                                ]}>
                                <ThemeText
                                    fontSize="title"
                                    fontColor="primary">
                                    {(item.title ?? "♪").charAt(0)}
                                </ThemeText>
                            </View>
                            <View style={styles.textWrap}>
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
                        </Pressable>
                    )}
                />
            ) : (
                <View style={styles.empty}>
                    <Icon
                        name="clock-outline"
                        size={64}
                        color={Color(colors.textSecondary)
                            .alpha(0.3)
                            .toString()}
                    />
                    <ThemeText
                        fontSize="subTitle"
                        fontColor="textSecondary"
                        style={styles.emptyText}>
                        暂无播放记录
                    </ThemeText>
                </View>
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
    separator: {
        height: 2,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
    },
    charBlock: {
        width: 48,
        height: 48,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    textWrap: {
        flex: 1,
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
