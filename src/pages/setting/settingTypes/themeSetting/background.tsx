import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Config, { useAppConfig } from "@/core/appConfig";
import ThemeCard from "./themeCard";
import Theme from "@/core/theme";
import { useI18N } from "@/core/i18n";

interface IBackgroundProps {
    /** 点"自定义背景"卡片：展开/收起自定义背景面板（浅色/深色/自定义背景三卡并列） */
    onCustomPress?: () => void;
    customOpen?: boolean;
    /** 未设置背景时点卡片：直接打开选图器（方案1：无背景 → 先选图，选完自动展开面板） */
    onDirectPick?: () => void;
}

export default function Background(props: IBackgroundProps) {
    const { t } = useI18N();
    const { onCustomPress, customOpen, onDirectPick } = props;

    // 未显式设置过主题（冷启动默认浅色）时 selectedTheme 为 undefined，按默认浅色处理 → 浅色卡选中
    const themeSelectedTheme =
        useAppConfig("theme.selectedTheme") ?? "p-light";
    const background = Theme.useBackground();

    return (
        <View>
            <ThemeText
                fontSize="subTitle"
                fontWeight="bold"
                fontColor="primary"
                style={style.header}>
                {t("themeSettings.setTheme")}
            </ThemeText>
            <View style={style.sectionWrapper}>
                <ThemeCard
                    preview="#fff"
                    title={t("themeSettings.lightMode")}
                    selected={themeSelectedTheme === "p-light"}
                    onPress={() => {
                        if (themeSelectedTheme !== "p-light") {
                            Theme.setTheme("p-light");
                            Config.setConfig("theme.followSystem", false);
                        }
                    }}
                />
                <ThemeCard
                    preview="#131313"
                    title={t("themeSettings.darkMode")}
                    selected={themeSelectedTheme === "p-dark"}
                    onPress={() => {
                        if (themeSelectedTheme !== "p-dark") {
                            Theme.setTheme("p-dark");
                            Config.setConfig("theme.followSystem", false);
                        }
                    }}
                />
                {/* 自定义背景与浅色/深色并列：预览当前背景图（未设置显示占位灰），选中态=已设背景。
                    未设背景时点卡片直接选图（onDirectPick）；已设背景时点卡片展开/收起面板 */}
                <ThemeCard
                    preview={background?.url ?? "#E2E8F0"}
                    title={t("themeSettings.customMode")}
                    selected={!!background?.url}
                    onPress={
                        background?.url ? onCustomPress : onDirectPick
                    }
                />
            </View>
            {/* 展开提示（收起态时引导点击展开） */}
            {customOpen ? null : (
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    style={style.expandHint}>
                    {background?.url
                        ? t("themeSettings.customBgOpenHint")
                        : t("themeSettings.customBgNotSetHint")}
                </ThemeText>
            )}
        </View>
    );
}

const style = StyleSheet.create({
    header: {
        marginTop: rpx(36),
        paddingLeft: rpx(24),
    },
    sectionWrapper: {
        marginTop: rpx(28),
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: rpx(24),
    },
    expandHint: {
        marginTop: rpx(8),
        paddingHorizontal: rpx(24),
    },
});
