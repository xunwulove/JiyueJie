import getOrCreateMMKV from "@/utils/getOrCreateMMKV.ts";
import { safeParse, safeStringify } from "@/utils/jsonUtil";

/**
 * 热门搜索 - 复刻 APlayer PlaylistApi.getHotSearch：
 * 主用 QQ 音乐热搜接口（实测可用），失败降级网易云 web/旧版热搜；24h 内读 MMKV 缓存不重拉。
 * 与音乐源解耦（不依赖插件），保证空搜索页永远有热门词可用。
 */

const CACHE_KEY = "search-hot-words";
const TTL = 24 * 60 * 60 * 1000;

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/84.0.4147.135";

interface IHotCache {
    words: string[];
    ts: number;
}

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
        mmkv.set("data", safeStringify({ words, ts: Date.now() }));
    } catch (_) {
        // 写缓存失败不影响使用
    }
}

/** 主：QQ 音乐热搜 */
async function fetchQqHotWords(limit: number): Promise<string[]> {
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

/** 降级 1：网易云 web 热搜 */
async function fetchNeteaseWebHotWords(limit: number): Promise<string[]> {
    const resp = await fetch("https://music.163.com/api/search/hot/web", {
        headers: {
            "User-Agent": UA,
            Referer: "https://music.163.com/",
        },
    });
    const json = await resp.json();
    if (json?.code !== 200 || !Array.isArray(json?.data?.list)) {
        return [];
    }
    return json.data.list
        .map((i: any) => (i && typeof i.searchWord === "string" ? i.searchWord : ""))
        .filter(Boolean)
        .slice(0, limit);
}

/** 降级 2：网易云旧版热搜 */
async function fetchNeteaseLegacyHotWords(limit: number): Promise<string[]> {
    const resp = await fetch("https://music.163.com/api/search/hot", {
        headers: {
            "User-Agent": UA,
            Referer: "https://music.163.com/",
        },
    });
    const json = await resp.json();
    const hots = json?.result?.hots;
    if (!Array.isArray(hots)) {
        return [];
    }
    return hots
        .map((h: any) => (h && typeof h.first === "string" ? h.first : ""))
        .filter(Boolean)
        .slice(0, limit);
}

export async function getHotWords(limit = 14): Promise<string[]> {
    const cached = readCache();
    if (cached) {
        return cached;
    }
    const fetchers = [fetchQqHotWords, fetchNeteaseWebHotWords, fetchNeteaseLegacyHotWords];
    for (const fetcher of fetchers) {
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
