import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Dialog from "./base";
import { hideDialog, showDialog } from "../useDialog";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import useColors from "@/hooks/useColors";
import Config from "@/core/appConfig";
import pathConst from "@/constants/pathConst";
import Toast from "@/utils/toast";
import { qualityKeys } from "@/utils/qualities";
import { iconSizeConst } from "@/constants/uiConst";
import { useI18N } from "@/core/i18n";
import { readdir } from "react-native-fs";

/**
 * 模块级状态缓存：点"下载目录"用同体系三级浮窗替换（FileSelectorDialog）打开选择器；
 * 切换期间缓存用户已改的设置，取消/选完均 setTimeout 重开本弹窗并恢复。
 */
let cachedState: {
    quality?: IMusic.IQualityKey;
    order?: "asc" | "desc";
    maxDownload?: number;
    downloadPath?: string;
} | null = null;

/**
 * 下载设置（对齐 APlayer DownloadPage 3 级弹窗：默认音质 + 音质顺序 + 下载目录 + 最大并发）
 * 迁移自设置页"基本设置-下载"组；写同一组 appConfig 键，下载内核不变
 */
export default function DownloadSettingsDialog() {
    const { t } = useI18N();
    const colors = useColors();

    const [quality, setQuality] = useState<IMusic.IQualityKey>(
        cachedState?.quality ??
            Config.getConfig("basic.defaultDownloadQuality") ??
            "standard",
    );
    const [order, setOrder] = useState<"asc" | "desc">(
        cachedState?.order ??
            Config.getConfig("basic.downloadQualityOrder") ??
            "asc",
    );
    const [maxDownload, setMaxDownload] = useState<number>(
        cachedState?.maxDownload ??
            Config.getConfig("basic.maxDownload") ??
            3,
    );
    const [downloadPath, setDownloadPath] = useState<string | undefined>(
        cachedState?.downloadPath ??
            Config.getConfig("basic.downloadPath"),
    );

    const qualityLabels: Record<IMusic.IQualityKey, string> = {
        low: t("musicQuality.low"),
        standard: t("musicQuality.standard"),
        high: t("musicQuality.high"),
        super: t("musicQuality.super"),
    };

    const onPickPath = () => {
        // 先缓存当前设置并关闭浮窗，再打开文件夹选择三级浮窗（同体系，无遮挡问题）
        cachedState = { quality, order, maxDownload, downloadPath };
        hideDialog();
        showDialog("FileSelectorDialog", {
            fileType: "folder",
            multi: false,
            actionText: t("basicSettings.fileSelector.selectFolder"),
            // 取消/返回退出：恢复下载设置浮窗（保留已改设置）
            onCancel() {
                setTimeout(() => {
                    showDialog("DownloadSettingsDialog");
                }, 0);
            },
            async onAction(selectedFiles) {
                try {
                    const targetDir = selectedFiles[0];
                    await readdir(targetDir.path);
                    cachedState = { ...cachedState, downloadPath: targetDir.path };
                    // 选完重新打开浮窗（恢复已改设置 + 新路径）
                    setTimeout(() => {
                        showDialog("DownloadSettingsDialog");
                    }, 0);
                    return true;
                } catch {
                    Toast.warn(t("toast.folderNotExistOrNoPermission"));
                    return false;
                }
            },
        });
    };

    const save = () => {
        cachedState = null;
        Config.setConfig("basic.defaultDownloadQuality", quality);
        Config.setConfig("basic.downloadQualityOrder", order);
        Config.setConfig("basic.maxDownload", maxDownload);
        if (downloadPath) {
            Config.setConfig("basic.downloadPath", downloadPath);
        }
        Toast.success(t("toast.saveSuccess"));
        hideDialog();
    };

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title withDivider>{t("downloadSettings.title")}</Dialog.Title>
            <Dialog.Content needScroll style={styles.content}>
                <View>
                    <OptionGroup title={t("basicSettings.defaultDownloadQuality")}>
                        {qualityKeys.map(key => (
                            <OptionRow
                                key={key}
                                label={qualityLabels[key] ?? key}
                                selected={quality === key}
                                onPress={() => setQuality(key)}
                            />
                        ))}
                    </OptionGroup>
                    <OptionGroup title={t("basicSettings.downloadQualityOrder")}>
                        <OptionRow
                            label={t("basicSettings.downloadQualityOrder.asc")}
                            selected={order === "asc"}
                            onPress={() => setOrder("asc")}
                        />
                        <OptionRow
                            label={t("basicSettings.downloadQualityOrder.desc")}
                            selected={order === "desc"}
                            onPress={() => setOrder("desc")}
                        />
                    </OptionGroup>
                    <OptionGroup title={t("basicSettings.maxDownload")}>
                        {[1, 3, 5, 7].map(n => (
                            <OptionRow
                                key={n}
                                label={`${n} 个`}
                                selected={maxDownload === n}
                                onPress={() => setMaxDownload(n)}
                            />
                        ))}
                    </OptionGroup>
                    <OptionGroup title={t("basicSettings.downloadPath")} last>
                        <Pressable onPress={onPickPath} style={styles.pathRow}>
                            <ThemeText
                                fontSize="normal"
                                numberOfLines={2}
                                style={styles.pathText}>
                                {downloadPath ?? pathConst.downloadMusicPath}
                            </ThemeText>
                            <Icon
                                name="folder-outline"
                                size={iconSizeConst.light}
                                color={colors.primary}
                            />
                        </Pressable>
                        <ThemeText
                            fontSize="caption"
                            fontColor="textSecondary"
                            style={styles.pathNote}>
                            {t("basicSettings.fileSelector.selectFolder")}
                        </ThemeText>
                    </OptionGroup>
                </View>
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress: hideDialog,
                    },
                    {
                        title: t("common.confirm"),
                        type: "primary",
                        onPress: save,
                    },
                ]}
            />
        </Dialog>
    );
}

function OptionGroup(props: {
    title: string;
    children: React.ReactNode;
    /** 最后一组：底部不留间距（消除按钮行上方空隙） */
    last?: boolean;
}) {
    const colors = useColors();
    return (
        <View style={[styles.group, props.last ? styles.groupLast : null]}>
            <ThemeText
                fontSize="subTitle"
                fontWeight="bold"
                color={colors.primary}
                style={styles.groupTitle}>
                {props.title}
            </ThemeText>
            {props.children}
        </View>
    );
}

function OptionRow(props: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    const colors = useColors();
    return (
        <Pressable onPress={props.onPress} style={styles.optionRow}>
            <ThemeText
                fontSize="subTitle"
                style={styles.optionLabel}
                fontWeight="medium">
                {props.label}
            </ThemeText>
            {props.selected ? (
                <Icon
                    name="check-circle"
                    size={iconSizeConst.light}
                    color={colors.primary}
                />
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    group: {
        marginBottom: 8,
    },
    groupLast: {
        marginBottom: 0,
    },
    groupTitle: {
        marginTop: 8,
        marginBottom: 2,
    },
    optionRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
        paddingHorizontal: 16,
    },
    optionLabel: {
        flex: 1,
    },
    pathRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
        paddingHorizontal: 16,
    },
    pathText: {
        flex: 1,
        marginRight: 8,
    },
    pathNote: {
        paddingHorizontal: 16,
    },
    content: {
        paddingBottom: 0,
    },
});
