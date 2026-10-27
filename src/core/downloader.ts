import { internalSerializeKey, supportLocalMediaType } from "@/constants/commonConst";
import pathConst from "@/constants/pathConst";
import { IAppConfig } from "@/types/core/config";
import { IInjectable } from "@/types/infra";
import { addFileScheme, escapeCharacter, mkdirR } from "@/utils/fileUtils";
import { devLog, errorLog } from "@/utils/log";
import { patchMediaExtra } from "@/utils/mediaExtra";
import { getMediaUniqueKey, isSameMediaItem } from "@/utils/mediaUtils";
import Mp3Util from "@/native/mp3Util";
import network from "@/utils/network";
import { getQualityOrder } from "@/utils/qualities";
import EventEmitter from "eventemitter3";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import path from "path-browserify";
import { useEffect, useState } from "react";
import { appendFile, copyFile, downloadFile, exists, moveFile, readDir, readFile, stat, unlink } from "react-native-fs";
import LocalMusicSheet from "./localMusicSheet";
import pluginReliability from "./pluginReliability";
import { IPluginManager } from "@/types/core/pluginManager";
import { setStorage, getStorage } from "@/utils/storage";


/** MIME → 扩展名映射（用于下载后真实格式探测与扩展名校正）。m4a 容器常被报成 video/mp4。 */
const mimeToExt: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "video/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/aac": "aac",
    "audio/x-aac": "aac",
    "audio/aacp": "aac",
};


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
    // 缓存目录中的确定性临时文件路径（.part，含 file scheme）；用于断点续传与孤儿清理
    tempPath?: string;
}


const downloadQueueAtom = atom<IMusic.IMusicItem[]>([]);
const downloadTasks = new Map<string, IDownloadTaskInfo>();

/** 已完成下载的歌曲（持久化，供下载管理页展示"已下载歌曲"） */
const DOWNLOADED_LIST_KEY = "downloaded-music-list";
const downloadedListAtom = atom<IMusic.IMusicItem[]>([]);

/** 下载队列顺序持久化 key（IMusic.IMusicItem[]） */
const DOWNLOAD_QUEUE_KEY = "download-queue-v1";
/** 下载任务表持久化 key（Record<uniqueKey, IPersistedDownloadTask>，不含运行态 jobId） */
const DOWNLOAD_TASKS_KEY = "download-tasks-v1";

/** 落盘时的任务结构（Map → Record，剔除运行态 jobId） */
interface IPersistedDownloadTask {
    status: DownloadStatus;
    filename: string;
    quality?: IMusic.IQualityKey;
    fileSize?: number;
    downloadedSize?: number;
    musicItem: IMusic.IMusicItem;
    errorReason?: DownloadFailReason;
    tempPath?: string;
}

function serializeDownloadTasks(): Record<string, IPersistedDownloadTask> {
    const out: Record<string, IPersistedDownloadTask> = {};
    downloadTasks.forEach((t, key) => {
        out[key] = {
            status: t.status,
            filename: t.filename,
            quality: t.quality,
            fileSize: t.fileSize,
            downloadedSize: t.downloadedSize,
            musicItem: t.musicItem,
            errorReason: t.errorReason,
            tempPath: t.tempPath,
        };
    });
    return out;
}

/** 持久化队列顺序 */
function persistDownloadQueue() {
    const queue = getDefaultStore().get(downloadQueueAtom);
    setStorage(DOWNLOAD_QUEUE_KEY, queue);
}

// 进度回调节流：关键状态即时写；进度按时间/字节增量节流写
let lastTasksPersistAt = 0;
const lastProgressBytes = new Map<string, number>();
const PROGRESS_PERSIST_INTERVAL = 500; // ms
const PROGRESS_PERSIST_SIZE_DELTA = 64 * 1024; // bytes

/**
 * 持久化任务表。
 * immediate=true：状态/文件名/tempPath/错误原因等关键变更，立即写；
 * immediate=false：仅进度变更，按 >=500ms 且字节增量 >=64KB 节流写。
 */
function persistDownloadTasks(immediate: boolean, key?: string, downloadedSize?: number) {
    const now = Date.now();
    if (!immediate) {
        if (now - lastTasksPersistAt < PROGRESS_PERSIST_INTERVAL) {
            return;
        }
        const prev = key ? (lastProgressBytes.get(key) ?? 0) : 0;
        if (downloadedSize !== undefined && downloadedSize - prev < PROGRESS_PERSIST_SIZE_DELTA) {
            return;
        }
    }
    lastTasksPersistAt = now;
    if (key && downloadedSize !== undefined) {
        lastProgressBytes.set(key, downloadedSize);
    }
    setStorage(DOWNLOAD_TASKS_KEY, serializeDownloadTasks());
}


interface IEvents {
    /** 某次下载行为出现报错 */
    [DownloaderEvent.DownloadError]: (reason: DownloadFailReason, error?: Error) => void;
    /** 下载某个媒体时报错 */
    [DownloaderEvent.DownloadTaskError]: (reason: DownloadFailReason, mediaItem: IMusic.IMusicItem, error?: Error) => void;
    /** 下载任务更新 */
    [DownloaderEvent.DownloadTaskUpdate]: (task: IDownloadTaskInfo) => void;
    /** 下载队列清空（info.hasError：队列中是否存在失败任务，供上层区分"完成/部分失败"提示） */
    [DownloaderEvent.DownloadQueueCompleted]: (info: { hasError: boolean }) => void;
}

class Downloader extends EventEmitter<IEvents> implements IInjectable {
    private configService!: IAppConfig;
    private pluginManagerService!: IPluginManager;

    private downloadingCount = 0;

    /** 被用户取消的进行中任务（media unique key）；下载完成后丢弃文件、不入库 */
    private cancelledTasks = new Set<string>();

    private generateFilename(musicItem: IMusic.IMusicItem) {
        // 下载文件命名：歌名在前（默认）/ 作者在前，可配置 basic.downloadNameOrder
        // （用户要求去除平台与歌曲id后缀，命名保持纯净：`歌名 - 歌手`）
        const order =
            this.configService?.getConfig("basic.downloadNameOrder") ?? "title-first";
        const title = escapeCharacter(musicItem.title) || "未知歌曲";
        const artist = escapeCharacter(musicItem.artist) || "未知歌手";
        return order === "artist-first"
            ? `${artist} - ${title}`
            : `${title} - ${artist}`;
    }


    injectDependencies(configService: IAppConfig, pluginManager: IPluginManager): void {
        this.configService = configService;
        this.pluginManagerService = pluginManager;
    }

    private updateDownloadTask(musicItem: IMusic.IMusicItem, patch: Partial<IDownloadTaskInfo>) {
        const key = getMediaUniqueKey(musicItem);
        const newValue = {
            ...downloadTasks.get(key),
            ...patch,
        } as IDownloadTaskInfo;
        downloadTasks.set(key, newValue);
        this.emit(DownloaderEvent.DownloadTaskUpdate, newValue);
        // 持久化：关键状态立即写；纯进度回调节流写（避免高频 IO）
        const progressOnly = Object.keys(patch).every(
            k => k === "downloadedSize" || k === "fileSize" || k === "jobId",
        );
        persistDownloadTasks(!progressOnly, key, patch.downloadedSize);
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


    async downloadNextPendingTask() {
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
                // 队列完结：统计是否有失败任务，区分"全部完成 / 部分失败"提示
                // （被取消的任务已从 downloadTasks 移除，不参与统计，不误报失败）
                const hasError = [...downloadTasks.values()].some(
                    task => task.status === DownloadStatus.Error,
                );
                this.emit(DownloaderEvent.DownloadQueueCompleted, {
                    hasError,
                });
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
                // 实际解析到的音质（break 时定格；循环外引用，故提升声明）
                let resolvedQuality: IMusic.IQualityKey | undefined;
                // 2026-10-27 与播放链路（trackPlayer play 5.3）对称：源自带多音质直链
                // （musicItem.source[quality]）时优先直接用——插件 getMediaSource 对 quality
                // 响应弱的源，不直链会"点高品质仍拿到标准档 url"。直链缺失再走插件解析。
                for (let quality of qualityOrder) {
                    const direct = musicItem.source?.[quality]?.url;
                    if (direct) {
                        data = {
                            url: direct,
                            headers: musicItem.source?.[quality]?.headers,
                        };
                        resolvedQuality = quality;
                        break;
                    }
                }
                if (!data?.url) {
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
                            resolvedQuality = quality;
                            break;
                        } catch { }
                    }
                }
                url = data?.url ?? url;
                headers = data?.headers;
                // 2026-10-27 下载音质如实回显：源不支持所选档时会静默降级，
                // 把任务音质更新为实际解析到的档（列表/完成提示展示真实音质，避免"点高品质下到标准"困惑）
                if (
                    data?.url &&
                    resolvedQuality &&
                    resolvedQuality !== nextTask.quality
                ) {
                    this.updateDownloadTask(musicItem, {
                        quality: resolvedQuality,
                    });
                }
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

        // 确定性临时文件名：与任务 uniqueKey 绑定，跨重启可定位半截文件实现断点续传。
        // 注意：RNFS(Android) 的 downloadFile 以 FileOutputStream(dest, false) 截断写、不支持追加，
        // 因此续传不直接写 .part，而是带 Range 头把“尾部”下载到独立侧车 .tail，再拼回 .part。
        const safeKey = escapeCharacter(getMediaUniqueKey(musicItem));
        const partPath = addFileScheme(
            this.getCacheDownloadPath(`${safeKey}.${extension}.part`),
        );
        const tailPath = `${partPath}.tail`;
        // 关键路径即时落盘，便于启动清理据此保留可续传的半截文件
        this.updateDownloadTask(musicItem, { tempPath: partPath });

        // 真实下载地址
        let targetDownloadPath = addFileScheme(
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

        // 探测已有半截文件，计算续传起点
        let resumeFrom = 0;
        try {
            if (await exists(partPath)) {
                const st = await stat(partPath);
                resumeFrom = st.size > 0 ? st.size : 0;
            }
        } catch {
            resumeFrom = 0;
        }
        // 上次中断发生在“已拼完 .part 但尚未 copyFile 到成品目录”：直接复用，无需重下
        const persistedFileSize = downloadTasks.get(getMediaUniqueKey(musicItem))?.fileSize ?? 0;
        const partAlreadyComplete = resumeFrom > 0 &&
            persistedFileSize > 0 &&
            resumeFrom >= persistedFileSize;

        // 下载（downloadFile 同步调用本身也纳入 try，避免异常逃出任务循环导致计数泄漏）
        try {
            if (!partAlreadyComplete) {
                // 组装请求头：续传时追加 Range（其余 headers 原样透传）
                const reqHeaders: Record<string, string> = {};
                if (headers && typeof headers === "object") {
                    Object.entries(headers as Record<string, string>).forEach(([k, v]) => {
                        if (v !== undefined && v !== null) {
                            reqHeaders[k] = String(v);
                        }
                    });
                }
                if (resumeFrom > 0) {
                    reqHeaders.Range = `bytes=${resumeFrom}-`;
                }

                let beginStatusCode = 0;
                let beginContentLength = 0;
                const { promise: downloadPromise } = downloadFile({
                    fromUrl: url ?? "",
                    toFile: tailPath,
                    headers: reqHeaders,
                    background: true,
                    begin: (res) => {
                        beginStatusCode = res.statusCode;
                        beginContentLength = res.contentLength;
                        const resumed = resumeFrom > 0 && res.statusCode === 206;
                        this.updateDownloadTask(musicItem, {
                            status: DownloadStatus.Downloading,
                            downloadedSize: resumed ? resumeFrom : 0,
                            fileSize: resumed ? resumeFrom + res.contentLength : res.contentLength,
                            jobId: res.jobId,
                        });
                    },
                    progress: (res) => {
                        const resumed = resumeFrom > 0 && beginStatusCode === 206;
                        this.updateDownloadTask(musicItem, {
                            status: DownloadStatus.Downloading,
                            downloadedSize: resumed ? resumeFrom + res.bytesWritten : res.bytesWritten,
                            fileSize: resumed ? resumeFrom + beginContentLength : beginContentLength,
                            jobId: res.jobId,
                        });
                    },
                });
                await downloadPromise;

                // 拼装：206 续传成功 → 把 tail 追加到 .part；
                // 全新下载或服务器忽略 Range(200) → tail 即完整文件，替换旧 .part
                if (resumeFrom > 0 && beginStatusCode === 206) {
                    const tailB64 = await readFile(tailPath, "base64");
                    await appendFile(partPath, tailB64, "base64");
                    await unlink(tailPath).catch(() => {});
                } else {
                    await unlink(partPath).catch(() => {});
                    await copyFile(tailPath, partPath);
                    await unlink(tailPath).catch(() => {});
                }
            }
            // 下载完成（或已可复用），从 .part 拷贝到成品目录；成品只在此刻出现
            await copyFile(partPath, targetDownloadPath);

            if (this.cancelledTasks.has(getMediaUniqueKey(musicItem))) {
                // 用户已取消：丢弃目标文件，不入库
                await unlink(targetDownloadPath).catch(() => {});
                this.cleanupCancelledTask(musicItem);
            } else {
                // 内嵌/探测统一用纯文件系统路径：RNFS 路径体系带 file:// 前缀，
                // 但原生 Mp3Util 的 File()/MediaMetadataRetriever 只认绝对路径，
                // 传 file:// 会恒判"文件不存在"导致封面/歌词内嵌静默失败（2026-10-26 根因修复）。
                // localPath 入库仍保持 file://（极悦界内部统一形式），仅 Mp3Util 调用去前缀。
                let fsTargetPath = targetDownloadPath.replace(/^file:\/\//, "");
                // P2 修复（扩展名错配）：MMR 探测真实 MIME，与当前扩展名不符且受支持时改名再内嵌。
                // 背景：CDN 直链常无后缀，getExtensionName 默认 mp3，实际可能是 flac/aac/m4a，
                // jaudiotagger 按错误扩展名解析会导致封面/歌词内嵌静默失败。
                try {
                    const realMime = await Mp3Util.getMimeType(fsTargetPath);
                    const realExt = realMime ? mimeToExt[realMime.toLowerCase()] : null;
                    if (
                        realExt &&
                        realExt !== extension &&
                        supportLocalMediaType.includes(`.${realExt}`)
                    ) {
                        const newPath = addFileScheme(
                            this.getDownloadPath(`${nextTask.filename}.${realExt}`),
                        );
                        await moveFile(targetDownloadPath, newPath);
                        targetDownloadPath = newPath;
                        fsTargetPath = newPath.replace(/^file:\/\//, "");
                        devLog(
                            "info",
                            "下载扩展名校正",
                            nextTask.filename,
                            `${extension} → ${realExt}`,
                        );
                    }
                } catch (e: any) {
                    // 探测/改名失败：保持原扩展名与路径，不影响入库
                    devLog(
                        "warn",
                        "下载扩展名探测失败，保持原扩展名",
                        nextTask.filename,
                        e?.message ?? e,
                    );
                }
                // 内嵌专辑图：有 artwork 时写入音频文件（失败不影响入库，errorLog 留痕便于排查）
                if (musicItem.artwork) {
                    Mp3Util.setMediaCover(
                        fsTargetPath,
                        musicItem.artwork,
                    ).catch((e: any) => {
                        errorLog("内嵌封面写入失败", {
                            title: musicItem.title,
                            msg: e?.message ?? e,
                        });
                    });
                }
                // 内嵌歌词：音源支持 getLyric 时尝试写入（失败不影响入库，
                // 避免个别音源歌词接口异常拖垮下载队列）
                if (plugin?.methods?.getLyric) {
                    plugin.methods
                        .getLyric(musicItem)
                        .then(async lrc => {
                            // 记录歌词可用率：下载取词成功/失败
                            if (plugin?.instance?.platform) {
                                void pluginReliability.recordLyricResult(
                                    plugin.instance.platform,
                                    !!lrc,
                                );
                            }
                            // 归一化歌词为字符串：MusicFree 插件 getLyric 约定返回
                            // { rawLrc, translation? }（少数返回裸字符串），直接塞对象
                            // 给原生 setMediaTag 会因 getString("lyric") 遇 Map 抛异常
                            // 导致内嵌静默失败（2026-10-26 装机实测根因）。
                            const lrcText =
                                typeof lrc === "string"
                                    ? lrc
                                    : (lrc?.rawLrc ?? lrc?.lrc ?? "");
                            if (lrcText) {
                                await Mp3Util.setMediaTag(fsTargetPath, {
                                    lyric: lrcText,
                                });
                            }
                        })
                        .catch((e: any) => {
                            errorLog("内嵌歌词写入失败", {
                                title: musicItem.title,
                                msg: String(e?.message ?? e),
                            });
                        });
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

        // 清理工作：半截 .part 仅在任务终态后删除（失败/取消时保留供下次续传由上层决定）
        if (this.cancelledTasks.has(getMediaUniqueKey(musicItem))) {
            await unlink(partPath).catch(() => {});
            await unlink(tailPath).catch(() => {});
        } else if (downloadTasks.get(getMediaUniqueKey(musicItem))?.status === DownloadStatus.Completed) {
            await unlink(partPath).catch(() => {});
        }
        this.downloadNextPendingTask();

        // 如果任务状态是完成，则从队列中移除
        const key = getMediaUniqueKey(musicItem);
        if (downloadTasks.get(key)?.status === DownloadStatus.Completed) {
            downloadTasks.delete(key);
            const downloadQueue = getDefaultStore().get(downloadQueueAtom);
            const newDownloadQueue = downloadQueue.filter(item => !isSameMediaItem(item, musicItem));
            getDefaultStore().set(downloadQueueAtom, newDownloadQueue);
            persistDownloadQueue();
            persistDownloadTasks(true);
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

        // 持久化入队结果（队列顺序 + 新任务）
        persistDownloadQueue();
        persistDownloadTasks(true);

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
        // 持久化队列/任务变更（被删任务的 .part 成为孤儿，由启动清理兜底删除）
        persistDownloadQueue();
        persistDownloadTasks(true);
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

/**
 * 启动时清理下载缓存目录。
 * 旧实现会删除整个缓存目录；改为只删除“孤儿”半截文件：
 *  - 无任务引用的 .part/.tail 一律删除（含被取消任务残留的 .part、上轮未拼完的 .tail）；
 *  - 仍被某个已恢复任务引用的 .part 保留——它是可续传的数据，绝不能删。
 * 调用时机：必须在任务表恢复完成之后（以任务 tempPath 为准）。
 */
async function cleanupDownloadCache() {
    try {
        const cacheDir = pathConst.downloadCachePath;
        const files = await readDir(cacheDir).catch(() => [] as any[]);
        const referenced = new Set<string>();
        downloadTasks.forEach(t => {
            if (t.tempPath) {
                referenced.add(t.tempPath.replace(/^(file|content):\/\//, ""));
            }
        });
        for (const f of files) {
            const p = f.path.replace(/^(file|content):\/\//, "");
            const isPartial = /\.(part|tail)$/.test(f.name);
            if (!isPartial) {
                // 旧版随机 nanoid 命名的缓存残留：无任务可续传，直接删除
                await unlink(f.path).catch(() => {});
                continue;
            }
            if (!referenced.has(p)) {
                await unlink(f.path).catch(() => {});
            }
        }
    } catch (e: any) {
        errorLog("清理下载缓存失败", e?.message ?? e);
    }
}

/** 恢复未完成的下载队列与任务表（启动时调用一次） */
async function initDownloadQueue() {
    // 1. 恢复队列顺序
    const savedQueue = (await getStorage(DOWNLOAD_QUEUE_KEY)) ?? [];
    if (Array.isArray(savedQueue)) {
        getDefaultStore().set(downloadQueueAtom, savedQueue as IMusic.IMusicItem[]);
    }
    // 2. 恢复任务状态/进度/文件名/音质/错误原因（Map → Record）
    const savedTasks = (await getStorage(DOWNLOAD_TASKS_KEY)) ?? {};
    if (savedTasks && typeof savedTasks === "object") {
        Object.entries(savedTasks as Record<string, IPersistedDownloadTask>).forEach(([key, t]) => {
            if (!t || !t.musicItem) {
                return;
            }
            let status = t.status;
            // 崩溃后无在飞下载进程：进行中任务一律回落为 Pending 等待重调度
            if (status === DownloadStatus.Preparing || status === DownloadStatus.Downloading) {
                status = DownloadStatus.Pending;
            }
            // Completed 已入“已下载列表”，不在恢复范围
            if (status === DownloadStatus.Completed) {
                return;
            }
            downloadTasks.set(key, {
                status,
                filename: t.filename,
                quality: t.quality,
                fileSize: t.fileSize,
                downloadedSize: t.downloadedSize,
                musicItem: t.musicItem,
                errorReason: t.errorReason,
                tempPath: t.tempPath,
                // jobId 为运行态，不恢复
            });
        });
    }
    // 3. 先恢复任务，再据此清理孤儿半截文件（有任务引用的 .part 保留续传）
    await cleanupDownloadCache();
    // 4. 自动续跑：存在 Pending 任务则触发调度
    downloader.downloadNextPendingTask();
}

/** 初始化时从持久化恢复已下载列表 + 未完成下载队列，并清理缓存孤儿残留 */
export async function initDownloadedList() {
    const list = (await getStorage(DOWNLOADED_LIST_KEY)) ?? [];
    if (Array.isArray(list)) {
        getDefaultStore().set(downloadedListAtom, list as IMusic.IMusicItem[]);
    }
    await initDownloadQueue();
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