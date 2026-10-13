import type { ResumeMode, SortType } from "@/constants/commonConst.ts";
import type { CustomizedColors } from "@/hooks/useColors";

export interface IAppConfigProperties {
    $schema: "2";
    // Basic
    "basic.autoPlayWhenAppStart": boolean;
    "basic.useCelluarNetworkPlay": boolean;
    "basic.useCelluarNetworkDownload": boolean;
    "basic.maxDownload": number;
    "basic.clickMusicInSearch": "playMusic" | "playMusicAndReplace";
    "basic.clickMusicInAlbum": "playAlbum" | "playMusic";
    "basic.downloadPath": string;
    "basic.notInterrupt": boolean;
    "basic.tempRemoteDuck": "pause" | "lowerVolume";
    "basic.tempRemoteDuckVolume": 0.3 | 0.5 | 0.8;
    "basic.autoStopWhenError": boolean;
    "basic.maxCacheSize": number;
    "basic.defaultPlayQuality": IMusic.IQualityKey;
    "basic.playQualityOrder": "asc" | "desc";
    "basic.defaultDownloadQuality": IMusic.IQualityKey;
    "basic.downloadQualityOrder": "asc" | "desc";
    "basic.downloadNameOrder": "title-first" | "artist-first";
    "basic.musicDetailDefault": "album" | "lyric";
    "basic.musicDetailAwake": boolean;
    "basic.maxHistoryLen": number;
    "basic.autoUpdatePlugin": boolean;
    "basic.notCheckPluginVersion": boolean;
    "basic.lazyLoadPlugin": boolean;
    "basic.associateLyricType": "input" | "search";
    "basic.showExitOnNotification": boolean;
    "basic.musicOrderInLocalSheet": SortType;
    "basic.tryChangeSourceWhenPlayFail": boolean;
    "basic.sortPluginByReliability": boolean;
    // 全屏播放页沉浸歌词（无操作自动进入沉浸展示层）
    "basic.immersiveEnable": boolean;
    "basic.immersiveDelay": number;
    "basic.immersiveEffect": boolean;
    // 音乐库列表排序（本地歌曲，8 维度 + 方向）
    "basic.musicLibrarySort":
        | "default"
        | "title"
        | "artist"
        | "album"
        | "duration"
        | "size"
        | "addTime"
        | "playCount";
    "basic.musicLibrarySortDirection": "asc" | "desc";

    // Lyric
    "lyric.showStatusBarLyric": boolean;
    "lyric.topPercent": number;
    "lyric.leftPercent": number;
    "lyric.align": number;
    "lyric.color": string;
    "lyric.backgroundColor": string;
    "lyric.widthPercent": number;
    "lyric.fontSize": number;
    "lyric.autoSearchLyric": boolean;

    // Theme
    "theme.background": string;
    "theme.backgroundOpacity": number;
    "theme.backgroundBlur": number;
    "theme.colors": CustomizedColors;
    "theme.followSystem": boolean;
    "theme.selectedTheme": string;

    // Backup
    "backup.resumeMode": ResumeMode;

    // Plugin
    "plugin.subscribeUrl": string;
    /** 手动指定的推荐歌单来源（"random" = 随机使用音源；插件 hash = 锁定该源；未配置 = 自动择优） */
    "plugin.recommendSource"?: string;

    // WebDAV
    "webdav.url": string;
    "webdav.username": string;
    "webdav.password": string;
}

export type AppConfigPropertyKey = keyof IAppConfigProperties;

export interface IAppConfig<T extends IAppConfigProperties = IAppConfigProperties> {
    setup(): Promise<void>;

    setConfig<K extends keyof T>(key: K, value?: T[K]): void;

    getConfig<K extends keyof T>(key: K): T[K] | undefined;
}