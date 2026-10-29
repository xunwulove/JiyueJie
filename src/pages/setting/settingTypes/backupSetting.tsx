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

/** WebDAV 备份目录（固定，App 专属，避免与 MusicFree 互占） */
const WEBDAV_BACKUP_DIR = "/jiyuejie/";
/** 备份文件前缀/后缀（用于识别与清理，只动自己格式的文件） */
const BACKUP_PREFIX = "backup-";
const BACKUP_SUFFIX = ".json";
/** 保留最近 N 份备份，更旧的自动清理（防无限堆积） */
const BACKUP_KEEP = 5;

/** 备份时间戳（本地时区，文件名内嵌 → 字典序 = 时间序） */
function backupTimestamp(d = new Date()): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
        d.getHours(),
    )}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** 列出 WebDAV 目录下全部备份文件名（时间倒序，最新的在前） */
async function listWebdavBackups(
    client: ReturnType<typeof createClient>,
): Promise<string[]> {
    const entries = (await client.getDirectoryContents(
        WEBDAV_BACKUP_DIR,
    )) as Array<{ basename?: string }>;
    return (entries ?? [])
        .map(e => e?.basename ?? "")
        .filter(
            name =>
                name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_SUFFIX),
        )
        .sort()
        .reverse();
}

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

    /** 执行恢复（LoadingDialog 包裹，含恢复方式） */
    async function doResume(raw: string | Object) {
        return new Promise<void>(resolve => {
            showDialog("LoadingDialog", {
                title: t("backupAndResume.resumeFromLocalFile"),
                loadingText: t("backupAndResume.resuming"),
                async task() {
                    await delay(300, false);
                    return Backup.resume(raw, resumeMode);
                },
                onResolve(_, hideDialog) {
                    Toast.success(t("toast.resumeSuccess"));
                    hideDialog();
                    resolve();
                },
                onCancel(hideDialog) {
                    hideDialog();
                    resolve();
                },
                onReject(reason, hideDialog) {
                    hideDialog();
                    console.log(reason);
                    Toast.warn(t("toast.resumeFail", { reason: reason?.message ?? reason }));
                    resolve();
                },
            });
        });
    }

    /** 恢复前预览校验：解析 + checksum + 概览 → 确认弹窗 → 执行恢复 */
    function confirmAndResume(raw: string | Object) {
        const p = Backup.preview(raw);
        if (!p.valid) {
            Toast.warn(
                t("toast.resumeFail", { reason: p.error ?? "备份文件无效" }),
            );
            return;
        }
        showDialog("SimpleDialog", {
            title: t("backupAndResume.resumePreviewTitle"),
            content: (
                <View style={style.previewBox}>
                    {(p.createdAt || p.appVersion) && (
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary">
                            {t("backupAndResume.resumePreviewMeta", {
                                time: p.createdAt
                                    ? new Date(p.createdAt).toLocaleString()
                                    : "—",
                                version: p.appVersion ?? "—",
                            })}
                        </ThemeText>
                    )}
                    <ThemeText fontSize="content" fontWeight="medium">
                        {t("backupAndResume.resumePreviewSummary", {
                            sheets: String(p.sheetsCount),
                            plugins: String(p.pluginsCount),
                            enabled: String(p.enabledCount),
                        })}
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontColor={
                            p.checksumVerified === true
                                ? "primary"
                                : "textSecondary"
                        }>
                        {p.checksumVerified === true
                            ? t("backupAndResume.resumeChecksumOk")
                            : p.checksumVerified === false
                                ? t("backupAndResume.resumeChecksumNone")
                                : t("backupAndResume.resumeChecksumFail")}
                    </ThemeText>
                </View>
            ),
            okText: t("backupAndResume.resumeConfirm"),
            onOk: () => {
                doResume(raw).catch(() => undefined);
            },
        });
    }

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
            confirmAndResume(result);
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
                        confirmAndResume(raw);
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

        if (!(await client.exists(WEBDAV_BACKUP_DIR))) {
            Toast.warn(t("toast.backupFileNotFound"));
            return;
        }

        try {
            // 恢复最新一份备份（按文件名时间戳倒序取第一个）
            const backups = await listWebdavBackups(client);
            if (backups.length === 0) {
                Toast.warn(t("toast.backupFileNotFound"));
                return;
            }
            const latest = backups[0];
            const resumeData = await client.getFileContents(
                `${WEBDAV_BACKUP_DIR}${latest}`,
                {
                    format: "text",
                },
            );
            confirmAndResume(resumeData);
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
            if (!(await client.exists(WEBDAV_BACKUP_DIR))) {
                await client.createDirectory(WEBDAV_BACKUP_DIR);
            }
            // 时间戳命名：每次备份都是新文件，永不覆盖历史
            const fileName = `${BACKUP_PREFIX}${backupTimestamp()}${BACKUP_SUFFIX}`;
            await client.putFileContents(
                `${WEBDAV_BACKUP_DIR}${fileName}`,
                raw,
                {
                    overwrite: true,
                },
            );
            // 清理：保留最近 BACKUP_KEEP 份，删除更旧（只删自己格式的文件）
            try {
                const backups = await listWebdavBackups(client);
                const toDelete = backups.slice(BACKUP_KEEP);
                for (const name of toDelete) {
                    try {
                        await client.deleteFile(
                            `${WEBDAV_BACKUP_DIR}${name}`,
                        );
                    } catch {
                        // 单文件删除失败不阻塞（下一轮再清）
                    }
                }
            } catch {
                // 清理失败不影响备份成功
            }
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
    /* 恢复预览弹窗内容：元信息 + 概览 + 校验状态 三行 */
    previewBox: {
        paddingVertical: rpx(4),
        gap: rpx(6),
    },
});
