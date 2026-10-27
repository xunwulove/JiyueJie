import { Pressable, StyleSheet } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import Color from "color";
import Icon from "@/components/base/icon.tsx";
import { useI18N } from "@/core/i18n";
import LinearGradient from "react-native-linear-gradient";

// todo icon: = musicFree(引入自定义字体 居中) search
export default function NavBar({ onSearchPress }: { onSearchPress?: () => void }) {
    const colors = useColors();
    const { t } = useI18N();

    const isDark = (colors as any).dark === true;

    // 2026-10-27 换色主题前提：去掉品牌蓝 fallback，直接取主题 appBar 色（theme.ts 中必有定义）
    const appBarColor = colors.appBar as string;

    return (
        <LinearGradient
            colors={[
                appBarColor,
                Color(appBarColor).darken(0.18).toString(),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.appbar}>
            <Pressable
                style={[
                    styles.searchBar,
                    {
                        backgroundColor: isDark
                            ? "rgba(255,255,255,0.16)"
                            : "rgba(255,255,255,0.22)",
                    },
                ]}
                accessible
                accessibilityLabel={t("home.clickToSearch")}
                onPress={onSearchPress}>
                <Icon
                    accessible={false}
                    name="magnifying-glass"
                    size={20}
                    color="rgba(255,255,255,0.9)"
                />
                <ThemeText
                    accessible={false}
                    fontSize="subTitle"
                    style={[styles.text]}>
                    {t("home.clickToSearch")}
                </ThemeText>
            </Pressable>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    appbar: {
        shadowColor: "transparent",
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        height: 56,
    },
    searchBar: {
        marginHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        height: "72%",
        maxHeight: 40,
        borderRadius: 20,
        paddingHorizontal: rpx(20),
    },
    text: {
        marginLeft: rpx(12),
        opacity: 0.9,
        color: "#FFFFFF",
    },
});
