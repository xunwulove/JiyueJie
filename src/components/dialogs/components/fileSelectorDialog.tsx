import Icon from "@/components/base/icon.tsx";
import Loading from "@/components/base/loading";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import { iconSizeConst } from "@/constants/uiConst";
import { useI18N } from "@/core/i18n";
import {
    ExternalStorageDirectoryPath,
    exists,
    getAllExternalFilesDirs,
    readDir,
} from "react-native-fs";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

import Dialog from "./base";
import { hideDialog } from "../useDialog";

interface IPathItem {
    path: string;
    parent: null | IPathItem;
}

interface IFileItem {
    path: string;
    type: "file" | "folder";
}

interface IFileSelectorDialogProps {
    fileType?: "file" | "folder" | "file-and-folder";
    multi?: boolean;
    actionText?: string;
    matchExtension?: (path: string) => boolean;
    /** 返回 true 表示处理完成，浮窗关闭 */
    onAction?: (selectedFiles: IFileItem[]) => boolean | Promise<boolean>;
    /** 取消/返回退出时的回调（如重开上游浮窗）；不传则仅关闭 */
    onCancel?: () => void;
}

/**
 * 文件夹/文件选择器 - 三级浮窗（对话框体系：居中缩放 + 渐变标题行 + 底部等高同渐变按钮行）。
 * 对齐旧 APlayer Level3Dialog 的文件选择交互：
 * - 目录行点击进入下一级（列表就地替换，不叠加新层）；返回手势逐级回退，回到根后关闭浮窗
 * - folder 单选：底部按钮确认"当前所在目录"（下载目录/扫描目录/备份目录）
 * - 多选：长按文件夹行勾选；file 行点击勾选
 */
export default function FileSelectorDialog(props: IFileSelectorDialogProps) {
    const { t } = useI18N();
    const colors = useColors();
    const {
        fileType = "folder",
        multi = false,
        actionText,
        matchExtension,
        onAction,
        onCancel,
    } = props ?? {};

    const [currentPath, setCurrentPath] = useState<IPathItem>({
        path: "/",
        parent: null,
    });
    const currentPathRef = useRef<IPathItem>(currentPath);
    const [filesData, setFilesData] = useState<IFileItem[]>([]);
    const [checkedItems, setCheckedItems] = useState<IFileItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        currentPathRef.current = currentPath;
    }, [currentPath]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                if (currentPath.path === "/") {
                    try {
                        const allExt = await getAllExternalFilesDirs();
                        if (allExt.length > 1) {
                            const sdCardPaths = allExt.map(sdp =>
                                sdp.substring(0, sdp.indexOf("/Android")),
                            );
                            if (
                                (
                                    await Promise.all(
                                        sdCardPaths.map(_ => exists(_)),
                                    )
                                ).every(val => val)
                            ) {
                                setFilesData(
                                    sdCardPaths.map(_ => ({
                                        type: "folder",
                                        path: _,
                                    })),
                                );
                            }
                        } else {
                            setCurrentPath({
                                path: ExternalStorageDirectoryPath,
                                parent: null,
                            });
                            return;
                        }
                    } catch {
                        setCurrentPath({
                            path: ExternalStorageDirectoryPath,
                            parent: null,
                        });
                        return;
                    }
                } else {
                    const res = (await readDir(currentPath.path)) ?? [];
                    let folders: IFileItem[] = [];
                    let files: IFileItem[] = [];
                    if (
                        fileType === "folder" ||
                        fileType === "file-and-folder"
                    ) {
                        folders = res
                            .filter(_ => _.isDirectory())
                            .map(_ => ({
                                type: "folder",
                                path: _.path,
                            }));
                    }
                    if (
                        fileType === "file" ||
                        fileType === "file-and-folder"
                    ) {
                        files = res
                            .filter(
                                _ =>
                                    _.isFile() &&
                                    (matchExtension
                                        ? matchExtension(_.path)
                                        : true),
                            )
                            .map(_ => ({
                                type: "file",
                                path: _.path,
                            }));
                    }
                    setFilesData([...folders, ...files]);
                }
            } catch {
                setFilesData([]);
            }
            setLoading(false);
        })();
    }, [currentPath.path]);

    /** 返回手势：目录内逐级回退，回到根目录则关闭浮窗（可回调恢复上游浮窗） */
    const onBackPress = useCallback(() => {
        const _currentPath = currentPathRef.current;
        if (_currentPath.parent !== null) {
            setCurrentPath(_currentPath.parent);
            return true;
        }
        onCancel?.();
        hideDialog();
        return true;
    }, [onCancel]);

    /** 底部取消：回调恢复上游浮窗后关闭 */
    const cancel = useCallback(() => {
        onCancel?.();
        hideDialog();
    }, [onCancel]);

    const goUp = useCallback(() => {
        if (currentPathRef.current.parent !== null) {
            setCurrentPath(currentPathRef.current.parent);
        }
    }, []);

    /** 面包屑分段（以当前链的顶层根为根，避免自动跳到存储根后点"/"回到多 SD 列表） */
    const crumbs = useMemo(() => {
        // 沿 parent 链回溯到当前路径的顶层根（多 SD 列表 = "/"；单存储 = ExternalStorageDirectoryPath；子目录 = 对应根）
        let root: IPathItem = currentPath;
        let node: IPathItem | null = currentPath;
        while (node?.parent) {
            root = node.parent;
            node = node.parent;
        }
        const rootPath = root.path;
        if (currentPath.path === rootPath) {
            return [{ label: "/", path: rootPath }];
        }
        const segs = currentPath.path.split("/").filter(Boolean);
        const rootSegs = rootPath.split("/").filter(Boolean);
        const relSegs = segs.slice(rootSegs.length);
        let acc = "";
        const items = [{ label: "/", path: rootPath }];
        relSegs.forEach(seg => {
            acc += "/" + seg;
            items.push({ label: seg, path: rootPath + acc });
        });
        return items;
    }, [currentPath]);

    const toggleCheck = useCallback(
        (item: IFileItem) => {
            if (!multi) {
                setCheckedItems([item]);
                return;
            }
            setCheckedItems(prev =>
                prev.some(_ => _.path === item.path)
                    ? prev.filter(_ => _.path !== item.path)
                    : [...prev, item],
            );
        },
        [multi],
    );

    /** 底部确认 */
    const confirm = useCallback(async () => {
        let selected: IFileItem[];
        if (fileType === "folder" && !multi) {
            // 单选文件夹：确认当前所在目录
            selected = [{ type: "folder", path: currentPathRef.current.path }];
        } else {
            selected = checkedItems;
        }
        if (!selected.length) {
            return;
        }
        const shouldClose = await onAction?.(selected);
        if (shouldClose) {
            hideDialog();
        }
    }, [checkedItems, fileType, multi, onAction]);

    const canConfirm =
        fileType === "folder" && !multi
            ? currentPath.path !== "/"
            : checkedItems.length > 0;

    const actionLabel =
        actionText ?? (fileType === "folder" ? "选择文件夹" : t("common.confirm"));

    const folderName = (path: string) => {
        const segs = path.split("/").filter(Boolean);
        return segs[segs.length - 1] ?? "/";
    };

    return (
        <Dialog
            onDismiss={() => {
                // 遮罩点击与返回键/底部取消行为一致：触发 onCancel（恢复上游浮窗/保留已缓存设置）后关闭
                onCancel?.();
                hideDialog();
            }}
            onBackPress={onBackPress}>
            <Dialog.Title withDivider>{actionLabel}</Dialog.Title>
            <Dialog.Content needScroll>
                <View style={styles.crumbRow}>
                    {currentPath.parent !== null ? (
                        <Pressable
                            hitSlop={8}
                            onPress={goUp}
                            style={styles.crumbUp}>
                            <Icon
                                name="arrow-left"
                                size={iconSizeConst.small}
                                color={colors.textSecondary}
                            />
                        </Pressable>
                    ) : null}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.crumbScroll}
                        contentContainerStyle={styles.crumbContent}>
                        {crumbs.map((crumb, idx) => (
                            <Pressable
                                key={crumb.path + idx}
                                onPress={() => {
                                    if (crumb.path !== currentPath.path) {
                                        setCurrentPath(prev => {
                                            // 以当前链顶层根为起点重建到目标路径的链（点根回根时 parent=null）
                                            let root: IPathItem = prev;
                                            let node: IPathItem | null = prev;
                                            while (node?.parent) {
                                                root = node.parent;
                                                node = node.parent;
                                            }
                                            const rootPath = root.path;
                                            if (crumb.path === rootPath) {
                                                return {
                                                    path: rootPath,
                                                    parent: null,
                                                };
                                            }
                                            const segs = crumb.path
                                                .split("/")
                                                .filter(Boolean);
                                            const rootSegs = rootPath
                                                .split("/")
                                                .filter(Boolean);
                                            const relSegs = segs.slice(
                                                rootSegs.length,
                                            );
                                            let acc = "";
                                            let chain: IPathItem = {
                                                path: rootPath,
                                                parent: null,
                                            };
                                            let cur = chain;
                                            relSegs.forEach(seg => {
                                                acc += "/" + seg;
                                                const next: IPathItem = {
                                                    path: rootPath + acc,
                                                    parent: cur,
                                                };
                                                cur = next;
                                            });
                                            return cur;
                                        });
                                    }
                                }}>
                                <ThemeText
                                    fontSize="description"
                                    fontColor={
                                        crumb.path === currentPath.path
                                            ? "primary"
                                            : "textSecondary"
                                    }>
                                    {idx === crumbs.length - 1
                                        ? crumb.label
                                        : crumb.label + " /"}
                                </ThemeText>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
                {loading ? (
                    <View style={styles.loadingWrap}>
                        <Loading />
                    </View>
                ) : filesData.length === 0 ? (
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.empty}>
                        此目录为空
                    </ThemeText>
                ) : (
                    <View>
                        {filesData.map(item => {
                            const isFolder = item.type === "folder";
                            const checked = checkedItems.some(
                                _ => _.path === item.path,
                            );
                            return (
                                <Pressable
                                    key={item.path}
                                    style={styles.row}
                                    onPress={() => {
                                        if (isFolder) {
                                            setCurrentPath(prev => ({
                                                parent: prev,
                                                path: item.path,
                                            }));
                                        } else {
                                            toggleCheck(item);
                                        }
                                    }}
                                    onLongPress={() => {
                                        if (isFolder && multi) {
                                            toggleCheck(item);
                                        }
                                    }}>
                                    <Icon
                                        name={
                                            isFolder
                                                ? "folder-outline"
                                                : "document-outline"
                                        }
                                        size={iconSizeConst.light}
                                        color={
                                            isFolder
                                                ? colors.primary
                                                : colors.textSecondary
                                        }
                                    />
                                    <View style={styles.rowMain}>
                                        <ThemeText
                                            fontSize="normal"
                                            fontWeight="medium"
                                            numberOfLines={1}>
                                            {folderName(item.path)}
                                        </ThemeText>
                                        <ThemeText
                                            fontSize="caption"
                                            fontColor="textSecondary">
                                            {isFolder ? "文件夹" : "文件"}
                                        </ThemeText>
                                    </View>
                                    {checked ? (
                                        <Icon
                                            name="check-circle"
                                            size={iconSizeConst.light}
                                            color={colors.primary}
                                        />
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress() {
                            cancel();
                        },
                    },
                    {
                        title: actionLabel,
                        type: "primary",
                        show: canConfirm,
                        onPress() {
                            confirm();
                        },
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    crumbRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    crumbUp: {
        marginRight: 8,
        paddingVertical: 4,
    },
    crumbScroll: {
        flex: 1,
    },
    crumbContent: {
        alignItems: "center",
        paddingRight: 12,
    },
    loadingWrap: {
        paddingVertical: 32,
        alignItems: "center",
    },
    empty: {
        paddingVertical: 32,
        textAlign: "center",
    },
    row: {
        height: 48, // 列表行规范 small
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 4,
    },
    rowMain: {
        flex: 1,
        marginLeft: 10,
        marginRight: 8,
    },
});
