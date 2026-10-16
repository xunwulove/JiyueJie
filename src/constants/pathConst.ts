import { Platform } from "react-native";
import RNFS, {
    CachesDirectoryPath,
    ExternalStorageDirectoryPath,
} from "react-native-fs";

export const basePath =
    Platform.OS === "android"
        ? RNFS.ExternalDirectoryPath
        : RNFS.DocumentDirectoryPath;

export default {
    basePath,
    pluginPath: `${basePath}/plugins/`,
    logPath: `${basePath}/log/`,
    dataPath: `${basePath}/data/`,
    cachePath: `${basePath}/cache/`,
    musicCachePath: CachesDirectoryPath + "/TrackPlayer",
    imageCachePath: CachesDirectoryPath + "/image_manager_disk_cache",
    localLrcPath: `${basePath}/local_lrc/`,
    lrcCachePath: `${basePath}/cache/lrc/`,
    /** 用户导入的耳机补偿 IR 目录（ViPER-DDC 自定义预设） */
    ddcCustomPath: `${basePath}/ddc_custom/`,
    downloadCachePath: `${basePath}/cache/download/`,
    downloadPath: `${basePath}/download/`,
    // 2026-10-13：默认下载保存路径改为系统 Music 目录（用户可见；需"所有文件访问"权限，下载前自动建目录）；
    // 非 Android 保持应用内目录
    downloadMusicPath:
        Platform.OS === "android"
            ? `${ExternalStorageDirectoryPath}/Music`
            : `${basePath}/download/music/`,
    mmkvPath: `${basePath}/mmkv`,
    mmkvCachePath: `${basePath}/cache/mmkv`,
};
