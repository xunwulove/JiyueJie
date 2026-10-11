import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Config, { useAppConfig } from "@/core/appConfig";
import ThemeCard from "./themeCard";
import Theme from "@/core/theme";
import { useI18N } from "@/core/i18n";

export default function Background() {
    const { t } = useI18N();

    const themeSelectedTheme = useAppConfig("theme.selectedTheme");

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
            </View>
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
});
