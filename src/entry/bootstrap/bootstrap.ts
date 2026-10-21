import "react-native-get-random-values";

import { getCurrentDialog, showDialog } from "@/components/dialogs/useDialog.ts";
import { ImgAsset } from "@/constants/assetsConst";
import { emptyFunction, localPluginHash, supportLocalMediaType } from "@/constants/commonConst";
import pathConst from "@/constants/pathConst";
import Config from "@/core/appConfig";
import downloader, { DownloadFailReason, DownloaderEvent, initDownloadedList } from "@/core/downloader";
import LocalMusicSheet from "@/core/localMusicSheet";
import pluginReliability from "@/core/pluginReliability";
import lyricManager from "@/core/lyricManager";
import musicHistory from "@/core/musicHistory";
import playEvents from "@/core/playEvents";
import { setupCoverBase } from "@/core/coverBase";
import MusicSheet from "@/core/musicSheet";
import PluginManager from "@/core/pluginManager";
import Theme from "@/core/theme";
import TrackPlayer from "@/core/trackPlayer";
import NativeUtils from "@/native/utils";
import { checkAndCreateDir } from "@/utils/fileUtils";
import { errorLog, trace } from "@/utils/log";
import { IPerfLogger, perfLogger } from "@/utils/perfLogger";
import PersistStatus from "@/utils/persistStatus";
import Toast from "@/utils/toast";
import * as SplashScreen from "expo-splash-screen";
import {  Linking, Platform } from "react-native";
import { PERMISSIONS, check, request } from "react-native-permissions";
import RNTrackPlayer, { AppKilledPlaybackBehavior, Capability } from "react-native-track-player";
import i18n from "@/core/i18n";
import bootstrapAtom from "./bootstrap.atom";
import { getDefaultStore } from "jotai";


// 依赖管理
PluginManager.injectDependencies(Config);
musicHistory.injectDependencies(Config);
TrackPlayer.injectDependencies(Config, musicHistory, PluginManager);
downloader.injectDependencies(Config, PluginManager);
lyricManager.injectDependencies(TrackPlayer, Config, PluginManager);
MusicSheet.injectDependencies(Config);


async function bootstrapImpl() {
    await SplashScreen.preventAutoHideAsync()
        .then(result =>
            console.log(
                `SplashScreen.preventAutoHideAsync() succeeded: ${result}`,
            ),
        )
        .catch(console.warn); // it's good to explicitly catch and inspect any error
    const logger = perfLogger();
    // 1. 检查权限
    // 首次启动（引导页未完成）时由引导页统一引导权限，不弹旧"存储权限"弹窗；
    // 仅引导已完成后权限仍缺失（老用户/跳过后）才补弹
    if (Platform.OS === "android" && Platform.Version >= 30) {
        const hasPermission = await NativeUtils.checkStoragePermission();
        if (
            !hasPermission &&
            !PersistStatus.get("app.skipBootstrapStorageDialog") &&
            PersistStatus.get("app.onboardingDone")
        ) {
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

    // 2. 数据初始化
    /** 初始化路径 */
    await setupFolder();
    trace("文件夹初始化完成");
    logger.mark("文件夹初始化完成");



    // 加载配置
    await Promise.all([
        Config.setup().then(() => {
            logger.mark("Config");
        }),
        MusicSheet.setup().then(() => {
            logger.mark("MusicSheet");
        }),
        musicHistory.setup().then(() => {
            logger.mark("musicHistory");
        }),
        playEvents.setup().then(() => {
            logger.mark("playEvents");
        }),
        Promise.resolve().then(() => {
            setupCoverBase();
            logger.mark("coverBase");
        }),
    ]);
    trace("配置初始化完成");
    logger.mark("配置初始化完成");

    // 加载插件
    await PluginManager.setup();
    logger.mark("插件初始化完成");
    trace("插件初始化完成");

    await initTrackPlayer(logger).catch(err => {
        // 初始化播放器出错，延迟初始化
        const bootstrapState = getDefaultStore().get(bootstrapAtom);

        if (bootstrapState.state === "Loading") {
            getDefaultStore().set(bootstrapAtom, {
                state: "TrackPlayerError",
                reason: err,
            });
        }
    });

    await LocalMusicSheet.setup();
    trace("本地音乐初始化完成");
    logger.mark("本地音乐初始化完成");

    await initDownloadedList();
    trace("已下载列表初始化完成");

    await pluginReliability.setup();
    await pluginReliability.setupRecommend();
    trace("音源可用率统计初始化完成");

    Theme.setup();
    trace("主题初始化完成");
    logger.mark("主题初始化完成");

    extraMakeup();

    i18n.setup();
    logger.mark("语言模块初始化完成");
    
    ErrorUtils.setGlobalHandler(error => {
        errorLog("未捕获的错误", error);
    });
}

/** 初始化 */
async function setupFolder() {
    await Promise.all([
        checkAndCreateDir(pathConst.dataPath),
        checkAndCreateDir(pathConst.logPath),
        checkAndCreateDir(pathConst.cachePath),
        checkAndCreateDir(pathConst.pluginPath),
        checkAndCreateDir(pathConst.lrcCachePath),
        checkAndCreateDir(pathConst.downloadCachePath),
        checkAndCreateDir(pathConst.localLrcPath),
        checkAndCreateDir(pathConst.downloadPath).then(() => {
            checkAndCreateDir(pathConst.downloadMusicPath);
        }),
    ]);
}

export async function initTrackPlayer(logger?: IPerfLogger) {
    try {
        await RNTrackPlayer.setupPlayer({
            maxCacheSize:
                Config.getConfig("basic.maxCacheSize") ?? 1024 * 1024 * 512,
        });
    } catch (e: any) {
        if (
            e?.message !==
            "The player has already been initialized via setupPlayer."
        ) {
            throw e;
        }
    }
    logger?.mark("加载播放器");

    const capabilities = Config.getConfig("basic.showExitOnNotification")
        ? [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.Stop,
        ]
        : [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
        ];
    await RNTrackPlayer.updateOptions({
        icon: ImgAsset.splashIcon,
        progressUpdateEventInterval: 1,
        android: {
            alwaysPauseOnInterruption: true,
            appKilledPlaybackBehavior:
                AppKilledPlaybackBehavior.ContinuePlayback,
        },
        capabilities: capabilities,
        compactCapabilities: capabilities,
        notificationCapabilities: [...capabilities, Capability.SeekTo],
    });
    logger?.mark("播放器初始化完成");
    trace("播放器初始化完成");

    await TrackPlayer.setupTrackPlayer();
    trace("播放列表初始化完成");
    logger?.mark("播放列表初始化完成");

    await lyricManager.setup();

    logger?.mark("歌词初始化完成");
}


/** 不需要阻塞的 */
async function extraMakeup() {
    // 自动更新（默认开启：未显式设置视为开，仅显式关闭才停）
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

    async function handleLinkingUrl(url: string) {
        // 插件
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
            } else if (supportLocalMediaType.some(it => url.endsWith(it))) {
                // 本地播放
                const musicItem = await PluginManager.getByHash(
                    localPluginHash,
                )?.instance?.importMusicItem?.(url);
                console.log(musicItem);
                if (musicItem) {
                    TrackPlayer.play(musicItem);
                }
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

    if (Config.getConfig("basic.autoPlayWhenAppStart")) {
        TrackPlayer.play();
    }
}


function bindEvents() {
    // 下载事件
    downloader.on(DownloaderEvent.DownloadError, (reason) => {
        if (reason === DownloadFailReason.NetworkOffline) {
            Toast.warn(i18n.t("toast.networkOffline"));
        } else if (reason === DownloadFailReason.NotAllowToDownloadInCellular) {
            if (getCurrentDialog()?.name !== "SimpleDialog") {
                showDialog("SimpleDialog", {
                    title: "流量提醒",
                    content: "当前非WIFI环境，为节省流量，请到侧边栏设置中打开【使用移动网络下载】功能后方可继续下载",
                });
            }
        }
    });

    downloader.on(DownloaderEvent.DownloadQueueCompleted, ({ hasError }) => {
        // 2026-10-20 修复：原队列清空无论成败都提示"下载任务已完成"；
        // 现按队列中是否存在失败任务区分提示
        if (hasError) {
            Toast.warn(i18n.t("toast.downloadQueuePartialFail"));
        } else {
            Toast.success(i18n.t("toast.downloadQueueCompleted"));
        }
    });
}

export default async function () {
    try {
        getDefaultStore().set(bootstrapAtom, {
            "state": "Loading",
        });
        await bootstrapImpl();
        bindEvents();
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