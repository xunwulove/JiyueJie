import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MusicList from "@/components/musicList";
import LocalMusicSheet from "@/core/localMusicSheet";
import {
    localMusicSheetId,
    localPluginPlatform,
    RequestStateCode,
} from "@/constants/commonConst";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import Color from "color";
import Toast from "@/utils/toast";

export default function LocalMusicList() {
    const musicList = LocalMusicSheet.useMusicList();
    const { t } = useI18N();
    const colors = useColors();
    const primary = colors.primary;

    /* 空态"去扫描"：与 AppBar 三点菜单扫描一致，弹文件选择器选目录后扫描入库 */
    const onScan = () => {
        showDialog("FileSelectorDialog", {
            fileType: "folder",
            multi: true,
            actionText: t("localMusic.beginScan"),
            async onAction(selectedFiles) {
                return new Promise(resolve => {
                    showDialog("LoadingDialog", {
                        title: t("localMusic.scanLocalMusic"),
                        promise: LocalMusicSheet.importLocal(
                            selectedFiles.map(_ => _.path),
                        ),
                        onResolve(data, hideDialog) {
                            Toast.success(t("toast.importSuccess"));
                            hideDialog();
                            resolve(true);
                        },
                        onCancel(hideDialog) {
                            LocalMusicSheet.cancelImportLocal();
                            hideDialog();
                            resolve(false);
                        },
                    });
                });
            },
        });
    };

    /* 本地音乐库空态：图标 + 说明 + 去扫描（对齐设计文档"空态显示去扫描引导"） */
    if (musicList.length === 0) {
        return (
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                <View style={styles.empty}>
                    <View
                        style={[
                            styles.emptyIcon,
                            { backgroundColor: Color(primary)
                                .alpha(0.1)
                                .toString() },
                        ]}>
                        <Icon
                            name="folder-music-outline"
                            size={44}
                            color={primary}
                        />
                    </View>
                    <ThemeText fontSize="title" fontWeight="bold">
                        本地音乐库还是空的
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.emptyDesc}>
                        扫描设备上的音乐，或稍后从引导页 / 右上角菜单扫描
                    </ThemeText>
                    <Pressable
                        onPress={onScan}
                        style={[styles.scanBtn, { backgroundColor: primary }]}>
                        <ThemeText
                            fontSize="normal"
                            fontWeight="bold"
                            color="#FFFFFF">
                            去扫描
                        </ThemeText>
                    </Pressable>
                </View>
            </HorizontalSafeAreaView>
        );
    }

    return (
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            <MusicList
                musicList={musicList}
                showIndex
                state={RequestStateCode.IDLE}
                musicSheet={{
                    id: localMusicSheetId,
                    title: t("common.local"),
                    platform: localPluginPlatform,
                    musicList: musicList,
                }}
            />
        </HorizontalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    emptyIcon: {
        width: 84,
        height: 84,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 18,
    },
    emptyDesc: {
        marginTop: 8,
        textAlign: "center",
        lineHeight: 18,
    },
    scanBtn: {
        marginTop: 24,
        borderRadius: 999,
        paddingHorizontal: 36,
        paddingVertical: 12,
    },
});
