import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import Clipboard from "@react-native-clipboard/clipboard";

import { getMediaUniqueKey } from "@/utils/mediaUtils";
import Toast from "@/utils/toast";
import { iconSizeConst } from "@/constants/uiConst";
import mediaCache from "@/core/mediaCache";
import TrackPlayer from "@/core/trackPlayer";
import { IIconName } from "@/components/base/icon.tsx";
import { hideDialog, showDialog } from "@/components/dialogs/useDialog";
import LocalMusicSheet from "@/core/localMusicSheet";
import { ListDivider } from "@/components/base/divider";
import { FlatList } from "react-native-gesture-handler";
import { useI18N } from "@/core/i18n";
import useOrientation from "@/hooks/useOrientation";
import { vmin, vmax } from "@/utils/rpx";
import Dialog from "./base";

interface IMusicItemLyricOptionsDialogProps {
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
}

// 行高用 ListItem 常规档位 small(48)，与歌曲菜单（musicItemOptionsDialog）同构统一
const ITEM_HEIGHT = 48;

interface IOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
    show?: boolean;
}

/**
 * 全屏播放页歌曲选项 - 三级浮窗（Dialog 版，替代原底部面板 MusicItemLyricOptions）：
 * 全屏播放页顶部三点菜单弹此浮窗。选项逻辑与面板版一致，
 * 载体改对话框体系（居中缩放 + 0901/0909 层级），规避底部面板在全屏播放层被压住的问题。
 */
export default function MusicItemLyricOptionsDialog(
    props: IMusicItemLyricOptionsDialogProps,
) {
    const { musicItem } = props ?? {};
    const { t } = useI18N();
    const orientation = useOrientation();

    const options: IOption[] = [
        {
            icon: "identification",
            title: `ID: ${getMediaUniqueKey(musicItem)}`,
            onPress: () => {
                mediaCache.setMediaCache(musicItem);
                Clipboard.setString(
                    JSON.stringify(
                        {
                            platform: musicItem.platform,
                            id: musicItem.id,
                        },
                        null,
                        "",
                    ),
                );
                Toast.success(t("toast.copiedToClipboard"));
                hideDialog();
            },
        },
        {
            icon: "user",
            title: t("panel.musicItemLyricOptions.author", { artist: musicItem.artist }),
            onPress: () => {
                try {
                    Clipboard.setString(musicItem.artist.toString());
                    Toast.success(t("toast.copiedToClipboard"));
                } catch {
                    Toast.warn(t("toast.copiedToClipboardFailed"));
                }
                hideDialog();
            },
        },
        {
            icon: "album-outline",
            show: !!musicItem.album,
            title: t("panel.musicItemLyricOptions.album", { album: musicItem.album }),
            onPress: () => {
                try {
                    Clipboard.setString(musicItem.album.toString());
                    Toast.success(t("toast.copiedToClipboard"));
                } catch {
                    Toast.warn(t("toast.copiedToClipboardFailed"));
                }
                hideDialog();
            },
        },
        {
            icon: "motion-play",
            title: t("musicListEditor.addToNextPlay"),
            onPress: () => {
                TrackPlayer.addNext(musicItem);
                hideDialog();
            },
        },
        {
            icon: "folder-plus",
            title: t("musicListEditor.addToSheet"),
            onPress: () => {
                hideDialog();
                // hideDialog/showDialog 同写 dialogInfoStore 单值，延迟一拍避免时序竞态
                setTimeout(() => {
                    showDialog("AddToMusicSheetDialog", { musicItem });
                }, 0);
            },
        },
        // 歌词设置（三级浮窗）：歌词偏移 + 关联方式 + 自动搜索歌词 + 更换歌词 + 字体大小
        // （字体大小、歌词翻译已移入歌词设置，此处不再保留快捷入口，单一入口）
        {
            icon: "lyric",
            title: t("panel.musicItemLyricOptions.lyricSettings"),
            onPress: () => {
                hideDialog();
                setTimeout(() => {
                    showDialog("LyricSettingDialog", { musicItem });
                }, 0);
            },
        },
        // B6：全屏页歌曲菜单补删除（两项：从该播放列表移除 + 永久删除本地文件）
        {
            icon: "minus",
            title: t("panel.musicItemLyricOptions.removeFromPlaylist"),
            show: !!TrackPlayer.isInPlayList(musicItem),
            onPress: async () => {
                await TrackPlayer.remove(musicItem);
                Toast.success(t("panel.musicItemLyricOptions.removedFromPlaylist"));
                hideDialog();
            },
        },
        {
            icon: "trash-outline",
            title: t("panel.musicItemLyricOptions.permanentDelete"),
            show: !!LocalMusicSheet.isLocalMusic(musicItem),
            onPress: () => {
                hideDialog();
                setTimeout(() => {
                    showDialog("SimpleDialog", {
                        title: t("panel.musicItemLyricOptions.permanentDelete"),
                        content: t(
                            "panel.musicItemLyricOptions.permanentDeleteConfirm",
                            {
                                title:
                                    musicItem.title ??
                                    t("panel.musicItemLyricOptions.unknownSong"),
                            },
                        ),
                        okText: t("common.delete"),
                        onOk: async () => {
                            try {
                                await LocalMusicSheet.removeMusic(
                                    musicItem,
                                    true,
                                );
                                Toast.success(t("toast.deleteSuccess"));
                            } catch (e: any) {
                                Toast.warn(
                                    t("panel.musicItemLyricOptions.deleteFail", {
                                        reason: e?.message ?? e,
                                    }),
                                );
                            }
                        },
                    });
                }, 0);
            },
        },
    ];

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>
                <ThemeText
                    fontSize="title"
                    fontWeight="bold"
                    numberOfLines={1}>
                    {musicItem?.title ?? t("panel.musicItemLyricOptions.unknownSong")}
                </ThemeText>
            </Dialog.Title>
            <FlatList
                // 过滤隐藏项（show:false）：否则 renderItem 返回 null 仍占 getItemLayout 固定行高，
                // 且 ItemSeparatorComponent 在不可见行之间照常画线 → 双线叠加/错位
                data={options.filter(_ => _.show !== false)}
                getItemLayout={(_, index) => ({
                    length: ITEM_HEIGHT,
                    offset: ITEM_HEIGHT * index,
                    index,
                })}
                ListFooterComponent={<View style={style.footer} />}
                style={[
                    style.listWrapper,
                    {
                        // 2026-10-24 通用弹窗式：与 RadioDialog 一致，选项区限高自身滚动
                        maxHeight:
                            orientation === "horizontal"
                                ? vmin(60)
                                : vmax(60),
                    },
                ]}
                keyExtractor={_ => _.title}
                ItemSeparatorComponent={() => (
                    <ListDivider marginLeft={16} />
                )}
                renderItem={({ item }) =>
                    item.show !== false ? (
                        <ListItem
                            withHorizontalPadding
                            heightType="small"
                            onPress={item.onPress}>
                            <ListItem.ListItemIcon
                                width={28}
                                icon={item.icon}
                                iconSize={iconSizeConst.light}
                            />
                            <ListItem.Content title={item.title} />
                        </ListItem>
                    ) : null
                }
            />
        </Dialog>
    );
}

const style = StyleSheet.create({
    listWrapper: {
        paddingTop: rpx(12),
        flexGrow: 0,
    },
    footer: {
        width: "100%",
        height: rpx(12), // 2026-10-21 统一：列表末项距底栏 12（原 30）
    },
});
