import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import IconTextButton from "@/components/base/iconTextButton";

import PluginManager, {
    IPendingLargePlugin,
    useSortedPlugins,
} from "@/core/pluginManager";
import { trace } from "@/utils/log";

import Toast from "@/utils/toast";
import axios from "axios";
import Config from "@/core/appConfig";
import { IAppConfigProperties } from "@/types/core/config";
import Empty from "@/components/base/empty";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import { showDialog } from "@/components/dialogs/useDialog";
import AppBar from "@/components/base/appBar";
import Fab from "@/components/base/fab";
import Input from "@/components/base/input";
import PluginItem from "../components/pluginItem";
import { IIconName } from "@/components/base/icon.tsx";
import { IInstallPluginResult } from "@/types/core/pluginManager";
import { useI18N } from "@/core/i18n";
import useIsTablet from "@/hooks/useIsTablet";
import { DEFAULT_PLUGIN_SUBSCRIPTION_URL } from "@/constants/defaultPluginSubscription";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import PluginInstallProgressDialog, {
    IInstallProgress,
} from "@/components/dialogs/components/pluginInstallProgressDialog";
import probeService from "@/core/probeService";

interface IOption {
    icon: IIconName;
    title: string;
    show?: boolean;
    /** 普通菜单项：点击收起面板并触发 onPress */
    onPress?: () => void;
    /** 开关项：渲染右侧开关，点击不收起面板 */
    type?: "default" | "switch";
    /** 开关配置 key：由 MenuDialog 内部实时订阅（快照 payload 不更新） */
    configKey?: keyof IAppConfigProperties;
    /** 开关默认值（配置未设置时） */
    defaultValue?: boolean;
    value?: boolean;
    onValueChange?: (v: boolean) => void;
}

export default function PluginList() {
    const plugins = useSortedPlugins();
    const { t } = useI18N();
    const isTablet = useIsTablet();
    const colors = useColors();

    const [loading, setLoading] = useState(false);
    // 批量安装进度：{phase:"download"|"mount", done, total, name?}，null 表示无安装任务
    const [installProgress, setInstallProgress] =
        useState<IInstallProgress | null>(null);
    // 音源检测进度：{phase:"probe", done, total, name?}，null 表示无检测任务
    const [probeProgress, setProbeProgress] =
        useState<IInstallProgress | null>(null);
    // 未挂载的大插件（批量安装跳过，列表底部提供手动安装入口；持久化本地）
    const [pendingLarge, setPendingLarge] = useState<IPendingLargePlugin[]>([]);
    // 从网络安装：输入框组件级状态（三级浮窗 SimpleDialog 内，关闭重开不丢失）
    const [networkUrl, setNetworkUrl] = useState("");

    /** 读取持久化的未挂载大插件列表 */
    useEffect(() => {
        PluginManager.getPendingLargePlugins()
            .then(setPendingLarge)
            .catch(() => setPendingLarge([]));
    }, []);

    /** 合并新跳过的大插件（去重）并持久化 */
    function mergePendingLarge(list: IPendingLargePlugin[]) {
        setPendingLarge(prev => {
            const merged = [...prev];
            list.forEach(item => {
                if (!merged.some(p => p.url === item.url)) {
                    merged.push(item);
                }
            });
            PluginManager.savePendingLargePlugins(merged).catch(() => {});
            return merged;
        });
    }

    /** 手动单装大插件：下载+挂载（大混淆插件单次挂载预期 1~2s 冻结，可预期） */
    async function onMountLarge(item: IPendingLargePlugin) {
        if (loading) {
            return;
        }
        setLoading(true);
        setInstallProgress({
            phase: "mount",
            done: 0,
            total: 1,
            name: item.name,
        });
        try {
            const result = await PluginManager.installPluginFromUrl(item.url, {
                notCheckVersion: Config.getConfig(
                    "basic.notCheckPluginVersion",
                ),
            });
            if (result.success) {
                setPendingLarge(prev => {
                    const next = prev.filter(p => p.url !== item.url);
                    PluginManager.savePendingLargePlugins(next).catch(() => {});
                    return next;
                });
                Toast.success(t("toast.installPluginSuccess"));
            } else {
                Toast.warn(
                    t("toast.partialPluginInstallFailedWithReason", {
                        reason: result.message ?? "",
                    }),
                );
            }
        } catch (e: any) {
            Toast.warn(e?.message ?? t("toast.unknownError"));
        }
        setLoading(false);
        setInstallProgress(null);
    }

    // 音源相关配置（与基础设置"音源"分组一致；已迁入三点菜单三级页面）
    // 开关项通过 configKey 由 MenuDialog 内部实时订阅（showDialog payload 是快照，不能依赖外部重渲染）

    const menuOptions: IOption[] = [
        {
            type: "switch",
            icon: "arrow-path",
            title: t("basicSettings.autoUpdatePlugin"),
            configKey: "basic.autoUpdatePlugin",
            defaultValue: true,
        },
        {
            type: "switch",
            icon: "shield-keyhole-outline",
            title: t("basicSettings.notCheckPluginVersion"),
            configKey: "basic.notCheckPluginVersion",
            defaultValue: false,
        },
        {
            type: "switch",
            icon: "moon",
            title: t("basicSettings.lazyLoadPlugin"),
            configKey: "basic.lazyLoadPlugin",
            defaultValue: true,
        },
        {
            type: "switch",
            icon: "strategy",
            title: t("basicSettings.sortPluginByReliability"),
            configKey: "basic.sortPluginByReliability",
            defaultValue: true,
        },
        {
            icon: "share",
            title: "导出全部插件",
            onPress() {
                onExportPluginsClick();
            },
        },
        {
            icon: "trash-outline",
            title: t("pluginSetting.menu.uninstallAll"),
            onPress() {
                showDialog("SimpleDialog", {
                    title: t("pluginSetting.menu.uninstallAll"),
                    content: t("pluginSetting.menu.uninstallAllContent"),
                    async onOk() {
                        setLoading(true);
                        await PluginManager.uninstallAllPlugins();
                        setLoading(false);
                        setInstallProgress(null);
                    },
                });
            },
        },
    ];

    /** 从本地安装插件：三级浮窗文件选择器（与音乐库屏蔽文件夹同款选择器，file 多选 + .js 过滤） */
    async function onInstallFromLocalClick() {
        showDialog("FileSelectorDialog", {
            fileType: "file",
            multi: true,
            actionText: t("pluginSetting.fabOptions.installFromLocal"),
            matchExtension: path => path.toLowerCase().endsWith(".js"),
            async onAction(selectedFiles) {
                try {
                    setLoading(true);
                    for (let i = 0; i < selectedFiles.length; ++i) {
                        setInstallProgress({
                            phase: "mount",
                            done: i,
                            total: selectedFiles.length,
                            name: selectedFiles[i].path?.split("/").pop(),
                        });
                        await PluginManager.installPluginFromLocalFile(
                            selectedFiles[i].path,
                            {
                                notCheckVersion: Config.getConfig(
                                    "basic.notCheckPluginVersion",
                                ),
                            },
                        );
                    }
                    Toast.success(t("toast.installPluginSuccess"));
                } catch (e: any) {
                    trace("插件安装失败", e?.message);
                    Toast.warn(
                        t("toast.installPluginFail", {
                            reason: e?.message ?? "",
                        }),
                    );
                }
                setLoading(false);
                setInstallProgress(null);
                return true;
            },
        });
    }

    /** 从网络安装插件：三级浮窗（SimpleDialog + 输入框），确定后按链接安装 */
    function onInstallFromNetworkClick() {
        showDialog("SimpleDialog", {
            title: t("pluginSetting.menu.installPlugin"),
            content: (
                <View>
                    <Input
                        value={networkUrl}
                        onChangeText={setNetworkUrl}
                        placeholder={t(
                            "pluginSetting.menu.installPluginDialogPlaceholder",
                        )}
                        maxLength={200}
                        style={style.networkUrlInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>
            ),
            okText: t("common.confirm"),
            async onOk() {
                const text = networkUrl.trim();
                if (!text) {
                    Toast.warn(t("toast.needInputPluginUrl"));
                    return;
                }
                setLoading(true);

                const result = await installPluginFromUrl(
                    text,
                    p => setInstallProgress(p),
                );

                // 检查是否全部安装成功
                const successResults: IInstallPluginResult[] = [];
                const failResults: IInstallPluginResult[] = [];
                for (let i = 0; i < result.length; ++i) {
                    if (result[i].success) {
                        successResults.push(result[i]);
                    } else {
                        failResults.push(result[i]);
                    }
                }

                if (!failResults.length) {
                    Toast.success(t("toast.installPluginSuccess"));
                } else {
                    Toast.warn(
                        successResults.length
                            ? t("toast.partialPluginInstallFailed")
                            : t("toast.allPluginInstallFailed"),
                        {
                            type: "warn",
                            actionText: t("common.view"),
                            onActionClick: () => {
                                showDialog("SimpleDialog", {
                                    title: t(
                                        "pluginSetting.menu.pluginInstallFailedDialogTitle",
                                    ),
                                    content: t(
                                        "pluginSetting.pluginInstallFailedDialogContent",
                                        {
                                            detail: failResults
                                                .map(
                                                    it =>
                                                        (it.pluginUrl ??
                                                            "") +
                                                        "\n" +
                                                        t(
                                                            "pluginSetting.failReason",
                                                            {
                                                                reason:
                                                                    it
                                                                        .message ??
                                                                    "",
                                                            },
                                                        ),
                                                )
                                                .join("\n-----\n"),
                                        },
                                    ),
                                });
                            },
                        },
                    );
                }

                setLoading(false);
                setNetworkUrl("");
            },
        });
    }

    async function onSubscribeClick() {
        // 未配置订阅时回退内置默认订阅源（极悦界音源库）
        const urls =
            Config.getConfig("plugin.subscribeUrl") ??
            JSON.stringify([{ url: DEFAULT_PLUGIN_SUBSCRIPTION_URL }]);
        setLoading(true);
        setInstallProgress(null);

        const successResults: IInstallPluginResult[] = [];
        const failResults: IInstallPluginResult[] = [];
        let skippedCount = 0;

        try {
            const urlItems = JSON.parse(urls!);
            if (Array.isArray(urlItems)) {
                // 收集全部订阅清单的插件 URL（去重），统一批量安装（下载并发 + 挂载分批让出）
                const allUrls: string[] = [];
                const noCacheHeaders = {
                    "Cache-Control": "no-cache",
                    Pragma: "no-cache",
                    Expires: "0",
                };
                for (let i = 0; i < urlItems.length; ++i) {
                    const url = urlItems[i]?.url;
                    if (!url) {
                        continue;
                    }
                    try {
                        if (url.endsWith(".json")) {
                            const text = (
                                await axios.get(url, {
                                    headers: noCacheHeaders,
                                })
                            ).data;
                            (text?.plugins ?? []).forEach((p: any) => {
                                if (p?.url) {
                                    allUrls.push(p.url);
                                }
                            });
                        } else {
                            allUrls.push(url);
                        }
                    } catch {
                        // 单条订阅地址拉取失败静默（与其他地址互不影响）
                    }
                }
                const uniqueUrls = [...new Set(allUrls)];
                const { results, skipped } =
                    await PluginManager.installPluginsFromUrls(
                        uniqueUrls,
                        p => setInstallProgress(p),
                        {
                            notCheckVersion: Config.getConfig(
                                "basic.notCheckPluginVersion",
                            ),
                        },
                        false,
                    );
                results.forEach(it => {
                    if (it.success) {
                        successResults.push(it);
                    } else {
                        failResults.push(it);
                    }
                });
                // 跳过的大插件：持久化到列表底部"未挂载"区块
                if (skipped?.length) {
                    skippedCount = skipped.length;
                    mergePendingLarge(skipped);
                }
            } else {
                throw new Error();
            }

            // 汇总弹窗：成功/跳过（大插件）/失败
            if (successResults.length) {
                const failedCount = failResults.length;
                showDialog("SimpleDialog", {
                    title: t("pluginSetting.installSummaryTitle"),
                    content: t("pluginSetting.installSummaryContent", {
                        success: successResults.length,
                        skipped: skippedCount,
                        failed: failedCount,
                    }),
                });
            }

            if (!failResults.length) {
                Toast.success(t("toast.installPluginSuccess"));
            } else {
                Toast.warn((successResults.length ? t("toast.partialPluginInstallFailed") : t("toast.allPluginInstallFailed")), {
                    "type": "warn",
                    "actionText": t("common.view"),
                    "onActionClick": () => {
                        showDialog("SimpleDialog", {
                            title: t("pluginSetting.menu.pluginInstallFailedDialogTitle"),
                            content: t("pluginSetting.pluginInstallFailedDialogContent", {
                                detail: failResults.map(it => (it.pluginUrl ?? "") + "\n" + t("pluginSetting.failReason", {
                                    reason: it.message ?? "",
                                })).join("\n-----\n"),
                            }),
                        });
                    },
                });
            }

        } catch {
            if (urls?.length) {
                const result = await installPluginFromUrl(urls, p => setInstallProgress(p));
                if (result[0]) {
                    if (result[0].success) {
                        Toast.success(t("toast.installPluginSuccess"));
                    } else {
                        Toast.warn(t("toast.partialPluginInstallFailedWithReason", {
                            reason: result[0].message ?? "",
                        }));
                    }
                } else {
                    Toast.warn(t("toast.subscriptionInvalid"));
                }
            }
        }
        setLoading(false);
        setInstallProgress(null);
    }

    async function onUpdateAllClick() {
        const plugins = PluginManager.getEnabledPlugins();
        setLoading(true);

        const successResults: IInstallPluginResult[] = [];
        const failResults: IInstallPluginResult[] = [];

        try {
            for (let i = 0; i < plugins.length; ++i) {
                const srcUrl = plugins[i].instance.srcUrl;
                if (srcUrl) {
                    setInstallProgress({
                        phase: "download",
                        done: i,
                        total: plugins.length,
                        name: plugins[i].name,
                    });
                    const result = await installPluginFromUrl(srcUrl);
                    if (result[0]) {
                        if (result[0].success) {
                            successResults.push(result[0]);
                        } else {
                            failResults.push(result[0]);
                        }
                    }
                }
            }

            if (!failResults.length) {
                Toast.success(t("toast.updatePluginSuccess"));
            } else {
                Toast.warn((successResults.length ? t("toast.partialPluginUpdateFailed") : t("toast.allPluginUpdateFailed")), {
                    "type": "warn",
                    "actionText": t("common.view"),
                    "onActionClick": () => {
                        showDialog("SimpleDialog", {
                            title: t("pluginSetting.menu.pluginUpdateFailedDialogTitle"),
                            content: t("pluginSetting.pluginUpdateFailedDialogContent", {
                                detail: failResults.map(it => (it.pluginUrl ?? "") + "\n" + t("pluginSetting.failReason", {
                                    reason: it.message ?? "",
                                })).join("\n-----\n"),
                            }),
                        });
                    },
                });
            }

        } catch (e: any) {
            Toast.warn(t("toast.unknownError", {
                reason: e?.message ?? e,
            }));
        }
        setLoading(false);
    }

    /**
     * 导出全部插件：生成订阅清单格式的 plugins.json（url + version），
     * 写入缓存目录后调起系统分享面板（微信/文件管理器等）
     */
    async function onExportPluginsClick() {
        const exportList = (plugins ?? [])
            .filter(p => p.instance?.srcUrl)
            .map(p => ({
                url: p.instance.srcUrl,
                version: p.instance.version ?? "",
            }));
        if (!exportList.length) {
            Toast.warn(t("toast.noExportablePlugin"));
            return;
        }
        try {
            const json = JSON.stringify({ plugins: exportList }, null, 2);
            const fileUri = `${
                FileSystem.cacheDirectory ?? ""
            }plugins_export_${Date.now()}.json`;
            await FileSystem.writeAsStringAsync(fileUri, json);
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: "application/json",
                    dialogTitle: "导出插件清单",
                });
            } else {
                Toast.warn(t("toast.shareNotSupported"));
            }
        } catch (e: any) {
            Toast.warn(
                t("toast.exportFail", { reason: e?.message ?? e }),
            );
        }
    }

    return (
        <>
            <AppBar
                actions={[
                    {
                        // 检测音源（主动探测：全量深度验证可播性；串行 60s 预算内完成，
                        // 深度验证为静默网络层 Range 拉取，不打断当前播放；
                        // 进度弹窗三行显示，可点"后台运行"收起、任务继续）
                        icon: "signal",
                        onPress() {
                            const plugins =
                                PluginManager.getSortedSearchablePlugins(
                                    "music",
                                );
                            setProbeProgress({
                                phase: "probe",
                                done: 0,
                                total: plugins.length,
                                name: undefined,
                            });
                            void probeService
                                .probeAllPlugins({
                                    deep: true,
                                    onProgress(done, total, name) {
                                        setProbeProgress({
                                            phase: "probe",
                                            done,
                                            total,
                                            name,
                                        });
                                    },
                                })
                                .then(report => {
                                    setProbeProgress(null);
                                    Toast.success(
                                        `检测完成：可搜索 ${report.searchOk}/${report.total} · 可解析 ${report.parseOk}/${report.total} · 可播放 ${report.playable}/${report.total}`,
                                    );
                                })
                                .catch(() => {
                                    setProbeProgress(null);
                                    Toast.warn(
                                        "音源检测失败，请稍后重试",
                                    );
                                });
                        },
                    },
                    {
                        // 订阅设置（三级浮窗：列表增删 + 更新订阅；必要时三级内再弹三级确认）
                        icon: "link",
                        onPress() {
                            showDialog("SubscriptionSettingDialog", {
                                onUpdateSubscription: onSubscribeClick,
                            });
                        },
                    },
                    {
                        // 三点菜单（三级浮窗：开关项 + 卸载全部）
                        icon: "ellipsis-vertical",
                        onPress() {
                            showDialog("MenuDialog", {
                                title: "音源管理",
                                options: menuOptions,
                            });
                        },
                    },
                ]}>
                音源管理
            </AppBar>
            <HorizontalSafeAreaView style={style.wrapper}>
                <>
                    {loading ? (
                        <PluginInstallProgressDialog
                            progress={installProgress}
                            onClose={() => {
                                setLoading(false);
                            }}
                        />
                    ) : null}
                    {probeProgress ? (
                        <PluginInstallProgressDialog
                            progress={probeProgress}
                            onClose={() => {
                                setProbeProgress(null);
                            }}
                        />
                    ) : null}
                    <FlatList
                        ListEmptyComponent={Empty}
                        ListFooterComponent={
                            <>
                                {pendingLarge.length ? (
                                    <View style={style.largeSection}>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="textSecondary">
                                            {t(
                                                "pluginSetting.largePluginSection",
                                            )}
                                        </ThemeText>
                                        {pendingLarge.map(item => (
                                            <View
                                                key={item.url}
                                                style={[
                                                    style.largeCard,
                                                    {
                                                        backgroundColor:
                                                                colors.card,
                                                    },
                                                ]}>
                                                <View
                                                    style={
                                                        style.largeCardInfo
                                                    }>
                                                    <ThemeText
                                                        fontSize="title"
                                                        numberOfLines={1}>
                                                        {item.name}
                                                    </ThemeText>
                                                    <ThemeText
                                                        fontSize="description"
                                                        fontColor="textSecondary">
                                                        {t(
                                                            "pluginSetting.largePluginSize",
                                                            {
                                                                size: Math.round(
                                                                    item.size /
                                                                            1024,
                                                                ),
                                                            },
                                                        )}
                                                    </ThemeText>
                                                </View>
                                                <IconTextButton
                                                    icon="arrow-down-tray"
                                                    onPress={() =>
                                                        onMountLarge(item)
                                                    }>
                                                    {t(
                                                        "pluginSetting.installLargePlugin",
                                                    )}
                                                </IconTextButton>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
                                <View style={style.blank} />
                            </>
                        }
                        data={plugins ?? []}
                        keyExtractor={_ => _.hash}
                        numColumns={isTablet ? 3 : 1}
                        columnWrapperStyle={
                            isTablet ? style.gridRow : undefined
                        }
                        renderItem={({ item: plugin }) => (
                            <View
                                style={
                                    isTablet
                                        ? style.gridItem
                                        : undefined
                                }>
                                <PluginItem
                                    key={plugin.hash}
                                    plugin={plugin}
                                    style={
                                        isTablet
                                            ? style.gridCard
                                            : undefined
                                    }
                                />
                            </View>
                        )}
                    />

                    <Fab
                        icon="plus"
                        onPress={() => {
                            // 三级浮窗（MenuDialog）：与三点菜单同体系，居中对话框
                            showDialog("MenuDialog", {
                                title: t(
                                    "pluginSetting.menu.installPlugin",
                                ),
                                options: [
                                    {
                                        icon: "folder-outline",
                                        title: t(
                                            "pluginSetting.fabOptions.installFromLocal",
                                        ),
                                        onPress: onInstallFromLocalClick,
                                    },
                                    {
                                        icon: "link",
                                        title: t(
                                            "pluginSetting.fabOptions.installFromNetwork",
                                        ),
                                        onPress: onInstallFromNetworkClick,
                                    },
                                    {
                                        icon: "arrow-path",
                                        title: t(
                                            "pluginSetting.fabOptions.updateAllPlugins",
                                        ),
                                        onPress: onUpdateAllClick,
                                    },
                                ],
                            });
                        }}
                    />
                </>
            </HorizontalSafeAreaView>
        </>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    blank: {
        height: rpx(200),
    },
    /** 平板三列：行容器（左右留边 + 列间距） */
    gridRow: {
        paddingHorizontal: rpx(24),
        columnGap: rpx(12),
    },
    /**
     * 平板三列：每列固定占 1/3 宽。
     * 用固定百分比而非 flex:1 —— 末行不满 3 个时（余 1/2 个），
     * FlatList 不包 columnWrapper，独立渲染的最后一个仍保持 1/3 宽、左对齐，不变形。
     */
    gridItem: {
        width: "33.333%",
    },
    /** 平板双列：卡片紧凑间距（覆盖 PluginItem 默认大间距） */
    gridCard: {
        marginHorizontal: 0,
        marginTop: rpx(16),
    },
    /** 网络安装输入框：底部细分割线（对齐扫描设置弹窗输入框） */
    networkUrlInput: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(128,128,128,0.3)",
    },
    /** 未挂载的大插件区块 */
    largeSection: {
        marginHorizontal: rpx(24),
        marginTop: rpx(28),
        gap: rpx(12),
    },
    largeCard: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        paddingHorizontal: rpx(16),
        paddingVertical: 12,
        gap: rpx(12),
    },
    largeCardInfo: {
        flex: 1,
        gap: rpx(4),
    },
});



async function installPluginFromUrl(
    text: string,
    onProgress?: (p: {
        phase: "download" | "mount";
        done: number;
        total: number;
    }) => void,
): Promise<IInstallPluginResult[]> {
    try {
        let urls: string[] = [];
        const inputUrl = text.trim();
        if (text.endsWith(".json")) {
            const jsonFile = (
                await axios.get(inputUrl, {
                    headers: {
                        "Cache-Control": "no-cache",
                        Pragma: "no-cache",
                        Expires: "0",
                    },
                })
            ).data;
            /**
             * {
             *     plugins: [{
             *          version: xxx,
             *          url: xxx
             *      }]
             * }
             */
            urls = (jsonFile?.plugins ?? []).map((_: any) => _.url);
        } else {
            urls = [inputUrl];
        }
        // 批量安装：下载并发、挂载逐个让出（清单含大量混淆插件时不再打满 JS 线程）
        const { results } = await PluginManager.installPluginsFromUrls(
            urls,
            onProgress,
            {
                notCheckVersion: Config.getConfig(
                    "basic.notCheckPluginVersion",
                ),
            },
        );
        return results;
    } catch (e: any) {
        return [{ success: false, message: e?.message, pluginUrl: text }];
    }
}
