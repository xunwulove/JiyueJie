import FastImage from "@/components/base/fastImage";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { getMediaUniqueKey } from "@/utils/mediaUtils";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import React from "react";
import { StyleSheet, View } from "react-native";

import Divider from "@/components/base/divider";
import { IIconName } from "@/components/base/icon.tsx";
import { hidePanel } from "@/components/panels/usePanel.ts";
import { iconSizeConst } from "@/constants/uiConst";
import mediaCache from "@/core/mediaCache";
import { FlatList } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PanelBase from "../base/panelBase";
import { useI18N } from "@/core/i18n";
import PersistStatus from "@/utils/persistStatus";
import TrackPlayer from "@/core/trackPlayer";
import { showDialog } from "@/components/dialogs/useDialog";
import LocalMusicSheet from "@/core/localMusicSheet";

interface IMusicItemLyricOptionsProps {
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
}

const ITEM_HEIGHT = 48;

interface IOption {
    icon: IIconName;
    title: string;
    onPress?: () => void;
    show?: boolean;
}

export default function MusicItemLyricOptions(
    props: IMusicItemLyricOptionsProps,
) {
    const { musicItem } = props ?? {};

    const safeAreaInsets = useSafeAreaInsets();
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
                    Toast.success(t("toast.copiedToClipboardFailed"));
                }
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
                    Toast.success(t("toast.copiedToClipboardFailed"));
                }
            },
        },
        {
            icon: "motion-play",
            title: "下一首播放",
            onPress: () => {
                TrackPlayer.addNext(musicItem);
                hidePanel();
            },
        },
        {
            icon: "folder-plus",
            title: "加入歌单",
            onPress: () => {
                showDialog("AddToMusicSheetDialog", { musicItem });
            },
        },
        {
            icon: "translation",
            title: `歌词翻译：${
                showTranslation ? "开启" : "关闭"
            }`,
            onPress: () => {
                PersistStatus.set(
                    "lyric.showTranslation",
                    !showTranslation,
                );
                hidePanel();
            },
        },
        // 全屏功能区移入：字体大小（三级浮窗）
        {
            icon: "font-size",
            title: "字体大小",
            onPress: () => {
                showDialog("SetFontSizeDialog", {
                    defaultSelect:
                        PersistStatus.get("lyric.detailFontSize") ?? 1,
                    onSelectChange(value) {
                        PersistStatus.set("lyric.detailFontSize", value);
                    },
                });
            },
        },
        // 歌词设置（三级浮窗）：歌词偏移 + 关联方式 + 自动搜索歌词（悬浮歌词设置已移回设置页）
        // 特殊处理：立即收起三点菜单（跳过动画，避免黑色遮罩残留叠在弹窗下层），
        // 菜单完全卸载后再弹歌词设置三级浮窗
        {
            icon: "lyric",
            title: "歌词设置",
            onPress: () => {
                hidePanel({
                    immediate: true,
                    callback: () =>
                        showDialog("LyricSettingDialog", { musicItem }),
                });
            },
        },
        // B6：全屏页歌曲菜单补删除（两项：从该播放列表移除 + 永久删除本地文件）
        {
            icon: "minus",
            title: "从该播放列表移除",
            show: !!TrackPlayer.isInPlayList(musicItem),
            onPress: async () => {
                await TrackPlayer.remove(musicItem);
                Toast.success("已从播放列表移除");
                hidePanel();
            },
        },
        {
            icon: "trash-outline",
            title: "永久删除",
            show: !!LocalMusicSheet.isLocalMusic(musicItem),
            onPress: () => {
                showDialog("SimpleDialog", {
                    title: "永久删除",
                    content: `确定从设备删除「${
                        musicItem.title ?? "未知歌曲"
                    }」？\n将从设备中删除文件，此操作不可恢复。`,
                    okText: "删除",
                    onOk: async () => {
                        try {
                            await LocalMusicSheet.removeMusic(
                                musicItem,
                                true,
                            );
                            Toast.success("删除成功");
                            hidePanel();
                        } catch (e: any) {
                            Toast.warn(
                                `删除失败 ${e?.message ?? e}`,
                            );
                        }
                    },
                });
            },
        },
    ];

    return (
        <PanelBase
            renderBody={() => (
                <>
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
                    <View style={style.wrapper}>
                        <FlatList
                            data={options}
                            getItemLayout={(_, index) => ({
                                length: ITEM_HEIGHT,
                                offset: ITEM_HEIGHT * index,
                                index,
                            })}
                            ListFooterComponent={<View style={style.footer} />}
                            style={[
                                style.listWrapper,
                                {
                                    marginBottom: safeAreaInsets.bottom,
                                },
                            ]}
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
                    </View>
                </>
            )}
        />
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: rpx(750),
        flex: 1,
    },
    header: {
        width: rpx(750),
        height: 100,
        flexDirection: "row",
        padding: rpx(24),
    },
    listWrapper: {
        paddingTop: rpx(12),
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
        width: rpx(750),
        height: rpx(30),
    },
});
