/**
 * 源鉴核心（独立 App「源鉴」）
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
import { effectiveKeywords } from "./settings";

/** 探测超时（毫秒） */
const STEP_TIMEOUT = 15000;
/** 歌单体系内层步骤超时（毫秒）：歌单详情/首曲解析各自限时，避免串行累计拖慢探测 */
const SHEET_STEP_TIMEOUT = 10000;
/** 全局并发 worker 数（避免同时打爆所有音源接口） */
export const PROBE_CONCURRENCY = 5;

/** 可探测的搜索类型（与 ICommon.SupportMediaType 一致） */
export const SEARCH_TYPES = ["music", "album", "artist", "sheet", "lyric"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** 搜索探测关键词（按搜索类型，依次尝试，任一命中即记成功）：
 *  用真实高频歌曲/歌手词而非泛词——泛词对"能否搜到具体歌曲"是弱测试，
 *  且泛词无结果不代表歌名无结果（误判方向错误）。 */
export const SEARCH_KEYWORDS: Record<SearchType, readonly string[]> = {
    music: ["孤勇者", "晴天"],
    album: ["周杰伦", "林俊杰"],
    artist: ["周杰伦"],
    sheet: ["热歌", "经典"],
    lyric: ["孤勇者", "晴天"],
};

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
    /** 搜索质量：首个搜索结果 title+artist 均非空（反映"能搜到完整歌曲"而非只有空壳） */
    searchFirstOk?: boolean;
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
    /** 实测：歌单首曲可解析（取首个歌单 → 歌单详情第一首 → getMediaSource 有播放地址） */
    sheetsFirstOk?: boolean;
    /** 实测：标签歌单可拉取（getRecommendSheetTags 有标签 + 按首个标签 getRecommendSheetsByTag 拉到歌单列表） */
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

/** 删除单条探测结果（源被卸载时清理） */
export function deleteProbeResult(hash: string) {
    probeStore.delete(hash);
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

/** 从错误中提取 HTTP 状态码（message 正则 + status/response.status 兜底） */
function extractHttpStatus(e: unknown): string | null {
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.match(/\b(4\d\d|5\d\d)\b/);
    if (m) {
        return m[1];
    }
    const st =
        (e as any)?.status ??
        (e as any)?.response?.status ??
        (e as any)?.response?.statusCode;
    return st ? String(st) : null;
}

function errMsg(e: unknown): string {
    const st = extractHttpStatus(e);
    let base = "";
    if (e instanceof Error) {
        base = e.message === "timeout" ? "超时" : e.message;
    } else {
        base = String(e);
    }
    // 状态码前置（message 已含则不再重复）：报告/建议动作可按状态码归类
    if (st && !base.includes(st)) {
        base = `HTTP ${st} ${base}`;
    }
    return base;
}

/** 带 1 次重试的 withTimeout：手机网络抖动兜底（搜索/解析关键步骤用） */
async function withRetry<T>(
    fn: () => Promise<T>,
    ms: number,
    retries = 1,
): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i <= retries; i++) {
        try {
            return await withTimeout(fn(), ms);
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr;
}

/** 失败原因人话化（手机端直接可读，替代裸状态码） */
export function explainError(msg?: string): string {
    const m = (msg || "").toLowerCase();
    if (!m) {
        return "";
    }
    if (m.includes("403") || m.includes("forbidden") || m.includes("鉴权")) {
        return "访问被拒（接口需鉴权/Referer，或源已对第三方关闭）";
    }
    if (m.includes("404") || m.includes("not found") || m.includes("不存在")) {
        return "资源不存在（接口/地址已失效）";
    }
    if (m.includes("429") || m.includes("rate limit")) {
        return "请求过于频繁（被限流，稍后再试）";
    }
    if (m.includes("401") || m.includes("unauthorized")) {
        return "未授权（需要登录凭据/Cookie）";
    }
    if (m.includes("timeout") || m.includes("超时")) {
        return "请求超时（网络慢或接口无响应）";
    }
    if (
        m.includes("network") ||
        m.includes("connect") ||
        m.includes("socket") ||
        m.includes("dns") ||
        m.includes("unreachable")
    ) {
        return "网络错误（无法连接，检查网络）";
    }
    if (m.includes("json") || m.includes("parse")) {
        return "返回内容无法解析（接口结构已变）";
    }
    return msg || "";
}

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
        sheetsFirstOk: false,
        sheetTagsOk: false,
        lyricOk: false,
        lyricTranslationOk: false,
        artistWorksOk: false,
        albumOk: false,
        commentsOk: false,
        durationMs: 0,
    };

    // ---- 阶段 A：各搜索类型并行实测（每类型依次尝试关键词，任一命中即成功） ----
    const searchResults = await Promise.all(
        abilities.searchTypes.map(async type => {
            if (!plugin.methods.search) {
                return { type, ok: false, error: "未实现 search" };
            }
            // 多关键词（按类型）：自定义主词在前 + 默认兜底，任一命中即成功
            const keywords = effectiveKeywords(type);
            for (const kw of keywords) {
                try {
                    const r = await withRetry(
                        () => plugin.methods.search(kw, 1, type),
                        STEP_TIMEOUT,
                    );
                    if (r && Array.isArray(r.data) && r.data.length > 0) {
                        return { type, ok: true, first: r.data[0] as any };
                    }
                } catch (e) {
                    // 记录最后错误，继续试下一个关键词
                    const last = { type, ok: false as const, error: errMsg(e) };
                    if (kw === keywords[keywords.length - 1]) {
                        return last;
                    }
                }
            }
            return { type, ok: false, error: "无结果" };
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
        // 搜索质量：首位结果 title+artist 均非空
        result.searchFirstOk =
            !!firstMusic?.title && !!firstMusic?.artist;
    } else {
        // 无 music 类型结果时：任一其他类型有结果也算可搜索
        const anyOk = searchResults.find(sr => sr.ok);
        if (anyOk) {
            result.searchOk = true;
            result.sampleTitle = anyOk.first?.title;
            result.sampleArtist = anyOk.first?.artist;
            result.searchFirstOk =
                !!anyOk.first?.title && !!anyOk.first?.artist;
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
                        const src = await withRetry(
                            () =>
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
                .then(async r => {
                    if (r && Array.isArray(r) && r.length > 0) {
                        result.sheetsOk = true;
                        result.sheetCount = r.length;
                        // 歌单首曲可解析（对齐极悦界歌单可用率口径：显示 + 首曲可解析）：
                        // 取首个歌单 → 歌单详情第一首 → getMediaSource 有播放地址
                        const firstSheet = r[0] as any;
                        try {
                            const info = await withTimeout(
                                plugin.methods.getMusicSheetInfo!(
                                    firstSheet,
                                    1,
                                ),
                                SHEET_STEP_TIMEOUT,
                            );
                            const firstSong = (info as any)?.musicList?.[0];
                            if (!firstSong) {
                                result.sheetsError =
                                    "歌单详情无歌曲，跳过首曲解析";
                                return;
                            }
                            const src = await withTimeout(
                                plugin.methods.getMediaSource!(
                                    firstSong,
                                    "standard",
                                ),
                                SHEET_STEP_TIMEOUT,
                            );
                            result.sheetsFirstOk = !!(src && src.url);
                            if (!result.sheetsFirstOk) {
                                result.sheetsError = "歌单首曲无播放地址";
                            }
                        } catch (e) {
                            result.sheetsFirstOk = false;
                            result.sheetsError = "歌单首曲解析失败：" + errMsg(e);
                        }
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
                .then(async r => {
                    const tags = r?.data ?? [];
                    if (!Array.isArray(tags) || tags.length === 0) {
                        result.sheetTagsOk = false;
                        result.sheetTagsError = "无标签数据";
                        return;
                    }
                    // 标签歌单可拉取：按首个标签 getRecommendSheetsByTag 拉歌单（标签整体透传，
                    // 保留 digest 等插件自定义字段——念心等源依赖 digest 判定歌单/歌曲分支）
                    if (plugin.methods.getRecommendSheetsByTag) {
                        try {
                            const sheets = await withTimeout(
                                plugin.methods.getRecommendSheetsByTag(
                                    tags[0] as unknown as ICommon.IUnique,
                                    1,
                                ),
                                SHEET_STEP_TIMEOUT,
                            );
                            result.sheetTagsOk =
                                !!sheets &&
                                Array.isArray(sheets.data) &&
                                sheets.data.length > 0;
                            if (!result.sheetTagsOk) {
                                result.sheetTagsError = "按标签拉歌单无结果";
                            }
                        } catch (e) {
                            result.sheetTagsOk = false;
                            result.sheetTagsError =
                                "按标签拉歌单失败：" + errMsg(e);
                        }
                    } else {
                        // 仅有标签方法：标签本身可获取即记可拉取（声明面）
                        result.sheetTagsOk = true;
                    }
                })
                .catch(e => {
                    result.sheetTagsOk = false;
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
                    sheetsFirstOk: false,
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
