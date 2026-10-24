import getOrCreateMMKV from "@/utils/getOrCreateMMKV.ts";
import { safeParse, safeStringify } from "@/utils/jsonUtil";

/**
 * 热门搜索 - 实时全网热搜（2026-10-24 第三次重构）：
 * 用户拍板：热门搜索 = 纯实时热搜接口，不用本地数据（本地排行与"搜索历史"重叠）。
 * 实测可用源（2026-10-24 本机验证）：
 *  1) 腾讯 QQ：POST u.y.qq.com/cgi-bin/musicu.fcg（GetHotkeyForQQMusicPC，返回 30 词实时热词）✅
 *  2) 酷我：GET hotword.kuwo.cn/hotword.s（kwplayer_ar 伪装，返回 20 词）✅
 *  3) 腾讯旧接口 gethotkey.fcg（匿名返回固定旧词，仅作最后兜底）
 *  4) B站音乐区排行（标题清洗，词新但偏视频标题）
 * 缓存 6h（防频繁请求触发风控；用户"不变"的痛点是源失效/旧数据，已由 1/2 实时源解决）。
 */

const CACHE_KEY = "search-hot-words";
const TTL = 6 * 60 * 60 * 1000;

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/84.0.4147.135";

interface IHotCache {
    words: string[];
    ts: number;
    /** 缓存结构版本：v3 = 纯实时热搜（本地排行已移除） */
    v: number;
}

/* ===== 缓存 ===== */

function readCache(): string[] | null {
    try {
        const mmkv = getOrCreateMMKV(CACHE_KEY);
        const raw = mmkv.getString("data");
        if (!raw) {
            return null;
        }
        const cache = safeParse(raw) as IHotCache | null;
        if (
            cache &&
            cache.v === 3 &&
            Array.isArray(cache.words) &&
            cache.words.length &&
            Date.now() - cache.ts < TTL
        ) {
            return cache.words;
        }
    } catch (_) {
        // 缓存损坏视为无缓存
    }
    return null;
}

function writeCache(words: string[]) {
    try {
        const mmkv = getOrCreateMMKV(CACHE_KEY);
        mmkv.set("data", safeStringify({ words, ts: Date.now(), v: 3 }));
    } catch (_) {
        // 写缓存失败不影响使用
    }
}

/* ===== 实时热搜源 ===== */

/** 主源：腾讯 QQ musicu.fcg GetHotkeyForQQMusicPC（实测：code=0，30 词实时热词） */
async function fetchQqMusicuHotWords(limit: number): Promise<string[]> {
    const body = JSON.stringify({
        comm: {
            ct: 19,
            cv: 1803,
            guid: "0",
            patch: 118,
            tmeAppID: "qqmusic",
            uin: "0",
        },
        hotkey: {
            method: "GetHotkeyForQQMusicPC",
            module: "tencent_musicsoso_hotkey.HotkeyService",
            param: { search_id: "", uin: 0 },
        },
    });
    const resp = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Referer: "https://y.qq.com/portal/player.html",
            "User-Agent": UA,
        },
        body,
    });
    const json = await resp.json();
    if (json?.code !== 0) {
        return [];
    }
    const vec = json?.hotkey?.data?.vec_hotkey;
    if (!Array.isArray(vec) || !vec.length) {
        return [];
    }
    return vec
        .map((h: any) => (h && typeof h.query === "string" ? h.query : ""))
        .filter(Boolean)
        .slice(0, limit);
}

/** 备源 1：酷我 hotword.s（实测：status=ok，20 词；kwplayer_ar 伪装头） */
async function fetchKuwoHotWords(limit: number): Promise<string[]> {
    const resp = await fetch(
        "http://hotword.kuwo.cn/hotword.s?prod=kwplayer_ar_9.3.0.1&corp=kuwo&newver=2&vipver=9.3.0.1&source=kwplayer_ar_9.3.0.1_40.apk&p2p=1&notrace=0&uid=0&plat=kwplayer_ar&rformat=json&encoding=utf8&tabid=1",
        {
            headers: {
                "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 9;)",
            },
        },
    );
    const json = await resp.json();
    if (json?.status !== "ok") {
        return [];
    }
    const tagvalue = json?.tagvalue;
    if (!Array.isArray(tagvalue) || !tagvalue.length) {
        return [];
    }
    return tagvalue
        .map((h: any) => (h && typeof h.key === "string" ? h.key : ""))
        .filter(Boolean)
        .slice(0, limit);
}

/** 兜底 2：腾讯旧接口 gethotkey.fcg（匿名返回固定旧词，仅保底） */
async function fetchQqLegacyHotWords(limit: number): Promise<string[]> {
    const resp = await fetch(
        "https://c.y.qq.com/splcloud/fcgi-bin/gethotkey.fcg?g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8",
        {
            headers: {
                "User-Agent": UA,
                Referer: "https://y.qq.com/",
            },
        },
    );
    const json = await resp.json();
    const hotkey = json?.data?.hotkey;
    if (!Array.isArray(hotkey) || !hotkey.length) {
        return [];
    }
    return hotkey
        .map((h: any) => (h && typeof h.k === "string" ? h.k : ""))
        .filter(Boolean)
        .slice(0, limit);
}

/** B站视频标题清洗：去【】标签/引号/栏目词，尽量还原歌名 */
function cleanBiliTitle(title: string): string {
    let s = title
        .replace(/【[^】]*】/g, "")
        .replace(/[“”"«»]/g, " ")
        .trim();
    const parts = s.split("|");
    s = (parts[0] ?? "").trim() || s;
    if (!s) {
        return "";
    }
    if (
        /盘点|歌单|翻唱|现场|合辑|教学|教程|挑战|合集|推荐|循环|串烧|remix|cover|live/i.test(
            s,
        ) ||
        s.length > 14
    ) {
        return "";
    }
    return s;
}

/** 兜底 3：B站音乐区排行（实时，标题清洗后取可用词） */
async function fetchBiliHotWords(limit: number): Promise<string[]> {
    const resp = await fetch(
        "https://api.bilibili.com/x/web-interface/ranking/v2?rid=3&type=all",
        {
            headers: { "User-Agent": UA },
        },
    );
    const json = await resp.json();
    const list = json?.data?.list;
    if (!Array.isArray(list)) {
        return [];
    }
    return list
        .map((i: any) =>
            i && typeof i.title === "string"
                ? cleanBiliTitle(i.title)
                : "",
        )
        .filter(Boolean)
        .slice(0, limit);
}

export async function getHotWords(limit = 14): Promise<string[]> {
    // 纯实时热搜：缓存 6h 内直接返回，过期/无缓存按序重拉
    const cached = readCache();
    if (cached) {
        return cached;
    }
    for (const fetcher of [
        fetchQqMusicuHotWords,
        fetchKuwoHotWords,
        fetchQqLegacyHotWords,
        fetchBiliHotWords,
    ]) {
        try {
            const words = await fetcher(limit);
            if (words.length) {
                writeCache(words);
                return words;
            }
        } catch (_) {
            // 该通道失败，尝试下一个
        }
    }
    return [];
}
