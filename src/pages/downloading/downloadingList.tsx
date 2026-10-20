import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { sizeFormatter } from "@/utils/fileUtils";
import {
    DownloadStatus,
    DownloadFailReason,
    useDownloadQueue,
    useDownloadTask,
    useDownloadedList,
} from "@/core/downloader";
import downloader from "@/core/downloader";
import { FlashList } from "@shopify/flash-list";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import ThemeText from "@/components/base/themeText";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import Color from "color";
import { Pressable } from "react-native";
import Toast from "@/utils/toast";
import { showDialog } from "@/components/dialogs/useDialog";

/** 状态标签（对齐 APlayer statusLabel） */
function statusLabel(status: DownloadStatus): string {
    switch (status) {
    case DownloadStatus.Downloading:
        return "下载中";
    case DownloadStatus.Pending:
        return "等待中";
    case DownloadStatus.Preparing:
        return "准备中";
    case DownloadStatus.Completed:
        return "已完成";
    case DownloadStatus.Error:
        return "失败";
    default:
        return "";
    }
}

/**
 * 下载任务卡片 - 对齐 APlayer DownloadTaskItem：
 * surfaceVariant 底圆角 14 padding 12；状态图标 24；标题 15sp Medium；副行 12sp "歌手 · 状态"；
 * 下载中/等待中显示 4dp 进度条（圆角2、primary 填充）+ "N%" 11sp；失败显示错误 12sp error；
 * 右侧操作：失败/等待中可删除（fork 内核无暂停/重试 API，记录差异）
 */
function DownloadingListItem(props: { musicItem: IMusic.IMusicItem }) {
    const { musicItem } = props;
    const taskInfo = useDownloadTask(musicItem);
    const colors = useColors();

    const status = taskInfo?.status ?? DownloadStatus.Error;

    let iconName: IIconName = "arrow-down-tray";
    let iconColor = colors.textSecondary;
    if (status === DownloadStatus.Error) {
        iconName = "exclamation-circle";
        iconColor = (colors as any).error ?? "#E5484D";
    } else if (status === DownloadStatus.Completed) {
        iconName = "check-circle";
        iconColor = colors.primary;
    }

    const progress =
        taskInfo?.downloadedSize && taskInfo?.fileSize
            ? Math.min(
                100,
                (taskInfo.downloadedSize / taskInfo.fileSize) * 100,
            )
            : 0;

    /* 副行：歌手 · 状态（下载中附进度）；失败时副行仍显示"歌手 · 失败"，详细错误单独红色行展示 */
    let description = `${musicItem.artist ?? ""} · ${statusLabel(status)}`;
    let errorDetail: string | undefined;
    if (status === DownloadStatus.Error) {
        if (taskInfo?.errorReason === DownloadFailReason.NoWritePermission) {
            errorDetail = "没有写入文件的权限";
        } else if (taskInfo?.errorReason === DownloadFailReason.FailToFetchSource) {
            errorDetail = "获取音乐源失败";
        } else {
            errorDetail = "未知错误";
        }
    } else if (status === DownloadStatus.Downloading) {
        description = `${sizeFormatter(taskInfo?.downloadedSize ?? 0)} / ${sizeFormatter(taskInfo?.fileSize ?? 0)}`;
    }

    return (
        <View
            style={[
                styles.card,
                { backgroundColor: colors.surfaceVariant ?? colors.card },
            ]}>
            <View style={styles.row}>
                <Icon name={iconName} size={24} color={iconColor} />
                <View style={styles.info}>
                    <ThemeText
                        fontSize="body"
                        fontWeight="medium"
                        numberOfLines={1}>
                        {musicItem.title}
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        numberOfLines={1}>
                        {description}
                    </ThemeText>
                </View>
                {/* 失败/等待中可删除（fork removeDownloadTask 仅支持 Pending/Error） */}
                {status === DownloadStatus.Error ||
                status === DownloadStatus.Pending ? (
                        <Pressable
                            hitSlop={12}
                            onPress={() =>
                                downloader.remove(musicItem)
                            }>
                            <Icon
                                name="trash-outline"
                                size={24}
                                color={colors.textSecondary}
                            />
                        </Pressable>
                    ) : null}
            </View>
            {/* 进度/状态区 */}
            {status === DownloadStatus.Downloading ||
            status === DownloadStatus.Pending ||
            status === DownloadStatus.Preparing ? (
                    <>
                        <View style={styles.progressArea}>
                            <View
                                style={[
                                    styles.track,
                                    {
                                        backgroundColor:
                                        (colors as any).surface ??
                                        colors.background,
                                    },
                                ]}>
                                <View
                                    style={[
                                        styles.fill,
                                        {
                                            width: `${progress}%`,
                                            backgroundColor: colors.primary,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                        <ThemeText
                            fontSize="caption"
                            fontColor="textSecondary"
                            style={styles.progressText}>
                            {status === DownloadStatus.Downloading
                                ? `${Math.round(progress)}%`
                                : statusLabel(status)}
                        </ThemeText>
                    </>
                ) : null}
            {status === DownloadStatus.Error ? (
                <ThemeText
                    fontSize="description"
                    color={(colors as any).error ?? "#E5484D"}
                    style={styles.statusText}>
                    {errorDetail}
                </ThemeText>
            ) : null}
        </View>
    );
}

/** 已下载歌曲行（已完成）：勾图标 + 歌手 · 已完成 + 右端删除（删文件+删记录） */
function DownloadedListItem(props: { musicItem: IMusic.IMusicItem }) {
    const { musicItem } = props;
    const { t } = useI18N();
    const colors = useColors();

    return (
        <View
            style={[
                styles.card,
                { backgroundColor: colors.surfaceVariant ?? colors.card },
            ]}>
            <View style={styles.row}>
                <Icon
                    name="check-circle"
                    size={24}
                    color={colors.primary}
                />
                <View style={styles.info}>
                    <ThemeText
                        fontSize="body"
                        fontWeight="medium"
                        numberOfLines={1}>
                        {musicItem.title}
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        numberOfLines={1}>
                        {musicItem.artist ?? ""} · 已下载
                    </ThemeText>
                </View>
                <Pressable
                    hitSlop={12}
                    onPress={() => {
                        // 删除确认：仅删记录（保留文件）或连同文件删除
                        showDialog("MenuDialog", {
                            title: musicItem.title,
                            options: [
                                {
                                    icon: "document-outline",
                                    title: "删除记录（保留文件）",
                                    async onPress() {
                                        await downloader.removeDownloadedRecord(
                                            musicItem,
                                        );
                                        Toast.success(t("toast.downloadRecordDeleted"));
                                    },
                                },
                                {
                                    icon: "trash-outline",
                                    title: "删除记录及文件",
                                    async onPress() {
                                        await downloader.removeDownloaded(
                                            musicItem,
                                        );
                                        Toast.success(t("toast.downloadRecordAndFileDeleted"));
                                    },
                                },
                            ],
                        });
                    }}>
                    <Icon
                        name="trash-outline"
                        size={24}
                        color={colors.textSecondary}
                    />
                </Pressable>
            </View>
        </View>
    );
}

/** 下载列表 - 对齐 APlayer DownloadPage 列表（contentPadding 16/8、spacedBy 8）；空态 64dp 图标 + 14sp 文案 */
export default function DownloadingList() {
    const downloadQueue = useDownloadQueue();
    const downloadedList = useDownloadedList();
    const colors = useColors();

    const data = useMemo(() => {
        // 进行中/等待/失败任务在前，已完成歌曲在后
        return [
            ...downloadQueue.map(item => ({ kind: "task" as const, item })),
            ...downloadedList.map(item => ({
                kind: "done" as const,
                item,
            })),
        ];
    }, [downloadQueue, downloadedList]);

    if (data.length === 0) {
        return (
            <View style={styles.empty}>
                <Icon
                    name="arrow-down-tray"
                    size={64}
                    color={Color(colors.textSecondary).alpha(0.3).toString()}
                />
                <ThemeText
                    fontSize="subTitle"
                    fontColor="textSecondary"
                    style={styles.emptyText}>
                    暂无下载
                </ThemeText>
            </View>
        );
    }

    return (
        <View style={styles.wrapper}>
            <FlashList
                style={styles.list}
                contentContainerStyle={styles.listContent}
                data={data}
                estimatedItemSize={80}
                keyExtractor={_ => `${_.kind}${_.item.platform}.${_.item.id}`}
                ItemSeparatorComponent={() => (
                    <View style={styles.separator} />
                )}
                renderItem={({ item }) =>
                    item.kind === "done" ? (
                        <DownloadedListItem musicItem={item.item} />
                    ) : (
                        <DownloadingListItem musicItem={item.item} />
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    list: {
        flexGrow: 0,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    separator: {
        height: 8,
    },
    card: {
        borderRadius: 14,
        padding: 12,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
    },
    info: {
        flex: 1,
        marginLeft: 10,
        marginRight: 8,
    },
    progressArea: {
        marginTop: 8,
    },
    track: {
        height: 4,
        borderRadius: 2,
        overflow: "hidden",
    },
    fill: {
        height: 4,
        borderRadius: 2,
    },
    progressText: {
        marginTop: 4,
    },
    statusText: {
        marginTop: 4,
    },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        marginTop: 12,
    },
});
