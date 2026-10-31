"use strict";
const axios = require("axios");

// ===== 配置 =====
const METING_BASE = "https://api.injahow.cn/meting/";
const NETEASE_SEARCH = "https://music.163.com/api/search/get";

// 默认 User-Agent（模拟移动端）
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1";

// ===== 常量 =====
// 热门排行榜（硬编码，避免额外请求）
const HOT_TOP_LISTS = [
  { id: "19723756", title: "飙升榜", artwork: "https://p1.music.126.net/rIi7Qzy2i2Y_1QD7cd0MYA==/109951170048506929.jpg" },
  { id: "3779629", title: "新歌榜", artwork: "https://p1.music.126.net/N2HOvxfkYKqkYHZANi5EcQ==/109951170048506932.jpg" },
  { id: "2884035", title: "原创榜", artwork: "https://p1.music.126.net/sBzD11n0huNGxT3FmRfGqA==/109951170048506930.jpg" },
  { id: "3778678", title: "热歌榜", artwork: "https://p1.music.126.net/Zy1EDuRgBNmDwOMcuBXsxA==/109951170048506931.jpg" },
];

// ===== 结束常量 =====

// ===== 工具函数 =====

/**
 * 从用户变量或默认值获取音乐源
 * 支持的源: netease, kuwo, kugou, migu, tencent, bilibili
 */
function getMusicSource() {
  try {
    const vars = env.getUserVariables();
    return (vars && vars.source) || "netease";
  } catch (e) {
    return "netease";
  }
}

/**
 * 格式化歌手名（数组 → 用 / 拼接）
 */
function formatArtist(artists) {
  if (!artists || !artists.length) return "未知歌手";
  return artists.map((a) => a.name).join(" / ");
}

/**
 * 将 NetEase 搜索结果转为 IMusicItem
 */
function formatMusicItem(item, source) {
  const songId = String(item.id);
  return {
    id: songId,
    title: item.name,
    artist: formatArtist(item.artists),
    album: (item.album && item.album.name) || "",
    artwork: item.album
      ? METING_BASE +
        "?server=" +
        source +
        "&type=pic&id=" +
        item.album.picId
      : "",
    duration: item.duration ? Math.floor(item.duration / 1000) : 0,
    // 扩展字段：供后续方法使用
    _source: source,
    _picId: item.album ? String(item.album.picId) : "",
    _neteaseId: songId,
  };
}

/**
 * 封装 Meting API 请求
 */
async function metingRequest(server, type, id) {
  const url =
    METING_BASE + "?server=" + server + "&type=" + type + "&id=" + id;
  const res = await axios.get(url, {
    headers: { "User-Agent": UA },
    timeout: 8000,
  });
  return res.data;
}

// ===== 插件方法 =====

/**
 * 搜索 - 使用 NetEase API
 */
async function search(query, page, type) {
  if (type !== "music") {
    return { isEnd: true, data: [] };
  }

  const source = getMusicSource();
  const limit = 30;
  const offset = (page - 1) * limit;

  try {
    const res = await axios.get(NETEASE_SEARCH, {
      params: {
        s: query,
        type: 1, // 1=单曲
        limit: limit,
        offset: offset,
      },
      headers: {
        "User-Agent": UA,
        Referer: "https://music.163.com/",
      },
      timeout: 10000,
    });

    const data = res.data;
    if (!data || data.code !== 200 || !data.result) {
      return { isEnd: true, data: [] };
    }

    const songs = data.result.songs || [];
    const total = data.result.songCount || 0;

    return {
      isEnd: offset + songs.length >= total,
      data: songs.map(function (item) {
        return formatMusicItem(item, source);
      }),
    };
  } catch (e) {
    console.error("[Meting聚合] 搜索失败:", e.message);
    return { isEnd: true, data: [] };
  }
}

/**
 * 获取播放链接 - 使用 Meting API type=url
 */
async function getMediaSource(musicItem, quality) {
  const source = musicItem._source || getMusicSource();
  const songId = musicItem._neteaseId || musicItem.id;

  // 音质映射 (Meting API 的 br 参数)
  // low=128, standard=192, high=320, super=740(flac)
  const qualityMap = {
    low: "128",
    standard: "192",
    high: "320",
    super: "740",
  };
  const br = qualityMap[quality] || "320";

  try {
    // Meting type=url 会重定向到真实音频地址
    // 直接返回 Meting 端点作为 URL
    const audioUrl =
      METING_BASE +
      "?server=" +
      source +
      "&type=url&id=" +
      songId +
      "&br=" +
      br;

    return {
      url: audioUrl,
    };
  } catch (e) {
    console.error("[Meting聚合] 获取音源失败:", e.message);
    throw new Error("获取播放链接失败");
  }
}

/**
 * 获取歌词 - 使用 Meting API type=lrc
 */
async function getLyric(musicItem) {
  const source = musicItem._source || getMusicSource();
  const songId = musicItem._neteaseId || musicItem.id;

  try {
    const lrcText = await metingRequest(source, "lrc", songId);

    if (!lrcText || typeof lrcText !== "string") {
      return { rawLrc: "" };
    }

    return {
      rawLrc: lrcText,
    };
  } catch (e) {
    console.error("[Meting聚合] 获取歌词失败:", e.message);
    return { rawLrc: "" };
  }
}

/**
 * 获取歌曲详情 - 使用 Meting API type=song 补全信息
 */
async function getMusicInfo(musicItem) {
  const source = musicItem._source || getMusicSource();
  const songId = musicItem._neteaseId || musicItem.id;

  try {
    const songData = await metingRequest(source, "song", songId);

    if (!songData || !songData.length) {
      return {};
    }

    const info = songData[0];
    const result = {};

    // 补全标题和歌手（Meting 数据可能更准确）
    if (info.name) result.title = info.name;
    if (info.artist) result.artist = info.artist;

    return result;
  } catch (e) {
    console.error("[Meting聚合] 获取歌曲信息失败:", e.message);
    return {};
  }
}

/**
 * 获取排行榜列表
 */
async function getTopLists() {
  return [
    {
      title: "热门榜单",
      data: HOT_TOP_LISTS,
    },
  ];
}

/**
 * 获取排行榜详情 - 使用 NetEase API 获取榜单歌曲
 */
async function getTopListDetail(topListItem, page) {
  const source = getMusicSource();
  const playlistId = topListItem.id;

  try {
    const res = await axios.get(
      "https://music.163.com/api/playlist/detail",
      {
        params: {
          id: playlistId,
          limit: 50,
          offset: (page - 1) * 50,
        },
        headers: {
          "User-Agent": UA,
          Referer: "https://music.163.com/",
        },
        timeout: 10000,
      }
    );

    const data = res.data;
    if (!data || data.code !== 200 || !data.result) {
      return { isEnd: true, musicList: [] };
    }

    const tracks = data.result.tracks || [];
    const trackIds = data.result.trackIds || [];

    return {
      isEnd: (page - 1) * 50 + tracks.length >= trackIds.length,
      musicList: tracks.map(function (item) {
        return formatMusicItem(item, source);
      }),
    };
  } catch (e) {
    console.error("[Meting聚合] 获取榜单详情失败:", e.message);
    return { isEnd: true, musicList: [] };
  }
}

/**
 * 获取推荐歌单标签
 */
async function getRecommendSheetTags() {
  return {
    data: [
      {
        title: "推荐歌单",
        data: [
          { id: "hot", title: "热门" },
          { id: "new", title: "最新" },
        ],
      },
    ],
  };
}

/**
 * 按标签获取推荐歌单 - 使用 NetEase API
 */
async function getRecommendSheetsByTag(tag, page) {
  const source = getMusicSource();
  // NetEase 歌单分类: tag.id 对应实际的分类名
  const catMap = { hot: "华语", new: "流行" };
  const cat = catMap[tag.id] || "华语";
  const limit = 30;

  try {
    const res = await axios.get(
      "https://music.163.com/api/playlist/list",
      {
        params: {
          cat: cat,
          order: tag.id === "new" ? "new" : "hot",
          limit: limit,
          offset: (page - 1) * limit,
          total: true,
        },
        headers: {
          "User-Agent": UA,
          Referer: "https://music.163.com/",
        },
        timeout: 10000,
      }
    );

    const data = res.data;
    if (!data || data.code !== 200) {
      return { isEnd: true, data: [] };
    }

    const playlists = data.playlists || [];
    const total = data.total || 0;

    return {
      isEnd: (page - 1) * limit + playlists.length >= total,
      data: playlists.map(function (pl) {
        return {
          id: String(pl.id),
          title: pl.name,
          artwork: pl.coverImgUrl || "",
          artist: (pl.creator && pl.creator.nickname) || "",
          description: pl.description || "",
          playCount: pl.playCount || 0,
          worksNum: pl.trackCount || 0,
          _source: source,
        };
      }),
    };
  } catch (e) {
    console.error("[Meting聚合] 获取推荐歌单失败:", e.message);
    return { isEnd: true, data: [] };
  }
}

/**
 * 获取歌单详情 - 使用 NetEase API
 */
async function getMusicSheetInfo(sheetItem, page) {
  const source = sheetItem._source || getMusicSource();
  const playlistId = sheetItem.id;

  try {
    const res = await axios.get(
      "https://music.163.com/api/playlist/detail",
      {
        params: {
          id: playlistId,
          limit: 50,
          offset: (page - 1) * 50,
        },
        headers: {
          "User-Agent": UA,
          Referer: "https://music.163.com/",
        },
        timeout: 10000,
      }
    );

    const data = res.data;
    if (!data || data.code !== 200 || !data.result) {
      return { isEnd: true, musicList: [] };
    }

    const tracks = data.result.tracks || [];
    const trackIds = data.result.trackIds || [];

    return {
      isEnd: (page - 1) * 50 + tracks.length >= trackIds.length,
      musicList: tracks.map(function (item) {
        return formatMusicItem(item, source);
      }),
    };
  } catch (e) {
    console.error("[Meting聚合] 获取歌单详情失败:", e.message);
    return { isEnd: true, musicList: [] };
  }
}

// ===== 导出 =====
module.exports = {
  platform: "碳酸Meting",
  version: "1.0.0",
  author: "葡萄球君",
  shareURL: "https://gitee.com/nainoz_naa/music/raw/master/%E7%A2%B3%E9%85%B8Meting.js",
  description:
    "基于 Meting API 的多平台音乐聚合插件\n\n" +
    "数据来源：\n" +
    "- 搜索：网易云音乐 API\n" +
    "- 播放/歌词/封面：Meting API (api.injahow.cn)\n\n" +
    "支持的音乐源（在插件设置中切换）：\n" +
    "netease - 网易云音乐（默认）\n" +
    "kuwo - 酷我音乐\n" +
    "kugou - 酷狗音乐\n" +
    "migu - 咪咕音乐\n" +
    "tencent - QQ音乐\n\n" +
    "注意：部分音源可能不稳定，建议使用默认 netease",
  cacheControl: "no-cache",
  supportedSearchType: ["music"],
  userVariables: [
    {
      key: "source",
      name: "音乐源",
      hint: "netease / kuwo / kugou / migu / tencent，默认 netease",
    },
  ],

  search: search,
  getMediaSource: getMediaSource,
  getLyric: getLyric,
  getMusicInfo: getMusicInfo,
  getTopLists: getTopLists,
  getTopListDetail: getTopListDetail,
  getRecommendSheetTags: getRecommendSheetTags,
  getRecommendSheetsByTag: getRecommendSheetsByTag,
  getMusicSheetInfo: getMusicSheetInfo,
};
