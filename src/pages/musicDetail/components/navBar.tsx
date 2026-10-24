import React from "react";
import { StyleSheet, View } from "react-native";
import IconButton from "@/components/base/iconButton";
import { useGoBack } from "@/core/tabletNav";
import useColors from "@/hooks/useColors";
import { showDialog } from "@/components/dialogs/useDialog";
import TrackPlayer from "@/core/trackPlayer";

/**
 * 全屏播放页顶栏：返回按钮 + 右端（主题设置图标（衣服，弹沉浸歌词设置三级浮窗）+ 三点菜单（歌曲菜单））
 */
export default function NavBar() {
    const goBack = useGoBack();
    const colors = useColors();

    return (
        <View style={styles.container}>
            <IconButton
                name="arrow-left"
                sizeType="normal"
                color={colors.text}
                style={[styles.button, styles.backButton]}
                onPress={() => {
                    goBack();
                }}
            />
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
                            showDialog("MusicItemLyricOptionsDialog", {
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
    backButton: {
        marginLeft: 16, // 返回按钮离屏幕边缘留出距离
    },
    rightGroup: {
        flexDirection: "row",
        alignItems: "center",
        paddingRight: 16, // 主题/三点菜单整体往左收一点，不贴最右边缘
    },
});
