import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import Dialog from "./base";
import Loading from "@/components/base/loading";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";

/** 安装进度（download=下载阶段 / mount=挂载阶段），null = 无进度数据（仅转圈） */
export interface IInstallProgress {
    phase: "download" | "mount" | "probe";
    done: number;
    total: number;
    name?: string;
}

/**
 * 音源安装/检测进度 - 三级弹窗（符合 Dialog 规范：52dp 渐变标题 / vh(70) 内容 / 52dp 按钮行）。
 * 与探测软件保持一致的三行布局：行1 状态+计数 / 行2 进度条+百分比 / 行3 当前插件名。
 * phase="probe" 时为"检测音源"进度（由音源管理页检测按钮驱动）。
 * 由 PluginList 声明式渲染（props 实时更新，不走命令式 showDialog 快照）；
 * "后台运行"= 仅收起弹窗，安装/检测任务继续后台执行（无法中途取消）。
 */
export default function PluginInstallProgressDialog(props: {
    progress: IInstallProgress | null;
    onClose: () => void;
}) {
    const { progress, onClose } = props;
    const colors = useColors();
    const isProbe = progress?.phase === "probe";

    return (
        <Dialog onDismiss={onClose}>
            <Dialog.Title>
                {isProbe ? "检测音源" : "安装音源"}
            </Dialog.Title>
            <Dialog.Content style={style.content}>
                {progress ? (
                    <View style={style.progressCard}>
                        {/* 行1 状态 + 计数 */}
                        <View style={style.progressRow1}>
                            <ThemeText
                                fontSize="content"
                                fontWeight="medium">
                                {isProbe
                                    ? "正在检测音源"
                                    : progress.phase === "download"
                                        ? "正在下载音源"
                                        : "正在挂载音源"}
                            </ThemeText>
                            <ThemeText
                                fontSize="content"
                                fontWeight="bold"
                                fontColor="primary">
                                {progress.done}/{progress.total}
                            </ThemeText>
                        </View>
                        {/* 行2 进度条 + 百分比 */}
                        <View style={style.progressRow2}>
                            <View
                                style={[
                                    style.progressTrack,
                                    {
                                        backgroundColor: colors.divider,
                                    },
                                ]}>
                                <View
                                    style={[
                                        style.progressFill,
                                        {
                                            width: `${
                                                progress.total > 0
                                                    ? Math.round(
                                                        (progress.done /
                                                              progress.total) *
                                                              100,
                                                    )
                                                    : 0
                                            }%`,
                                            backgroundColor: colors.primary,
                                        },
                                    ]}
                                />
                            </View>
                            <ThemeText
                                fontSize="caption"
                                fontColor="textSecondary"
                                style={style.progressPct}>
                                {progress.total > 0
                                    ? Math.round(
                                        (progress.done /
                                              progress.total) *
                                              100,
                                    )
                                    : 0}
                                %
                            </ThemeText>
                        </View>
                        {/* 行3 正在检测/加载的插件名 */}
                        <View style={style.progressRow3}>
                            <ThemeText
                                fontSize="description"
                                fontColor="textSecondary">
                                {isProbe ? "正在检测：" : "正在加载："}
                            </ThemeText>
                            <ThemeText
                                fontSize="description"
                                fontWeight="medium"
                                numberOfLines={1}
                                style={style.progressName}>
                                {progress.name ?? "准备中…"}
                            </ThemeText>
                        </View>
                    </View>
                ) : (
                    <View style={style.loadingWrap}>
                        <Loading size="large" />
                        <ThemeText
                            fontSize="content"
                            fontColor="textSecondary"
                            style={style.loadingText}>
                            正在安装…
                        </ThemeText>
                    </View>
                )}
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: "后台运行",
                        type: "normal",
                        onPress: onClose,
                    },
                ]}
            />
        </Dialog>
    );
}

const style = StyleSheet.create({
    content: {
        paddingHorizontal: rpx(24),
        paddingTop: rpx(12),
        paddingBottom: rpx(12),
    },
    progressCard: {
        gap: 8,
    },
    progressRow1: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    progressRow2: {
        flexDirection: "row",
        alignItems: "center",
    },
    progressTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: "hidden",
    },
    progressFill: {
        height: 4,
        borderRadius: 2,
    },
    progressPct: {
        width: 44,
        textAlign: "right",
        marginLeft: 8,
    },
    progressRow3: {
        flexDirection: "row",
        alignItems: "center",
    },
    progressName: {
        flex: 1,
    },
    loadingWrap: {
        alignItems: "center",
        paddingVertical: rpx(24),
    },
    loadingText: {
        marginTop: rpx(12),
    },
});
