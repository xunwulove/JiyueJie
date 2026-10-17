import { internalSerializeKey, supportLocalMediaType } from "@/constants/commonConst";
import pathConst from "@/constants/pathConst";
import { IAppConfig } from "@/types/core/config";
import { IInjectable } from "@/types/infra";
import { addFileScheme, escapeCharacter, mkdirR } from "@/utils/fileUtils";
import { errorLog } from "@/utils/log";
import { patchMediaExtra } from "@/utils/mediaExtra";
import { getMediaUniqueKey, isSameMediaItem } from "@/utils/mediaUtils";
import Mp3Util from "@/native/mp3Util";
import network from "@/utils/network";
import { getQualityOrder } from "@/utils/qualities";
import EventEmitter from "eventemitter3";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import path from "path-browserify";
import { useEffect, useState } from "react";
import { copyFile, downloadFile, exists, readDir, unlink } from "react-native-fs";
import LocalMusicSheet from "./localMusicSheet";
import { IPluginManager } from "@/types/core/pluginManager";
import { setStorage, getStorage } from "@/utils/storage";


export enum DownloadStatus {
    // 等待下载
    Pending,
    // 准备下载链接
    Preparing,
    // 下载中
    Downloading,
    // 下载完成
    Completed,
    // 下载失败
    Error
}


export enum DownloaderEvent {
    // 某次下载行为出错
    DownloadError = "download-error",

    // 下载任务更新
    DownloadTaskUpdate = "download-task-update",

    // 下载某个音乐时出错
    DownloadTaskError = "download-task-error",

    // 下载完成
    DownloadQueueCompleted = "download-queue-completed",
}

export enum DownloadFailReason {
    /** 无网络 */
    NetworkOffline = "network-offline",
    /** 设置-禁止在移动网络下下载 */
    NotAllowToDownloadInCellular = "not-allow-to-download-in-cellular",
    /** 无法获取到媒体源 */
    FailToFetchSource = "no-valid-source",
    /** 没有文件写入的权限 */
    NoWritePermission = "no-write-permission",
    Unknown = "unknown",
}

interface IDownloadTaskInfo {
    // 状态
    status: DownloadStatus;
    // 目标文件名
    filename: string;
    // 下载id
    jobId?: number;
    // 下载音质
    quality?: IMusic.IQualityKey;
    // 文件大小
    fileSize?: number;
    // 已下载大小
    downloadedSize?: number;
    // 音乐信息
    musicItem: IMusic.IMusicItem;
    // 如果下载失败，下载失败的原因
    errorReason?: DownloadFailReason;
}


const downloadQueueAtom = atom<IMusic.IMusicItem[]>([]);
const downloadTasks = new Map<string, IDownloadTaskInfo>();

/** 已完成下载的歌曲（持久化，供下载管理页展示"已下载歌曲"） */
const DOWNLOADED_LIST_KEY = "downloaded-music-list";
const downloadedListAtom = atom<IMusic.IMusicItem[]>([]);


interface IEvents {
    /** 某次下载行为出现报错 */
    [DownloaderEvent.DownloadError]: (reason: DownloadFailReason, error?: Error) => void;
    /** 下载某个媒体时报错 */
    [DownloaderEvent.DownloadTaskError]: (reason: DownloadFailReason, mediaItem: IMusic.IMusicItem, error?: Error) => void;
    /** 下载任务更新 */
    [DownloaderEvent.DownloadTaskUpdate]: (task: IDownloadTaskInfo) => void;
    /** 下载队列清空 */
    [DownloaderEvent.DownloadQueueCompleted]: () => void;
}

class Downloader extends EventEmitter<IEvents> implements IInjectable {
    private configService!: IAppConfig;
    private pluginManagerService!: IPluginManager;

    private downloadingCount = 0;

    /** 被用户取消的进行中任务（media unique key）；下载完成后丢弃文件、不入库 */
    private cancelledTasks = new Set<string>();

    private generateFilename(musicItem: IMusic.IMusicItem) {
        // 下载文件命名：歌名在前（默认）/ 作者在前，可配置 basic.downloadNameOrder
        const order =
            this.configService?.getConfig("basic.downloadNameOrder") ?? "title-first";
        const title = escapeCharacter(musicItem.title) || "未知歌曲";
        const artist = escapeCharacter(musicItem.artist) || "未知歌手";
        const baseName =
            order === "artist-first"
                ? `${artist} - ${title}`
                : `${title} - ${artist}`;
        // 追加平台与歌曲id，避免同名同作者不同版本互相覆盖；并保留该后缀不被截断
        const uniqueTag = `_${escapeCharacter(musicItem.platform)}-${escapeCharacter(musicItem.id)}`;
        return baseName.slice(0, Math.max(0, 200 - uniqueTag.length)) + uniqueTag;
    }


    injectDependencies(configService: IAppConfig, pluginManager: IPluginManager): void {
        this.configService = configService;
        this.pluginManagerService = pluginManager;
    }

    private updateDownloadTask(musicItem: IMusic.IMusicItem, patch: Partial<IDownloadTaskInfo>) {
        const newValue = {
            ...downloadTasks.get(getMediaUniqueKey(musicItem)),
            ...patch,
        } as IDownloadTaskInfo;
        downloadTasks.set(getMediaUniqueKey(musicItem), newValue);
        this.emit(DownloaderEvent.DownloadTaskUpdate, newValue);
        return newValue;
    }

    // 开始下载
    private markTaskAsStarted(musicItem: IMusic.IMusicItem) {
        this.downloadingCount++;
        this.updateDownloadTask(musicItem, {
            status: DownloadStatus.Preparing,
        });
    }

    private markTaskAsCompleted(musicItem: IMusic.IMusicItem) {
        this.downloadingCount--;
        this.updateDownloadTask(musicItem, {
            status: DownloadStatus.Completed,
        });
        // 持久化已下载歌曲（下载管理页展示；去重）
        this.addToDownloadedList(musicItem);
    }

    /** 追加到已下载列表（内存 atom + AsyncStorage 持久化） */
    private addToDownloadedList(musicItem: IMusic.IMusicItem) {
        const store = getDefaultStore();
        const list = store.get(downloadedListAtom);
        if (!list.some(_ => isSameMediaItem(_, musicItem))) {
            const next = [...list, musicItem];
            store.set(downloadedListAtom, next);
            setStorage(DOWNLOADED_LIST_KEY, next);
        }
    }

    private markTaskAsError(musicItem: IMusic.IMusicItem, reason: DownloadFailReason, error?: Error) {
        this.downloadingCount--;
        this.updateDownloadTask(musicItem, {
            status: DownloadStatus.Error,
            errorReason: reason,
        });
        this.emit(DownloaderEvent.DownloadTaskError, reason, musicItem, error);
    }

    /** 清理被用户取消的进行中任务：平衡并发计数并移除任务记录（不入库、不 emit） */
    private cleanupCancelledTask(musicItem: IMusic.IMusicItem) {
        const key = getMediaUniqueKey(musicItem);
        this.cancelledTasks.delete(key);
        this.downloadingCount--;
        downloadTasks.delete(key);
    }

    /** 匹配文件后缀 */
    private getExtensionName(url: string) {
        const regResult = url.match(
            /^https?\:\/\/.+\.([^\?\.]+?$)|(?:([^\.]+?)\?.+$)/,
        );
        if (regResult) {
            return regResult[1] ?? regResult[2] ?? "mp3";
        } else {
            return "mp3";
        }
    };

    /** 获取下载路径 */
    private getDownloadPath(fileName: string) {
        const dlPath =
            this.configService.getConfig("basic.downloadPath") ?? pathConst.downloadMusicPath;
        if (!dlPath.endsWith("/")) {
            return `${dlPath}/${fileName ?? ""}`;
        }
        return fileName ? dlPath + fileName : dlPath;
    };

    /** 获取缓存的下载路径 */
    private getCacheDownloadPath(fileName: string) {
        const cachePath = pathConst.downloadCachePath;
        if (!cachePath.endsWith("/")) {
            return `${cachePath}/${fileName ?? ""}`;
        }
        return fileName ? cachePath + fileName : cachePath;
    }


    private async downloadNextPendingTask() {
        const maxDownloadCount = Math.max(1, Math.min(+(this.configService.getConfig("basic.maxDownload") || 3), 10));
        const downloadQueue = getDefaultStore().get(downloadQueueAtom);

        // 如果超过最大下载数量，或者没有下载任务，则不执行
        if (this.downloadingCount >= maxDownloadCount || this.downloadingCount >= downloadQueue.length) {
            return;
        }

        // 寻找下一个pending task
        let nextTask: IDownloadTaskInfo | null = null;
        for (let i = 0; i < downloadQueue.length; i++) {
            const musicItem = downloadQueue[i];
            const key = getMediaUniqueKey(musicItem);
            const task = downloadTasks.get(key);
            if (task && task.status === DownloadStatus.Pending) {
                nextTask = task;
                break;
            }
        }

        // 没有下一个任务了
        if (!nextTask) {
            if (this.downloadingCount === 0) {
                this.emit(DownloaderEvent.DownloadQueueCompleted);
            }
            return;
        }

        const musicItem = nextTask.musicItem;
        // 更新下载状态
        this.markTaskAsStarted(musicItem);

        let url = musicItem.url;
        let headers = musicItem.headers;

        const plugin = this.pluginManagerService.getByName(musicItem.platform);

        try {
            if (plugin) {
                const qualityOrder = getQualityOrder(
                    nextTask.quality ??
                    this.configService.getConfig("basic.defaultDownloadQuality") ??
                    "standard",
                    this.configService.getConfig("basic.downloadQualityOrder") ?? "asc",
                );
                let data: IPlugin.IMediaSourceResult | null = null;
                for (let quality of qualityOrder) {
                    try {
                        data = await plugin.methods.getMediaSource(
                            musicItem,
                            quality,
                            1,
                            true,
                        );
                        if (!data?.url) {
                            continue;
                        }
                        break;
                    } catch { }
                }
                url = data?.url ?? url;
                headers = data?.headers;
            }
            if (!url) {
                throw new Error(DownloadFailReason.FailToFetchSource);
            }
        } catch (e: any) {
            /** 无法下载，跳过 */
            errorLog("下载失败-无法获取下载链接", {
                item: {
                    id: musicItem.id,
                    title: musicItem.title,
                    platform: musicItem.platform,
                    quality: nextTask.quality,
                },
                reason: e?.message ?? e,
            });

            if (this.cancelledTasks.has(getMediaUniqueKey(musicItem))) {
                this.cleanupCancelledTask(musicItem);
            } else if (e.message === DownloadFailReason.FailToFetchSource) {
                this.markTaskAsError(musicItem, DownloadFailReason.FailToFetchSource, e);
            } else {
                this.markTaskAsError(musicItem, DownloadFailReason.Unknown, e);
            }
            // 失败路径同样调度下一个 pending 任务，避免队列卡死
            // （计数已在 markTaskAsError / cleanupCancelledTask 内递减，与正常路径 :309 对称）
            this.downloadNextPendingTask();
            return;
        }

        // 预处理完成，可以开始处理下一个任务
        this.downloadNextPendingTask();

        // 下载逻辑
        // 识别文件后缀
        let extension = this.getExtensionName(url);
        if (supportLocalMediaType.every(item => item !== ("." + extension))) {
            extension = "mp3";
        }

        // 缓存下载地址
        const cacheDownloadPath = addFileScheme(
            this.getCacheDownloadPath(`${nanoid()}.${extension}`),
        );

        // 真实下载地址
        const targetDownloadPath = addFileScheme(
            this.getDownloadPath(`${nextTask.filename}.${extension}`),
        );

        // 检测下载位置是否存在
        try {
            const folder = path.dirname(targetDownloadPath);
            const folderExists = await exists(folder);
            if (!folderExists) {
                await mkdirR(folder);
            }
        } catch (e: any) {
            if (this.cancelledTasks.has(getMediaUniqueKey(musicItem))) {
                this.cleanupCancelledTask(musicItem);
            } else {
                this.markTaskAsError(musicItem, DownloadFailReason.NoWritePermission, e);
            }
            return;
        }

        // 下载（downloadFile 同步调用本身也纳入 try，避免异常逃出任务循环导致计数泄漏）
        try {
            const { promise: downloadPromise } = downloadFile({
                fromUrl: url ?? "",
                toFile: cacheDownloadPath,
                headers: headers,
                background: true,
                begin: (res) => {
                    this.updateDownloadTask(musicItem, {
                        status: DownloadStatus.Downloading,
                        downloadedSize: 0,
                        fileSize: res.contentLength,
                        jobId: res.jobId,
                    });
                },
                progress: (res) => {
                    this.updateDownloadTask(musicItem, {
                        status: DownloadStatus.Downloading,
                        downloadedSize: res.bytesWritten,
                        fileSize: res.contentLength,
                        jobId: res.jobId,
                    });
                },
            });
            await downloadPromise;
            // 下载完成，移动文件
            await copyFile(cacheDownloadPath, targetDownloadPath);

            if (this.cancelledTasks.has(getMediaUniqueKey(musicItem))) {
                // 用户已取消：丢弃目标文件，不入库
                await unlink(targetDownloadPath).catch(() => {});
                this.cleanupCancelledTask(musicItem);
            } else {
                // 内嵌专辑图：有 artwork 时写入音频文件（失败不影响入库）
                if (musicItem.artwork) {
                    Mp3Util.setMediaCover(
                        targetDownloadPath,
                        musicItem.artwork,
                    ).catch(() => {});
                }
                LocalMusicSheet.addMusic({
                    ...musicItem,
                    [internalSerializeKey]: {
                        localPath: targetDownloadPath,
                    },
                });

                patchMediaExtra(musicItem, {
                    downloaded: true,
                    localPath: targetDownloadPath,
                });

                this.markTaskAsCompleted(musicItem);
            }
        } catch (e: any) {
            if (this.cancelledTasks.has(getMediaUniqueKey(musicItem))) {
                this.cleanupCancelledTask(musicItem);
            } else {
                this.markTaskAsError(musicItem, DownloadFailReason.Unknown, e);
            }
        }

        // 清理工作
        await unlink(cacheDownloadPath);
        this.downloadNextPendingTask();

        // 如果任务状态是完成，则从队列中移除
        const key = getMediaUniqueKey(musicItem);
        if (downloadTasks.get(key)?.status === DownloadStatus.Completed) {
            downloadTasks.delete(key);
            const downloadQueue = getDefaultStore().get(downloadQueueAtom);
            const newDownloadQueue = downloadQueue.filter(item => !isSameMediaItem(item, musicItem));
            getDefaultStore().set(downloadQueueAtom, newDownloadQueue);
        }
    }

    download(musicItems: IMusic.IMusicItem | IMusic.IMusicItem[], quality?: IMusic.IQualityKey) {
        if (network.isOffline) {
            this.emit(DownloaderEvent.DownloadError, DownloadFailReason.NetworkOffline);
            return;
        }

        if (network.isCellular && this.configService.getConfig("basic.useCelluarNetworkDownload") === false) {
            this.emit(DownloaderEvent.DownloadError, DownloadFailReason.NotAllowToDownloadInCellular);
            return;
        }

        // 整理成数组
        if (!Array.isArray(musicItems)) {
            musicItems = [musicItems];
        }

        // 防止重复下载
        musicItems = musicItems.filter(m => {
            const key = getMediaUniqueKey(m);
            // 如果存在下载任务
            if (downloadTasks.has(key)) {
                return false;
            }
            // TODO: 如果已经下载了，也应该返回false
            if (LocalMusicSheet.isLocalMusic(m)) {
                return false;
            }

            // 设置下载任务
            downloadTasks.set(getMediaUniqueKey(m), {
                status: DownloadStatus.Pending,
                filename: this.generateFilename(m),
                quality: quality,
                musicItem: m,
            });

            return true;
        });

        if (!musicItems.length) {
            return;
        }

        // 添加进任务队列
        const downloadQueue = getDefaultStore().get(downloadQueueAtom);
        const newDownloadQueue = [...downloadQueue, ...musicItems];
        getDefaultStore().set(downloadQueueAtom, newDownloadQueue);

        this.downloadNextPendingTask();
    }

    remove(musicItem: IMusic.IMusicItem) {
        // 删除下载任务
        const key = getMediaUniqueKey(musicItem);
        const task = downloadTasks.get(key);
        if (!task) {
            return false;
        }
        if (task.status === DownloadStatus.Pending || task.status === DownloadStatus.Error) {
            downloadTasks.delete(key);
        } else if (
            task.status === DownloadStatus.Preparing ||
            task.status === DownloadStatus.Downloading
        ) {
            // 进行中任务无法立即中止：标记取消，待下载完成后丢弃文件、不入库
            this.cancelledTasks.add(key);
        } else {
            return false;
        }
        const downloadQueue = getDefaultStore().get(downloadQueueAtom);
        const newDownloadQueue = downloadQueue.filter(item => !isSameMediaItem(item, musicItem));
        getDefaultStore().set(downloadQueueAtom, newDownloadQueue);
        return true;
    }

    /** 删除已下载歌曲：移除持久化记录 + 删除本地文件 */
    async removeDownloaded(musicItem: IMusic.IMusicItem) {
        await this.removeDownloadedRecord(musicItem);
        // 删除文件（尽力而为；路径 = 下载目录/文件名.后缀）
        try {
            const filename = this.generateFilename(musicItem);
            const dir = this.getDownloadPath("");
            // 两侧统一去除 scheme 前缀再比较，避免 file:///content:// 前缀导致 startsWith 匹配失败
            const stripScheme = (p: string) => p.replace(/^(file|content):\/\//, "");
            const dirNoScheme = stripScheme(dir);
            const normDir = dirNoScheme.endsWith("/") ? dirNoScheme : `${dirNoScheme}/`;
            const res = await readDir(dirNoScheme).catch(() => [] as any[]);
            const target = res.find(_ =>
                stripScheme(_.path).startsWith(normDir) &&
                _.name.startsWith(filename),
            );
            if (target) {
                await unlink(target.path);
            }
        } catch (e: any) {
            errorLog("删除已下载文件失败", e?.message ?? e);
        }
    }

    /** 仅删除已下载记录（保留本地文件） */
    async removeDownloadedRecord(musicItem: IMusic.IMusicItem) {
        const store = getDefaultStore();
        const list = store.get(downloadedListAtom);
        const next = list.filter(_ => !isSameMediaItem(_, musicItem));
        store.set(downloadedListAtom, next);
        await setStorage(DOWNLOADED_LIST_KEY, next);
    }
}

/** 已下载歌曲列表（下载管理页"已下载"区） */
export const useDownloadedList = () => useAtomValue(downloadedListAtom);

/** 启动时清理下载缓存目录里的半截临时文件（无断点续传/任务持久化，残留即垃圾；此时无进行中任务） */
async function cleanupDownloadCache() {
    try {
        const cacheDir = pathConst.downloadCachePath;
        const files = await readDir(cacheDir).catch(() => [] as any[]);
        for (const f of files) {
            await unlink(f.path).catch(() => {});
        }
    } catch (e: any) {
        errorLog("清理下载缓存失败", e?.message ?? e);
    }
}

/** 初始化时从持久化恢复已下载列表，并清理下载缓存残留 */
export async function initDownloadedList() {
    const list = (await getStorage(DOWNLOADED_LIST_KEY)) ?? [];
    if (Array.isArray(list)) {
        getDefaultStore().set(downloadedListAtom, list as IMusic.IMusicItem[]);
    }
    // 启动时无进行中任务，缓存目录里的半截文件一律删除（后台执行，不阻塞启动）
    void cleanupDownloadCache();
}


const downloader = new Downloader();
export default downloader;

export function useDownloadTask(musicItem: IMusic.IMusicItem) {
    const [downloadStatus, setDownloadStatus] = useState(downloadTasks.get(getMediaUniqueKey(musicItem)) ?? null);

    useEffect(() => {
        const callback = (task: IDownloadTaskInfo) => {
            if (isSameMediaItem(task?.musicItem, musicItem)) {
                setDownloadStatus(task);
            }
        };
        downloader.on(DownloaderEvent.DownloadTaskUpdate, callback);

        return () => {
            downloader.off(DownloaderEvent.DownloadTaskUpdate, callback);
        };
    }, [musicItem]);

    return downloadStatus;
}

export const useDownloadQueue = () => useAtomValue(downloadQueueAtom);