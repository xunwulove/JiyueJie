/**
 * 网易云音乐公开接口数据服务（推荐歌单/排行榜数据层）
 * - 榜单列表：GET /api/toplist/detail
 * - 榜单/歌单详情：GET /api/v3/playlist/detail?id=
 * - 推荐歌单：GET /api/personalized/playlist
 * 说明：仅用于获取歌单/榜单元数据（歌曲信息无音频地址），播放统一走播放前匹配（playMatcher）
 */

const NETEASE_BASE = "https://music.163.com";
const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** 平台标记：播放匹配时据此优先选"网易系"插件 */
export const NETEASE_PLATFORM = "网易云";

async function fetchJson<T = any>(
    url: string,
    timeout = 15000,
): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": UA,
                Referer: NETEASE_BASE + "/",
            },
            signal: controller.signal,
        });
        if (!res.ok) {
            return null;
        }
        return (await res.json()) as T;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** 网易歌曲项 → IMusicItem（无音频地址，仅供列表展示与匹配） */
function toMusicItem(track: any): IMusic.IMusicItem | null {
    if (!track?.id) {
        return null;
    }
    const ar = track.ar ?? track.artists ?? [];
    return {
        id: String(track.id),
        title: track.name ?? "未知歌曲",
        artist: Array.isArray(ar)
            ? ar
                .map((a: any) => a?.name ?? "")
                .filter(Boolean)
                .join(" / ")
            : "",
        album: track.al?.name ?? track.album?.name ?? "",
        artwork: track.al?.picUrl ?? track.album?.picUrl ?? "",
        duration: track.dt ? Math.round((track.dt as number) / 1000) : 0,
        platform: NETEASE_PLATFORM,
        apiSource: "netease",
    };
}

/** 榜单列表 */
export async function getTopLists(): Promise<IMusic.IMusicSheetItemBase[]> {
    const data = await fetchJson<any>(`${NETEASE_BASE}/api/toplist/detail`);
    const list = data?.list ?? [];
    return list
        .filter((it: any) => it?.id)
        .map((it: any) => ({
            id: String(it.id),
            title: it.name ?? "未知榜单",
            coverImg:
                it.coverImgUrl ??
                (it.coverImgId_str
                    ? `https://p1.music.126.net/coverImgUrl/${it.coverImgId_str}.jpg`
                    : undefined),
            description: it.description,
            updateFrequency: it.updateFrequency,
            platform: NETEASE_PLATFORM,
            apiSource: "netease",
        }));
}

/** 榜单/歌单详情（榜单本身是特殊歌单） */
export async function getSheetDetail(
    id: string,
): Promise<IMusic.IMusicItem[]> {
    const data = await fetchJson<any>(
        `${NETEASE_BASE}/api/v3/playlist/detail?id=${id}`,
        20000,
    );
    const tracks = data?.playlist?.tracks ?? [];
    return tracks
        .map(toMusicItem)
        .filter((it: IMusic.IMusicItem | null): it is IMusic.IMusicItem => !!it);
}

/** 单曲详情（按 id 获取单曲元数据，用于导入单曲链接的内置解析；播放仍走 playMatcher） */
export async function getSongDetail(
    id: string,
): Promise<IMusic.IMusicItem | null> {
    const data = await fetchJson<any>(
        `${NETEASE_BASE}/api/song/detail?ids=[${id}]`,
        20000,
    );
    const song = data?.songs?.[0];
    return song ? toMusicItem(song) : null;
}

/** 推荐歌单列表（响应较慢，放宽超时） */
export async function getRecommendSheets(): Promise<
    IMusic.IMusicSheetItemBase[]
    > {
    const data = await fetchJson<any>(
        `${NETEASE_BASE}/api/personalized/playlist?limit=30`,
        25000,
    );
    const result = data?.result ?? [];
    return result
        .filter((it: any) => it?.id)
        .map((it: any) => ({
            id: String(it.id),
            title: it.name ?? "未知歌单",
            coverImg: it.picUrl ?? undefined,
            description: it.copywriter,
            worksNum: it.trackCount,
            playCount: it.playCount,
            platform: NETEASE_PLATFORM,
            apiSource: "netease",
        }));
}
