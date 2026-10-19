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
import { iconSizeConst } from "@/constants/uiConst";
import mediaCache from "@/core/mediaCache";
import TrackPlayer from "@/core/trackPlayer";
import { IIconName } from "@/components/base/icon.tsx";
import { hideDialog, showDialog } from "@/components/dialogs/useDialog";
import LocalMusicSheet from "@/core/localMusicSheet";
import PersistStatus from "@/utils/persistStatus";
import Divider from "@/components/base/divider";
import { FlatList } from "react-native-gesture-handler";
import { useI18N } from "@/core/i18n";
import Dialog from "./base";

interface IMusicItemLyricOptionsDialogProps {
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
}

// 行高用 ListItem 紧凑档位 smallest(36)（规范：big64/normal56/small48/smallest36），
// 与下方 ListItem heightType="smallest" 保持一致，缩短弹窗总高
const ITEM_HEIGHT = 36;

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

    // 歌词翻译开关（原全屏页翻译按钮移入此处；默认开启）
    const showTranslation = PersistStatus.useValue(
        "lyric.showTranslation",
        true,
    );

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
        {
            icon: "translation",
            title: t("panel.musicItemLyricOptions.showTranslation", {
                status: t(
                    showTranslation
                        ? "panel.musicItemLyricOptions.showTranslationOn"
                        : "panel.musicItemLyricOptions.showTranslationOff",
                ),
            }),
            onPress: () => {
                PersistStatus.set(
                    "lyric.showTranslation",
                    !showTranslation,
                );
                hideDialog();
            },
        },
        // 全屏功能区移入：字体大小（三级浮窗）
        {
            icon: "font-size",
            title: t("basicSettings.lyric.fontSize"),
            onPress: () => {
                hideDialog();
                setTimeout(() => {
                    showDialog("SetFontSizeDialog", {
                        defaultSelect:
                            PersistStatus.get("lyric.detailFontSize") ?? 1,
                        onSelectChange(value) {
                            PersistStatus.set("lyric.detailFontSize", value);
                        },
                    });
                }, 0);
            },
        },
        // 歌词设置（三级浮窗）：歌词偏移 + 关联方式 + 自动搜索歌词（悬浮歌词设置已移回设置页）
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
                            fontSize="description"
                            numberOfLines={2}>
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
                                heightType="smallest"
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
