import "react-native-get-random-values";

import { showDialog } from "@/components/dialogs/useDialog.ts";
import { emptyFunction } from "@/constants/commonConst";
import pathConst from "@/constants/pathConst";
import Config from "@/core/appConfig";
import pluginReliability from "@/core/pluginReliability";
import PluginManager from "@/core/pluginManager";
import Theme from "@/core/theme";
import NativeUtils from "@/native/utils";
import { checkAndCreateDir } from "@/utils/fileUtils";
import { errorLog, trace } from "@/utils/log";
import { perfLogger } from "@/utils/perfLogger";
import PersistStatus from "@/utils/persistStatus";
import Toast from "@/utils/toast";
import * as SplashScreen from "expo-splash-screen";
import { Linking, Platform } from "react-native";
import { check, request, PERMISSIONS } from "react-native-permissions";
import i18n from "@/core/i18n";
import bootstrapAtom from "./bootstrap.atom";
import { getDefaultStore } from "jotai";

// 依赖管理：独立 App「源鉴」只注入插件引擎所需依赖
PluginManager.injectDependencies(Config);

async function bootstrapImpl() {
    await SplashScreen.preventAutoHideAsync()
        .then(result =>
            console.log(
                `SplashScreen.preventAutoHideAsync() succeeded: ${result}`,
            ),
        )
        .catch(console.warn);
    const logger = perfLogger();

    // 1. 检查权限
    if (Platform.OS === "android" && Platform.Version >= 30) {
        const hasPermission = await NativeUtils.checkStoragePermission();
        if (!hasPermission && !PersistStatus.get("app.skipBootstrapStorageDialog")) {
            showDialog("CheckStorage");
        }
    } else {
        const [readStoragePermission, writeStoragePermission] =
            await Promise.all([
                check(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE),
                check(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE),
            ]);
        if (
            !(
                readStoragePermission === "granted" &&
                writeStoragePermission === "granted"
            )
        ) {
            await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
            await request(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
        }
    }
    logger.mark("权限检查完成");

    // 2. 数据目录初始化
    await setupFolder();
    trace("文件夹初始化完成");
    logger.mark("文件夹初始化完成");

    // 3. 配置加载
    await Config.setup();
    logger.mark("Config 初始化完成");

    // 4. 插件引擎加载（音源探测的对象）
    await PluginManager.setup();
    logger.mark("插件初始化完成");
    trace("插件初始化完成");

    await pluginReliability.setup();
    await pluginReliability.setupRecommend();
    trace("音源可用率统计初始化完成");

    Theme.setup();
    trace("主题初始化完成");
    logger.mark("主题初始化完成");

    i18n.setup();
    logger.mark("语言模块初始化完成");

    ErrorUtils.setGlobalHandler(error => {
        errorLog("未捕获的错误", error);
    });
}

/** 初始化目录 */
async function setupFolder() {
    await Promise.all([
        checkAndCreateDir(pathConst.dataPath),
        checkAndCreateDir(pathConst.logPath),
        checkAndCreateDir(pathConst.cachePath),
        checkAndCreateDir(pathConst.pluginPath),
    ]);
}

/** 不需要阻塞的 */
async function extraMakeup() {
    // 自动更新音源订阅（默认开启：未显式设置视为开，仅显式关闭才停）
    try {
        if (Config.getConfig("basic.autoUpdatePlugin") !== false) {
            const lastUpdated = PersistStatus.get("app.pluginUpdateTime") || 0;
            const now = Date.now();
            if (Math.abs(now - lastUpdated) > 86400000) {
                PersistStatus.set("app.pluginUpdateTime", now);
                // 按订阅清单增量更新音源：解析清单 + name/version 对比 + 限并发下载（失败静默）
                await PluginManager.updatePluginsFromSubscription();
            }
        }
    } catch { }

    // 插件安装深链（与主软件同协议，便于从网页/分享链接直接安装音源）
    async function handleLinkingUrl(url: string) {
        try {
            if (url.startsWith("musicfree://install/")) {
                const plugins = url
                    .slice(20)
                    .split(",")
                    .map(decodeURIComponent);
                await Promise.all(
                    plugins.map(it =>
                        PluginManager.installPluginFromUrl(it).catch(emptyFunction),
                    ),
                );
                Toast.success(i18n.t("toast.pluginInstallSuccess"));
            } else if (url.endsWith(".js")) {
                PluginManager.installPluginFromLocalFile(url, {
                    notCheckVersion: Config.getConfig(
                        "basic.notCheckPluginVersion",
                    ),
                })
                    .then(res => {
                        if (res.success) {
                            Toast.success(
                                i18n.t("toast.pluginInstallSuccessNamed", {
                                    name: res.pluginName,
                                }),
                            );
                        } else {
                            Toast.warn(
                                i18n.t("toast.pluginInstallFail", {
                                    message: res.message,
                                }),
                            );
                        }
                    })
                    .catch(e => {
                        console.log(e);
                        Toast.warn(e?.message ?? i18n.t("toast.unknownPlugin"));
                    });
            }
        } catch { }
    }

    // 开启监听
    Linking.addEventListener("url", data => {
        if (data.url) {
            handleLinkingUrl(data.url);
        }
    });
    const initUrl = await Linking.getInitialURL();
    if (initUrl) {
        handleLinkingUrl(initUrl);
    }
}

export default async function () {
    try {
        getDefaultStore().set(bootstrapAtom, {
            "state": "Loading",
        });
        await bootstrapImpl();
        extraMakeup();
        getDefaultStore().set(bootstrapAtom, {
            "state": "Done",
        });
    } catch (e: any) {
        errorLog("初始化出错", e);
        if (getDefaultStore().get(bootstrapAtom).state === "Loading") {
            getDefaultStore().set(bootstrapAtom, {
                state: "Fatal",
                reason: e,
            });
        }
    }
    // 隐藏开屏动画
    console.log("HIDE");
    await SplashScreen.hideAsync();
}
