/**
 * QQ音乐公开接口数据服务（推荐歌单/排行榜数据层）
 * - 榜单列表：GET /v8/fcg-bin/fcg_myqq_toplist.fcg
 * - 榜单详情：GET /v8/fcg-bin/fcg_v8_toplist_cp.fcg?topid=
 * - 推荐歌单列表：GET /splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg
 * - 歌单详情：QQ 直连接口全部反爬（privacy error/404/500003），由 qqSheetDetail 走 QQ 插件 getMusicSheetInfo
 */

const QQ_BASE = "https://c.y.qq.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** 平台标记：播放匹配时据此优先选"QQ系"插件 */
export const QQ_PLATFORM = "QQ音乐";

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
                Referer: "https://y.qq.com/",
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

/** 专辑封面（albummid → 图片 URL） */
function albumArt(albummid?: string): string {
    return albummid
        ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`
        : "";
}

/** QQ 榜单歌曲项 → IMusicItem（无音频地址，仅供展示与匹配） */
function toMusicItem(song: any): IMusic.IMusicItem | null {
    const data = song?.data ?? {};
    const songmid = data?.songmid ?? data?.mid;
    if (!songmid) {
        return null;
    }
    return {
        id: String(songmid),
        title: data?.songname ?? data?.name ?? "未知歌曲",
        artist:
            data?.singername ??
            data?.singer?.[0]?.name ??
            (Array.isArray(data?.singer)
                ? data.singer
                    .map((s: any) => s?.name ?? "")
                    .filter(Boolean)
                    .join(" / ")
                : "") ??
            "",
        album: data?.albumname ?? "",
        artwork: albumArt(data?.albummid),
        duration: data?.interval ? Number(data.interval) : 0,
        platform: QQ_PLATFORM,
        apiSource: "qq",
    };
}

/** 榜单列表 */
export async function getTopLists(): Promise<IMusic.IMusicSheetItemBase[]> {
    const data = await fetchJson<any>(
        `${QQ_BASE}/v8/fcg-bin/fcg_myqq_toplist.fcg?format=json&g_tk=5381&uin=0&inCharset=utf-8&outCharset=utf-8`,
    );
    const topList = data?.data?.topList ?? [];
    return topList
        .filter((it: any) => it?.id)
        .map((it: any) => ({
            id: String(it.id),
            // 榜单详情走 QQ 官方接口：写入 topid 作为"榜单"标记（cache.ts 据此区分接口/插件分支）
            topid: it.id,
            title: it.name ?? "未知榜单",
            coverImg:
                it.picUrl ??
                (it.frontPicUrl || it.topTitle
                    ? albumArt(it.topAlbumMID)
                    : undefined),
            description: it.info,
            updateFrequency: it.period,
            worksNum: it.songList?.length,
            platform: QQ_PLATFORM,
            apiSource: "qq",
        }));
}

/** 榜单详情 */
export async function getTopListDetail(
    topid: string,
): Promise<IMusic.IMusicItem[]> {
    const data = await fetchJson<any>(
        `${QQ_BASE}/v8/fcg-bin/fcg_v8_toplist_cp.fcg?format=json&page=detail&topid=${topid}&type=top&song_begin=0&song_num=50`,
        20000,
    );
    const songlist = data?.songlist ?? [];
    return songlist
        .map(toMusicItem)
        .filter((it: IMusic.IMusicItem | null): it is IMusic.IMusicItem => !!it);
}

/** 推荐歌单列表 */
export async function getRecommendSheets(): Promise<
    IMusic.IMusicSheetItemBase[]
    > {
    const data = await fetchJson<any>(
        `${QQ_BASE}/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg?format=json&categoryId=10000000&sortId=5&sin=0&ein=30`,
        20000,
    );
    const list = data?.data?.list ?? [];
    return list
        .filter((it: any) => it?.dissid)
        .map((it: any) => ({
            id: String(it.dissid),
            title: it.dissname ?? "未知歌单",
            coverImg: it.imgurl
                ? `https:${it.imgurl}`
                : undefined,
            worksNum: it.song_cnt,
            listenNum: it.listen_num,
            platform: QQ_PLATFORM,
            apiSource: "qq",
        }));
}
