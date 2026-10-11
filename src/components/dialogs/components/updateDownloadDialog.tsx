import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import RNFS, { downloadFile } from "react-native-fs";
import pathConst from "@/constants/pathConst";
import { addFileScheme, mkdirR } from "@/utils/fileUtils";
import NativeUtils from "@/native/utils";
import path from "path-browserify";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import Toast from "@/utils/toast";

interface IProps {
    version: string;
    fromUrl: string;
    backUrl?: string;
}

type Status = "downloading" | "completed" | "error";

function formatSize(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSec: number): string {
    if (!bytesPerSec || bytesPerSec <= 0) return "0 KB/s";
    if (bytesPerSec < 1024 * 1024) {
        return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    }
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
}

/**
 * 软件内下载更新三级浮窗：
 * 进度条 + 百分比 + 下载速度 + 已下载/总大小；完成 → 拉起系统安装器
 */
export default function UpdateDownloadDialog(props: IProps) {
    const { version, fromUrl } = props ?? {};
    const { t } = useI18N();
    const colors = useColors();

    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] = useState<Status>("downloading");
    const [progress, setProgress] = useState(0);
    const [downloadedSize, setDownloadedSize] = useState(0);
    const [fileSize, setFileSize] = useState(0);
    const [speed, setSpeed] = useState(0);
    const [filePath, setFilePath] = useState("");

    const jobIdRef = useRef<number | undefined>(undefined);
    const lastSampleRef = useRef({ time: Date.now(), bytes: 0 });
    const statusRef = useRef<Status>("downloading");

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    const targetPath = addFileScheme(
        `${pathConst.downloadPath}update/极悦界-v${version}.apk`,
    );
    const plainPath = targetPath.replace(/^file:\/\//, "");

    useEffect(() => {
        let disposed = false;

        setStatus("downloading");
        setProgress(0);
        setDownloadedSize(0);
        setFileSize(0);
        setSpeed(0);
        setFilePath(targetPath);
        jobIdRef.current = undefined;
        lastSampleRef.current = { time: Date.now(), bytes: 0 };

        (async () => {
            try {
                // 复用已下载完成的 APK：目标文件已存在且大于 1MB（排除半成品/损坏文件）→ 直接进入"已下载完成"，不再重新下载
                const stat = await RNFS.stat(plainPath).catch(() => null);
                const statSize = (stat as any)?.size ?? 0;
                if (!disposed && statSize > 1024 * 1024) {
                    setFileSize(statSize);
                    setDownloadedSize(statSize);
                    setProgress(1);
                    setStatus("completed");
                    return;
                }
                await mkdirR(path.dirname(plainPath));
                if (disposed) return;
                // 清理上一次尝试的半成品
                await RNFS.unlink(plainPath).catch(() => {});
                if (disposed) return;

                const { jobId, promise } = downloadFile({
                    fromUrl,
                    toFile: targetPath,
                    background: true,
                    begin: res => {
                        if (disposed) return;
                        setFileSize(res.contentLength || 0);
                        lastSampleRef.current = {
                            time: Date.now(),
                            bytes: 0,
                        };
                    },
                    progress: res => {
                        if (disposed) return;
                        const now = Date.now();
                        const dt = now - lastSampleRef.current.time;
                        if (dt > 500) {
                            const instSpeed =
                                ((res.bytesWritten -
                                    lastSampleRef.current.bytes) *
                                    1000) /
                                dt;
                            lastSampleRef.current = {
                                time: now,
                                bytes: res.bytesWritten,
                            };
                            setSpeed(instSpeed);
                        }
                        setDownloadedSize(res.bytesWritten);
                        setFileSize(res.contentLength || 0);
                        setProgress(
                            res.contentLength
                                ? res.bytesWritten / res.contentLength
                                : 0,
                        );
                    },
                });
                jobIdRef.current = jobId;
                await promise;
                if (disposed) return;
                setProgress(1);
                setStatus("completed");
            } catch (e: any) {
                if (disposed) return;
                setStatus("error");
                Toast.warn(`下载更新失败：${e?.message ?? "未知错误"}`);
            }
        })();

        return () => {
            disposed = true;
            // 组件卸载/重试时停止未完成的下载，避免后台继续
            if (
                jobIdRef.current !== undefined &&
                statusRef.current === "downloading"
            ) {
                RNFS.stopDownload(jobIdRef.current);
            }
        };
    }, [attempt]);

    function onCancel() {
        if (jobIdRef.current !== undefined) {
            RNFS.stopDownload(jobIdRef.current);
        }
        // 已下载完成的文件保留，供下次直接安装；仅清理下载中/失败留下的半成品
        if (statusRef.current !== "completed") {
            RNFS.unlink(plainPath).catch(() => {});
        }
        hideDialog();
    }

    function onInstall() {
        NativeUtils.installApk(plainPath)
            .then(() => {
                hideDialog();
            })
            .catch(e => {
                if (e?.code === "NEED_INSTALL_PERMISSION") {
                    Toast.warn(
                        "请在系统设置中允许「极悦界」安装未知应用，然后重试",
                    );
                    return;
                }
                Toast.warn(`无法启动安装：${e?.message ?? "未知错误"}`);
            });
    }

    function onRetry() {
        setAttempt(a => a + 1);
    }

    const percent = Math.min(100, Math.round(progress * 100));

    return (
        <Dialog onDismiss={onCancel}>
            <Dialog.Title withDivider>
                {status === "completed"
                    ? `下载完成 V${version}`
                    : status === "error"
                      ? "下载更新失败"
                      : `正在下载更新 V${version}`}
            </Dialog.Title>
            <Dialog.Content>
                <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${percent}%`,
                                    backgroundColor: colors.primary,
                                },
                            ]}
                        />
                    </View>
                    <ThemeText
                        fontSize="subTitle"
                        fontWeight="bold"
                        style={styles.percentText}>
                        {percent}%
                    </ThemeText>
                </View>
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    style={styles.metaText}>
                    {status === "downloading"
                        ? `${formatSize(downloadedSize)} / ${formatSize(
                              fileSize,
                          )} · ${formatSpeed(speed)}`
                        : status === "completed"
                          ? "已下载完成，点击下方按钮安装"
                          : "网络异常或服务器无响应，可重试"}
                </ThemeText>
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress: onCancel,
                    },
                    ...(status === "downloading"
                        ? []
                        : [
                              {
                                  title:
                                      status === "completed"
                                          ? "立即安装"
                                          : "重试",
                                  type: "primary" as const,
                                  onPress:
                                      status === "completed"
                                          ? onInstall
                                          : onRetry,
                              },
                          ]),
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    progressRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        marginTop: rpx(8),
    },
    progressTrack: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#99999933",
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: 4,
    },
    percentText: {
        marginLeft: 12,
        width: 36,
        textAlign: "right",
    },
    metaText: {
        marginTop: rpx(16),
        paddingHorizontal: rpx(8),
        textAlign: "center",
    },
});
