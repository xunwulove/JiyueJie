import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import Clipboard from "@react-native-clipboard/clipboard";

import { getMediaUniqueKey } from "@/utils/mediaUtils";
import FastImage from "@/components/base/fastImage";
import Toast from "@/utils/toast";
import LocalMusicSheet from "@/core/localMusicSheet";
import { localMusicSheetId, musicHistorySheetId } from "@/constants/commonConst";

import { hideDialog, showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import Divider from "@/components/base/divider";
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
 * 载体改对话框体系（居中缩放 + 16300 层级），规避底部面板在
 * 歌单/全屏等场景被 KeyboardAvoidingView/覆盖层压住的问题。
 */
export default function MusicItemOptionsDialog(
    props: IMusicItemOptionsDialogProps,
) {
    const { musicItem, musicSheet } = props ?? {};
    const { t } = useI18N();

    const downloaded = LocalMusicSheet.isLocalMusic(musicItem);
    const associatedLrc = getMediaExtraProperty(musicItem, "associatedLrc");

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
            icon: "album-outline",
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
        {
            icon: "arrow-down-tray",
            title: t("common.download"),
            show: !downloaded,
            onPress: () => {
                hideDialog();
                // 音质选择仍为底部面板（不同 store，直接切换安全）
                showPanel("MusicQuality", {
                    musicItem,
                    type: "download",
                    async onQualityPress(quality) {
                        downloader.download(musicItem, quality);
                    },
                });
            },
        },
        {
            icon: "check-circle-outline",
            title: t("panel.musicItemOptions.downloaded"),
            show: !!downloaded,
        },
        {
            icon: "trash-outline",
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
            icon: "trash-outline",
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
            icon: "link-slash",
            title: t("panel.musicItemOptions.unassociateLyric"),
            show: !!associatedLrc,
            onPress: async () => {
                lyricManager.unassociateLyric(musicItem);
                Toast.success(t("panel.musicItemOptions.unassociateLyricSuccess"));
                hideDialog();
            },
        },
        {
            icon: "archive-box-x-mark",
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
            <Dialog.Content
                needScroll
                style={{ paddingHorizontal: 0, paddingTop: 12, paddingBottom: 0 }}>
                <View style={style.header}>
                    <FastImage
                        style={style.artwork}
                        source={musicItem?.artwork}
                        placeholderSource={ImgAsset.albumDefault}
                    />
                    <View style={style.content}>
                        <ThemeText numberOfLines={2} style={style.title}>
                            {musicItem?.title}
                        </ThemeText>
                        <ThemeText
                            fontColor="textSecondary"
                            numberOfLines={2}
                            fontSize="description">
                            {musicItem?.artist}{" "}
                            {musicItem?.album ? `- ${musicItem.album}` : ""}
                        </ThemeText>
                    </View>
                </View>
                <Divider />
                <FlatList
                    data={options}
                    getItemLayout={(_, index) => ({
                        length: ITEM_HEIGHT,
                        offset: ITEM_HEIGHT * index,
                        index,
                    })}
                    ListFooterComponent={<View style={style.footer} />}
                    style={style.listWrapper}
                    keyExtractor={_ => _.title}
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
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress() {
                            hideDialog();
                        },
                    },
                ]}
            />
        </Dialog>
    );
}

const style = StyleSheet.create({
    header: {
        width: "100%",
        height: 100,
        flexDirection: "row",
        paddingHorizontal: rpx(24),
    },
    listWrapper: {
        paddingTop: rpx(12),
        flexGrow: 0,
    },
    artwork: {
        width: 72,
        height: 72,
        borderRadius: 8,
    },
    content: {
        marginLeft: rpx(36),
        width: rpx(526),
        height: 72,
        justifyContent: "space-around",
    },
    title: {
        paddingRight: rpx(24),
    },
    footer: {
        width: "100%",
        height: rpx(30),
    },
});
