import React, { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { AppState } from "react-native";
import ThemeText from "@/components/base/themeText";
import ListItem from "@/components/base/listItem";
import ThemeSwitch from "@/components/base/switch";
import { ListDivider } from "@/components/base/divider";
import { useI18N } from "@/core/i18n";
import LyricUtil from "@/native/lyricUtil";
import NativeUtils from "@/native/utils";
import Toast from "@/utils/toast";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
type IPermissionTypes = "floatingWindow" | "fileStorage";
/**
 * 权限管理三级浮窗（原权限管理二级页压缩为浮窗）：
 * 说明 + 悬浮窗/文件读写两行开关（点击行申请对应权限），返回前台自动重查状态
 */
export default function PermissionSettingDialog() {
    const appState = useRef(AppState.currentState);
    const [permissions, setPermissions] = useState<
        Record<IPermissionTypes, boolean>
    >({
        floatingWindow: false,
        fileStorage: false,
    });
    const { t } = useI18N();
    async function checkPermission(type?: IPermissionTypes) {
        // 函数式更新读取最新 state，避免 useEffect([]) 首帧闭包
        // 在兜底 setTimeout 里把另一项权限闪回 false
        if (!type || type === "floatingWindow") {
            try {
                const hasPermission =
                    await LyricUtil.checkSystemAlertPermission();
                setPermissions(prev => ({
                    ...prev,
                    floatingWindow: hasPermission,
                }));
            } catch {
                // 查询失败保持原状态，避免闪回 false
            }
        }
        if (!type || type === "fileStorage") {
            try {
                const hasPermission =
                    await NativeUtils.checkStoragePermission();
                setPermissions(prev => ({
                    ...prev,
                    fileStorage: hasPermission,
                }));
            } catch {
                // 同上
            }
        }
    }
    useEffect(() => {
        checkPermission();
        const subscription = AppState.addEventListener(
            "change",
            nextAppState => {
                if (
                    appState.current.match(/inactive|background/) &&
                    nextAppState === "active"
                ) {
                    checkPermission();
                }
                appState.current = nextAppState;
            },
        );
        return () => {
            subscription.remove();
        };
    }, []);
    // 申请悬浮窗权限：系统会跳转设置页，返回前台由 AppState 监听重查；
    // 此处再兜底一次，保证立即返回时开关状态也刷新
    const requestFloatingWindow = () => {
        LyricUtil.requestSystemAlertPermission()
            .catch(() => {
                Toast.warn(t("toast.noFloatWindowPermission"));
            })
            .finally(() => {
                setTimeout(() => {
                    checkPermission("floatingWindow");
                }, 500);
            });
    };
    // 申请存储权限：系统对话框在应用内弹出（Android 13+），
    // 弹框会让应用失焦触发 AppState 重查；此处延时兜底刷新
    const requestFileStorage = () => {
        NativeUtils.requestStoragePermission();
        setTimeout(() => {
            checkPermission("fileStorage");
        }, 800);
    };
    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>
                {t("permissionSetting.title")}
            </Dialog.Title>
            <Dialog.Content>
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    style={styles.description}>
                    {t("permissionSetting.description")}
                </ThemeText>
                <ListItem
                    withHorizontalPadding
                    heightType="small"
                    onPress={requestFloatingWindow}>
                    <ListItem.Content
                        title={t("permissionSetting.floatWindowPermission")}
                        description={t(
                            "permissionSetting.floatWindowPermissionDescription",
                        )}
                    />
                    <ThemeSwitch
                        value={permissions.floatingWindow}
                        onValueChange={requestFloatingWindow}
                    />
                </ListItem>
                {/* 2026-10-21 统一：列表项之间加 ListDivider */}
                <ListDivider marginLeft={16} />
                <ListItem
                    withHorizontalPadding
                    heightType="small"
                    onPress={requestFileStorage}>
                    <ListItem.Content
                        title={t(
                            "permissionSetting.fileReadWritePermission",
                        )}
                        description={t(
                            "permissionSetting.fileReadWritePermissionDescription",
                        )}
                    />
                    <ThemeSwitch
                        value={permissions.fileStorage}
                        onValueChange={requestFileStorage}
                    />
                </ListItem>
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.done"),
                        type: "primary",
                        onPress: hideDialog,
                    },
                ]}
            />
        </Dialog>
    );
}
const styles = StyleSheet.create({
    description: {
        paddingHorizontal: 0,
        paddingVertical: 8,
    },
});
