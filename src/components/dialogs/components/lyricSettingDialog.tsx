import ListItem from "@/components/base/listItem";
import { ListDivider } from "@/components/base/divider";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import {
    createRadio,
    createSwitch,
} from "@/pages/setting/settingTypes/basicSetting";
import { useAppConfig } from "@/core/appConfig";
import lyricManager from "@/core/lyricManager";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import useColors from "@/hooks/useColors";
import Color from "color";

interface IProps {
    /** 当前播放歌曲（歌词偏移按歌曲记录） */
    musicItem: IMusic.IMusicItem;
}

/**
 * 歌词设置三级浮窗（全屏播放页三点菜单"歌词设置"项，点菜单项时先关闭菜单）：
 * 歌词偏移（行内步进控件，不跳三级） + 关联方式 + 自动搜索歌词
 * （悬浮歌词设置已移回设置页独立分组"悬浮歌词"）
 */
export default function LyricSettingDialog(props: IProps) {
    const { musicItem } = props ?? {};
    const { t } = useI18N();
    const colors = useColors();

    const associateLyricType = useAppConfig("basic.associateLyricType");
    const enableAutoSearchLyric = useAppConfig("lyric.autoSearchLyric");

    /* 歌词偏移：行内 -0.2s / 重置 / +0.2s，点击立即写入并刷新歌词 */
    const [offset, setOffset] = useState(
        () => getMediaExtraProperty(musicItem, "lyricOffset") ?? 0,
    );
    const round1 = (n: number) => Math.round(n * 10) / 10;
    const applyOffset = (next: number) => {
        const v = round1(next);
        setOffset(v);
        lyricManager.updateLyricOffset(musicItem, v);
    };
    const offsetStatus =
        offset === 0
            ? "正常"
            : offset < 0
                ? `延迟 ${(-offset).toFixed(1)}s`
                : `提前 ${offset.toFixed(1)}s`;

    const associateRadio = createRadio(
        t("basicSettings.associateLyricType"),
        "basic.associateLyricType",
        ["input", "search"],
        associateLyricType ?? "search",
        {
            input: t("basicSettings.associateLyricType.input"),
            search: t("basicSettings.associateLyricType.search"),
        },
    );

    const autoSearchLyric = createSwitch(
        t("basicSettings.lyric.autoSearchLyric"),
        "lyric.autoSearchLyric",
        enableAutoSearchLyric ?? false,
    );

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title withDivider>
                {t("basicSettings.lyric")}
            </Dialog.Title>
            <Dialog.Content needScroll style={styles.content}>
                {/* 歌词偏移：行内步进，不跳三级页面 */}
                <View style={styles.offsetRow}>
                    <View style={styles.offsetInfo}>
                        <ThemeText
                            fontSize="content"
                            fontWeight="medium"
                            numberOfLines={1}>
                            歌词偏移
                        </ThemeText>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            numberOfLines={1}>
                            {offsetStatus}
                        </ThemeText>
                    </View>
                    <View style={styles.offsetBtns}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.offsetBtn,
                                {
                                    backgroundColor: Color(
                                        colors.primary,
                                    )
                                        .alpha(0.1)
                                        .toString(),
                                },
                                pressed
                                    ? { opacity: 0.6 }
                                    : null,
                            ]}
                            onPress={() => applyOffset(offset - 0.2)}>
                            <ThemeText
                                fontSize="description"
                                fontWeight="medium"
                                color={colors.primary}>
                                -0.2s
                            </ThemeText>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [
                                styles.offsetBtn,
                                {
                                    backgroundColor:
                                        colors.surfaceVariant ??
                                        colors.card,
                                },
                                pressed
                                    ? { opacity: 0.6 }
                                    : null,
                            ]}
                            onPress={() => applyOffset(0)}>
                            <ThemeText
                                fontSize="description"
                                fontWeight="medium"
                                fontColor="textSecondary">
                                重置
                            </ThemeText>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [
                                styles.offsetBtn,
                                {
                                    backgroundColor: Color(
                                        colors.primary,
                                    )
                                        .alpha(0.1)
                                        .toString(),
                                },
                                pressed
                                    ? { opacity: 0.6 }
                                    : null,
                            ]}
                            onPress={() => applyOffset(offset + 0.2)}>
                            <ThemeText
                                fontSize="description"
                                fontWeight="medium"
                                color={colors.primary}>
                                +0.2s
                            </ThemeText>
                        </Pressable>
                    </View>
                </View>
                <ListDivider marginLeft={16} />
                <ListItem
                    withHorizontalPadding
                    heightType="small"
                    onPress={associateRadio.onPress}>
                    <ListItem.Content title={associateRadio.title} />
                    {associateRadio.right}
                </ListItem>
                <ListDivider marginLeft={16} />
                <ListItem
                    withHorizontalPadding
                    heightType="small"
                    onPress={autoSearchLyric.onPress}>
                    <ListItem.Content title={autoSearchLyric.title} />
                    {autoSearchLyric.right}
                </ListItem>
            </Dialog.Content>
        </Dialog>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
    },
    /* 歌词偏移行：48dp 与列表行等高 */
    offsetRow: {
        height: 48,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    offsetInfo: {
        flex: 1,
        marginRight: 8,
    },
    offsetBtns: {
        flexDirection: "row",
        alignItems: "center",
    },
    offsetBtn: {
        height: 28,
        paddingHorizontal: 12,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
    },
});
