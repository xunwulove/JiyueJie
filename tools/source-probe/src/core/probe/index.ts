/**
 * 音源探测核心（独立 App「音源探测」）
 *
 * 对已安装音源插件逐一批量探测能力，供探测页展示与多重筛选。
 * 采用「声明矩阵 + 实测」双面探测：
 * - 声明面：检查 supportedMethods / instance 声明的方法与搜索类型（秒级）
 * - 实测面：实际调用接口验证（可搜索各类型 / 可解析播放 / 有歌单 / 有歌词与翻译 /
 *           歌手作品 / 专辑 / 评论 / 歌单标签），失败记录原因
 *
 * 设计约束（与极悦界同源，便于后期迁移）：
 * - 完全复用 pluginManager / Plugin.methods，不重复实现插件运行时
 * - 并发上限、每步超时、可取消；结果按插件 hash 索引并持久化
 * - 纯逻辑模块（不依赖 UI）
 */
import { Plugin } from "@/core/pluginManager/plugin";
import pluginManager from "@/core/pluginManager";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { verifyPlayable } from "./playback";

/** 探测超时（毫秒） */
const STEP_TIMEOUT = 15000;
/** 全局并发 worker 数（避免同时打爆所有音源接口） */
export const PROBE_CONCURRENCY = 5;

/** 可探测的搜索类型（与 ICommon.SupportMediaType 一致） */
export const SEARCH_TYPES = ["music", "album", "artist", "sheet", "lyric"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export type ProbeStatus = "idle" | "running" | "done";

/** 声明矩阵：插件静态声明了哪些能力 */
export interface IProbeAbilities {
    search: boolean;
    /** 声明支持的搜索类型 */
    searchTypes: SearchType[];
    mediaSource: boolean;
    musicInfo: boolean;
    lyric: boolean;
    albumInfo: boolean;
    musicSheetInfo: boolean;
    artistWorks: boolean;
    topLists: boolean;
    topListDetail: boolean;
    recommendSheetTags: boolean;
    recommendSheetsByTag: boolean;
    importMusicSheet: boolean;
    musicComments: boolean;
}

export interface IProbeResult {
    hash: string;
    name: string;
    enabled: boolean;
    abilities: IProbeAbilities;
    /** 实测：各搜索类型是否有结果 */
    searchTypesOk: Record<SearchType, boolean>;
    /** 可搜索（music 或任一声明类型实测有结果） */
    searchOk: boolean;
    searchError?: string;
    sampleTitle?: string;
    sampleArtist?: string;
    /** 实测：可解析播放地址 */
    mediaSourceOk: boolean;
    mediaSourceError?: string;
    /** 实测：深度播放验证（真实播放样本歌曲，能出声才算通过） */
    playableOk: boolean;
    /** 深度播放验证失败原因（分类后） */
    playError?: string;
    /** 深度播放验证：实际播放秒数 */
    playedSec?: number;
    /** 深度播放验证：播放器解析出的音频时长（秒） */
    playDurationSec?: number;
    /** 深度播放验证耗时（毫秒） */
    playVerifyMs?: number;
    /** 实测：有歌单（getTopLists 有结果） */
    sheetsOk: boolean;
    sheetsError?: string;
    sheetCount?: number;
    /** 实测：有歌单标签（getRecommendSheetTags 有结果） */
    sheetTagsOk: boolean;
    sheetTagsError?: string;
    /** 实测：有歌词 */
    lyricOk: boolean;
    lyricError?: string;
    /** 实测：歌词含翻译 */
    lyricTranslationOk: boolean;
    /** 实测：歌手作品（getArtistWorks 有结果） */
    artistWorksOk: boolean;
    artistWorksError?: string;
    /** 实测：专辑（getAlbumInfo 有结果） */
    albumOk: boolean;
    albumError?: string;
    /** 实测：评论（getMusicComments 有结果） */
    commentsOk: boolean;
    commentsError?: string;
    /** 探测耗时 */
    durationMs: number;
    /** 失败原因（全能力失败时汇总） */
    lastError?: string;
}

export interface IProbeProgress {
    finished: number;
    total: number;
    cancelled: boolean;
    /** 刚完成的插件 hash（便于 UI 增量并入结果） */
    doneHash?: string;
    /** 当前正在探测的插件名（探测页第三行显示） */
    currentName?: string;
}

const probeStore = getOrCreateMMKV("probe.result");

/** 结果持久化（key=插件 hash） */
export function saveProbeResult(result: IProbeResult) {
    probeStore.set(result.hash, JSON.stringify(result));
}

export function loadProbeResult(hash: string): IProbeResult | null {
    const raw = probeStore.getString(hash);
    return raw ? (JSON.parse(raw) as IProbeResult) : null;
}

export function clearProbeResults() {
    probeStore.getAllKeys().forEach(k => probeStore.delete(k));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), ms);
        promise.then(
            v => {
                clearTimeout(timer);
                resolve(v);
            },
            e => {
                clearTimeout(timer);
                reject(e);
            },
        );
    });
}

function errMsg(e: unknown): string {
    if (e instanceof Error) {
        return e.message === "timeout" ? "超时" : e.message;
    }
    return String(e);
}

const SHEET_METHODS = [
    "getTopLists",
    "getRecommendSheetsByTag",
    "getMusicSheetInfo",
] as const;

/** 构建声明矩阵 */
function collectAbilities(plugin: Plugin): IProbeAbilities {
    const sm = plugin.supportedMethods;
    const instance = plugin.instance ?? {};
    const declaredSearchTypes: SearchType[] = Array.isArray(
        instance.supportedSearchType,
    )
        ? (instance.supportedSearchType as SearchType[])
        : sm.has("search")
            ? ["music"]
            : [];
    // 补齐声明面：即使 supportedSearchType 缺失，也按通用类型清单声明（实测决定成败）
    const searchTypes =
        declaredSearchTypes.length > 0
            ? declaredSearchTypes
            : ([...SEARCH_TYPES] as SearchType[]);

    return {
        search: sm.has("search"),
        searchTypes,
        mediaSource: sm.has("getMediaSource"),
        musicInfo: sm.has("getMusicInfo"),
        lyric: sm.has("getLyric"),
        albumInfo: sm.has("getAlbumInfo"),
        musicSheetInfo: sm.has("getMusicSheetInfo"),
        artistWorks: sm.has("getArtistWorks"),
        topLists: sm.has("getTopLists"),
        topListDetail: sm.has("getTopListDetail"),
        recommendSheetTags: sm.has("getRecommendSheetTags"),
        recommendSheetsByTag: sm.has("getRecommendSheetsByTag"),
        importMusicSheet: sm.has("importMusicSheet"),
        musicComments: sm.has("getMusicComments"),
    };
}

async function probeOne(plugin: Plugin): Promise<IProbeResult> {
    const t0 = Date.now();
    const abilities = collectAbilities(plugin);

    const result: IProbeResult = {
        hash: plugin.hash,
        name: plugin.name,
        enabled: pluginManager.isPluginEnabled(plugin),
        abilities,
        searchTypesOk: {
            music: false,
            album: false,
            artist: false,
            sheet: false,
            lyric: false,
        },
        searchOk: false,
        mediaSourceOk: false,
        playableOk: false,
        sheetsOk: false,
        sheetTagsOk: false,
        lyricOk: false,
        lyricTranslationOk: false,
        artistWorksOk: false,
        albumOk: false,
        commentsOk: false,
        durationMs: 0,
    };

    // ---- 阶段 A：各搜索类型并行实测（每类型 1 次，成功即记） ----
    const searchResults = await Promise.all(
        abilities.searchTypes.map(async type => {
            if (!plugin.methods.search) {
                return { type, ok: false, error: "未实现 search" };
            }
            try {
                const r = await withTimeout(
                    plugin.methods.search("音乐", 1, type),
                    STEP_TIMEOUT,
                );
                if (r && Array.isArray(r.data) && r.data.length > 0) {
                    return { type, ok: true, first: r.data[0] as any };
                }
                return { type, ok: false, error: "无结果" };
            } catch (e) {
                return { type, ok: false, error: errMsg(e) };
            }
        }),
    );

    searchResults.forEach(sr => {
        result.searchTypesOk[sr.type] = sr.ok;
        if (!sr.ok && sr.error && sr.type === "music") {
            result.searchError = sr.error;
        }
    });

    const musicHit = searchResults.find(sr => sr.type === "music");
    const firstMusic = musicHit?.ok ? (musicHit.first as any) : null;
    if (musicHit?.ok) {
        result.searchOk = true;
        result.sampleTitle = firstMusic?.title;
        result.sampleArtist = firstMusic?.artist;
    } else {
        // 无 music 类型结果时：任一其他类型有结果也算可搜索
        const anyOk = searchResults.find(sr => sr.ok);
        if (anyOk) {
            result.searchOk = true;
            result.sampleTitle = anyOk.first?.title;
            result.sampleArtist = anyOk.first?.artist;
        } else {
            result.searchError = result.searchError ?? "各类型均无结果";
        }
    }

    const artistHit = searchResults.find(sr => sr.type === "artist");
    const firstArtist = artistHit?.ok ? (artistHit.first as any) : null;
    const albumHit = searchResults.find(sr => sr.type === "album");
    const firstAlbum = albumHit?.ok ? (albumHit.first as any) : null;

    // ---- 阶段 B：基于样本并行实测各项能力 ----
    const tasks: Promise<void>[] = [];

    if (firstMusic) {
        if (abilities.mediaSource) {
            tasks.push(
                (async () => {
                    try {
                        const src = await withTimeout(
                            plugin.methods.getMediaSource(
                                firstMusic,
                                "standard",
                            ),
                            STEP_TIMEOUT,
                        );
                        result.mediaSourceOk = !!src && !!src.url;
                        if (!src || !src.url) {
                            result.mediaSourceError = "无可用播放地址";
                            result.playError = "无播放地址，跳过播放验证";
                            return;
                        }
                        // 深度播放验证：真实播放样本歌曲（全局串行队列，内部自带 20s 超时）
                        const v = await verifyPlayable(src.url, src.headers);
                        result.playableOk = v.playableOk;
                        result.playError = v.playError;
                        result.playedSec = v.playedSec;
                        result.playDurationSec = v.durationSec;
                        result.playVerifyMs = v.verifyMs;
                    } catch (e) {
                        result.mediaSourceError = errMsg(e);
                        if (!result.playableOk) {
                            result.playError = "播放验证异常：" + errMsg(e);
                        }
                    }
                })(),
            );
        } else {
            result.mediaSourceError = "未实现 getMediaSource";
            result.playError = "未实现 getMediaSource，跳过播放验证";
        }

        if (abilities.lyric) {
            tasks.push(
                withTimeout(
                    plugin.methods.getLyric(firstMusic),
                    STEP_TIMEOUT,
                )
                    .then(l => {
                        result.lyricOk = !!l && !!(l.rawLrc || l.translation);
                        result.lyricTranslationOk = !!l && !!l.translation;
                        if (!result.lyricOk) {
                            result.lyricError = "无歌词";
                        }
                    })
                    .catch(e => {
                        result.lyricError = errMsg(e);
                    }),
            );
        } else {
            result.lyricError = "未实现 getLyric";
        }

        if (abilities.musicComments) {
            tasks.push(
                withTimeout(
                    plugin.methods.getMusicComments(firstMusic, 1),
                    STEP_TIMEOUT,
                )
                    .then(c => {
                        result.commentsOk =
                            !!c && Array.isArray(c.data) && c.data.length > 0;
                        if (!result.commentsOk) {
                            result.commentsError = "无评论";
                        }
                    })
                    .catch(e => {
                        result.commentsError = errMsg(e);
                    }),
            );
        } else {
            result.commentsError = "未实现 getMusicComments";
        }
    } else {
        result.mediaSourceError = "无样本歌曲，跳过";
        result.lyricError = "无样本歌曲，跳过歌词探测";
        result.commentsError = "无样本歌曲，跳过";
    }

    if (firstArtist && abilities.artistWorks) {
        tasks.push(
            withTimeout(
                plugin.methods.getArtistWorks(firstArtist, 1, "music"),
                STEP_TIMEOUT,
            )
                .then(w => {
                    result.artistWorksOk =
                        !!w && Array.isArray(w.data) && w.data.length > 0;
                    if (!result.artistWorksOk) {
                        result.artistWorksError = "无作品";
                    }
                })
                .catch(e => {
                    result.artistWorksError = errMsg(e);
                }),
        );
    } else if (firstArtist) {
        result.artistWorksError = "未实现 getArtistWorks";
    } else {
        result.artistWorksError = "无歌手样本，跳过";
    }

    if (firstAlbum && abilities.albumInfo) {
        tasks.push(
            withTimeout(
                plugin.methods.getAlbumInfo(firstAlbum, 1),
                STEP_TIMEOUT,
            )
                .then(a => {
                    result.albumOk =
                        !!a && Array.isArray(a.musicList) && a.musicList.length > 0;
                    if (!result.albumOk) {
                        result.albumError = "无专辑曲目";
                    }
                })
                .catch(e => {
                    result.albumError = errMsg(e);
                }),
        );
    } else if (firstAlbum) {
        result.albumError = "未实现 getAlbumInfo";
    } else {
        result.albumError = "无专辑样本，跳过";
    }

    // 歌单体系（独立并行）
    if (abilities.topLists) {
        tasks.push(
            withTimeout(plugin.methods.getTopLists(), STEP_TIMEOUT)
                .then(r => {
                    if (r && Array.isArray(r) && r.length > 0) {
                        result.sheetsOk = true;
                        result.sheetCount = r.length;
                    } else {
                        result.sheetsError = "无歌单数据";
                    }
                })
                .catch(e => {
                    result.sheetsError = errMsg(e);
                }),
        );
    } else {
        result.sheetsError = "未实现歌单方法";
    }

    if (abilities.recommendSheetTags) {
        tasks.push(
            withTimeout(plugin.methods.getRecommendSheetTags(), STEP_TIMEOUT)
                .then(r => {
                    const tags = r?.data ?? [];
                    result.sheetTagsOk = Array.isArray(tags) && tags.length > 0;
                    if (!result.sheetTagsOk) {
                        result.sheetTagsError = "无标签数据";
                    }
                })
                .catch(e => {
                    result.sheetTagsError = errMsg(e);
                }),
        );
    } else {
        result.sheetTagsError = "未实现 getRecommendSheetTags";
    }

    await Promise.all(tasks);

    const anyOk =
        result.searchOk ||
        result.mediaSourceOk ||
        result.playableOk ||
        result.sheetsOk ||
        result.lyricOk ||
        result.artistWorksOk ||
        result.albumOk ||
        result.commentsOk ||
        result.sheetTagsOk;
    if (!anyOk) {
        result.lastError =
            result.searchError ??
            result.mediaSourceError ??
            result.sheetsError ??
            result.lyricError;
    }

    result.durationMs = Date.now() - t0;
    return result;
}

/**
 * 批量探测。返回 Map<hash, result>，并发完成即写入。
 * onProgress 回调（每次完成一个插件时触发）。
 */
export async function runProbe(
    plugins: Plugin[],
    signal: { cancelled: boolean },
    onProgress?: (progress: IProbeProgress) => void,
): Promise<Map<string, IProbeResult>> {
    const results = new Map<string, IProbeResult>();
    const total = plugins.length;
    let index = 0;

    const worker = async () => {
        while (index < plugins.length && !signal.cancelled) {
            const i = index++;
            const plugin = plugins[i];
            let doneHash: string | undefined;
            // 开始处理前先上报"当前插件名"，UI 第三行实时显示
            onProgress?.({
                finished: results.size,
                total,
                cancelled: signal.cancelled,
                currentName: plugin.name,
            });
            try {
                const r = await probeOne(plugin);
                results.set(plugin.hash, r);
                saveProbeResult(r);
                doneHash = plugin.hash;
            } catch (e) {
                const r: IProbeResult = {
                    hash: plugin.hash,
                    name: plugin.name,
                    enabled: pluginManager.isPluginEnabled(plugin),
                    abilities: collectAbilities(plugin),
                    searchTypesOk: {
                        music: false,
                        album: false,
                        artist: false,
                        sheet: false,
                        lyric: false,
                    },
                    searchOk: false,
                    mediaSourceOk: false,
                    playableOk: false,
                    sheetsOk: false,
                    sheetTagsOk: false,
                    lyricOk: false,
                    lyricTranslationOk: false,
                    artistWorksOk: false,
                    albumOk: false,
                    commentsOk: false,
                    lastError: errMsg(e),
                    durationMs: 0,
                };
                results.set(plugin.hash, r);
                saveProbeResult(r);
                doneHash = plugin.hash;
            }
            onProgress?.({
                finished: results.size,
                total,
                cancelled: signal.cancelled,
                doneHash,
                currentName: plugin.name,
            });
        }
    };

    const workerCount = Math.min(PROBE_CONCURRENCY, Math.max(plugins.length, 1));
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
}

export { pluginManager };
