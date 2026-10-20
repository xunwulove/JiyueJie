import React from "react";
import { View } from "react-native";
import ThemeText from "@/components/base/themeText";
import { iconSizeConst } from "@/constants/uiConst";
import { qualityKeys, qualityText } from "@/utils/qualities";
import { sizeFormatter } from "@/utils/fileUtils";
import { useI18N } from "@/core/i18n";
import Config from "@/core/appConfig";
import useColors from "@/hooks/useColors";
import { useMusicQuality } from "@/core/trackPlayer";
import ListItem from "@/components/base/listItem";
import { ListDivider } from "@/components/base/divider";
import Dialog from "./base";
import { hideDialog } from "../useDialog";

interface IMusicQualityDialogProps {
    type?: "play" | "download";
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
    /** 点击回调 */
    onQualityPress: (
        quality: IMusic.IQualityKey,
        musicItem: IMusic.IMusicItem,
    ) => void;
}

/**
 * 音质选择 - 三级浮窗（Dialog 版，替代原底部面板 MusicQuality）：
 * 下载音质选择（歌单/全屏三点"下载"入口）。列表式选择，当前音质高亮
 * （play=当前播放音质，download=设置里默认下载音质 basic.defaultDownloadQuality）。
 */
export default function MusicQualityDialog(
    props: IMusicQualityDialogProps,
) {
    const { musicItem, onQualityPress, type = "play" } = props ?? {};
    const { t } = useI18N();
    const colors = useColors();
    // 当前音质：play=播放中的音质；download=下载设置默认音质
    const playingQuality = useMusicQuality();
    const currentQuality: IMusic.IQualityKey =
        type === "play"
            ? playingQuality
            : (Config.getConfig("basic.defaultDownloadQuality") ??
                "standard");

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title
                stringContent
                containerStyle={{ paddingHorizontal: 0 }}>
                {t("panel.musicQuality.title", {
                    type:
                        type === "play"
                            ? t("common.play")
                            : t("common.download"),
                })}
            </Dialog.Title>
            <Dialog.Content
                needScroll
                style={{ paddingHorizontal: 0, paddingTop: 12, paddingBottom: 12 }}>
                {qualityKeys.map((key, i) => {
                    const isCurrent = key === currentQuality;
                    return (
                        <View key={key}>
                            <ListItem
                                withHorizontalPadding
                                heightType="small"
                                onPress={() => {
                                    onQualityPress(key, musicItem);
                                    hideDialog();
                                }}>
                                <ListItem.Content
                                    title={
                                        <ThemeText
                                            fontColor={
                                                isCurrent ? "primary" : "text"
                                            }
                                            fontWeight={
                                                isCurrent ? "bold" : "regular"
                                            }
                                            numberOfLines={1}>
                                            {qualityText[key]}
                                            {musicItem.qualities?.[key]?.size
                                                ? ` (${sizeFormatter(
                                                    musicItem.qualities[key].size!,
                                                )})`
                                                : ""}
                                        </ThemeText>
                                    }
                                />
                                {isCurrent ? (
                                    <ListItem.ListItemIcon
                                        icon="check"
                                        iconSize={iconSizeConst.normal}
                                        color={colors.primary}
                                    />
                                ) : null}
                            </ListItem>
                            {/* 2026-10-21 统一：列表项之间加 ListDivider */}
                            {i < qualityKeys.length - 1 ? (
                                <ListDivider marginLeft={16} />
                            ) : null}
                        </View>
                    );
                })}
            </Dialog.Content>
        </Dialog>
    );
}
