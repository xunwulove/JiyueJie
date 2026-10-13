import React, { useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import { isSameMediaItem } from "@/utils/mediaUtils";
import IconButton from "@/components/base/iconButton";
import IconTextButton from "@/components/base/iconTextButton";
import Divider from "@/components/base/divider";
import Loading from "@/components/base/loading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useColors from "@/hooks/useColors";
import TrackPlayer, { useCurrentMusic, usePlayList, useRepeatMode } from "@/core/trackPlayer";
import repeatModeConst from "@/constants/repeatModeConst";
import { FlashList } from "@shopify/flash-list";
import { useI18N } from "@/core/i18n";

// 对齐媒体行规范：行高 64dp（固定值，跨设备一致），左右 padding 16dp
const ITEM_HEIGHT = 64;

interface IPlayListProps {
    item: IMusic.IMusicItem;
    index: number;
    isCurrentMusic: boolean;
}

/**
 * 播放队列行 - 对齐 APlayer QueueSongItem：
 * padding 10/8；序号 14sp（当前 primary Bold / 否则 textSecondary）宽 28；
 * 歌名 15sp（当前 primary Bold / 否则 Medium）+ 歌手 12sp；当前曲右侧"播放中" 11sp primary；
 * 保留 fork x-mark 删除按钮（旧项目无删除，差异记录）
 */
function _PlayListItem(props: IPlayListProps) {
    const colors = useColors();
    const { item, index, isCurrentMusic } = props;

    return (
        <Pressable
            onPress={() => {
                TrackPlayer.play(item);
            }}
            style={({ pressed }) => [
                style.musicItem,
                pressed
                    ? { backgroundColor: colors.background }
                    : null,
            ]}>
            <ThemeText
                fontSize="subTitle"
                fontColor={
                    isCurrentMusic ? "primary" : "textSecondary"
                }
                fontWeight={
                    isCurrentMusic ? "bold" : "regular"
                }
                style={style.index}>
                {index + 1}
            </ThemeText>
            <View style={style.info}>
                <ThemeText
                    fontSize="content"
                    fontWeight={
                        isCurrentMusic ? "bold" : "medium"
                    }
                    fontColor={isCurrentMusic ? "primary" : "text"}
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
            {isCurrentMusic ? (
                <ThemeText
                    fontSize="caption"
                    fontColor="primary"
                    style={style.playing}>
                    播放中
                </ThemeText>
            ) : null}
            <IconButton
                style={{ marginLeft: 8 }}
                name="x-mark"
                sizeType="small"
                onPress={() => {
                    TrackPlayer.remove(item);
                }}
            />
        </Pressable>
    );
}

const PlayListItem = React.memo(
    _PlayListItem,
    (prev, next) =>
        !!isSameMediaItem(prev.item, next.item) &&
        prev.isCurrentMusic === next.isCurrentMusic,
);

interface IBodyProps {
    loading?: boolean;
}
export default function Body(props: IBodyProps) {
    const { loading } = props;
    const playList = usePlayList();
    const currentMusicItem = useCurrentMusic();
    const repeatMode = useRepeatMode();
    const { t } = useI18N();
    const listRef = useRef<FlashList<IMusic.IMusicItem> | null>();
    const safeAreaInsets = useSafeAreaInsets();

    const initIndex = useMemo(() => {
        const id = playList.findIndex(_ =>
            isSameMediaItem(currentMusicItem, _),
        );

        if (id !== -1) {
            return id;
        }
        return undefined;
    }, []);

    const renderItem = ({ item, index }: { item: IMusic.IMusicItem; index: number }) => {
        return (
            <PlayListItem
                item={item}
                index={index}
                isCurrentMusic={!!isSameMediaItem(item, currentMusicItem)}
            />
        );
    };

    return loading ? (
        <Loading />
    ) : (
        <View
            style={[
                style.playList,
                {
                    paddingBottom: safeAreaInsets.bottom,
                },
            ]}>
            <FlashList
                ref={_ => {
                    listRef.current = _;
                }}
                extraData={{ currentMusicItem }}
                estimatedItemSize={ITEM_HEIGHT}
                data={playList}
                initialScrollIndex={initIndex}
                renderItem={renderItem}
            />
            <Divider />
            <View style={style.toolbar}>
                <IconTextButton
                    onPress={() => {
                        TrackPlayer.toggleRepeatMode();
                    }}
                    icon={repeatModeConst[repeatMode].icon}>
                    {t(("repeatMode." + repeatMode) as any)}
                </IconTextButton>
                <IconTextButton
                    icon="trash-outline"
                    onPress={() => {
                        TrackPlayer.clearPlayList();
                    }}>
                    {t("common.clear")}
                </IconTextButton>
            </View>
        </View>
    );
}

const style = StyleSheet.create({
    playList: {
        width: rpx(750),
        flex: 1,
    },
    /** 底部工具条：承接原 header 的循环模式/清空按钮（header 已统一为 PanelHeader） */
    toolbar: {
        height: 56,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    musicItem: {
        width: "100%",
        minHeight: ITEM_HEIGHT,
        paddingHorizontal: 16, // 对齐 16dp（固定值）
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 0,
    },
    index: {
        width: 28, // 对齐 28dp（固定值）
        textAlign: "center",
    },
    info: {
        flex: 1,
    },
    playing: {
        marginLeft: 8,
    },
});
