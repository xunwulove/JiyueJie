import ListItem from "@/components/base/listItem";
import { ListDivider } from "@/components/base/divider";
import ThemeText from "@/components/base/themeText";
import Backup from "@/core/backup";
import Toast from "@/utils/toast";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { showDialog } from "@/components/dialogs/useDialog";
import axios from "axios";

import { ResumeMode } from "@/constants/commonConst.ts";
import Config, { useAppConfig } from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import delay from "@/utils/delay";
import { writeInChunks } from "@/utils/fileUtils.ts";
import { errorLog } from "@/utils/log.ts";
import { getDocumentAsync } from "expo-document-picker";
import { readAsStringAsync } from "expo-file-system";
import { AuthType, createClient } from "webdav";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";

export default function BackupSetting() {
    const { t } = useI18N();
    const colors = useColors();

    const resumeMode = useAppConfig("backup.resumeMode");
    const webdavUrl = useAppConfig("webdav.url");
    const webdavUsername = useAppConfig("webdav.username");
    const webdavPassword = useAppConfig("webdav.password");


    const onBackupToLocal = async () => {
        showDialog("FileSelectorDialog", {
            fileType: "folder",
            multi: false,
            actionText: t("backupAndResume.beginBackup"),
            async onAction(selectedFiles) {
                const raw = Backup.backup();
                const folder = selectedFiles[0]?.path;
                return new Promise(resolve => {
                    showDialog("LoadingDialog", {
                        title: t("backupAndResume.backupDialogTitle"),
                        loadingText: t("backupAndResume.backuping"),
                        promise: writeInChunks(
                            `${folder}${folder?.endsWith("/") ? "" : "/"
                            }backup.json`,
                            raw,
                        ),
                        onResolve(_, hideDialog) {
                            Toast.success(t("toast.backupSuccess"));
                            hideDialog();
                            resolve(true);
                        },
                        onCancel(hideDialog) {
                            hideDialog();
                            resolve(false);
                        },
                        onReject(reason, hideDialog) {
                            hideDialog();
                            resolve(false);
                            console.log(reason);
                            Toast.warn(t("toast.backupFail", { reason: reason?.message ?? reason }));
                        },
                    });
                });
            },
        });
    };

    async function onResumeFromLocal() {
        try {
            const pickResult = await getDocumentAsync({
                copyToCacheDirectory: true,
                type: "application/json",
            });
            if (pickResult.canceled) {
                return;
            }
            const result = await readAsStringAsync(pickResult.assets[0].uri);
            return new Promise(resolve => {
                showDialog("LoadingDialog", {
                    title: t("backupAndResume.resumeFromLocalFile"),
                    loadingText: t("backupAndResume.resuming"),
                    async task() {
                        await delay(300, false);
                        return Backup.resume(result, resumeMode);
                    },
                    onResolve(_, hideDialog) {
                        Toast.success(t("toast.resumeSuccess"));
                        hideDialog();
                        resolve(true);
                    },
                    onCancel(hideDialog) {
                        hideDialog();
                        resolve(false);
                    },
                    onReject(reason, hideDialog) {
                        hideDialog();
                        resolve(false);
                        console.log(reason);
                        Toast.warn(t("toast.resumeFail", { reason: reason?.message ?? reason }));
                    },
                });
            });
        } catch (e: any) {
            errorLog("恢复失败", e);
            Toast.warn(t("toast.resumeFail", { reason: e?.message ?? e }));
        }
    }

    async function onResumeFromUrl() {
        // 2026-10-14：输入类操作统一三级浮窗（原为底部 SimpleInput 面板，与缓存上限一致）
        showDialog("SimpleInputDialog", {
            title: t("backupAndResume.resumeFromUrlDialogTitle"),
            placeholder: t("backupAndResume.resumeFromUrlDialogPlaceHolder"),
            maxLength: 1024,
            async onOk(text, close) {
                try {
                    const url = text.trim();
                    if (url.endsWith(".json") || url.endsWith(".txt")) {
                        const raw = (await axios.get(text)).data;
                        await Backup.resume(raw, resumeMode);
                        Toast.success(t("toast.resumeSuccess"));
                        close();
                    } else {
                        throw "无效的URL";
                    }
                } catch (e: any) {
                    Toast.warn(t("toast.resumeFail", { reason: e?.message ?? e }));
                }
            },
        });
    }

    async function onResumeFromWebdav() {
        const url = Config.getConfig("webdav.url");
        const username = Config.getConfig("webdav.username");
        const password = Config.getConfig("webdav.password");

        if (!(username && password && url)) {
            Toast.warn(t("toast.resumePreCheckFailed"));
            return;
        }
        const client = createClient(url, {
            authType: AuthType.Password,
            username: username,
            password: password,
        });

        if (!(await client.exists("/MusicFree/MusicFreeBackup.json"))) {
            Toast.warn(t("toast.backupFileNotFound"));
            return;
        }

        try {
            const resumeData = await client.getFileContents(
                "/MusicFree/MusicFreeBackup.json",
                {
                    format: "text",
                },
            );
            await Backup.resume(
                resumeData,
                Config.getConfig("backup.resumeMode"),
            );
            Toast.success(t("toast.resumeSuccess"));
        } catch (e: any) {
            Toast.warn(t("toast.resumeFail", { reason: e?.message ?? e }));
        }
    }

    async function onBackupToWebdav() {
        const username = Config.getConfig("webdav.username");
        const password = Config.getConfig("webdav.password");
        const url = Config.getConfig("webdav.url");
        if (!(username && password && url)) {
            Toast.warn(t("toast.resumePreCheckFailed"));
            return;
        }
        try {
            const client = createClient(url, {
                authType: AuthType.Password,
                username: username,
                password: password,
            });

            const raw = Backup.backup();
            if (!(await client.exists("/MusicFree"))) {
                await client.createDirectory("/MusicFree");
            }
            // 临时文件
            await client.putFileContents(
                "/MusicFree/MusicFreeBackup.json",
                raw,
                {
                    overwrite: true,
                },
            );
            Toast.success(t("toast.backupSuccess"));
        } catch (e: any) {
            Toast.warn(t("toast.backupFail", { reason: e?.message ?? e }));
        }
    }

    return (
        <ScrollView style={style.wrapper}>
            {/* 分组一：恢复方式（卡片式，对齐设置页） */}
            <View style={style.group}>
                <View style={[style.groupHeader, style.firstGroupHeader]}>
                    <ThemeText
                        fontSize="subTitle"
                        fontColor="primary"
                        fontWeight="bold">
                        {t("sidebar.backupAndResume")}
                    </ThemeText>
                </View>
                <View style={[style.card, { backgroundColor: colors.card }]}>
                    <ListItem
                        withHorizontalPadding
                        heightType="small"
                        onPress={() => {
                            showDialog("RadioDialog", {
                                title: t("backupAndResume.setResumeMode"),
                                content: [
                                    {
                                        label: t(("backupAndResume.resumeMode." + ResumeMode.Append) as any),
                                        value: ResumeMode.Append,
                                    },
                                    {
                                        label: t(("backupAndResume.resumeMode." + ResumeMode.OverwriteDefault) as any),
                                        value: ResumeMode.OverwriteDefault,
                                    },
                                    {
                                        label: t(("backupAndResume.resumeMode." + ResumeMode.Overwrite) as any),
                                        value: ResumeMode.Overwrite,
                                    },
                                ],
                                onOk(value) {
                                    Config.setConfig(
                                        "backup.resumeMode",
                                        value as any,
                                    );
                                },
                            });
                        }}>
                        <ListItem.Content title={t("backupAndResume.resumeMode")} />
                        <ListItem.ListItemText>
                            {
                                t(("backupAndResume.resumeMode." + ((resumeMode as ResumeMode) ||
                                    ResumeMode.Append)) as any)
                            }
                        </ListItem.ListItemText>
                    </ListItem>
                </View>
            </View>

            {/* 分组二：本地备份 */}
            <View style={style.group}>
                <View style={style.groupHeader}>
                    <ThemeText
                        fontSize="subTitle"
                        fontColor="primary"
                        fontWeight="bold">
                        {t("backupAndResume.localBackup")}
                    </ThemeText>
                </View>
                <View style={[style.card, { backgroundColor: colors.card }]}>
                    <ListItem
                        withHorizontalPadding
                        heightType="small"
                        onPress={onBackupToLocal}>
                        <ListItem.Content title={t("backupAndResume.backupToLocal")} />
                    </ListItem>
                    <ListDivider marginLeft={16} />
                    <ListItem
                        withHorizontalPadding
                        heightType="small"
                        onPress={onResumeFromLocal}>
                        <ListItem.Content title={t("backupAndResume.resumeFromLocalFile")} />
                    </ListItem>
                    <ListDivider marginLeft={16} />
                    <ListItem
                        withHorizontalPadding
                        heightType="small"
                        onPress={onResumeFromUrl}>
                        <ListItem.Content title={t("backupAndResume.resumeFromUrlDialogTitle")} />
                    </ListItem>
                </View>
            </View>

            {/* 分组三：Webdav */}
            <View style={style.group}>
                <View style={style.groupHeader}>
                    <ThemeText
                        fontSize="subTitle"
                        fontColor="primary"
                        fontWeight="bold">
                        Webdav
                    </ThemeText>
                </View>
                <View style={[style.card, { backgroundColor: colors.card }]}>
                    <ListItem
                        withHorizontalPadding
                        heightType="small"
                        onPress={() => {
                            showDialog("WebDAVSettingDialog", {
                                initValues: {
                                    url: webdavUrl ?? "",
                                    username: webdavUsername ?? "",
                                    password: webdavPassword ?? "",
                                },
                                onOk(values, closeDialog) {
                                    Config.setConfig("webdav.url", values?.url);
                                    Config.setConfig("webdav.username", values?.username);
                                    Config.setConfig("webdav.password", values?.password);

                                    Toast.success(t("toast.saveSuccess"));
                                    closeDialog();
                                },
                            });
                        }}>
                        <ListItem.Content title={t("backupAndResume.webdavSettings")} />
                    </ListItem>
                    <ListDivider marginLeft={16} />
                    <ListItem
                        withHorizontalPadding
                        heightType="small"
                        onPress={onBackupToWebdav}>
                        <ListItem.Content title={t("backupAndResume.backupToWebdav")} />
                    </ListItem>
                    <ListDivider marginLeft={16} />
                    <ListItem
                        withHorizontalPadding
                        heightType="small"
                        onPress={onResumeFromWebdav}>
                        <ListItem.Content title={t("backupAndResume.resumeFromWebdav")} />
                    </ListItem>
                </View>
            </View>
        </ScrollView>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
        paddingBottom: rpx(24),
    },
    /* 卡片式分组（对齐设置页 basicSetting）：分组标题在外，行收进圆角卡片 */
    group: {
        marginTop: rpx(8),
    },
    groupHeader: {
        paddingHorizontal: 16,
        height: 36,
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(8),
    },
    /* 仅第一个分组：标题离顶部 AppBar 收紧（其余分组保持统一间距） */
    firstGroupHeader: {
        marginTop: 0,
    },
    card: {
        marginHorizontal: rpx(24),
        borderRadius: 14,
        overflow: "hidden",
    },
});
