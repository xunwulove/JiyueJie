import { getCurrentDialog, showDialog } from "@/components/dialogs/useDialog";
import { showToast } from "@/components/base/toast";
import {
    internalFakeSoundKey,
    sortIndexSymbol,
    timeStampSymbol,
} from "@/constants/commonConst";
import { MusicRepeatMode } from "@/constants/repeatModeConst";
import delay from "@/utils/delay";
import { normalizeDurationSec } from "@/utils/durationUtil";
import getUrlExt from "@/utils/getUrlExt";
import { errorLog, trace } from "@/utils/log";
import { createMediaIndexMap } from "@/utils/mediaIndexMap";
import {
    getLocalPath,
    isSameMediaItem,
} from "@/utils/mediaUtils";
import Network from "@/utils/network";
import PersistStatus from "@/utils/persistStatus";
import { getQualityOrder } from "@/utils/qualities";
import { musicIsPaused } from "@/utils/trackUtils";
import EventEmitter from "eventemitter3";
import { produce } from "immer";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import shuffle from "lodash.shuffle";
import ReactNativeTrackPlayer, {
    Event,
    State,
    Track,
    TrackMetadataBase,
    usePlaybackState,
    useProgress,
} from "react-native-track-player";
import LocalMusicSheet from "../localMusicSheet";
import { matchMusic, prewarmApiSongs, platformMatches } from "../playMatcher";
import pluginReliability from "../pluginReliability";
import { ensureSoundEffectAttached } from "@/core/soundEffect";

import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import type { IAppConfig } from "@/types/core/config";
import type { IMusicHistory } from "@/types/core/musicHistory";
import { ITrackPlayer } from "@/types/core/trackPlayer/index";
import minDistance from "@/utils/minDistance";
import { IPluginManager } from "@/types/core/pluginManager";
import { ImgAsset } from "@/constants/assetsConst";
import { resolveImportedAssetOrPath } from "@/utils/fileUtils";



const currentMusicAtom = atom<IMusic.IMusicItem | null>(null);
const repeatModeAtom = atom<MusicRepeatMode>(MusicRepeatMode.QUEUE);
const qualityAtom = atom<IMusic.IQualityKey>("standard");
const playListAtom = atom<IMusic.IMusicItem[]>([]);


class TrackPlayer extends EventEmitter<{
    [TrackPlayerEvents.PlayEnd]: () => void;
    [TrackPlayerEvents.CurrentMusicChanged]: (musicItem: IMusic.IMusicItem | null) => void;
    [TrackPlayerEvents.ProgressChanged]: (progress: {
        position: number;
        duration: number;
    }) => void;
}> implements ITrackPlayer {
    // 依赖
    private configService!: IAppConfig;
    private musicHistoryService!: IMusicHistory;
    private pluginManagerService!: IPluginManager;

    // 当前播放的音乐下标
    private currentIndex = -1;
    // 音乐播放器服务是否启动
    private serviceInited = false;
    // 播放器未初始化的重试计数（仅允许一次，避免无限递归）
    private playerInitRetries = 0;
    // 播放失败重试状态：playRetryScheduled 表示已调度/正在执行重试（期间重复的错误事件直接忽略）；
    // playRetryFailed 表示重试已发起且仍失败（再次进入 handlePlayFail 时提示并切下一首）。
    // 播放成功、切歌/换当前曲时两者一并复位。
    private playRetryScheduled = false;
    private playRetryFailed = false;
    // 播放队列索引map
    private playListIndexMap = createMediaIndexMap([] as IMusic.IMusicItem[]);


    private static maxMusicQueueLength = 10000;
    private static halfMaxMusicQueueLength = 5000;
    private static toggleRepeatMapping = {
        [MusicRepeatMode.SHUFFLE]: MusicRepeatMode.SINGLE,
        [MusicRepeatMode.SINGLE]: MusicRepeatMode.QUEUE,
        [MusicRepeatMode.QUEUE]: MusicRepeatMode.SHUFFLE,
    };
    private static fakeAudioUrl = "musicfree://fake-audio";
    private static proposedAudioUrl = "musicfree://proposed-audio";

    constructor() {
        super();
    }

    public get previousMusic() {
        const currentMusic = this.currentMusic;
        if (!currentMusic) {
            return null;
        }

        return this.getPlayListMusicAt(this.currentIndex - 1);
    }

    public get currentMusic() {
        return getDefaultStore().get(currentMusicAtom);
    }

    public get nextMusic() {
        const currentMusic = this.currentMusic;
        if (!currentMusic) {
            return null;
        }

        return this.getPlayListMusicAt(this.currentIndex + 1);
    }

    public get repeatMode() {
        return getDefaultStore().get(repeatModeAtom);
    }

    public get quality() {
        return getDefaultStore().get(qualityAtom);
    }

    public get playList() {
        return getDefaultStore().get(playListAtom);
    }


    injectDependencies(configService: IAppConfig, musicHistoryService: IMusicHistory, pluginManager: IPluginManager): void {
        this.configService = configService;
        this.musicHistoryService = musicHistoryService;
        this.pluginManagerService = pluginManager;
    }


    async setupTrackPlayer() {
        const rate = PersistStatus.get("music.rate");
        const musicQueue = PersistStatus.get("music.playList");
        const repeatMode = PersistStatus.get("music.repeatMode");
        const progress = PersistStatus.get("music.progress");
        const track = PersistStatus.get("music.musicItem");
        const quality =
            PersistStatus.get("music.quality") ||
            this.configService.getConfig("basic.defaultPlayQuality") ||
            "standard";

        // 状态恢复
        if (rate) {
            ReactNativeTrackPlayer.setRate(+rate / 100);
        }
        if (repeatMode) {
            getDefaultStore().set(repeatModeAtom, repeatMode as MusicRepeatMode);
        }

        if (musicQueue && Array.isArray(musicQueue)) {
            this.addAll(
                musicQueue,
                undefined,
                repeatMode === MusicRepeatMode.SHUFFLE,
            );
        }

        if (track && this.isInPlayList(track)) {
            if (!this.configService.getConfig("basic.autoPlayWhenAppStart")) {
                track.isInit = true;
            }

            // 异步（平台名与插件 name 不一致时按平台关键词兜底，保证启动恢复能拿到源）
            let resumePlugin = this.pluginManagerService.getByMedia(track);
            if (!resumePlugin) {
                resumePlugin = this.pluginManagerService
                    .getSearchablePlugins("music")
                    .find(p =>
                        platformMatches(
                            p.instance.platform,
                            track.platform,
                        ),
                    );
            }
            resumePlugin
                ?.methods.getMediaSource(track, quality)
                .then(async newSource => {
                    track.url = newSource?.url || track.url;
                    track.headers = newSource?.headers || track.headers;

                    if (isSameMediaItem(this.currentMusic, track)) {
                        // 开启自动续播时 track.isInit 为 false → autoPlay 为 true；
                        // 关闭时置 isInit=true → 不自动播放（与 L158-160 的本意一致）
                        await this.setTrackSource(track as Track, !track.isInit);
                        if (progress) {
                            // 异步（此时队列已就绪，seekTo 在此处正确执行）
                            this.seekTo(progress);
                        }
                    }
                });
            this.setCurrentMusic(track);
        }

        if (!this.serviceInited) {

            /**
             * 此事件可能会被触发多次（比如直接替换queue） 参考代码：https://github.com/doublesymmetry/KotlinAudio
             */
            ReactNativeTrackPlayer.addEventListener(
                Event.PlaybackActiveTrackChanged,
                async evt => {
                    // 均衡器兜底绑定（播放器就绪且有 session 时执行一次；不阻塞播放）
                    ensureSoundEffectAttached().catch(() => undefined);
                    if (
                        evt.index === 1 &&
                        evt.lastIndex === 0 &&
                        evt.track?.url === TrackPlayer.fakeAudioUrl
                    ) {
                        trace("队列末尾，播放下一首");
                        this.emit(TrackPlayerEvents.PlayEnd);
                        if (
                            this.repeatMode ===
                            MusicRepeatMode.SINGLE
                        ) {
                            await this.play(null, true);
                        } else {
                            // 当前生效的歌曲是下一曲的标记
                            await this.skipToNext();
                        }
                    }
                },
            );

            ReactNativeTrackPlayer.addEventListener(
                Event.PlaybackError,
                async e => {
                    errorLog("播放出错", e.message);
                    // WARNING: 不稳定，报错的时候有可能track已经变到下一首歌去了
                    const currentTrack =
                        await ReactNativeTrackPlayer.getActiveTrack();
                    if (currentTrack?.isInit) {
                        // HACK: 避免初始失败的情况
                        ReactNativeTrackPlayer.updateMetadataForTrack(0, {
                            ...currentTrack,
                            // @ts-ignore
                            isInit: undefined,
                        });
                        return;
                    }

                    if (
                        currentTrack?.url !== TrackPlayer.fakeAudioUrl && currentTrack?.url !== TrackPlayer.proposedAudioUrl &&
                        (await ReactNativeTrackPlayer.getActiveTrackIndex()) === 0 &&
                        e.message
                    ) {
                        trace("播放出错", {
                            message: e.message,
                            code: e.code,
                        });

                        // 已下载文件被删除（android-io-file-not-found）不再静默卡死，
                        // 统一走 handlePlayFail（自动下一首/提示）
                        this.handlePlayFail();
                    }
                },
            );

            this.serviceInited = true;
        }
    }

    /**************** 播放队列 ******************/
    getMusicIndexInPlayList(musicItem?: IMusic.IMusicItem | null) {
        if (!musicItem) {
            return -1;
        }
        return this.playListIndexMap.getIndex(musicItem);
    }

    isInPlayList(musicItem?: IMusic.IMusicItem | null) {
        if (!musicItem) {
            return false;
        }

        return this.playListIndexMap.has(musicItem);
    }

    getPlayListMusicAt(index: number): IMusic.IMusicItem | null {
        const playList = this.playList;
        const len = playList.length;
        if (len === 0) {
            return null;
        }
        return playList[(index + len) % len];
    }

    isPlayListEmpty() {
        return this.playList.length === 0;
    }

    /****** 播放逻辑 *****/
    addAll(
        musicItems: Array<IMusic.IMusicItem>,
        beforeIndex?: number,
        shouldShuffle?: boolean,
    ): void {
        const now = Date.now();
        let newPlayList: IMusic.IMusicItem[] = [];
        let currentPlayList = this.playList;
        musicItems.forEach((item, index) => {
            item[timeStampSymbol] = now;
            item[sortIndexSymbol] = index;
        });

        if (beforeIndex === undefined || beforeIndex < 0) {
            // 1.1. 添加到歌单末尾，并过滤掉已有的歌曲
            newPlayList = currentPlayList.concat(
                musicItems.filter(item => !this.isInPlayList(item)),
            );
        } else {
            // 1.2. 新的播放列表，插入
            const indexMap = createMediaIndexMap(musicItems);
            const beforeDraft = currentPlayList
                .slice(0, beforeIndex)
                .filter(item => !indexMap.has(item));
            const afterDraft = currentPlayList
                .slice(beforeIndex)
                .filter(item => !indexMap.has(item));

            newPlayList = [...beforeDraft, ...musicItems, ...afterDraft];
        }

        // 如果太长了
        if (newPlayList.length > TrackPlayer.maxMusicQueueLength) {
            newPlayList = this.shrinkPlayListToSize(
                newPlayList,
                beforeIndex ?? newPlayList.length - 1,
            );
        }

        // 2. 如果需要随机
        if (shouldShuffle) {
            newPlayList = shuffle(newPlayList);
        }
        // 3. 设置播放列表
        this.setPlayList(newPlayList);
    }

    add(
        musicItem: IMusic.IMusicItem | IMusic.IMusicItem[],
        beforeIndex?: number,
    ): void {
        this.addAll(
            Array.isArray(musicItem) ? musicItem : [musicItem],
            beforeIndex,
        );
    }

    addNext(musicItem: IMusic.IMusicItem | IMusic.IMusicItem[]): void {
        const shouldAutoPlay = this.isPlayListEmpty() || !this.currentMusic;

        this.add(musicItem, this.currentIndex + 1);

        if (shouldAutoPlay) {
            this.play(Array.isArray(musicItem) ? musicItem[0] : musicItem);
        }
    }

    async remove(musicItem: IMusic.IMusicItem): Promise<void> {
        const playList = this.playList;

        let newPlayList: IMusic.IMusicItem[] = [];
        let currentMusic: IMusic.IMusicItem | null = this.currentMusic;
        const targetIndex = this.getMusicIndexInPlayList(musicItem);
        let shouldPlayCurrent: boolean | null = null;
        if (targetIndex === -1) {
            // 1. 这种情况应该是出错了
            return;
        }
        // 2. 移除的是当前项
        if (this.currentIndex === targetIndex) {
            // 2.1 停止播放，移除当前项
            newPlayList = produce(playList, draft => {
                draft.splice(targetIndex, 1);
            });
            // 2.2 设置新的播放列表，并更新当前音乐
            if (newPlayList.length === 0) {
                currentMusic = null;
                shouldPlayCurrent = false;
            } else {
                currentMusic = newPlayList[this.currentIndex % newPlayList.length];
                try {
                    const state = (
                        await ReactNativeTrackPlayer.getPlaybackState()
                    ).state;
                    shouldPlayCurrent = !musicIsPaused(state);
                } catch {
                    shouldPlayCurrent = false;
                }
            }
            this.setCurrentMusic(currentMusic);
        } else {
            // 3. 删除
            newPlayList = produce(playList, draft => {
                draft.splice(targetIndex, 1);
            });
        }

        this.setPlayList(newPlayList);
        if (shouldPlayCurrent === true) {
            await this.play(currentMusic, true);
        } else if (shouldPlayCurrent === false) {
            await ReactNativeTrackPlayer.reset();
        }
    }

    isCurrentMusic(musicItem?: IMusic.IMusicItem | null) {
        return isSameMediaItem(musicItem, this.currentMusic);
    }

    async play(
        musicItem?: IMusic.IMusicItem | null,
        forcePlay?: boolean,
    ): Promise<void> {
        try {
            // 如果不传参，默认是播放当前音乐
            if (!musicItem) {
                musicItem = this.currentMusic;
            }
            if (!musicItem) {
                throw new Error(PlayFailReason.PLAY_LIST_IS_EMPTY);
            }
            // 0. 接口数据源（推荐歌单/榜单接口歌曲，无音频地址）：
            //    播放前匹配"我们的源"（≤2 个源），命中 → 用匹配歌曲播放；失败 → 走原歌解析（失败由播放器自动下一首）
            if (musicItem && musicItem.apiSource) {
                const matched = await matchMusic(musicItem);
                if (matched) {
                    // 匹配可达数秒：期间用户可能已切歌，匹配结果不得劫持新播放队列
                    if (!this.isCurrentMusic(musicItem)) {
                        return;
                    }
                    // 用匹配结果原位替换队列中的接口歌曲（保持队列结构与连播顺序，
                    // 否则 matched 被 add 到队尾会导致 currentIndex 错位、下一首越界）
                    this.replaceInPlayList(musicItem, matched);
                    return this.play(matched, forcePlay);
                }
            }
            // 1. 移动网络禁止播放
            const localPath = getLocalPath(musicItem);
            if (
                Network.isCellular &&
                this.configService.getConfig("basic.useCelluarNetworkPlay") ===
                    false &&
                !LocalMusicSheet.isLocalMusic(musicItem) &&
                !localPath
            ) {
                await ReactNativeTrackPlayer.reset();
                throw new Error(PlayFailReason.FORBID_CELLUAR_NETWORK_PLAY);
            }

            // 2. 如果是当前正在播放的音频
            if (this.isCurrentMusic(musicItem)) {
                // 获取底层播放器中的track
                const currentTrack = await ReactNativeTrackPlayer.getTrack(0);
                // 2.1 如果当前有源
                if (
                    currentTrack?.url &&
                    isSameMediaItem(
                        musicItem,
                        currentTrack as IMusic.IMusicItem,
                    )
                ) {
                    const currentActiveIndex =
                        await ReactNativeTrackPlayer.getActiveTrackIndex();
                    if (currentActiveIndex !== 0) {
                        await ReactNativeTrackPlayer.skip(0);
                    }
                    if (forcePlay) {
                        // 2.1.1 强制重新开始
                        await this.seekTo(0);
                    }
                    const currentState = (
                        await ReactNativeTrackPlayer.getPlaybackState()
                    ).state;
                    if (currentState === State.Stopped) {
                        await this.setTrackSource(currentTrack);
                    }
                    if (currentState !== State.Playing) {
                        // 2.1.2 恢复播放
                        await ReactNativeTrackPlayer.play();
                    }
                    // 这种情况下，播放队列和当前歌曲都不需要变化
                    return;
                }
                // 2.2 其他情况：重新获取源
            }

            // 3. 如果没有在播放列表中，添加到队尾；同时更新列表状态
            const inPlayList = this.isInPlayList(musicItem);
            if (!inPlayList) {
                this.add(musicItem);
            }

            // 4. 更新列表状态和当前音乐
            this.setCurrentMusic(musicItem);
            await ReactNativeTrackPlayer.setQueue([{
                ...musicItem,
                url: TrackPlayer.proposedAudioUrl,
                artwork: resolveImportedAssetOrPath(musicItem.artwork?.trim?.()?.length ? musicItem.artwork : ImgAsset.albumDefault) as unknown as any,
            }, this.getFakeNextTrack()]);

            // 5. 获取音源
            let track: IMusic.IMusicItem;

            // 5.1 通过插件获取音源
            // 平台名与插件 name 不一致时（如接口歌曲 platform="网易云" vs 插件 name="网易云音乐"），
            // getByName 会返回 null 导致原 id 解析失败 —— 按平台关键词匹配已启用插件兜底
            const itemPlatform = musicItem.platform;
            let plugin = this.pluginManagerService.getByName(itemPlatform);
            if (!plugin) {
                plugin = this.pluginManagerService
                    .getSearchablePlugins("music")
                    .find(p =>
                        platformMatches(p.instance.platform, itemPlatform),
                    );
            }
            // 5.2 获取音质排序
            const qualityOrder = getQualityOrder(
                this.configService.getConfig("basic.defaultPlayQuality") ?? "standard",
                this.configService.getConfig("basic.playQualityOrder") ?? "asc",
            );
            // 5.3 插件返回音源
            let source: IPlugin.IMediaSourceResult | null = null;
            for (let quality of qualityOrder) {
                if (this.isCurrentMusic(musicItem)) {
                    source =
                        (await plugin?.methods?.getMediaSource(
                            musicItem,
                            quality,
                        )) ?? null;
                    // 5.3.1 获取到真实源
                    if (source) {
                        this.setQuality(quality);
                        // 记录音源可用率：解析成功
                        pluginReliability.recordResult(
                            plugin?.instance?.platform,
                            true,
                        );
                        break;
                    }
                } else {
                    // 5.3.2 已经切换到其他歌曲了，
                    return;
                }
            }

            if (!this.isCurrentMusic(musicItem)) {
                return;
            }
            if (!source) {
                // 如果有source
                if (musicItem.source) {
                    for (let quality of qualityOrder) {
                        if (musicItem.source[quality]?.url) {
                            source = musicItem.source[quality]!;
                            this.setQuality(quality);

                            break;
                        }
                    }
                }
                // 5.4 没有返回源
                if (!source && !musicItem.url) {
                    // 记录音源可用率：解析失败
                    pluginReliability.recordResult(
                        plugin?.instance?.platform,
                        false,
                    );
                    // 插件失效的情况（播放失败自动切换音源，默认开启）
                    if (this.configService.getConfig("basic.tryChangeSourceWhenPlayFail") ?? true) {
                        // 重试
                        const similarMusic = await this.getSimilarMusic(
                            musicItem,
                            "music",
                            () => !this.isCurrentMusic(musicItem),
                        );

                        if (similarMusic) {
                            const similarMusicPlugin =
                                this.pluginManagerService.getByMedia(similarMusic);

                            for (let quality of qualityOrder) {
                                if (this.isCurrentMusic(musicItem)) {
                                    source =
                                        (await similarMusicPlugin?.methods?.getMediaSource(
                                            similarMusic,
                                            quality,
                                        )) ?? null;
                                    // 5.4.1 获取到真实源
                                    if (source) {
                                        this.setQuality(quality);
                                        // 记录音源可用率：换源成功
                                        pluginReliability.recordResult(
                                            similarMusicPlugin?.instance?.platform,
                                            true,
                                        );
                                        break;
                                    }
                                } else {
                                    // 5.4.2 已经切换到其他歌曲了，
                                    return;
                                }
                            }
                        }

                        if (!source) {
                            throw new Error(PlayFailReason.INVALID_SOURCE);
                        }
                    } else {
                        throw new Error(PlayFailReason.INVALID_SOURCE);
                    }
                } else {
                    source = {
                        url: musicItem.url,
                    };
                    this.setQuality("standard");
                }
            }

            // 6. 特殊类型源
            if (getUrlExt(source.url) === ".m3u8") {
                // @ts-ignore
                source.type = "hls";
            }
            // 7. 合并结果
            track = this.mergeTrackSource(musicItem, source) as IMusic.IMusicItem;

            // 先设置音源（不等待补充信息，避免播放被元数据请求阻塞）
            trace("获取音源成功", track);
            // 8. 设置音源
            await this.setTrackSource(track as Track);
            // 播放链路成功，重置"未初始化"重试计数与本曲失败重试状态
            this.playerInitRetries = 0;
            this.playRetryScheduled = false;
            this.playRetryFailed = false;

            // 9. 获取补充信息
            let info: Partial<IMusic.IMusicItem> | null = null;
            try {
                info =
                    (await plugin?.methods?.getMusicInfo?.(musicItem)) ?? null;
                if (
                    (typeof info?.url === "string" && info.url.trim() === "") ||
                    (info?.url && typeof info.url !== "string")
                ) {
                    delete info.url;
                }
            } catch { }

            // 10. 新增历史记录（在补充信息之后：合并 duration，供"听歌时长"统计；
            // 网络歌曲点击播放时 duration 常缺失，需用补充信息补全后再写入）
            this.musicHistoryService.addMusic({
                ...musicItem,
                duration: normalizeDurationSec(
                    info?.duration ?? track.duration ?? musicItem.duration,
                ),
            } as IMusic.IMusicItem);

            // 10.5 时长回填：第三方音源常缺 duration（历史条目 duration=0 → 统计 0 分钟），
            // 播放器实际解析出时长后回填，保证听歌时长统计有效（不阻塞播放）
            this.backfillHistoryDuration(musicItem);

            // 11. 设置补充信息
            if (info && this.isCurrentMusic(musicItem)) {
                const mergedTrack = this.mergeTrackSource(track, info);
                getDefaultStore().set(currentMusicAtom, mergedTrack as IMusic.IMusicItem);
                await ReactNativeTrackPlayer.updateMetadataForTrack(
                    0,
                    mergedTrack as TrackMetadataBase,
                );
            }
        } catch (e: any) {
            const message = e?.message;
            if (
                message ===
                "The player is not initialized. Call setupPlayer first."
            ) {
                // setupPlayer 持续失败时叠加重试会无限递归：仅允许重试一次
                if (this.playerInitRetries >= 1) {
                    this.playerInitRetries = 0;
                    await this.handlePlayFail();
                    return;
                }
                this.playerInitRetries += 1;
                await ReactNativeTrackPlayer.setupPlayer();
                return this.play(musicItem, forcePlay);
            } else if (message === PlayFailReason.FORBID_CELLUAR_NETWORK_PLAY) {
                if (getCurrentDialog()?.name !== "SimpleDialog") {
                    showDialog("SimpleDialog", {
                        title: "流量提醒",
                        content:
                            "当前非WIFI环境，侧边栏设置中打开【使用移动网络播放】功能后可继续播放",
                    });
                }
            } else if (message === PlayFailReason.INVALID_SOURCE) {
                trace("音源为空，播放失败");
                await this.handlePlayFail();
            } else if (message === PlayFailReason.PLAY_LIST_IS_EMPTY) {
                // 队列是空的，不应该出现这种情况
            } else {
                // 未识别的异常（网络抖动/插件崩溃/播放器内部错误等）：不再静默吞掉。
                // 代际守卫：仅当失败的仍是当前曲才处理，避免异步竞态下处理到别的歌；
                // 统一走 handlePlayFail（重试当前曲一次，仍失败则提示并切下一首）。
                if (this.isCurrentMusic(musicItem)) {
                    await this.handlePlayFail();
                }
            }
        }
    }

    async pause(): Promise<void> {
        await ReactNativeTrackPlayer.pause();
    }

    toggleRepeatMode(): void {
        this.setRepeatMode(TrackPlayer.toggleRepeatMapping[this.repeatMode]);
    }

    // 清空播放队列
    async clearPlayList(): Promise<void> {
        this.setPlayList([]);
        this.setCurrentMusic(null);

        await ReactNativeTrackPlayer.reset();
        PersistStatus.set("music.musicItem", undefined);
        PersistStatus.set("music.progress", 0);
    }

    async skipToNext(): Promise<void> {
        if (this.isPlayListEmpty()) {
            this.setCurrentMusic(null);
            return;
        }

        await this.play(this.getPlayListMusicAt(this.currentIndex + 1), true);
    }

    async skipToPrevious(): Promise<void> {
        if (this.isPlayListEmpty()) {
            this.setCurrentMusic(null);
            return;
        }

        await this.play(
            this.getPlayListMusicAt(this.currentIndex === -1 ? 0 : this.currentIndex - 1),
            true,
        );
    }

    async changeQuality(newQuality: IMusic.IQualityKey): Promise<boolean> {
        // 获取当前的音乐和进度
        if (newQuality === this.quality) {
            return true;
        }

        // 获取当前歌曲
        const musicItem = this.currentMusic;
        if (!musicItem) {
            return false;
        }
        try {
            const progress = await ReactNativeTrackPlayer.getProgress();
            let plugin = this.pluginManagerService.getByMedia(musicItem);
            if (!plugin) {
                plugin = this.pluginManagerService
                    .getSearchablePlugins("music")
                    .find(p =>
                        platformMatches(
                            p.instance.platform,
                            musicItem.platform,
                        ),
                    );
            }
            const newSource = await plugin?.methods?.getMediaSource(
                musicItem,
                newQuality,
            );
            if (!newSource?.url) {
                throw new Error(PlayFailReason.INVALID_SOURCE);
            }
            if (this.isCurrentMusic(musicItem)) {
                const playingState = (
                    await ReactNativeTrackPlayer.getPlaybackState()
                ).state;
                await this.setTrackSource(
                    this.mergeTrackSource(musicItem, newSource) as unknown as Track,
                    !musicIsPaused(playingState),
                );

                await this.seekTo(progress.position ?? 0);
                this.setQuality(newQuality);
            }
            return true;
        } catch {
            // 修改失败
            return false;
        }
    }

    async playWithReplacePlayList(
        musicItem: IMusic.IMusicItem,
        newPlayList: IMusic.IMusicItem[],
    ): Promise<void> {
        if (newPlayList.length !== 0) {
            const now = Date.now();
            if (newPlayList.length > TrackPlayer.maxMusicQueueLength) {
                newPlayList = this.shrinkPlayListToSize(
                    newPlayList,
                    newPlayList.findIndex(it => isSameMediaItem(it, musicItem)),
                );
            }

            newPlayList.forEach((it, index) => {
                it[timeStampSymbol] = now;
                it[sortIndexSymbol] = index;
            });

            this.setPlayList(
                this.repeatMode === MusicRepeatMode.SHUFFLE
                    ? shuffle(newPlayList)
                    : newPlayList,
            );
            await this.play(musicItem, true);
            // 后台预热队列中的接口歌曲（推荐歌单/榜单无音频地址的歌）：
            // 节流 ≤3 并发、每首间隔 2.5s 预匹配，轮到时命中缓存；失败不影响播放
            if (newPlayList.length) {
                void prewarmApiSongs(newPlayList).catch(() => undefined);
            }
        }
    }

    async seekTo(progress: number) {
        PersistStatus.set("music.progress", progress);
        return ReactNativeTrackPlayer.seekTo(progress);
    }

    getProgress = ReactNativeTrackPlayer.getProgress.bind(ReactNativeTrackPlayer);
    getRate = ReactNativeTrackPlayer.getRate.bind(ReactNativeTrackPlayer);
    setRate = ReactNativeTrackPlayer.setRate.bind(ReactNativeTrackPlayer);
    reset = ReactNativeTrackPlayer.reset.bind(ReactNativeTrackPlayer);


    /**************** 辅助函数 -- 设置内部状态 ****************/

    private setCurrentMusic(musicItem?: IMusic.IMusicItem | null) {
        // 切歌/换当前曲时复位播放失败重试状态；同一首歌的重复设置不复位
        // （否则重试链路 play() 内部 :499 的 setCurrentMusic 会把状态清掉，造成无限重试）
        if (!isSameMediaItem(musicItem, this.currentMusic)) {
            this.playRetryScheduled = false;
            this.playRetryFailed = false;
        }
        // 设置UI内部状态的musicitem
        if (!musicItem) {
            this.currentIndex = -1;
            getDefaultStore().set(currentMusicAtom, null);
            PersistStatus.set("music.musicItem", undefined);
            PersistStatus.set("music.progress", 0);

            this.emit(TrackPlayerEvents.CurrentMusicChanged, null);
            return;
        }
        if (typeof musicItem.artwork !== "string") {
            musicItem.artwork = ImgAsset.albumDefault;
        }
        this.currentIndex = this.getMusicIndexInPlayList(musicItem);
        getDefaultStore().set(currentMusicAtom, musicItem);

        this.emit(TrackPlayerEvents.CurrentMusicChanged, musicItem);
    }

    private setRepeatMode(mode: MusicRepeatMode) {
        const playList = this.playList;
        let newPlayList: IMusic.IMusicItem[];
        const prevMode = getDefaultStore().get(repeatModeAtom);
        if (
            (prevMode === MusicRepeatMode.SHUFFLE &&
                mode !== MusicRepeatMode.SHUFFLE) ||
            (mode === MusicRepeatMode.SHUFFLE &&
                prevMode !== MusicRepeatMode.SHUFFLE)
        ) {
            if (mode === MusicRepeatMode.SHUFFLE) {
                newPlayList = shuffle(playList);
            } else {
                newPlayList = this.sortByTimestampAndIndex(playList, true);
            }
            this.setPlayList(newPlayList);
        }

        getDefaultStore().set(repeatModeAtom, mode);
        // 更新下一首歌的信息
        ReactNativeTrackPlayer.updateMetadataForTrack(
            1,
            this.getFakeNextTrack(),
        );
        // 记录
        PersistStatus.set("music.repeatMode", mode);
    }

    private setQuality(quality: IMusic.IQualityKey) {
        getDefaultStore().set(qualityAtom, quality);
        PersistStatus.set("music.quality", quality);
    }

    // 设置音源
    private async setTrackSource(track: Track, autoPlay = true) {
        const clonedTrack = this.patchMediaArtwork(track);
        if (!clonedTrack) {
            return;
        }
        await ReactNativeTrackPlayer.setQueue([clonedTrack, this.getFakeNextTrack()]);
        PersistStatus.set("music.musicItem", track as IMusic.IMusicItem);
        PersistStatus.set("music.progress", 0);
        if (autoPlay) {
            await ReactNativeTrackPlayer.play();
        }
    }

    /**
     * 设置播放队列
     * @param newPlayList 播放队列
     * @param persist 是否持久化
     */
    private setPlayList(newPlayList: IMusic.IMusicItem[], persist = true) {
        getDefaultStore().set(playListAtom, newPlayList);

        this.playListIndexMap = createMediaIndexMap(newPlayList);

        if (persist) {
            PersistStatus.set("music.playList", newPlayList);
        }

        this.currentIndex = this.getMusicIndexInPlayList(this.currentMusic);
    }

    /**
     * 用匹配结果原位替换队列中的歌曲（接口歌曲 → 匹配到的可播放歌曲）。
     * 保持队列结构与播放顺序，避免 matched 追加队尾导致 currentIndex 错位、连播越界。
     * @param origin 原歌曲（在队列中）
     * @param replacement 匹配结果（原位替换）
     */
    private replaceInPlayList(
        origin: IMusic.IMusicItem,
        replacement: IMusic.IMusicItem,
    ) {
        const list = this.playList;
        const idx = this.getMusicIndexInPlayList(origin);
        if (idx < 0) {
            // 单曲播放（未入队）场景：无需替换，后续 add 到队尾即只有这一首
            return;
        }
        const newList = [...list];
        newList[idx] = replacement;
        this.setPlayList(newList, true);
    }

    /** 时长回填（异步，不阻塞播放）：第三方音源常缺 duration → 历史条目 0 时长 →
     * 听歌时长统计为 0；轮询播放器实际解析时长（最长约 6s），拿到有效值后回填历史。
     * 已切歌 / 播放器异常时静默放弃。 */
    private backfillHistoryDuration(musicItem: IMusic.IMusicItem) {
        (async () => {
            try {
                for (let i = 0; i < 12; i++) {
                    if (!this.isCurrentMusic(musicItem)) {
                        return; // 已切歌，放弃回填
                    }
                    const progress = await ReactNativeTrackPlayer.getProgress();
                    const d = progress?.duration;
                    if (d && d > 0 && Number.isFinite(d)) {
                        await this.musicHistoryService.updateDuration(
                            musicItem,
                            d,
                        );
                        return;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch {
                // 拿不到实际时长不影响播放
            }
        })();
    }


    /**************** 辅助函数 -- 工具方法 ****************/
    private shrinkPlayListToSize = (
        queue: IMusic.IMusicItem[],
        targetIndex = this.currentIndex,
    ) => {
        // 播放列表上限，太多无法缓存状态
        if (queue.length > TrackPlayer.maxMusicQueueLength) {
            if (targetIndex < TrackPlayer.halfMaxMusicQueueLength) {
                queue = queue.slice(0, TrackPlayer.maxMusicQueueLength);
            } else {
                const right = Math.min(
                    queue.length,
                    targetIndex + TrackPlayer.halfMaxMusicQueueLength,
                );
                const left = Math.max(0, right - TrackPlayer.maxMusicQueueLength);
                queue = queue.slice(left, right);
            }
        }
        return queue;
    };

    private mergeTrackSource(
        mediaItem: ICommon.IMediaBase,
        props: Record<string, any> | undefined,
    ) {
        return props
            ? {
                ...mediaItem,
                ...props,
                id: mediaItem.id,
                platform: mediaItem.platform,
            }
            : mediaItem;
    }

    private sortByTimestampAndIndex(array: any[], newArray = false) {
        if (newArray) {
            array = [...array];
        }
        return array.sort((a, b) => {
            const ts = a[timeStampSymbol] - b[timeStampSymbol];
            if (ts !== 0) {
                return ts;
            }
            return a[sortIndexSymbol] - b[sortIndexSymbol];
        });
    }

    private getFakeNextTrack() {
        let track: Track | undefined;
        const repeatMode = this.repeatMode;
        if (repeatMode === MusicRepeatMode.SINGLE) {
            // 单曲循环
            track = this.getPlayListMusicAt(this.currentIndex) as Track;
        } else {
            // 下一曲
            track = this.getPlayListMusicAt(this.currentIndex + 1) as Track;
        }

        if (track) {
            return produce(track, _ => {
                _.url = TrackPlayer.fakeAudioUrl;
                _.$ = internalFakeSoundKey;
                _.artwork = resolveImportedAssetOrPath(ImgAsset.albumDefault) as unknown as any;
            });
        } else {
            // 只有列表长度为0时才会出现的特殊情况
            return {
                url: TrackPlayer.fakeAudioUrl,
                $: internalFakeSoundKey,
            } as Track;
        }
    }


    private async handlePlayFail() {
        // 自动停止模式：保持既有行为——toast 提示，不重试、不切歌
        if (this.configService.getConfig("basic.autoStopWhenError")) {
            showToast({
                type: "warn",
                message: "播放失败",
            });
            return;
        }
        const currentMusic = this.currentMusic;
        // 无当前曲：队列已空，无事可做
        if (!currentMusic) {
            return;
        }
        // 已重试过仍失败：提示 + 500ms 后切下一首（保证连跳时不静默）
        if (this.playRetryFailed) {
            showToast({
                type: "warn",
                message: "播放失败",
            });
            await delay(500);
            await this.skipToNext();
            return;
        }
        // 重试已在调度/进行中：同一播放错误可能多次触发 PlaybackError 事件，
        // 此处直接忽略，等待本次重试结果（重试失败会经 play() 的 catch 再次进入本方法）
        if (this.playRetryScheduled) {
            return;
        }
        // 首次失败：延迟 2.5s 后重试当前曲一次
        this.playRetryScheduled = true;
        await delay(2500);
        // 竞态守卫：delay 期间用户可能已手动切歌/换曲，重试前再确认仍是同一首，
        // 否则不接管、不跳歌（新的播放链路自己负责）
        if (!this.isCurrentMusic(currentMusic)) {
            return;
        }
        // 标记"重试已发起"：本次重试若再失败，将走上面的提示+切歌分支；
        // reset 清空占位/错误队列，强制重新走取源流程（否则 2.1 分支会把
        // proposedAudioUrl 占位当成"已有源"，直接重播占位 URL 而不重新解析）
        this.playRetryFailed = true;
        await ReactNativeTrackPlayer.reset();
        await this.play(currentMusic, true);
    }

    /**
 *
 * @param musicItem 音乐类型
 * @param type 媒体类型
 * @param abortFunction 如果函数为true，则中断
 * @returns
 */
    private async getSimilarMusic<T extends ICommon.SupportMediaType>(
        musicItem: IMusic.IMusicItem,
        type: T = "music" as T,
        abortFunction?: () => boolean,
    ): Promise<ICommon.SupportMediaItemBase[T] | null> {
        const keyword = musicItem.alias || musicItem.title;
        const plugins = this.pluginManagerService.getSearchablePlugins(type);

        let distance = Infinity;
        let minDistanceMusicItem;
        let targetPlugin;

        const startTime = Date.now();

        for (let plugin of plugins) {
            // 超时时间：8s
            if (abortFunction?.() || Date.now() - startTime > 8000) {
                break;
            }
            if (plugin.name === musicItem.platform) {
                continue;
            }
            const results = await plugin.methods
                .search(keyword, 1, type)
                .catch(() => null);

            // 取前两个
            const firstTwo = results?.data?.slice(0, 2) || [];

            for (let item of firstTwo) {
                if (item.title === keyword && item.artist === musicItem.artist) {
                    distance = 0;
                    minDistanceMusicItem = item;
                    targetPlugin = plugin;
                    break;
                } else {
                    const dist =
                        minDistance(keyword, musicItem.title) +
                        minDistance(item.artist, musicItem.artist);
                    if (dist < distance) {
                        distance = dist;
                        minDistanceMusicItem = item;
                        targetPlugin = plugin;
                    }
                }
            }

            if (distance === 0) {
                break;
            }
        }
        if (minDistanceMusicItem && targetPlugin) {
            return minDistanceMusicItem as ICommon.SupportMediaItemBase[T];
        }

        return null;
    }


    private patchMediaArtwork(track: Track) {
        // Bug: React native track player 在设置音频时，artwork不能为null，并且部分情况下artwork不能为ImageSource类型
        if (!track) {
            return null;
        }
        return {
            ...track,
            artwork: resolveImportedAssetOrPath(
                track.artwork?.trim?.()?.length ? track.artwork : ImgAsset.albumDefault,
            ) as unknown as any,
        };
    }

}

export const usePlayList = () => useAtomValue(playListAtom);
export const useCurrentMusic = () => useAtomValue(currentMusicAtom);
export const useRepeatMode = () => useAtomValue(repeatModeAtom);
export const useMusicQuality = () => useAtomValue(qualityAtom);
export function useMusicState() {
    const playbackState = usePlaybackState();

    return playbackState.state;
}
export { State as MusicState, useProgress };

enum PlayFailReason {
    /** 禁止移动网络播放 */
    FORBID_CELLUAR_NETWORK_PLAY = "FORBID_CELLUAR_NETWORK_PLAY",
    /** 播放列表为空 */
    PLAY_LIST_IS_EMPTY = "PLAY_LIST_IS_EMPTY",
    /** 无效源 */
    INVALID_SOURCE = "INVALID_SOURCE",
    /** 非当前音乐 */
}

const trackPlayer = new TrackPlayer();
export default trackPlayer;