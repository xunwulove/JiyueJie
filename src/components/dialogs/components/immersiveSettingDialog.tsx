import ListItem from "@/components/base/listItem";
import { ListDivider } from "@/components/base/divider";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import {
    createRadio,
    createSwitch,
} from "@/pages/setting/settingTypes/basicSetting";
import { useAppConfig } from "@/core/appConfig";
/**
 * 沉浸歌词设置三级浮窗（全屏播放页标题行右端"衣服"主题图标入口）：
 * 沉浸歌词开关 + 自动进入时长（10/15/30 秒）+ 缓慢流动光效开关
 */
export default function ImmersiveSettingDialog() {
    const { t } = useI18N();
    const enable = useAppConfig("basic.immersiveEnable") ?? true;
    const delay = useAppConfig("basic.immersiveDelay") ?? 15;
    const effect = useAppConfig("basic.immersiveEffect") ?? true;
    const enableSwitch = createSwitch(
        t("immersive.enable"),
        "basic.immersiveEnable",
        enable,
    );
    const delayRadio = createRadio(
        t("immersive.delay"),
        "basic.immersiveDelay",
        [10, 15, 30],
        delay,
        {
            10: t("immersive.delay.10"),
            15: t("immersive.delay.15"),
            30: t("immersive.delay.30"),
        },
    );
    const effectSwitch = createSwitch(
        t("immersive.effect"),
        "basic.immersiveEffect",
        effect,
    );
    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>{t("immersive.title")}</Dialog.Title>
            <Dialog.Content needScroll style={styles.content}>
                <ListItem
                    withHorizontalPadding
                    heightType="small"
                    onPress={enableSwitch.onPress}>
                    <ListItem.Content title={enableSwitch.title} />
                    {enableSwitch.right}
                </ListItem>
                <ListDivider marginLeft={16} />
                <ListItem
                    withHorizontalPadding
                    heightType="small"
                    onPress={delayRadio.onPress}>
                    <ListItem.Content title={delayRadio.title} />
                    {delayRadio.right}
                </ListItem>
                <ListDivider marginLeft={16} />
                <ListItem
                    withHorizontalPadding
                    heightType="small"
                    onPress={effectSwitch.onPress}>
                    <ListItem.Content title={effectSwitch.title} />
                    {effectSwitch.right}
                </ListItem>
                {/* 样式说明（当前唯一样式，说明性文字） */}
                <View style={styles.styleRow}>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        numberOfLines={1}>
                        {t("immersive.style")}：{t("immersive.style.lyric")}
                    </ThemeText>
                </View>
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
    styleRow: {
        height: 44,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
    },
});
