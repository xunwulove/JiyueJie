import React, { useState } from "react";
import {
    ActivityIndicator,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import globalStyle from "@/constants/globalStyle";
import AppBar from "@/components/base/appBar";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import ThemeSwitch from "@/components/base/switch";
import Input from "@/components/base/input";
import { ListDivider } from "@/components/base/divider";
import useColors from "@/hooks/useColors";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import { showDialog, hideDialog } from "@/components/dialogs/useDialog";
import Toast from "@/utils/toast";
import LocalMusicSheet from "@/core/localMusicSheet";
import {
    defaultScanFolders,
    getScanSettings,
    updateScanSettings,
} from "@/core/scanSettings";

/**
 * 扫描设置页（媒体来源） - 复刻 APlayer ScanSettingsPage：
 * 开始扫描 / 使用 Android 媒体库 / 自定义文件夹（选目录）/ 管理外部存储权限 /
 * 不扫描 60 秒以下音频 / 被屏蔽的文件夹（输入或选目录）/ 并集说明
 */
export default function ScanSettings() {
    const colors = useColors();
    const [settings, setSettings] = useState<any>(null);
    const [scanning, setScanning] = useState(false);
    /** 被屏蔽文件夹输入弹窗的文本（组件级状态，选择文件夹后回弹不丢失） */
    const [blockedInput, setBlockedInput] = useState("");

    // 首次加载持久化设置
    React.useEffect(() => {
        getScanSettings().then(setSettings);
    }, []);

    const patch = (p: Record<string, any>) => {
        const next = { ...settings, ...p };
        setSettings(next);
        updateScanSettings(p);
    };

    const onScan = async () => {
        if (!settings || scanning) {
            return;
        }
        setScanning(true);
        try {
            const folders: string[] = [];
            if (settings.useMediaLibrary) {
                folders.push(...defaultScanFolders());
            }
            // 自定义文件夹：有路径即启用（无独立开关）
            folders.push(...(settings.customFolders ?? []));
            if (!folders.length) {
                Toast.warn("请先启用媒体库或添加自定义文件夹");
                return;
            }
            const count = await LocalMusicSheet.importLocal(folders);
            Toast.success(`扫描完成，共 ${count} 首歌曲`);
        } catch {
            Toast.warn("扫描失败");
        } finally {
            setScanning(false);
        }
    };

    /** 选择文件夹并写入（三级浮窗，对齐 Level3Dialog 交互） */
    const pickFolder = (key: "customFolders" | "blockedFolders") => {
        showDialog("FileSelectorDialog", {
            fileType: "folder",
            multi: false,
            actionText: "添加",
            async onAction(selectedFiles) {
                const path = selectedFiles[0]?.path;
                if (path) {
                    const list = settings[key] ?? [];
                    if (!list.includes(path)) {
                        patch({ [key]: [...list, path] });
                    }
                }
                return true;
            },
        });
    };

    const removeItem = (key: "customFolders" | "blockedFolders", path: string) => {
        patch({ [key]: (settings[key] ?? []).filter((_: string) => _ !== path) });
    };

    /** 添加被屏蔽的文件夹（输入路径或选择文件夹；选择器与输入弹窗互斥，返回/取消均回弹输入弹窗） */
    const showAddBlockedDialog = () => {
        showDialog("SimpleDialog", {
            title: "添加被屏蔽的文件夹",
            content: (
                <View>
                    <Input
                        placeholder="例如 /storage/emulated/0/Download"
                        value={blockedInput}
                        onChangeText={setBlockedInput}
                        style={styles.dialogInput}
                    />
                    <AddRow
                        title="选择文件夹"
                        onPress={() => {
                            // 先关输入弹窗，再开文件选择器（避免双浮窗叠加）
                            hideDialog();
                            showDialog("FileSelectorDialog", {
                                fileType: "folder",
                                multi: false,
                                actionText: "添加",
                                // 取消/返回退出：回弹输入弹窗（保留已输入文本）
                                onCancel() {
                                    setTimeout(() => {
                                        showAddBlockedDialog();
                                    }, 0);
                                },
                                async onAction(selectedFiles) {
                                    const path = selectedFiles[0]?.path;
                                    if (path) {
                                        const list =
                                            settings.blockedFolders ?? [];
                                        if (!list.includes(path)) {
                                            patch({
                                                blockedFolders: [
                                                    ...list,
                                                    path,
                                                ],
                                            });
                                        }
                                    }
                                    // 选完回弹输入弹窗
                                    setTimeout(() => {
                                        showAddBlockedDialog();
                                    }, 0);
                                    return true;
                                },
                            });
                        }}
                        compact
                    />
                </View>
            ),
            okText: "添加",
            onOk() {
                if (blockedInput.trim()) {
                    const list = settings.blockedFolders ?? [];
                    if (!list.includes(blockedInput.trim())) {
                        patch({
                            blockedFolders: [...list, blockedInput.trim()],
                        });
                    }
                    setBlockedInput("");
                }
            },
        });
    };

    if (!settings) {
        return (
            <>
                <AppBar>媒体来源</AppBar>
                <View style={globalStyle.flex1} />
            </>
        );
    }

    return (
        <View style={[globalStyle.flex1, { backgroundColor: "transparent" }]}>
            <AppBar>媒体来源</AppBar>
            <ScrollView
                style={globalStyle.flex1}
                contentContainerStyle={styles.content}>
                {/* ===== 开始扫描 ===== */}
                <Pressable onPress={onScan}>
                    <LinearGradient
                        colors={[
                            Color(colors.primary).alpha(0.14).toString(),
                            Color(colors.primary).alpha(0.04).toString(),
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.scanCard}>
                        <Icon
                            name="arrow-path"
                            size={22}
                            color={colors.primary}
                        />
                        <View style={styles.scanTextWrap}>
                            <ThemeText fontSize="content" fontWeight="bold">
                                开始扫描
                            </ThemeText>
                            <ThemeText
                                fontSize="description"
                                fontColor="textSecondary"
                                style={styles.scanSubtitle}>
                                {scanning
                                    ? "正在扫描本地音乐…"
                                    : "扫描设备中的音乐文件"}
                            </ThemeText>
                        </View>
                        {scanning ? (
                            <ActivityIndicator
                                size="small"
                                color={colors.primary}
                            />
                        ) : null}
                    </LinearGradient>
                </Pressable>

                {/* ===== 媒体库（卡片式分组，对齐设置页/备份管理） ===== */}
                <View style={styles.group}>
                    <View style={styles.groupHeader}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="primary"
                            fontWeight="bold">
                            媒体库
                        </ThemeText>
                    </View>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <SettingSwitchRow
                            icon="folder-music-outline"
                            title="使用 Android 媒体库"
                            checked={settings.useMediaLibrary}
                            onCheckedChange={v =>
                                patch({ useMediaLibrary: v })
                            }
                        />
                        <ListDivider marginLeft={16} />
                        {settings.customFolders?.map((path: string) => (
                            <FolderRow
                                key={path}
                                path={path}
                                onRemove={() =>
                                    removeItem("customFolders", path)
                                }
                            />
                        ))}
                        {settings.customFolders?.length ? (
                            <ListDivider marginLeft={16} />
                        ) : null}
                        <AddRow
                            title="添加自定义文件夹"
                            onPress={() => pickFolder("customFolders")}
                        />
                    </View>
                </View>

                {/* ===== 设置（卡片式分组） ===== */}
                <View style={styles.group}>
                    <View style={styles.groupHeader}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="primary"
                            fontWeight="bold">
                            设置
                        </ThemeText>
                    </View>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        <Pressable
                            style={styles.permissionRow}
                            onPress={() => Linking.openSettings()}>
                            <Icon
                                name="shield-keyhole-outline"
                                size={20}
                                color={colors.primary}
                            />
                            <ThemeText
                                fontSize="content"
                                fontWeight="medium"
                                style={styles.permissionTitle}>
                                管理外部存储权限
                            </ThemeText>
                        </Pressable>
                        <ListDivider marginLeft={16} />
                        <SettingSwitchRow
                            icon="arrow-path"
                            title="不扫描 60 秒以下音频"
                            subtitle="跳过时长不足 1 分钟的音频"
                            checked={settings.minDuration}
                            onCheckedChange={v =>
                                patch({ minDuration: v })
                            }
                        />
                    </View>
                </View>

                {/* ===== 被屏蔽的文件夹（卡片式分组） ===== */}
                <View style={styles.group}>
                    <View style={styles.groupHeader}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="primary"
                            fontWeight="bold">
                            被屏蔽的文件夹
                        </ThemeText>
                    </View>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        {settings.blockedFolders?.map((path: string) => (
                            <FolderRow
                                key={path}
                                path={path}
                                onRemove={() =>
                                    removeItem("blockedFolders", path)
                                }
                            />
                        ))}
                        {settings.blockedFolders?.length ? (
                            <ListDivider marginLeft={16} />
                        ) : null}
                        <AddRow
                            title="添加被屏蔽的文件夹"
                            onPress={showAddBlockedDialog}
                        />
                    </View>
                </View>

                {/* ===== 说明 ===== */}
                <ThemeText
                    fontSize="caption"
                    fontColor="textSecondary"
                    opacity={0.7}
                    style={styles.note}>
                    若使用自定义文件夹功能的同时开启了使用 Android 媒体库功能，
                    那么最终扫描到的歌曲为二者并集。如果仅需使用自定义文件夹请关闭使用
                    Android 媒体库功能。
                </ThemeText>
            </ScrollView>
        </View>
    );
}

/** 开关设置行（对齐设置行标题 content 16/medium：20 图标 primary + 标题 16 + 可选副标题 12 + Switch） */
function SettingSwitchRow(props: {
    icon: any;
    title: string;
    subtitle?: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
}) {
    const { icon, title, subtitle, checked, onCheckedChange } = props;
    const colors = useColors();
    return (
        <View style={styles.switchRow}>
            <Icon name={icon} size={20} color={colors.primary} />
            <View style={styles.switchTextWrap}>
                <ThemeText fontSize="content" fontWeight="medium">
                    {title}
                </ThemeText>
                {subtitle ? (
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary">
                        {subtitle}
                    </ThemeText>
                ) : null}
            </View>
            <ThemeSwitch value={checked} onValueChange={onCheckedChange} />
        </View>
    );
}

/** 添加行（与"管理外部存储权限"行格式一致：20 图标 primary + 标题 16 medium 正文色 + 右箭头） */
function AddRow({
    title,
    onPress,
    compact,
}: {
    title: string;
    onPress: () => void;
    compact?: boolean;
}) {
    const colors = useColors();
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.addRow,
                compact ? styles.addRowCompact : null,
            ]}>
            <Icon
                name="folder-plus"
                size={20}
                color={colors.primary}
            />
            <ThemeText
                fontSize="content"
                fontWeight="medium"
                style={styles.addText}>
                {title}
            </ThemeText>
        </Pressable>
    );
}

/** 文件夹行（对齐 APlayer：13sp onSurfaceVariant + Clear 16 移除） */
function FolderRow({
    path,
    onRemove,
}: {
    path: string;
    onRemove: () => void;
}) {
    const colors = useColors();
    return (
        <View style={styles.folderRow}>
            <Icon
                name="folder-outline"
                size={16}
                color={colors.textSecondary}
            />
            <ThemeText
                fontSize="content"
                fontColor="textSecondary"
                numberOfLines={1}
                style={styles.folderPath}>
                {path}
            </ThemeText>
            <Pressable onPress={onRemove}>
                <Icon
                    name="x-mark"
                    size={16}
                    color={
                        colors.textSecondary
                            ? Color(colors.textSecondary)
                                  .alpha(0.5)
                                  .toString()
                            : undefined
                    }
                />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 24,
    },
    /* 卡片式分组（对齐设置页/备份管理 backupSetting）：分组标题在外，行收进圆角卡片 */
    group: {
        marginTop: 8,
    },
    groupHeader: {
        paddingHorizontal: 16,
        height: 36,
        flexDirection: "row",
        alignItems: "center",
    },
    card: {
        marginHorizontal: 24,
        borderRadius: 14,
        overflow: "hidden",
    },
    scanCard: {
        width: "100%",
        marginHorizontal: 16, // content 无水平 padding（卡片分组自留边距），扫描卡单独保持 16
        borderRadius: 14,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    scanTextWrap: {
        flex: 1,
        marginLeft: 12,
    },
    scanSubtitle: {
        marginTop: 2,
    },
    switchRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    switchTextWrap: {
        flex: 1,
        marginLeft: 16,
    },
    permissionRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    permissionTitle: {
        flex: 1,
        marginLeft: 16,
    },
    folderRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10, // 与 addRow/permissionRow 垂直间距一致，保证同级行高统一
    },
    addRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10, // 与 permissionRow 行距一致
    },
    addRowCompact: {
        paddingTop: 8,
    },
    addText: {
        flex: 1,
        marginLeft: 16, // 与 permissionTitle 一致
    },
    folderPath: {
        flex: 1,
        marginLeft: 16, // 对齐 permissionTitle 文本起点
    },
    note: {
        marginTop: 16,
        lineHeight: 18,
    },
    dialogInput: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(128,128,128,0.3)",
    },
});
