import {
    StorageKeys,
    internalSerializeKey,
    supportLocalMediaType,
} from "@/constants/commonConst";
import mp3Util, { IBasicMeta } from "@/native/mp3Util";
import { getFileName } from "@/utils/fileUtils.ts";
import {
    getLocalPath,
    isSameMediaItem,
} from "@/utils/mediaUtils";
import StateMapper from "@/utils/stateMapper";
import { getStorage, setStorage } from "@/utils/storage";
import {
    getScanSettings,
    isBlockedPath,
    MIN_DURATION_SECONDS,
} from "@/core/scanSettings";
import CryptoJs from "crypto-js";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { ReadDirItem, exists, readDir, unlink } from "react-native-fs";

let localSheet: IMusic.IMusicItem[] = [];
const localSheetStateMapper = new StateMapper(() => localSheet);

export async function setup() {
    const sheet = await getStorage(StorageKeys.LocalMusicSheet);
    if (sheet) {
        let validSheet: IMusic.IMusicItem[] = [];
        const now = Date.now();
        for (let index = 0; index < sheet.length; ++index) {
            const musicItem = sheet[index];
            const localPath = getLocalPath(musicItem);
            if (localPath && (await exists(localPath))) {
                // 存量迁移：补 $timestamp（入库时间，保持原顺序）与 size（无则 0）
                if (!musicItem.$timestamp) {
                    musicItem.$timestamp = now - (sheet.length - index) * 1000;
                    musicItem.$sortIndex = sheet.length - index;
                }
                if (musicItem.size === undefined) {
                    musicItem.size = 0;
                }
                validSheet.push(musicItem);
            }
        }
        if (validSheet.length !== sheet.length) {
            await setStorage(StorageKeys.LocalMusicSheet, validSheet);
        }
        localSheet = validSheet;
    } else {
        await setStorage(StorageKeys.LocalMusicSheet, []);
    }
    localSheetStateMapper.notify();
}

export async function addMusic(
    musicItem: IMusic.IMusicItem | IMusic.IMusicItem[],
) {
    if (!Array.isArray(musicItem)) {
        musicItem = [musicItem];
    }
    let newSheet = [...localSheet];
    musicItem.forEach(mi => {
        if (localSheet.findIndex(_ => isSameMediaItem(mi, _)) === -1) {
            // 入库时间：新加入的歌曲补 $timestamp（排序"添加时间"使用）
            if (!mi.$timestamp) {
                mi.$timestamp = Date.now();
                mi.$sortIndex = 0;
            }
            newSheet.push(mi);
        }
    });
    await setStorage(StorageKeys.LocalMusicSheet, newSheet);
    localSheet = newSheet;
    localSheetStateMapper.notify();
}

function addMusicDraft(musicItem: IMusic.IMusicItem | IMusic.IMusicItem[]) {
    if (!Array.isArray(musicItem)) {
        musicItem = [musicItem];
    }
    let newSheet = [...localSheet];
    musicItem.forEach(mi => {
        if (localSheet.findIndex(_ => isSameMediaItem(mi, _)) === -1) {
            if (!mi.$timestamp) {
                mi.$timestamp = Date.now();
                mi.$sortIndex = 0;
            }
            newSheet.push(mi);
        }
    });
    localSheet = newSheet;
    localSheetStateMapper.notify();
}

async function saveLocalSheet() {
    await setStorage(StorageKeys.LocalMusicSheet, localSheet);
}

export async function removeMusic(
    musicItem: IMusic.IMusicItem,
    deleteOriginalFile = false,
) {
    const idx = localSheet.findIndex(_ => isSameMediaItem(_, musicItem));
    let newSheet = [...localSheet];
    if (idx !== -1) {
        const localMusicItem = localSheet[idx];
        newSheet.splice(idx, 1);
        const localPath =
            musicItem[internalSerializeKey]?.localPath ??
            localMusicItem[internalSerializeKey]?.localPath;
        if (deleteOriginalFile && localPath) {
            try {
                await unlink(localPath);
            } catch (e: any) {
                if (e.message !== "File does not exist") {
                    throw e;
                }
            }
        }
    }
    localSheet = newSheet;
    localSheetStateMapper.notify();
    saveLocalSheet();
}

function parseFilename(fn: string): Partial<IMusic.IMusicItem> | null {
    const data = fn.slice(0, fn.lastIndexOf(".")).split("@");
    const [platform, id, title, artist] = data;
    if (!platform || !id) {
        return null;
    }
    return {
        id,
        platform: platform,
        title: title ?? "",
        artist: artist ?? "",
    };
}

function localMediaFilter(filename: string) {
    return supportLocalMediaType.some(ext => filename.toLowerCase().endsWith(ext));
}

let importToken: string | null = null;
/** 扫描到的文件：路径 + 大小（字节），供"按文件大小"排序 */
interface ILocalScanFile {
    path: string;
    size: number;
}
// 获取本地的文件列表
async function getMusicStats(folderPaths: string[], blocked: string[]) {
    const _importToken = nanoid();
    importToken = _importToken;
    const musicList: ILocalScanFile[] = [];
    let peek: string | undefined;
    let dirFiles: ReadDirItem[] = [];
    while (folderPaths.length !== 0) {
        if (importToken !== _importToken) {
            throw new Error("Import Broken");
        }
        peek = folderPaths.shift() as string;
        try {
            dirFiles = await readDir(peek);
        } catch {
            dirFiles = [];
        }

        dirFiles.forEach(item => {
            if (item.isDirectory()) {
                // 屏蔽目录：命中前缀则跳过整个目录（对齐 APlayer 屏蔽文件夹）
                if (!isBlockedPath(item.path, blocked)) {
                    folderPaths.push(item.path);
                }
            } else if (localMediaFilter(item.path)) {
                musicList.push({ path: item.path, size: item.size ?? 0 });
            }
        });
    }

    return { musicList, token: _importToken };
}

function cancelImportLocal() {
    importToken = null;
}

// 导入本地音乐
const groupNum = 25;
async function importLocal(_folderPaths: string[]): Promise<number> {
    // 本地音乐链路统一使用原始绝对路径（不加 file://）：readDir 返回的 item.path 即为 raw 路径，
    // 播放时由 plugin.getMediaSource 统一 addFileScheme，native mp3Util(File(path)) 需要 raw 路径。
    // （注：RNFS JS 层 normalizeFilePath 会自动剥离 file:// 前缀，两种写法皆可用；raw 路径与文件选择器一致更直接。）
    const folderPaths = [..._folderPaths];
    // 扫描设置：屏蔽目录 + 60 秒过滤（对齐 APlayer ScanEngine）
    const scanSettings = await getScanSettings();
    const blocked = scanSettings.blockedFolders ?? [];
    const minDuration = scanSettings.minDuration
        ? MIN_DURATION_SECONDS
        : 0;
    const { musicList, token } = await getMusicStats(folderPaths, blocked);
    if (token !== importToken) {
        throw new Error("Import Broken");
    }
    // 分组请求，不然序列化可能出问题
    let metas: IBasicMeta[] = [];
    const groups = Math.ceil(musicList.length / groupNum);
    for (let i = 0; i < groups; ++i) {
        metas = metas.concat(
            await mp3Util.getMediaMeta(
                musicList
                    .slice(i * groupNum, (i + 1) * groupNum)
                    .map(f => f.path),
            ),
        );
    }
    if (token !== importToken) {
        throw new Error("Import Broken");
    }
    const musicItems: IMusic.IMusicItem[] = (
        await Promise.all(
            musicList.map(async (file, index) => {
                const musicPath = file.path;
                let { platform, id, title, artist } =
                    parseFilename(getFileName(musicPath, true)) ?? {};
                const meta = metas[index];
                if (!platform || !id) {
                    platform = "本地";
                    id = CryptoJs.MD5(musicPath).toString(CryptoJs.enc.Hex);
                }
                return {
                    id,
                    platform,
                    title: title ?? meta?.title ?? getFileName(musicPath),
                    artist: artist ?? meta?.artist ?? "未知歌手",
                    duration: parseInt(meta?.duration ?? "0", 10) / 1000,
                    album: meta?.album ?? "未知专辑",
                    artwork: "",
                    size: file.size, // 文件大小（字节），"按文件大小"排序
                    $timestamp: Date.now(), // 扫描入库时间，"按添加时间"排序
                    $sortIndex: musicList.length - index,
                    [internalSerializeKey]: {
                        localPath: musicPath,
                    },
                } as IMusic.IMusicItem;
            }),
        )
    ).filter(_ =>
        // 不扫描 60 秒以下音频（对齐 APlayer minDuration 过滤）
        minDuration === 0 ||
        _.duration <= 0 ||
        _.duration >= minDuration,
    );
    if (token !== importToken) {
        throw new Error("Import Broken");
    }
    addMusic(musicItems);
    return musicItems.length;
}

/** 是否为本地音乐 */
function isLocalMusic(
    musicItem: ICommon.IMediaBase | null,
): IMusic.IMusicItem | undefined {
    return musicItem
        ? localSheet.find(_ => isSameMediaItem(_, musicItem))
        : undefined;
}

/** 状态-是否为本地音乐 */
function useIsLocal(musicItem: IMusic.IMusicItem | null) {
    const localMusicState = localSheetStateMapper.useMappedState();
    const [isLocal, setIsLocal] = useState<boolean>(!!isLocalMusic(musicItem));
    useEffect(() => {
        if (!musicItem) {
            setIsLocal(false);
        } else {
            setIsLocal(!!isLocalMusic(musicItem));
        }
    }, [localMusicState, musicItem]);
    return isLocal;
}

function getMusicList() {
    return localSheet;
}

async function updateMusicList(newSheet: IMusic.IMusicItem[]) {
    const _localSheet = [...newSheet];
    try {
        await setStorage(StorageKeys.LocalMusicSheet, _localSheet);
        localSheet = _localSheet;
        localSheetStateMapper.notify();
    } catch {}
}

const LocalMusicSheet = {
    setup,
    addMusic,
    removeMusic,
    addMusicDraft,
    saveLocalSheet,
    importLocal,
    cancelImportLocal,
    isLocalMusic,
    useIsLocal,
    getMusicList,
    useMusicList: localSheetStateMapper.useMappedState,
    updateMusicList,
};

export default LocalMusicSheet;
