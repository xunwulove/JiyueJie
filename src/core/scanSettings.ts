import { getStorage, setStorage } from "@/utils/storage";
import { ExternalStorageDirectoryPath } from "react-native-fs";

/** 扫描设置（对齐 APlayer ScanSettings：媒体库/自定义文件夹/60秒过滤/屏蔽目录，持久化） */
export interface IScanSettings {
    /** 使用 Android 媒体库（fork：扫描默认目录 = 系统 Music + Download） */
    useMediaLibrary: boolean;
    /** 启用自定义文件夹 */
    customEnabled: boolean;
    /** 自定义文件夹路径列表 */
    customFolders: string[];
    /** 不扫描 60 秒以下音频 */
    minDuration: boolean;
    /** 被屏蔽的文件夹路径列表 */
    blockedFolders: string[];
}

const SCAN_SETTINGS_KEY = "scan-settings";

const DEFAULTS: IScanSettings = {
    useMediaLibrary: true,
    customEnabled: false,
    customFolders: [],
    minDuration: true,
    blockedFolders: [],
};

let cache: IScanSettings | null = null;

export async function getScanSettings(): Promise<IScanSettings> {
    if (!cache) {
        const stored = await getStorage(SCAN_SETTINGS_KEY);
        cache = { ...DEFAULTS, ...(stored ?? {}) };
    }
    return cache as IScanSettings;
}

export async function updateScanSettings(patch: Partial<IScanSettings>) {
    const cur = await getScanSettings();
    cache = { ...cur, ...patch };
    await setStorage(SCAN_SETTINGS_KEY, cache);
}

/** 路径是否命中屏蔽文件夹（前缀匹配，对齐 APlayer ScanSettings.isBlocked） */
export function isBlockedPath(
    path: string,
    blocked: string[],
): boolean {
    return blocked.some(_ => path.startsWith(_));
}

/** 默认扫描目录（fork 对齐"使用 Android 媒体库"：系统 Music / Download 目录） */
export function defaultScanFolders(): string[] {
    if (!ExternalStorageDirectoryPath) {
        return [];
    }
    return [
        `${ExternalStorageDirectoryPath}/Music`,
        `${ExternalStorageDirectoryPath}/Download`,
    ];
}

/** 60 秒（对齐 APlayer DEFAULT_MIN_DURATION_MS = 60_000） */
export const MIN_DURATION_SECONDS = 60;
