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

    // 2026-10-27 源能力约束：搜索结果携带 qualities 时（源声明各音质 url/大小），
    // **只显示实际可下载的音质**（未声明的档位直接不渲染，避免"选高品质→源没有→静默下标准档"的困惑）；
    // 接口歌曲/未知音质信息（qualities 缺失）显示全部档，靠下载侧 qualityOrder 兜底降级。
    const declaredQualities: IMusic.IQualityKey[] | null =
        musicItem.qualities &&
        Object.keys(musicItem.qualities).length > 0
            ? qualityKeys.filter(
                key =>
                    musicItem.qualities?.[key]?.url ||
                    musicItem.qualities?.[key]?.size,
            )
            : null;
    // 实际展示的档位：源声明了音质表 → 只显示声明的档；否则全部档
    const visibleQualities: IMusic.IQualityKey[] =
        declaredQualities !== null ? declaredQualities : qualityKeys;

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
                {visibleQualities.map((key, i) => {
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
                                                isCurrent
                                                    ? "primary"
                                                    : "text"
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
                            {i < visibleQualities.length - 1 ? (
                                <ListDivider marginLeft={16} />
                            ) : null}
                        </View>
                    );
                })}
            </Dialog.Content>
        </Dialog>
    );
}
