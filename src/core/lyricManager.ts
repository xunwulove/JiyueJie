import { IAppConfig } from "@/types/core/config";
import { ITrackPlayer } from "@/types/core/trackPlayer";
import { IInjectable } from "@/types/infra";
import LyricParser, { IParsedLrcItem } from "@/utils/lrcParser";
import { getMediaExtraProperty, patchMediaExtra } from "@/utils/mediaExtra";
import { isSameMediaItem } from "@/utils/mediaUtils";
import minDistance from "@/utils/minDistance";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { Plugin } from "./pluginManager";
import pluginReliability from "./pluginReliability";

import LyricUtil from "@/native/lyricUtil";
import PersistStatus from "@/utils/persistStatus";
import RNTrackPlayer, { Event } from "react-native-track-player";
import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import { IPluginManager } from "@/types/core/pluginManager";


interface ILyricState {
    loading: boolean;
    lyrics: IParsedLrcItem[];
    hasTranslation: boolean;
    meta?: Record<string, string>;
}

const defaultLyricState = {
    loading: true,
    lyrics: [],
    hasTranslation: false,
};

const lyricStateAtom = atom<ILyricState>(defaultLyricState);
const currentLyricItemAtom = atom<IParsedLrcItem | null>(null);


class LyricManager implements IInjectable {

    private trackPlayer!: ITrackPlayer;
    private appConfig!: IAppConfig;
    private pluginManager!: IPluginManager;

    private lyricParser: LyricParser | null = null;


    get currentLyricItem() {
        return getDefaultStore().get(currentLyricItemAtom);
    }

    get lyricState() {
        return getDefaultStore().get(lyricStateAtom);
    }

    injectDependencies(trackPlayerService: ITrackPlayer, appConfigService: IAppConfig, pluginManager: IPluginManager): void {
        this.trackPlayer = trackPlayerService;
        this.appConfig = appConfigService;
        this.pluginManager = pluginManager;
    }

    setup() {
        // 更新歌词
        this.trackPlayer.on(TrackPlayerEvents.CurrentMusicChanged, (musicItem) => {
            this.refreshLyric(true, true);

            if (this.appConfig.getConfig("lyric.showStatusBarLyric")) {
                if (musicItem) {
                    LyricUtil.setStatusBarLyricText(
                        `${musicItem.title} - ${musicItem.artist}`,);
                } else {
                    LyricUtil.setStatusBarLyricText("极悦界");
                }
            }
        });

        RNTrackPlayer.addEventListener(Event.PlaybackProgressUpdated, evt => {
            const parser = this.lyricParser;
            if (!parser || !this.trackPlayer.isCurrentMusic(parser.musicItem)) {
                return;
            }

            const currentLyricItem = getDefaultStore().get(currentLyricItemAtom);
            const newLyricItem = parser.getPosition(evt.position);


            if (currentLyricItem?.lrc !== newLyricItem?.lrc) {
                // 更新当前歌词状态
                getDefaultStore().set(currentLyricItemAtom, newLyricItem ?? null);

                // 更新状态栏歌词
                const showTranslation = PersistStatus.get("lyric.showTranslation");

                if (this.appConfig.getConfig("lyric.showStatusBarLyric")) {
                    LyricUtil.setStatusBarLyricText(
                        (newLyricItem?.lrc ?? "") +
                        (showTranslation
                            ? `\n${newLyricItem?.translation ?? ""}`
                            : ""),
                    );
                }
            }
        });


        if (this.appConfig.getConfig("lyric.showStatusBarLyric")) {
            const statusBarLyricConfig = {
                topPercent: this.appConfig.getConfig("lyric.topPercent"),
                leftPercent: this.appConfig.getConfig("lyric.leftPercent"),
                align: this.appConfig.getConfig("lyric.align"),
                color: this.appConfig.getConfig("lyric.color"),
                backgroundColor: this.appConfig.getConfig("lyric.backgroundColor"),
                widthPercent: this.appConfig.getConfig("lyric.widthPercent"),
                fontSize: this.appConfig.getConfig("lyric.fontSize"),
            };
            LyricUtil.showStatusBarLyric(
                "极悦界",
                statusBarLyricConfig ?? {}
            );
        }

        this.refreshLyric(true);
    }

    associateLyric(musicItem: IMusic.IMusicItem, linkToMusicItem: ICommon.IMediaBase) {
        if (!musicItem || !linkToMusicItem) {
            return false;
        }

        // 如果当前音乐项和关联的音乐项相同，则不需要重新关联
        if (isSameMediaItem(musicItem, linkToMusicItem)) {
            patchMediaExtra(musicItem, {
                associatedLrc: undefined,
                cachedLrc: undefined,
            });
            return false;
        } else {
            patchMediaExtra(musicItem, {
                associatedLrc: linkToMusicItem,
                // 更换歌词后旧缓存失效，避免 refreshLyric 命中旧歌词
                cachedLrc: undefined,
            });
            if (this.trackPlayer.isCurrentMusic(musicItem)) {
                this.refreshLyric(false);
            }
            return true;
        }
    }

    unassociateLyric(musicItem: IMusic.IMusicItem) {
        if (!musicItem) {
            return;
        }

        patchMediaExtra(musicItem, {
            associatedLrc: undefined,
            cachedLrc: undefined,
        });

        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            this.refreshLyric(false);
        }
    }

    /**
     * 强制重新获取歌词（"更换歌词"：清除本地缓存后重新走插件获取/自动搜索）。
     */
    async forceRefreshLyric(musicItem: IMusic.IMusicItem) {
        patchMediaExtra(musicItem, { cachedLrc: undefined });
        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            await this.refreshLyric(false, false);
        }
    }

    updateLyricOffset(musicItem: IMusic.IMusicItem, offset: number) {
        if (!musicItem) {
            return;
        }

        // 更新歌词偏移
        patchMediaExtra(musicItem, {
            lyricOffset: offset,
        });

        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            this.refreshLyric(true, false);
        }
    }

    private setLyricAsLoadingState() {
        getDefaultStore().set(lyricStateAtom, {
            loading: true,
            lyrics: [],
            hasTranslation: false,
        });
        getDefaultStore().set(currentLyricItemAtom, null);
    }

    private setLyricAsNoLyricState() {
        getDefaultStore().set(lyricStateAtom, {
            loading: false,
            lyrics: [],
            hasTranslation: false,
        });
        getDefaultStore().set(currentLyricItemAtom, null);
        if (this.appConfig.getConfig("lyric.showStatusBarLyric")) {
            const musicItem = this.trackPlayer.currentMusic;
            LyricUtil.setStatusBarLyricText(musicItem ? `${musicItem.title} - ${musicItem.artist}` : "极悦界");
        }
    }

    private async refreshLyric(skipFetchLyricSourceIfSame: boolean = true, ignoreProgress: boolean = false) {
        const currentMusicItem = this.trackPlayer.currentMusic;

        // 如果没有当前音乐项，重置歌词状态
        if (!currentMusicItem) {
            this.setLyricAsNoLyricState();
            return;
        }

        try {
            let lrcSource: ILyric.ILyricSource | null;

            if (skipFetchLyricSourceIfSame && this.lyricParser && this.trackPlayer.isCurrentMusic(this.lyricParser.musicItem)) {
                lrcSource = this.lyricParser.lyricSource ?? null;
            } else {
                // 重置歌词状态
                this.setLyricAsLoadingState();

                // 歌词本地缓存：上次获取/自动搜索成功后写入（mediaExtra.cachedLrc），
                // 重启/重新进入直接读取，避免每次进播放页都重复请求歌词
                const cachedLrc = getMediaExtraProperty(currentMusicItem, "cachedLrc");
                if (cachedLrc?.rawLrc) {
                    lrcSource = {
                        rawLrc: cachedLrc.rawLrc,
                        translation: cachedLrc.translation,
                    };
                } else {
                    const lyricPlugin = this.pluginManager.getByMedia(currentMusicItem);
                    lrcSource = (await lyricPlugin?.methods?.getLyric(currentMusicItem)) ?? null;
                    // 记录歌词可用率：远程获取成功=ok，空=失败（本地缓存分支不重复记）
                    if (lyricPlugin?.instance?.platform) {
                        void pluginReliability.recordLyricResult(
                            lyricPlugin.instance.platform,
                            !!lrcSource,
                        );
                    }

                    // 如果歌词源不存在，并且开启自动搜索歌词（默认开启：未显式关闭时自动搜索）
                    if (
                        !lrcSource &&
                        (this.appConfig.getConfig("lyric.autoSearchLyric") ?? true)
                    ) {
                        // 重置歌词状态
                        this.setLyricAsLoadingState();

                        lrcSource = await this.searchSimilarLyric(currentMusicItem);
                    }

                    // 获取成功（含自动搜索命中）后写入缓存；无 rawLrc 不缓存
                    if (lrcSource?.rawLrc) {
                        patchMediaExtra(currentMusicItem, {
                            cachedLrc: {
                                rawLrc: lrcSource.rawLrc,
                                translation: lrcSource.translation,
                            },
                        });
                    }
                }
            }

            // 切换到其他歌曲了, 直接返回
            if (!this.trackPlayer.isCurrentMusic(currentMusicItem)) {
                return;
            }

            // 如果源不存在，恢复默认设置
            if (!lrcSource) {
                this.setLyricAsNoLyricState();
                this.lyricParser = null;
                return;
            }

            this.lyricParser = new LyricParser(lrcSource.rawLrc!, {
                extra: {
                    offset: (getMediaExtraProperty(currentMusicItem, "lyricOffset") || 0) * -1,
                },
                musicItem: currentMusicItem,
                lyricSource: lrcSource,
                translation: lrcSource.translation,
            });

            getDefaultStore().set(lyricStateAtom, {
                loading: false,
                lyrics: this.lyricParser.getLyricItems(),
                hasTranslation: !!lrcSource.translation,
                meta: this.lyricParser.getMeta(),
            });

            const currentLyric = ignoreProgress ? (this.lyricParser.getLyricItems()?.[0] ?? null) : this.lyricParser.getPosition((await this.trackPlayer.getProgress()).position);
            // 切歌复核：await getProgress 期间可能已切歌，避免旧歌歌词写入新状态
            if (!this.trackPlayer.isCurrentMusic(currentMusicItem)) {
                return;
            }
            getDefaultStore().set(currentLyricItemAtom, currentLyric || null);

            if (this.appConfig.getConfig("lyric.showStatusBarLyric")) {
                if (currentLyric) {
                    LyricUtil.setStatusBarLyricText(
                        (currentLyric?.lrc ?? "") +
                        (this.lyricParser.hasTranslation
                            ? `\n${currentLyric?.translation ?? ""}`
                            : ""),
                    );
                } else {
                    const musicItem = this.trackPlayer.currentMusic;
                    LyricUtil.setStatusBarLyricText(musicItem ? `${musicItem.title} - ${musicItem.artist}` : "极悦界");
                }
            }
        } catch (err) {
            if (this.trackPlayer.isCurrentMusic(currentMusicItem)) {
                this.lyricParser = null;
                this.setLyricAsNoLyricState();
            }
        }
    }

    /**
     * 检索最接近的歌词
     * @param musicItem 
     * @returns 
     */
    private async searchSimilarLyric(musicItem: IMusic.IMusicItem) {
        const keyword = musicItem.alias || musicItem.title;
        // 歌曲搜索：源插件不实现 "lyric" 搜索类型（实测 58 个源插件 search 均无 lyric 分支），
        // 改为搜歌曲候选，再对候选 getLyric 取词
        const plugins = this.pluginManager.getSearchablePlugins("music");
        // 歌词源选择：按歌词可用率降序尝试（可用率相同显式随机 tiebreak），
        // 让"能稳定提供歌词"的源优先被搜索取词；遍历仍找最接近的歌词
        const lyricOrdered = [...plugins].sort((a, b) => {
            const ra = pluginReliability.getLyricReliabilitySync(
                a.instance.platform,
            );
            const rb = pluginReliability.getLyricReliabilitySync(
                b.instance.platform,
            );
            if (rb !== ra) {
                return rb - ra; // 可用率高者优先
            }
            return Math.random() - 0.5; // 相同可用率：显式随机 tiebreak
        });

        let distance = Infinity;
        let minDistanceMusicItem;
        let targetPlugin: Plugin | null = null;

        const startTime = Date.now();

        for (let plugin of lyricOrdered) {
            // 如果插件不是当前音乐的插件，或者当前音乐不是正在播放的音乐，则跳过
            if (
                !this.trackPlayer.isCurrentMusic(musicItem)
            ) {
                return null;
            }

            // 总超时 8s：多插件串行累计过久会让 loading 一直转，对齐 getSimilarMusic 的熔断风格
            if (Date.now() - startTime > 8000) {
                break;
            }

            if (plugin.name === musicItem.platform) {
                // 如果插件是当前音乐的插件，则跳过
                continue;
            }

            const results = await plugin.methods
                .search(keyword, 1, "music")
                .catch(() => null);

            // 取前两个
            const firstTwo = results?.data?.slice(0, 2) || [];

            for (let item of firstTwo) {
                if (
                    item.title === keyword &&
                    item.artist === musicItem.artist
                ) {
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
            const lrc = await targetPlugin.methods
                .getLyric(minDistanceMusicItem)
                .catch(() => null);
            // 记录歌词可用率：自动搜索取词成功/失败
            if (targetPlugin.instance?.platform) {
                void pluginReliability.recordLyricResult(
                    targetPlugin.instance.platform,
                    !!lrc,
                );
            }
            return lrc;
        }

        return null;
    }

}

const lyricManager = new LyricManager();
export default lyricManager;


export const useLyricState = () => useAtomValue(lyricStateAtom);
export const useCurrentLyricItem = () => useAtomValue(currentLyricItemAtom);