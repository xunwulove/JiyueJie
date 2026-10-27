import { useMMKVObject } from "react-native-mmkv";

import { getStorage, removeStorage } from "@/utils/storage";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV.ts";

import type { AppConfigPropertyKey, IAppConfig, IAppConfigProperties } from "@/types/core/config";
import { safeParse, safeStringify } from "@/utils/jsonUtil";

const configStore = getOrCreateMMKV("App.config");

class AppConfig implements IAppConfig {
    // 配置变化监听（浮窗/面板等非 hook 场景实时刷新用）
    private listeners = new Set<() => void>();

    /** 订阅配置变化（setConfig 写入时触发），返回取消订阅句柄 */
    onConfigChanged(listener: () => void): { remove: () => void } {
        this.listeners.add(listener);
        return {
            remove: () => {
                this.listeners.delete(listener);
            },
        };
    }

    // 迁移函数
    private async migrateConfig(): Promise<void> {

        const parsedSchema = !configStore.contains("$schema")
            ? 0
            : parseInt(configStore.getString("$schema") || "0", 10);
        // 非数字的损坏值（NaN）视为 0，触发全量迁移，避免迁移被静默跳过
        const schemaVersion = Number.isNaN(parsedSchema) ? 0 : parsedSchema;

        if (schemaVersion < 1) {
            // 获取旧配置
            const oldConfig = await getStorage("local-config");

            // 如果没有旧配置，直接初始化新配置
            if (!oldConfig) {
                configStore.set("$schema", "1");
                return;
            }

            // 迁移每个字段
            const mapping: [string, AppConfigPropertyKey][] = [
                // Basic
                [
                    "setting.basic.autoPlayWhenAppStart",
                    "basic.autoPlayWhenAppStart",
                ],
                [
                    "setting.basic.useCelluarNetworkPlay",
                    "basic.useCelluarNetworkPlay",
                ],
                [
                    "setting.basic.useCelluarNetworkDownload",
                    "basic.useCelluarNetworkDownload",
                ],
                ["setting.basic.maxDownload", "basic.maxDownload"],
                ["setting.basic.clickMusicInSearch", "basic.clickMusicInSearch"],
                ["setting.basic.clickMusicInAlbum", "basic.clickMusicInAlbum"],
                ["setting.basic.downloadPath", "basic.downloadPath"],
                ["setting.basic.notInterrupt", "basic.notInterrupt"],
                ["setting.basic.tempRemoteDuck", "basic.tempRemoteDuck"],
                ["setting.basic.autoStopWhenError", "basic.autoStopWhenError"],
                ["setting.basic.maxCacheSize", "basic.maxCacheSize"],
                ["setting.basic.defaultPlayQuality", "basic.defaultPlayQuality"],
                ["setting.basic.playQualityOrder", "basic.playQualityOrder"],
                [
                    "setting.basic.defaultDownloadQuality",
                    "basic.defaultDownloadQuality",
                ],
                [
                    "setting.basic.downloadQualityOrder",
                    "basic.downloadQualityOrder",
                ],
                ["setting.basic.musicDetailDefault", "basic.musicDetailDefault"],
                ["setting.basic.musicDetailAwake", "basic.musicDetailAwake"],
                ["setting.basic.maxHistoryLen", "basic.maxHistoryLen"],
                ["setting.basic.autoUpdatePlugin", "basic.autoUpdatePlugin"],
                [
                    "setting.basic.notCheckPluginVersion",
                    "basic.notCheckPluginVersion",
                ],
                ["setting.basic.associateLyricType", "basic.associateLyricType"],
                [
                    "setting.basic.showExitOnNotification",
                    "basic.showExitOnNotification",
                ],
                [
                    "setting.basic.musicOrderInLocalSheet",
                    "basic.musicOrderInLocalSheet",
                ],
                [
                    "setting.basic.tryChangeSourceWhenPlayFail",
                    "basic.tryChangeSourceWhenPlayFail",
                ],
                [
                    "setting.basic.sortPluginByReliability",
                    "basic.sortPluginByReliability",
                ],

                // Lyric
                ["setting.lyric.showStatusBarLyric", "lyric.showStatusBarLyric"],
                ["setting.lyric.topPercent", "lyric.topPercent"],
                ["setting.lyric.leftPercent", "lyric.leftPercent"],
                ["setting.lyric.align", "lyric.align"],
                ["setting.lyric.color", "lyric.color"],
                ["setting.lyric.backgroundColor", "lyric.backgroundColor"],
                ["setting.lyric.widthPercent", "lyric.widthPercent"],
                ["setting.lyric.fontSize", "lyric.fontSize"],
                ["setting.lyric.autoSearchLyric", "lyric.autoSearchLyric"],

                // Theme
                ["setting.theme.background", "theme.background"],
                ["setting.theme.backgroundOpacity", "theme.backgroundOpacity"],
                ["setting.theme.backgroundBlur", "theme.backgroundBlur"],
                ["setting.theme.colors", "theme.colors"],
                ["setting.theme.followSystem", "theme.followSystem"],
                ["setting.theme.selectedTheme", "theme.selectedTheme"],

                // Backup
                ["setting.backup.resumeMode", "backup.resumeMode"],

                // Plugin
                ["setting.plugin.subscribeUrl", "plugin.subscribeUrl"],

                // WebDAV
                ["setting.webdav.url", "webdav.url"],
                ["setting.webdav.username", "webdav.username"],
                ["setting.webdav.password", "webdav.password"],
            ];

            // 执行迁移
            function getPathValue(obj: Record<string, any>, path: string) {
                const keys = path.split(".");
                let tmp = obj;
                for (let i = 0; i < keys.length; ++i) {
                    tmp = tmp?.[keys[i]];
                }
                return tmp;
            }

            mapping.forEach(([oldPath, newKey]) => {
                const value = getPathValue(oldConfig, oldPath);
                if (value !== undefined) {
                    const str = safeStringify(value);
                    // 序列化失败返回空串时跳过写入，避免空串导致 getConfig 解析崩溃
                    if (str !== "") {
                        configStore.set(newKey, str);
                    }
                }
            });

            // 设置版本标识
            configStore.set("$schema", "1");

            // 清理旧配置
            await removeStorage("local-config"); // 根据需求决定是否删除旧配置
        }

        if (schemaVersion < 2) {
            // @ts-expect-error 兼容旧版本
            if (this.getConfig("basic.clickMusicInSearch") === "播放歌曲") {
                this.setConfig("basic.clickMusicInSearch", "playMusic");
            } else {
                this.setConfig("basic.clickMusicInSearch", "playMusicAndReplace");
            }

            // @ts-expect-error 兼容旧版本
            if (this.getConfig("basic.clickMusicInAlbum") === "播放专辑") {
                this.setConfig("basic.clickMusicInAlbum", "playAlbum");
            } else {
                this.setConfig("basic.clickMusicInAlbum", "playMusic");
            }

            // @ts-expect-error 兼容旧版本
            if (this.getConfig("basic.tempRemoteDuck") === "暂停") {
                this.setConfig("basic.tempRemoteDuck", "pause");
            } else {
                this.setConfig("basic.tempRemoteDuck", "lowerVolume");
            }

            configStore.set("$schema", "2");
        }

        // 数值型字段兜底：旧版本配置可能存为字符串（如 "500"），
        // 下游 `?? 默认值` 会直接拿到字符串，统一 Number() 转换（已修复待真机验证）
        const numericKeys: AppConfigPropertyKey[] = [
            "basic.maxDownload",
            "basic.maxCacheSize",
            "basic.maxHistoryLen",
        ];
        numericKeys.forEach(key => {
            const raw = configStore.getString(key);
            if (raw !== undefined && raw !== "") {
                const parsed = safeParse(raw);
                if (typeof parsed === "string") {
                    const num = Number(parsed);
                    if (!Number.isNaN(num)) {
                        configStore.set(key, safeStringify(num));
                    }
                }
            }
        });
    }

    async setup(): Promise<void> {
        await this.migrateConfig();
    }

    setConfig<K extends keyof IAppConfigProperties>(
        key: K,
        value?: IAppConfigProperties[K] | undefined,
    ): void {
        if (value === undefined) {
            configStore.delete(key);
        } else {
            const str = safeStringify(value);
            // 序列化失败返回空串时跳过写入（保留旧值），避免空串导致 getConfig 解析崩溃
            if (str === "") {
                return;
            }
            configStore.set(key, str);
        }
        // 通知配置变化订阅者（浮窗/面板实时刷新）
        this.listeners.forEach(listener => listener());
    }

    getConfig<K extends keyof IAppConfigProperties>(
        key: K,
    ): IAppConfigProperties[K] | undefined {
        const value = configStore.getString(key);
        // 空串/undefined 直接返回 undefined，不进入解析
        if (!value) {
            return undefined;
        }
        // 损坏数据 safeParse 返回 null，转 undefined，绝不抛异常
        return safeParse<IAppConfigProperties[K]>(value) ?? undefined;
    }
}

const appConfig = new AppConfig();
export default appConfig;
/***** hooks *****/
export function useAppConfig<K extends keyof IAppConfigProperties>(key: K): IAppConfigProperties[K] | undefined {
    return useMMKVObject<IAppConfigProperties[K]>(key, configStore)[0];
}