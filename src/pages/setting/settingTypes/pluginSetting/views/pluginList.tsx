import React, { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import * as DocumentPicker from "expo-document-picker";
import Loading from "@/components/base/loading";

import PluginManager, { useSortedPlugins } from "@/core/pluginManager";
import { trace } from "@/utils/log";

import Toast from "@/utils/toast";
import axios from "axios";
import { useNavigate, ROUTE_PATH } from "@/core/router";
import Config, { useAppConfig } from "@/core/appConfig";
import Empty from "@/components/base/empty";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import AppBar from "@/components/base/appBar";
import Fab from "@/components/base/fab";
import PluginItem from "../components/pluginItem";
import { IIconName } from "@/components/base/icon.tsx";
import { IInstallPluginResult } from "@/types/core/pluginManager";
import { useI18N } from "@/core/i18n";
import useIsTablet from "@/hooks/useIsTablet";
import { DEFAULT_PLUGIN_SUBSCRIPTION_URL } from "@/constants/defaultPluginSubscription";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

interface IOption {
    icon: IIconName;
    title: string;
    show?: boolean;
    /** 普通菜单项：点击收起面板并触发 onPress */
    onPress?: () => void;
    /** 开关项：渲染右侧开关，点击不收起面板 */
    type?: "default" | "switch";
    value?: boolean;
    onValueChange?: (v: boolean) => void;
}

export default function PluginList() {
    const plugins = useSortedPlugins();
    const { t } = useI18N();
    const isTablet = useIsTablet();

    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    // 音源相关配置（与基础设置"音源"分组一致；已迁入三点菜单三级页面）
    const autoUpdatePlugin = useAppConfig("basic.autoUpdatePlugin");
    const notCheckPluginVersion = useAppConfig("basic.notCheckPluginVersion");
    const lazyLoadPlugin = useAppConfig("basic.lazyLoadPlugin");
    const sortPluginByReliability = useAppConfig("basic.sortPluginByReliability");

    const menuOptions: IOption[] = [
        {
            type: "switch",
            icon: "arrow-path",
            title: t("basicSettings.autoUpdatePlugin"),
            value: autoUpdatePlugin ?? true,
            onValueChange: v => Config.setConfig("basic.autoUpdatePlugin", v),
        },
        {
            type: "switch",
            icon: "shield-keyhole-outline",
            title: t("basicSettings.notCheckPluginVersion"),
            value: notCheckPluginVersion ?? false,
            onValueChange: v =>
                Config.setConfig("basic.notCheckPluginVersion", v),
        },
        {
            type: "switch",
            icon: "moon",
            title: t("basicSettings.lazyLoadPlugin"),
            value: lazyLoadPlugin ?? false,
            onValueChange: v => Config.setConfig("basic.lazyLoadPlugin", v),
        },
        {
            type: "switch",
            icon: "strategy",
            title: t("basicSettings.sortPluginByReliability"),
            value: sortPluginByReliability ?? true,
            onValueChange: v =>
                Config.setConfig("basic.sortPluginByReliability", v),
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
                    },
                });
            },
        },
    ];

    async function onInstallFromLocalClick() {
        try {
            const results = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                multiple: true,
                type: ["application/javascript", "text/javascript"],
            });
            if (results.canceled) {
                // 用户取消
                return;
            }
            setLoading(true);

            await Promise.all(
                results.assets.map(async it => {
                    await PluginManager.installPluginFromLocalFile(it.uri, {
                        notCheckVersion: Config.getConfig(
                            "basic.notCheckPluginVersion",
                        ),
                        useExpoFs: true,
                    });
                }),
            );
            // 初步过滤

            Toast.success(t("toast.installPluginSuccess"));
        } catch (e: any) {
            trace("插件安装失败", e?.message);
            Toast.warn(t("toast.installPluginFail", {
                reason: e?.message ?? "",
            }));
        }
        setLoading(false);
    }

    async function onInstallFromNetworkClick() {
        showPanel("SimpleInput", {
            title: t("pluginSetting.menu.installPlugin"),
            placeholder: t("pluginSetting.menu.installPluginDialogPlaceholder"),
            maxLength: 200,
            async onOk(text, closePanel) {
                setLoading(true);
                closePanel();

                const result = await installPluginFromUrl(text.trim());

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
                    Toast.warn(successResults.length ? t("toast.partialPluginInstallFailed") : t("toast.allPluginInstallFailed"), {
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


                setLoading(false);
            },
        });
    }

    async function onSubscribeClick() {
        // 未配置订阅时回退内置默认订阅源（极悦界音源库）
        const urls =
            Config.getConfig("plugin.subscribeUrl") ??
            JSON.stringify([{ url: DEFAULT_PLUGIN_SUBSCRIPTION_URL }]);
        setLoading(true);

        const successResults: IInstallPluginResult[] = [];
        const failResults: IInstallPluginResult[] = [];

        try {
            const urlItems = JSON.parse(urls!);
            if (Array.isArray(urlItems)) {
                for (let i = 0; i < urlItems.length; ++i) {
                    const result = await installPluginFromUrl(urlItems[i].url);
                    if (result[0]) {
                        if (result[0].success) {
                            successResults.push(result[0]);
                        } else {
                            failResults.push(result[0]);
                        }
                    }
                }
            } else {
                throw new Error();
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
                const result = await installPluginFromUrl(urls);
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
            Toast.warn("没有可导出的插件（仅支持导出有来源 URL 的插件）");
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
                Toast.warn("当前设备不支持系统分享，无法导出");
            }
        } catch (e: any) {
            Toast.warn(`导出失败：${e?.message ?? e}`);
        }
    }

    return (
        <>
            <AppBar
                actions={[
                    {
                        // 排序
                        icon: "sort-outline",
                        onPress() {
                            navigate(ROUTE_PATH.PLUGIN_SORT);
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
                        <Loading />
                    ) : (
                        <FlatList
                            ListEmptyComponent={Empty}
                            ListFooterComponent={<View style={style.blank} />}
                            data={plugins ?? []}
                            keyExtractor={_ => _.hash}
                            numColumns={isTablet ? 2 : 1}
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
                    )}

                    <Fab
                        icon="plus"
                        onPress={() => {
                            showPanel("SimpleSelect", {
                                header: t("pluginSetting.menu.installPlugin"),
                                candidates: [
                                    {
                                        value: "从本地安装插件",
                                        title: t("pluginSetting.fabOptions.installFromLocal"),
                                    },
                                    {
                                        value: "从网络安装插件",
                                        title: t("pluginSetting.fabOptions.installFromNetwork"),
                                    },
                                    {
                                        value: "更新全部插件",
                                        title: t("pluginSetting.fabOptions.updateAllPlugins"),
                                    },
                                ],
                                onPress(item) {
                                    if (item.value === "从本地安装插件") {
                                        onInstallFromLocalClick();
                                    } else if (
                                        item.value === "从网络安装插件"
                                    ) {
                                        onInstallFromNetworkClick();
                                    } else if (item.value === "更新全部插件") {
                                        onUpdateAllClick();
                                    }
                                },
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
    /** 平板双列：行容器（左右留边 + 列间距） */
    gridRow: {
        paddingHorizontal: rpx(24),
        columnGap: rpx(12),
    },
    /** 平板双列：每列占 50% */
    gridItem: {
        flex: 1,
    },
    /** 平板双列：卡片紧凑间距（覆盖 PluginItem 默认大间距） */
    gridCard: {
        marginHorizontal: 0,
        marginTop: rpx(16),
    },
});



async function installPluginFromUrl(text: string): Promise<IInstallPluginResult[]> {
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
        return await Promise.all(
            urls.map(url =>
                PluginManager.installPluginFromUrl(url, {
                    notCheckVersion: Config.getConfig(
                        "basic.notCheckPluginVersion",
                    ),
                }),
            ),
        );
    } catch (e: any) {
        return [{ success: false, message: e?.message, pluginUrl: text }];
    }
}
