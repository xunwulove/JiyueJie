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
    // 开机自启动（车机/平板常电场景；与原生 SharedPreferences autoBootPrefs/enabled 同步）
    "basic.autoBoot": boolean;
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
    /** 自动择优持久化的当前歌单来源（仅用于保持离开时歌单的缓存；非用户手动指定，不在来源浮窗勾选） */
    "plugin.recommendSourceCache"?: string;

    // WebDAV
    "webdav.url": string;
    "webdav.username": string;
    "webdav.password": string;

    // 音效（均衡器/低音增强/环绕声，绑定 ExoPlayer audioSessionId）
    "sound.eqEnabled": boolean;
    /** 均衡器预设 index；-1 = 手动（按 eqBands 逐段） */
    "sound.eqPreset": number;
    /** 手动模式各频段增益（millibel，长度 = 设备频段数，默认全 0） */
    "sound.eqBands": number[];
    /** 低音增强强度 0..1000（0 = 关） */
    "sound.bassBoost": number;
    /** 环绕声强度 0..1000（0 = 关） */
    "sound.virtualizer": number;
    /** 响度增强强度 0..1000（0 = 关） */
    "sound.loudnessEnhancer": number;
    /** 预设混响 0=关闭,1=小房间,2=中房间,3=大房间,4=中厅,5=大厅,6=板式 */
    "sound.reverbPreset": number;
    /** 环境混响预设 0=关闭,1=小房间,2=中房间,3=大厅,4=教堂,5=洞穴,6=录音棚 */
    "sound.envReverbPreset": number;
    /** 动态处理强度 0..1000（0 = 关，API 28+） */
    "sound.dynamicsProcessing": number;

    // JamesDSP 进阶音效（libjamesdsp 核心库）
    "jdsp.postGain": number;
    "jdsp.bassEnabled": boolean;
    "jdsp.bassGain": number;
    "jdsp.stereoEnabled": boolean;
    "jdsp.stereoMix": number;
    "jdsp.reverbEnabled": boolean;
    "jdsp.reverbPreset": number;
    "jdsp.reverbEngine": number;
    "jdsp.tubeEnabled": boolean;
    "jdsp.tubeGain": number;
    "jdsp.crossfeedEnabled": boolean;
    "jdsp.crossfeedMode": number;
    "jdsp.convolverEnabled": boolean;
    "jdsp.convolverPreset": number;
    "jdsp.ddcEnabled": boolean;
    "jdsp.ddcHeadphone": number;
    /** 用户导入的耳机补偿预设（file 为内部存储 ddc_custom/ 下的文件名） */
    "jdsp.ddcCustom": { name: string; file: string }[];
    "jdsp.eqBands": number[];
}

export type AppConfigPropertyKey = keyof IAppConfigProperties;

export interface IAppConfig<T extends IAppConfigProperties = IAppConfigProperties> {
    setup(): Promise<void>;

    setConfig<K extends keyof T>(key: K, value?: T[K]): void;

    getConfig<K extends keyof T>(key: K): T[K] | undefined;
}