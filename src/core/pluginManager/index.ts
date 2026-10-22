import {
    emptyFunction,
    localPluginHash,
    localPluginPlatform,
} from "@/constants/commonConst";
import pathConst from "@/constants/pathConst";
import { DEFAULT_PLUGIN_SUBSCRIPTION_URL } from "@/constants/defaultPluginSubscription";
import {
    IInstallPluginConfig,
    IInstallPluginResult,
    IPluginManager,
} from "@/types/core/pluginManager";
import { removeAllMediaExtra } from "@/utils/mediaExtra";
import axios from "axios";
import { compare } from "compare-versions";
import EventEmitter from "eventemitter3";
import { readAsStringAsync } from "expo-file-system";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { copyFile, readDir, readFile, unlink, writeFile } from "react-native-fs";
import { showToast } from "@/components/base/toast";
import { devLog, errorLog, trace } from "../../utils/log";
import pluginMeta from "./meta";
import { localFilePlugin, Plugin, PluginState } from "./plugin";
import i18n from "../i18n";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { safeParse } from "@/utils/jsonUtil";
import { IInjectable } from "@/types/infra";
import { IAppConfig } from "@/types/core/config";
import delay from "@/utils/delay";
import pluginReliability from "../pluginReliability";

const pluginsAtom = atom<Plugin[]>([]);
const pluginCacheStore = getOrCreateMMKV("plugin.cache");
/** 未挂载大插件列表的持久化 key（批量安装跳过 >300KB 混淆插件，列表底部手动安装） */
const PENDING_LARGE_KEY = "pendingLargePlugins";

/**
 * 自动更新音源的并发下载上限。
 * 增量对比后待下载量通常很小（仅新增/更新的插件）；即使首次全量（100 个），
 * 10 并发也远低于 98 全并发，避免触发 gitee 反爬（历史有 403 风控记录）。
 */
const PLUGIN_UPDATE_CONCURRENCY = 10;

/**
 * 大混淆插件体积阈值（字符数近似字节）。
 * jsjiami 系插件在 Hermes（解释器）上同步求值开销约为 V8 的 5~20 倍，
 * 450KB+ 单文件单个挂载即可把 JS 线程占死 1~2s；批量串行时累加成界面假死。
 * 超过该阈值的插件默认跳过自动挂载（skipped），改为列表底部手动安装。
 */
export const PLUGIN_SIZE_LIMIT = 300 * 1024;

/** 被跳过的"大插件"：供 UI 在列表底部渲染"未挂载"条目与手动安装入口 */
export interface IPendingLargePlugin {
    url: string;
    name: string;
    /** 插件代码字节数（近似） */
    size: number;
}

/** 限并发执行异步任务：固定 worker 数，按序取任务（失败由任务自身处理） */
async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    task: (item: T) => Promise<void>,
): Promise<void> {
    let index = 0;
    const workerCount = Math.min(limit, items.length);
    const workers = Array.from({ length: workerCount }, async () => {
        while (index < items.length) {
            const i = index++;
            await task(items[i]);
        }
    });
    await Promise.all(workers);
}

const ee = new EventEmitter<{
    "order-updated": () => void;
    "enabled-updated": (pluginName: string, enabled: boolean) => void;
}>();

class PluginManager implements IPluginManager, IInjectable {
    private appConfigService!: IAppConfig;

    injectDependencies(config: IAppConfig): void {
        this.appConfigService = config;
    }

    /**
     * 获取当前存储的插件列表
     * @returns 插件实例数组
     */
    private getPlugins() {
        return getDefaultStore().get(pluginsAtom);
    }

    /**
     * 更新存储中的插件列表
     * @param plugins - 要设置的插件实例数组
     */
    private setPlugins(plugins: Plugin[]) {
        getDefaultStore().set(pluginsAtom, plugins);

        // 清理缓存中已卸载的插件
        const cachedKeys = pluginCacheStore.getAllKeys();
        cachedKeys.forEach(key => {
            if (!plugins.find(it => it.path === key)) {
                pluginCacheStore.delete(key);
            }
        });

        plugins.forEach(it => {
            this.updatePluginCache(it);
        });
    }

    private updatePluginCache(plugin: Plugin) {
        if (plugin.path && plugin.state === PluginState.Mounted) {
            pluginCacheStore.set(
                plugin.path,
                JSON.stringify({
                    name: plugin.name,
                    hash: plugin.hash,
                    path: plugin.path,
                    instance: plugin.instance,
                    supportedMethods: [...plugin.supportedMethods],
                }),
            );
        }
    }

    /**
     * 读取持久化的"未挂载大插件"列表（批量安装跳过的大混淆插件）
     */
    async getPendingLargePlugins(): Promise<IPendingLargePlugin[]> {
        const raw = pluginCacheStore.getString(PENDING_LARGE_KEY);
        if (!raw) {
            return [];
        }
        try {
            const parsed = safeParse(raw);
            return Array.isArray(parsed) ? (parsed as IPendingLargePlugin[]) : [];
        } catch {
            return [];
        }
    }

    /**
     * 持久化"未挂载大插件"列表
     */
    async savePendingLargePlugins(list: IPendingLargePlugin[]): Promise<void> {
        if (!list.length) {
            pluginCacheStore.delete(PENDING_LARGE_KEY);
            return;
        }
        pluginCacheStore.set(PENDING_LARGE_KEY, JSON.stringify(list));
    }

    /**
     * 初始化插件管理器，从文件系统加载所有插件
     * 读取插件目录中的所有.js文件并创建插件实例
     * @throws 如果插件初始化失败则抛出异常
     */
    async setup() {
        try {
            await pluginMeta.migratePluginMeta();
            // 加载插件
            const pluginsFileItems = await readDir(pathConst.pluginPath);
            const allPlugins: Array<Plugin> = [];


            for (let i = 0; i < pluginsFileItems.length; ++i) {
                const pluginFileItem = pluginsFileItems[i];
                trace("初始化插件", pluginFileItem);
                if (
                    pluginFileItem.isFile() &&
                    (pluginFileItem.name?.endsWith?.(".js") ||
                        pluginFileItem.path?.endsWith?.(".js"))
                ) {
                    // 如果存在缓存信息
                    let plugin: Plugin;
                    let isLazyLoad = false;
                    // 懒加载默认开启（与菜单开关 defaultValue 一致）：仅显式关闭才全量加载
                    if (
                        this.appConfigService.getConfig(
                            "basic.lazyLoadPlugin",
                        ) !== false &&
                        pluginCacheStore.contains(pluginFileItem.path)
                    ) {
                        isLazyLoad = true;
                        const lazyProps = safeParse(pluginCacheStore.getString(pluginFileItem.path));
                        lazyProps.loadFuncCode = async () =>
                            await readFile(pluginFileItem.path, "utf8");
                        plugin = new Plugin(
                            null,
                            pluginFileItem.path,
                            lazyProps,
                        );
                    } else {
                        const funcCode = await readFile(
                            pluginFileItem.path,
                            "utf8",
                        );
                        plugin = new Plugin(funcCode, pluginFileItem.path);
                    }

                    const _pluginIndex = allPlugins.findIndex(
                        p => p.hash === plugin.hash,
                    );
                    if (_pluginIndex !== -1) {
                        // 重复插件，直接忽略
                        continue;
                    }
                    if (plugin.state === PluginState.Mounted || isLazyLoad) {
                        allPlugins.push(plugin);
                    }
                }
            }

            this.setPlugins(allPlugins);
            // 异步初始化插件

            delay(10_000, true).then(async () => {
                for (let i = 0; i < allPlugins.length; ++i) {
                    const plugin = allPlugins[i];

                    if (plugin.state === PluginState.Initializing) {
                        try {
                            await plugin.ensureMounted();
                            this.updatePluginCache(plugin);
                        } catch (e: any) {
                            // 单个插件挂载失败不应中断其余插件，也不产生 unhandled rejection
                            errorLog(
                                "插件延迟挂载失败",
                                plugin?.name
                                    ? `${plugin.name}: ${e?.message ?? e}`
                                    : e?.message ?? e,
                            );
                        }
                        // 分批让出 JS 线程：混淆插件逐个求值会把主线程打满，
                        // 每挂载 2 个让出一帧，UI 保持可响应（冷启动不冻结）
                        if (i % 2 === 1) {
                            await delay(16);
                        }
                    }
                }
            }).catch((e: any) => {
                errorLog("插件延迟挂载失败", e?.message ?? e);
            });
        } catch (e: any) {
            showToast({
                type: "warn",
                message: `插件初始化失败:${e?.message ?? e}`,
            });
            errorLog("插件初始化失败", e?.message);
            throw e;
        }

        Plugin.injectDependencies(this);
    }

    /**
     * 从本地文件安装插件
     * @param pluginPath - 插件文件路径
     * @param config - 安装配置选项
     * @param config.notCheckVersion - 为true时跳过版本检查
     * @param config.useExpoFs - 为true时使用Expo文件系统代替React Native的文件系统
     * @returns 安装结果，包含成功状态和相关信息
     */
    async installPluginFromLocalFile(
        pluginPath: string,
        config?: IInstallPluginConfig & {
            useExpoFs?: boolean;
        },
    ): Promise<IInstallPluginResult> {
        let funcCode: string;
        if (config?.useExpoFs) {
            funcCode = await readAsStringAsync(pluginPath);
        } else {
            funcCode = await readFile(pluginPath, "utf8");
        }

        if (funcCode) {
            const plugin = new Plugin(funcCode, pluginPath);
            let allPlugins = [...this.getPlugins()];

            const _pluginIndex = allPlugins.findIndex(
                p => p.hash === plugin.hash,
            );
            if (_pluginIndex !== -1) {
                // 静默忽略
                return {
                    success: true,
                    message: "插件已安装",
                    pluginName: plugin.name,
                    pluginHash: plugin.hash,
                };
            }
            const oldVersionPlugin = allPlugins.find(
                p => p.name === plugin.name,
            );
            if (oldVersionPlugin && !config?.notCheckVersion) {
                if (
                    compare(
                        oldVersionPlugin.instance.version ?? "",
                        plugin.instance.version ?? "",
                        ">",
                    )
                ) {
                    return {
                        success: false,
                        message: "已安装更新版本的插件",
                        pluginName: plugin.name,
                        pluginHash: plugin.hash,
                    };
                }
            }

            if (plugin.state === PluginState.Mounted) {
                const fn = nanoid();
                if (oldVersionPlugin) {
                    allPlugins = allPlugins.filter(
                        _ => _.hash !== oldVersionPlugin.hash,
                    );
                    try {
                        await unlink(oldVersionPlugin.path);
                    } catch {}
                }
                const _pluginPath = `${pathConst.pluginPath}${fn}.js`;
                await copyFile(pluginPath, _pluginPath);
                plugin.path = _pluginPath;
                allPlugins = allPlugins.concat(plugin);
                this.setPlugins(allPlugins);

                return {
                    success: true,
                    pluginName: plugin.name,
                    pluginHash: plugin.hash,
                };
            }
            return {
                success: false,
                message: "插件无法解析",
            };
        }
        return {
            success: false,
            message: "插件无法识别",
        };
    }

    /**
     * 从URL安装插件
     * @param url - 下载插件的URL
     * @param config - 安装配置选项
     * @param config.notCheckVersion - 为true时跳过版本检查
     * @returns 安装结果，包含成功状态和相关信息
     */
    /**
     * 挂载已下载的插件代码并落盘（installPluginFromUrl 与批量安装共用的核心逻辑）
     * @param funcCode - 已下载的插件源码
     * @param url - 插件来源 URL（用于结果回显与版本检查）
     * @param config - 安装配置选项
     */
    private async installFromCode(
        funcCode: string,
        url?: string,
        config?: IInstallPluginConfig,
    ): Promise<IInstallPluginResult> {
        const plugin = new Plugin(funcCode, "");
        let allPlugins = [...this.getPlugins()];
        const pluginIndex = allPlugins.findIndex(
            p => p.hash === plugin.hash,
        );
        if (pluginIndex !== -1) {
            // 静默忽略
            return {
                success: true,
                message: "插件已安装",
                pluginName: plugin.name,
                pluginHash: plugin.hash,
                pluginUrl: url,
            };
        }
        const oldVersionPlugin = allPlugins.find(
            p => p.name === plugin.name,
        );
        if (oldVersionPlugin && !config?.notCheckVersion) {
            if (
                compare(
                    oldVersionPlugin.instance.version ?? "",
                    plugin.instance.version ?? "",
                    ">",
                )
            ) {
                return {
                    success: false,
                    message: "已安装更新版本的插件",
                    pluginName: plugin.name,
                    pluginHash: plugin.hash,
                    pluginUrl: url,
                };
            }
        }

        if (plugin.hash !== "") {
            const fn = nanoid();
            const _pluginPath = `${pathConst.pluginPath}${fn}.js`;
            await writeFile(_pluginPath, funcCode, "utf8");
            plugin.path = _pluginPath;
            allPlugins = allPlugins.concat(plugin);
            if (oldVersionPlugin) {
                allPlugins = allPlugins.filter(
                    _ => _.hash !== oldVersionPlugin.hash,
                );
                try {
                    await unlink(oldVersionPlugin.path);
                } catch {}
            }
            this.setPlugins(allPlugins);
            return {
                success: true,
                pluginName: plugin.name,
                pluginHash: plugin.hash,
                pluginUrl: url,
            };
        }
        return {
            success: false,
            message: "插件无法解析",
            pluginUrl: url,
        };
    }

    /**
     * 批量安装插件（订阅拉取专用）：下载与挂载分离。
     * 阶段 1 限并发下载（网络等待，不占 JS 线程）；
     * 阶段 2 逐个挂载，每个插件挂载后让出一段空闲（delay 50ms）让 UI 渲染插队，
     * 从根上避免「多个 jsjiami 混淆插件同步求值」把 JS 线程打满导致界面冻结/安装假死。
     * 超过 PLUGIN_SIZE_LIMIT 的大混淆插件：autoMountLarge=false 时跳过自动挂载
     * （进 skipped，由 UI 在列表底部提供手动安装）；true 时（探测 App）排最后逐个挂载。
     * @param urls - 待安装插件 URL 列表
     * @param onProgress - 进度回调：{phase: "download"|"mount", done, total, name?}
     * @param config - 安装配置
     * @param autoMountLarge - 是否自动挂载大插件（极悦界 false；探测 App true 保探测覆盖）
     */
    async installPluginsFromUrls(
        urls: string[],
        onProgress?: (p: {
            phase: "download" | "mount";
            done: number;
            total: number;
            name?: string;
        }) => void,
        config?: IInstallPluginConfig,
        autoMountLarge = false,
    ): Promise<{
        results: IInstallPluginResult[];
        success: number;
        failed: number;
        skipped: IPendingLargePlugin[];
    }> {
        const results: IInstallPluginResult[] = [];
        const noCacheHeaders = {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
            Expires: "0",
        };
        // 阶段 1：并发下载（不挂载；慢源（如 hebijunge 大混淆插件）放宽到 30s，
        // 不被 plugin.ts 的全局 2s 默认超时误杀）
        const downloads: Array<{ url: string; code: string }> = [];
        let downloaded = 0;
        await runWithConcurrency(
            urls,
            PLUGIN_UPDATE_CONCURRENCY,
            async url => {
                try {
                    const code = (
                        await axios.get(url, {
                            headers: noCacheHeaders,
                            timeout: 30_000,
                        })
                    ).data;
                    if (code) {
                        downloads.push({ url, code });
                    }
                } catch (e: any) {
                    results.push({
                        success: false,
                        message: e?.message ?? "",
                        pluginUrl: url,
                    });
                }
                downloaded++;
                onProgress?.({
                    phase: "download",
                    done: downloaded,
                    total: urls.length,
                    name: url.split("/").pop()?.slice(0, 40) ?? url,
                });
            },
        );
        // 阶段 2：分档——大混淆插件默认跳过自动挂载（s 抛到 skipped，UI 提供手动安装）
        const large: Array<{ url: string; code: string }> = [];
        const normal: Array<{ url: string; code: string }> = [];
        for (const d of downloads) {
            if (d.code.length > PLUGIN_SIZE_LIMIT) {
                large.push(d);
            } else {
                normal.push(d);
            }
        }
        const skipped: IPendingLargePlugin[] = autoMountLarge
            ? []
            : large.map(({ url, code }) => ({
                  url,
                  name: url.split("/").pop()?.slice(0, 40) ?? url,
                  size: code.length,
              }));
        const mountList = autoMountLarge ? [...normal, ...large] : normal;
        let mounted = 0;
        for (let i = 0; i < mountList.length; ++i) {
            const { url, code } = mountList[i];
            const pluginName = url.split("/").pop()?.slice(0, 40) ?? url;
            // 挂载前先渲染"正在挂载 · 文件名"，让出主线程一帧；
            // 避免串行混淆插件顶层求值期间 UI 全程冻结、进度停留在上一阶段
            onProgress?.({
                phase: "mount",
                done: mounted,
                total: downloads.length,
                name: pluginName,
            });
            await delay(30);
            try {
                results.push(await this.installFromCode(code, url, config));
            } catch (e: any) {
                results.push({
                    success: false,
                    message: e?.message ?? "",
                    pluginUrl: url,
                });
            }
            mounted++;
            onProgress?.({
                phase: "mount",
                done: mounted,
                total: downloads.length,
                name: pluginName,
            });
            await delay(30);
        }
        const success = results.filter(r => r.success).length;
        return { results, success, failed: results.length - success, skipped };
    }

    /**
     * 从URL安装插件
     * @param url - 下载插件的URL
     * @param config - 安装配置选项
     * @param config.notCheckVersion - 为true时跳过版本检查
     * @returns 安装结果，包含成功状态和相关信息
     */
    async installPluginFromUrl(
        url: string,
        config?: IInstallPluginConfig,
    ): Promise<IInstallPluginResult> {
        try {
            const funcCode = (
                await axios.get(url, {
                    headers: {
                        "Cache-Control": "no-cache",
                        Pragma: "no-cache",
                        Expires: "0",
                    },
                    timeout: 30_000,
                })
            ).data;
            if (funcCode) {
                return await this.installFromCode(funcCode, url, config);
            } else {
                return {
                    success: false,
                    message: "插件无法识别",
                    pluginUrl: url,
                };
            }
        } catch (e: any) {
            devLog("error", "URL安装插件失败", e, e?.message);
            errorLog("URL安装插件失败", e);

            if (e?.response?.statusCode === 404) {
                return {
                    success: false,
                    message: "插件不存在，请联系插件作者",
                    pluginUrl: url,
                };
            } else {
                return {
                    success: false,
                    message: e?.message ?? "",
                    pluginUrl: url,
                };
            }
        }
    }

    /**
     * 通过哈希值卸载插件
     * @param hash - 要卸载的插件哈希值
     */
    async uninstallPlugin(hash: string) {
        let plugins = [...this.getPlugins()];
        const targetIndex = plugins.findIndex(_ => _.hash === hash);
        if (targetIndex !== -1) {
            try {
                const pluginName = plugins[targetIndex].name;
                await unlink(plugins[targetIndex].path);
                plugins = plugins.filter(_ => _.hash !== hash);
                this.setPlugins(plugins);
                // 防止其他重名
                if (plugins.every(_ => _.name !== pluginName)) {
                    removeAllMediaExtra(pluginName);
                }
            } catch {}
        }
    }

    /**
     * 卸载系统中的所有插件
     * 同时清理媒体额外数据并删除插件文件
     */
    async uninstallAllPlugins() {
        await Promise.all(
            this.getPlugins().map(async plugin => {
                try {
                    const pluginName = plugin.name;
                    await unlink(plugin.path);
                    removeAllMediaExtra(pluginName);
                } catch (e) {}
            }),
        );
        this.setPlugins([]);

        /** 清除空余文件，异步做就可以了 */
        readDir(pathConst.pluginPath)
            .then(fns => {
                fns.forEach(fn => {
                    unlink(fn.path).catch(emptyFunction);
                });
            })
            .catch(emptyFunction);
    }

    /**
     * 使用插件的源URL更新插件
     * @param plugin - 要更新的插件实例
     * @throws 如果插件没有源URL或更新失败时抛出错误
     */
    async updatePlugin(plugin: Plugin) {
        const updateUrl = plugin.instance.srcUrl;
        if (!updateUrl) {
            throw new Error("没有更新源");
        }
        try {
            await this.installPluginFromUrl(updateUrl);
        } catch (e: any) {
            if (e.message === "插件已安装") {
                throw new Error(i18n.t("checkUpdate.error.latestVersion"));
            } else {
                throw e;
            }
        }
    }

    /**
     * 按订阅清单增量更新音源（启动自动更新 / 首启引导共用）：
     * 1. 解析订阅地址（未配置时写入内置默认源并直接使用）
     * 2. 逐个订阅地址下载清单：.json 取 plugins[]，其余视为单个插件直链
     * 3. 与已安装插件按 name + version 增量对比：已装同名且版本不低于清单 → 跳过；否则加入待下载
     * 4. 限并发下载（失败静默，与历史行为一致）
     */
    async updatePluginsFromSubscription(): Promise<void> {
        try {
            let subscribeUrl = this.appConfigService.getConfig(
                "plugin.subscribeUrl",
            );
            if (!subscribeUrl) {
                subscribeUrl = JSON.stringify([
                    { url: DEFAULT_PLUGIN_SUBSCRIPTION_URL },
                ]);
                this.appConfigService.setConfig(
                    "plugin.subscribeUrl",
                    subscribeUrl,
                );
            }
            const urlItems = JSON.parse(subscribeUrl);
            if (!Array.isArray(urlItems)) {
                return;
            }
            const noCacheHeaders = {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
                Expires: "0",
            };
            const needDownload: string[] = [];
            await runWithConcurrency(
                urlItems,
                PLUGIN_UPDATE_CONCURRENCY,
                async item => {
                    const url: string | undefined = item?.url;
                    if (!url) {
                        return;
                    }
                    try {
                        const text = (
                            await axios.get(url, { headers: noCacheHeaders })
                        ).data;
                        let list: Array<{
                            name?: string;
                            version?: string;
                            url?: string;
                        }> = [];
                        if (url.endsWith(".json")) {
                            list = (text?.plugins ?? []).map((it: any) => ({
                                name: it?.name,
                                version: it?.version,
                                url: it?.url,
                            }));
                        } else {
                            list = [{ url }];
                        }
                        const installed = this.getPlugins();
                        for (const p of list) {
                            if (!p?.url) {
                                continue;
                            }
                            const old = installed.find(
                                _ => _.name === p.name,
                            );
                            if (old && p.version) {
                                try {
                                    if (
                                        compare(
                                            old.instance.version ?? "",
                                            p.version,
                                            ">=",
                                        )
                                    ) {
                                        // 已装版本不低于清单版本 → 跳过
                                        continue;
                                    }
                                } catch {
                                    // 版本不可比 → 走下载，保守更新
                                }
                            }
                            needDownload.push(p.url);
                        }
                    } catch {
                        // 清单拉取失败静默
                    }
                },
            );
            if (needDownload.length) {
                // 下载/挂载分离 + 分批让出：不再并发同步挂载（多个混淆插件同步求值会把 JS 线程打满）
                await this.installPluginsFromUrls(needDownload).catch(
                    emptyFunction,
                );
            }
        } catch {
            // 整体静默，不阻塞启动
        }
    }

    /**
     * 通过媒体项的平台信息获取对应的插件
     * @param mediaItem - 包含平台信息的媒体项
     * @returns 与媒体平台匹配的插件实例或undefined
     */
    getByMedia(mediaItem: ICommon.IMediaBase) {
        return this.getByName(mediaItem?.platform);
    }

    /**
     * 通过名称获取插件
     * @param name - 要查找的插件名称
     * @returns 匹配名称的插件实例或本地文件插件
     */
    getByName(name: string) {
        if (name === localPluginPlatform) {
            return localFilePlugin;
        }
        const plugin = this.getPlugins().find(_ => _.name === name);
        // 取源/歌词/下载/替代名解析链路统一经此方法：
        // 禁用的插件不返回，避免其音源/歌词仍被请求（UI 列表走 getPlugins/getEnabledPlugins，不受影响）
        if (plugin && !pluginMeta.isPluginEnabled(plugin.name)) {
            return undefined;
        }
        return plugin;
    }

    /**
     * 通过哈希值获取插件
     * @param hash - 要查找的插件哈希值
     * @returns 匹配哈希的插件实例或本地文件插件
     */
    getByHash(hash: string) {
        return hash === localPluginHash
            ? localFilePlugin
            : this.getPlugins().find(_ => _.hash === hash);
    }

    /**
     * 获取所有已启用的插件
     * @returns 已启用的插件实例数组
     */
    getEnabledPlugins() {
        return this.getPlugins().filter(it =>
            pluginMeta.isPluginEnabled(it.name),
        );
    }

    /**
     * 获取按顺序排序的所有插件
     * @returns 按定义顺序排序的插件实例数组
     */
    getSortedPlugins() {
        const order = pluginMeta.getPluginOrder();
        return [...this.getPlugins()].sort((a, b) =>
            Math.sign(
                (order[a.name] ?? Infinity) - (order[b.name] ?? Infinity),
            ),
        );
    }

    /**
     * 获取所有支持搜索功能的已启用插件
     * @param supportedSearchType - 可选的搜索媒体类型过滤器
     * @returns 可搜索的插件实例数组
     */
    getSearchablePlugins(supportedSearchType?: ICommon.SupportMediaType) {
        return this.getPlugins().filter(
            it =>
                pluginMeta.isPluginEnabled(it.name) &&
                it.supportedMethods.has("search") &&
                (supportedSearchType && it.instance.supportedSearchType
                    ? it.instance.supportedSearchType.includes(
                        supportedSearchType,
                    )
                    : true),
        );
    }

    /**
     * 获取所有支持搜索功能的已启用插件，并按顺序排序
     * @param supportedSearchType - 可选的搜索媒体类型过滤器
     * @returns 按顺序排序的可搜索插件实例数组
     */
    getSortedSearchablePlugins(supportedSearchType?: ICommon.SupportMediaType) {
        const order = pluginMeta.getPluginOrder();
        return [...this.getSearchablePlugins(supportedSearchType)].sort(
            (a, b) =>
                Math.sign(
                    (order[a.name] ?? Infinity) - (order[b.name] ?? Infinity),
                ),
        );
    }

    /**
     * 获取所有实现特定功能的已启用插件
     * @param ability - 要检查的方法/功能名称
     * @returns 具有指定功能的插件实例数组
     */
    getPluginsWithAbility(ability: keyof IPlugin.IPluginInstanceMethods) {
        return this.getPlugins().filter(
            it =>
                pluginMeta.isPluginEnabled(it.name) &&
                it.supportedMethods.has(ability),
        );
    }

    /**
     * 获取所有实现特定功能的已启用插件，并按顺序排序
     * @param ability - 要检查的方法/功能名称
     * @returns 按顺序排序的具有指定功能的插件实例数组
     */
    getSortedPluginsWithAbility(ability: keyof IPlugin.IPluginInstanceMethods) {
        const order = pluginMeta.getPluginOrder();
        // 可用率自动排序（basic.sortPluginByReliability，默认开）：
        // 实际使用（搜索/推荐歌单/详情解析）的插件顺序按可用率降序优先，
        // 可用率相同（含无数据=默认 0.5）时回退到手动 order。
        const relSort =
            this.appConfigService.getConfig("basic.sortPluginByReliability") ??
            true;
        return [...this.getPluginsWithAbility(ability)].sort((a, b) => {
            if (relSort) {
                const relA = pluginReliability.getReliabilitySync(
                    a.instance.platform,
                );
                const relB = pluginReliability.getReliabilitySync(
                    b.instance.platform,
                );
                if (relA !== relB) {
                    return relB - relA;
                }
            }
            return Math.sign(
                (order[a.name] ?? Infinity) - (order[b.name] ?? Infinity),
            );
        });
    }

    /**
     * 设置插件的启用状态并发送事件通知
     * @param plugin - 要修改的插件实例
     * @param enabled - 是否启用插件
     */
    setPluginEnabled(plugin: Plugin, enabled: boolean) {
        ee.emit("enabled-updated", plugin.name, enabled);
        pluginMeta.setPluginEnabled(plugin.name, enabled);
    }

    /**
     * 检查插件是否已启用
     * @param plugin - 要检查的插件实例
     * @returns 表示插件是否启用的布尔值
     */
    isPluginEnabled(plugin: Plugin) {
        return pluginMeta.isPluginEnabled(plugin.name);
    }

    /**
     * 设置插件的排序顺序并发送顺序更新事件
     * @param sortedPlugins - 按期望顺序排列的插件实例数组
     */
    setPluginOrder(sortedPlugins: Plugin[]) {
        const orderMap: Record<string, number> = {};
        sortedPlugins.forEach((plugin, index) => {
            orderMap[plugin.name] = index;
        });
        pluginMeta.setPluginOrder(orderMap);
        ee.emit("order-updated");
    }

    setUserVariables(plugin: Plugin, userVariables: Record<string, string>) {
        pluginMeta.setUserVariables(plugin.name, userVariables);
    }

    getUserVariables(plugin: Plugin) {
        return pluginMeta.getUserVariables(plugin.name);
    }

    setAlternativePluginName(plugin: Plugin, alternativePluginName: string) {
        pluginMeta.setAlternativePlugin(plugin.name, alternativePluginName);
    }

    getAlternativePluginName(plugin: Plugin) {
        return pluginMeta.getAlternativePlugin(plugin.name);
    }

    getAlternativePlugin(plugin: Plugin) {
        const alternativePluginName = this.getAlternativePluginName(plugin);
        if (alternativePluginName) {
            return this.getByName(alternativePluginName);
        }
        return null;
    }
}

const pluginManager = new PluginManager();

export const usePlugins = () => useAtomValue(pluginsAtom);

export function useSortedPlugins() {
    const plugins = useAtomValue(pluginsAtom);
    const [sortedPlugins, setSortedPlugins] = useState<Plugin[]>(
        pluginManager.getSortedPlugins(),
    );

    useEffect(() => {
        const callback = () => {
            const order = pluginMeta.getPluginOrder();
            setSortedPlugins(
                [...plugins].sort((a, b) =>
                    Math.sign(
                        (order[a.name] ?? Infinity) -
                            (order[b.name] ?? Infinity),
                    ),
                ),
            );
        };

        ee.on("order-updated", callback);
        callback();
        return () => {
            ee.off("order-updated", callback);
        };
    }, [plugins]);

    return sortedPlugins;
}

export function usePluginEnabled(plugin: Plugin) {
    const [enabled, setEnabled] = useState(
        pluginManager.isPluginEnabled(plugin),
    );

    useEffect(() => {
        const callback = (pluginName: string, _enabled: boolean) => {
            if (pluginName === plugin?.name) {
                setEnabled(_enabled);
            }
        };

        ee.on("enabled-updated", callback);
        return () => {
            ee.off("enabled-updated", callback);
        };
    }, [plugin]);

    return enabled;
}

export default pluginManager;
export { Plugin };
