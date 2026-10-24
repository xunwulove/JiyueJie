import React from "react";
import { Appearance, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import ListItem from "@/components/base/listItem";
import ThemeSwitch from "@/components/base/switch";
import Config, { useAppConfig } from "@/core/appConfig";
import Theme from "@/core/theme";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";

export default function Mode() {
    const { t } = useI18N();
    const colors = useColors();
    const mode = useAppConfig("theme.followSystem") ?? false;
    return (
        <View>
            <ThemeText
                fontSize="subTitle"
                fontWeight="bold"
                fontColor="primary"
                style={styles.header}>
                {t("themeSettings.displayStyle")}
            </ThemeText>
            {/* 卡片式分组（对齐设置页 basicSetting）：行收进圆角卡片 */}
            <View
                style={[
                    styles.sectionWrapper,
                    { backgroundColor: colors.card },
                ]}>
                <ListItem withHorizontalPadding heightType="small">
                    <ListItem.Content>
                        <View style={styles.itemRow}>
                            <ThemeText>{t("themeSettings.followSystemTheme")}</ThemeText>
                            <ThemeSwitch
                                value={mode}
                                onValueChange={e => {
                                    if (e) {
                                        const colorScheme =
                                            Appearance.getColorScheme();
                                        if (colorScheme === "dark") {
                                            Theme.setTheme("p-dark");
                                        } else if (colorScheme === "light") {
                                            Theme.setTheme("p-light");
                                        }
                                    }
                                    Config.setConfig("theme.followSystem", e);
                                }}
                            />
                        </View>
                    </ListItem.Content>
                </ListItem>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingLeft: rpx(24),
        marginTop: rpx(36),
    },
    /* 卡片容器（对齐 basicSetting card：圆角14 + 左右24） */
    sectionWrapper: {
        marginTop: rpx(24),
        marginHorizontal: rpx(24),
        borderRadius: 14,
        overflow: "hidden",
    },
    itemRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
});
