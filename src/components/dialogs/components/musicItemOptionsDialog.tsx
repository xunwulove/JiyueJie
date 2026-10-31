import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import Clipboard from "@react-native-clipboard/clipboard";

import { getMediaUniqueKey } from "@/utils/mediaUtils";
import Toast from "@/utils/toast";
import LocalMusicSheet from "@/core/localMusicSheet";
import { localMusicSheetId, musicHistorySheetId } from "@/constants/commonConst";

import { hideDialog, showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { ListDivider } from "@/components/base/divider";
import { iconSizeConst } from "@/constants/uiConst";
import TrackPlayer from "@/core/trackPlayer";
import mediaCache from "@/core/mediaCache";
import { IIconName } from "@/components/base/icon.tsx";
import MusicSheet from "@/core/musicSheet";
import downloader from "@/core/downloader";
import Config from "@/core/appConfig";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import lyricManager from "@/core/lyricManager";
import { useI18N } from "@/core/i18n";
import musicHistory from "@/core/musicHistory";
import { FlatList } from "react-native-gesture-handler";
import useOrientation from "@/hooks/useOrientation";
import { vmin, vmax } from "@/utils/rpx";
import Dialog from "./base";

interface IMusicItemOptionsDialogProps {
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
    /** 歌曲所在歌单 */
    musicSheet?: IMusic.IMusicSheetItem;
}

const ITEM_HEIGHT = 48;

interface IOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
    show?: boolean;
}

/**
 * 歌曲选项 - 三级浮窗（Dialog 版，替代原底部面板 MusicItemOptions）：
 * 歌单歌曲列表三点菜单弹此浮窗。选项逻辑与面板版一致，
 * 载体改对话框体系（居中缩放 + 0901/0909 层级），规避底部面板在
 * 歌单/全屏等场景被 KeyboardAvoidingView/覆盖层压住的问题。
 */
export default function MusicItemOptionsDialog(
    props: IMusicItemOptionsDialogProps,
) {
    const { musicItem, musicSheet } = props ?? {};
    const { t } = useI18N();
    const orientation = useOrientation();

    const downloaded = LocalMusicSheet.isLocalMusic(musicItem);
    const associatedLrc = getMediaExtraProperty(musicItem, "associatedLrc");

    const options: IOption[] = [
        {
            icon: "id-card",
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
            title: t("panel.musicItemOptions.author", { artist: musicItem.artist }),
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
            icon: "album",
            show: !!musicItem.album,
            title: t("panel.musicItemOptions.album", { album: musicItem.album }),
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
            icon: "list-start",
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
        {
            icon: "download",
            title: t("common.download"),
            show: !downloaded,
            onPress: () => {
                hideDialog();
                // 音质选择弹窗：与当前弹窗同写 dialogInfoStore，延迟一拍避免时序竞态
                setTimeout(() => {
                    showDialog("MusicQualityDialog", {
                        musicItem,
                        type: "download",
                        async onQualityPress(quality) {
                            downloader.download(musicItem, quality);
                        },
                    });
                }, 0);
            },
        },
        {
            icon: "circle-check",
            title: t("panel.musicItemOptions.downloaded"),
            show: !!downloaded,
        },
        {
            icon: "trash-2",
            title: t("common.delete"),
            show: !!musicSheet,
            onPress: () => {
                hideDialog();
                // 删除前加确认浮窗（本地音乐库移除不删文件，仍确认防误触）
                setTimeout(() => {
                    showDialog("SimpleDialog", {
                        title: t("common.delete"),
                        content: t("panel.musicItemOptions.deleteConfirm", {
                            title: musicItem.title ?? "",
                        }),
                        onOk: async () => {
                            if (musicSheet?.id === localMusicSheetId) {
                                await LocalMusicSheet.removeMusic(musicItem);
                            } else if (
                                musicSheet?.id === musicHistorySheetId
                            ) {
                                await musicHistory.removeMusic(musicItem);
                            } else {
                                await MusicSheet.removeMusic(
                                    musicSheet!.id,
                                    musicItem,
                                );
                            }
                            Toast.success(t("toast.deleteSuccess"));
                        },
                    });
                }, 0);
            },
        },
        {
            icon: "trash-2",
            title: t("panel.musicItemOptions.deleteLocalDownload"),
            show: !!downloaded,
            onPress: () => {
                hideDialog();
                setTimeout(() => {
                    showDialog("SimpleDialog", {
                        title: t("panel.musicItemOptions.deleteLocalDownload"),
                        content: t("panel.musicItemOptions.deleteLocalDownloadConfirm"),
                        async onOk() {
                            try {
                                await LocalMusicSheet.removeMusic(musicItem, true);
                                Toast.success(t("toast.deleteSuccess"));
                            } catch (e: any) {
                                Toast.warn(`${t("panel.musicItemOptions.deleteFailed")} ${e?.message ?? e}`);
                            }
                        },
                    });
                }, 0);
            },
        },
        {
            icon: "link",
            title: associatedLrc
                ? t("panel.musicItemOptions.associatedLyric", { platform: associatedLrc.platform, id: associatedLrc.id })
                : t("panel.musicItemOptions.associateLyric"),
            onPress: () => {
                hideDialog();
                if (
                    Config.getConfig("basic.associateLyricType") === "input"
                ) {
                    showPanel("AssociateLrc", {
                        musicItem,
                    });
                } else {
                    showPanel("SearchLrc", {
                        musicItem,
                    });
                }
            },
        },
        {
            icon: "unlink",
            title: t("panel.musicItemOptions.unassociateLyric"),
            show: !!associatedLrc,
            onPress: async () => {
                lyricManager.unassociateLyric(musicItem);
                Toast.success(t("panel.musicItemOptions.unassociateLyricSuccess"));
                hideDialog();
            },
        },
        {
            icon: "archive-x",
            title: t("panel.musicItemOptions.clearPluginCache"),
            onPress: () => {
                mediaCache.removeMediaCache(musicItem);
                Toast.success(t("panel.musicItemOptions.cacheCleared"));
                hideDialog();
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
                    {musicItem?.title ?? "未知歌曲"}
                </ThemeText>
            </Dialog.Title>
            <FlatList
                // 过滤隐藏项（show:false）：否则 renderItem 返回 null 仍占 getItemLayout 固定行高，
                // 且 ItemSeparatorComponent 在不可见行之间照常画线 → 双线叠加/错位（实测"下载与关联歌词之间线变粗"）
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
