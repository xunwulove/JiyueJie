import ListItem from "@/components/base/listItem";
import { ListDivider } from "@/components/base/divider";
import ThemeText from "@/components/base/themeText";
import ThemeSwitch from "@/components/base/switch";
import { useI18N } from "@/core/i18n";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { hideDialog, showDialog } from "../useDialog";
import { showPanel } from "@/components/panels/usePanel";
import Dialog from "./base";
import PersistStatus from "@/utils/persistStatus";
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
    // 歌词翻译开关（原全屏页三点菜单移入此处；默认开启，仅歌词源带翻译时生效）
    const showTranslation = PersistStatus.useValue(
        "lyric.showTranslation",
        true,
    );
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
        enableAutoSearchLyric ?? true,
    );
    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>
                {t("basicSettings.lyric")}
            </Dialog.Title>
            <Dialog.Content needScroll style={styles.content}>
                {/* 歌词偏移：行内步进，不跳三级页面；状态文字显示在行右端 */}
                <View style={styles.offsetRow}>
                    <ThemeText
                        fontSize="content"
                        fontWeight="medium"
                        numberOfLines={1}>
                        歌词偏移
                    </ThemeText>
                    <View style={styles.offsetSpacer} />
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        numberOfLines={1}>
                        {offsetStatus}
                    </ThemeText>
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
                <ListDivider marginLeft={16} />
                {/* 歌词翻译：开关（PersistStatus），仅歌词源带翻译时显示翻译行 */}
                <ListItem
                    withHorizontalPadding
                    heightType="small"
                    onPress={() => {
                        PersistStatus.set(
                            "lyric.showTranslation",
                            !showTranslation,
                        );
                    }}>
                    <ListItem.Content title="歌词翻译" />
                    <ThemeSwitch
                        value={showTranslation ?? true}
                        onValueChange={v => {
                            PersistStatus.set("lyric.showTranslation", v);
                        }}
                    />
                </ListItem>
                <ListDivider marginLeft={16} />
                {/* 更换歌词：复用现有关联歌词面板（搜索候选歌词 / 输入关联），
                    选择后 lyricManager.associateLyric 会清旧缓存并刷新显示 */}
                <ListItem
                    withHorizontalPadding
                    heightType="small"
                    onPress={() => {
                        hideDialog();
                        // hideDialog/showPanel 同写面板状态，延迟一拍避免时序竞态
                        setTimeout(() => {
                            if (associateLyricType === "input") {
                                showPanel("AssociateLrc", { musicItem });
                            } else {
                                showPanel("SearchLrc", { musicItem });
                            }
                        }, 0);
                    }}>
                    <ListItem.Content title="更换歌词" />
                </ListItem>
                <ListDivider marginLeft={16} />
                {/* 字体大小（从全屏播放页三点菜单移入，歌词设置单一入口） */}
                <ListItem
                    withHorizontalPadding
                    heightType="small"
                    onPress={() => {
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
                    }}>
                    <ListItem.Content title={t("basicSettings.lyric.fontSize")} />
                </ListItem>
            </Dialog.Content>
        </Dialog>
    );
}
const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 0,
        paddingTop: 12, // 2026-10-21 统一：列表首项距标题分割线 12
        paddingBottom: 12, // 2026-10-21 统一：列表末项距底栏 12
    },
    /* 歌词偏移行：48dp 与列表行等高 */
    offsetRow: {
        height: 48,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    /* 标题与状态/按钮之间的弹性空间（状态显示在行右端） */
    offsetSpacer: {
        flex: 1,
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
