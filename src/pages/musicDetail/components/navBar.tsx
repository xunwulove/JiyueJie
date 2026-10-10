import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import IconButton from "@/components/base/iconButton";
import { useGoBack } from "@/core/tabletNav";
import useColors from "@/hooks/useColors";
import { showPanel } from "@/components/panels/usePanel";
import { showDialog } from "@/components/dialogs/useDialog";
import TrackPlayer from "@/core/trackPlayer";

/**
 * 全屏播放页顶栏 - 对齐 APlayer PlayingPage：返回 + "正在播放"16sp Bold
 * 右端：主题设置图标（衣服，弹沉浸歌词设置三级浮窗）+ 三点菜单（歌曲菜单，位于主题图标右侧）
 */
export default function NavBar() {
    const goBack = useGoBack();
    const colors = useColors();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <IconButton
                name="arrow-left"
                sizeType="normal"
                color={colors.text}
                style={styles.button}
                onPress={() => {
                    goBack();
                }}
            />
            <View style={styles.headerContent}>
                <Text style={[styles.headerTitleText, { color: colors.text }]}>
                    正在播放
                </Text>
            </View>
            <View style={styles.rightGroup}>
                {/* 主题设置（衣服图标）：沉浸歌词设置三级浮窗 */}
                <IconButton
                    name="t-shirt-outline"
                    sizeType="normal"
                    color={colors.textSecondary}
                    style={styles.button}
                    onPress={() => {
                        showDialog("ImmersiveSettingDialog");
                    }}
                />
                {/* 三点菜单：歌曲菜单，位于主题图标右侧 */}
                <IconButton
                    name="ellipsis-vertical"
                    sizeType="normal"
                    color={colors.textSecondary}
                    style={styles.button}
                    onPress={() => {
                        const currentMusic = TrackPlayer.currentMusic;
                        if (currentMusic) {
                            showPanel("MusicItemLyricOptions", {
                                musicItem: currentMusic,
                            });
                        }
                    }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        height: 56, // 对齐 APlayer 顶栏高度
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    button: {
        marginHorizontal: 4,
    },
    headerContent: {
        flex: 1,
        height: 56,
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitleText: {
        fontWeight: fontWeightConst.bold,
        fontSize: fontSizeConst.content,
        includeFontPadding: false,
    },
    rightGroup: {
        flexDirection: "row",
        alignItems: "center",
    },
});
