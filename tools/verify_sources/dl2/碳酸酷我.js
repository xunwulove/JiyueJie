"use strict";
const axios = require("axios");

// ===== 配置 =====
const SEARCH_API = "https://search.kuwo.cn/r.s";
const PLAY_API = "http://antiserver.kuwo.cn/anti.s";
const LYRIC_API = "http://m.kuwo.cn/newh5/singles/songinfoandlrc";

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1";

// ===== 工具函数 =====

/**
 * 将酷我搜索 API 的单引号伪 JSON 转为真正的 JSON 对象
 * 酷我 API 返回的是类似 JavaScript 对象字面量格式（键值都用单引号）
 */
function parseKuwoResponse(text) {
  if (!text) return null;
  // 移除末尾可能的多余字符，确保是完整对象
  var trimmed = text.trim();
  // 将单引号键值替换为双引号
  var jsonStr = trimmed
    .replace(/'/g, '"')            // 单引号 → 双引号
    .replace(/True/g, "true")      // Python True → true
    .replace(/False/g, "false");   // Python False → false
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("[酷我音乐] JSON 解析失败:", e.message);
    return null;
  }
}

/** 从 MUSICRID 提取纯数字 ID */
function extractId(musicrid) {
  if (!musicrid) return "";
  return String(musicrid).replace("MUSIC_", "");
}

/** 将 lrclist 转成 LRC 格式 */
function lrclistToLrc(lrclist) {
  if (!lrclist || !lrclist.length) return "";
  return lrclist
    .map(function (item) {
      var t = parseFloat(item.time);
      var min = Math.floor(t / 60);
      var sec = (t % 60).toFixed(2);
      if (min < 10) min = "0" + min;
      if (parseFloat(sec) < 10) sec = "0" + sec;
      return "[" + min + ":" + sec + "]" + item.lineLyric;
    })
    .join("\n");
}

/** 判断音质对应的 format 参数 */
function getFormat(quality) {
  var map = {
    low: "aac",
    standard: "mp3",
    high: "mp3",
    super: "mp3",
  };
  return map[quality] || "mp3";
}

// ===== 插件方法 =====

/**
 * 搜索
 */
async function search(query, page, type) {
  if (type !== "music") {
    return { isEnd: true, data: [] };
  }

  var limit = 30;
  var pn = (page - 1) * limit;

  try {
    var res = await axios.get(SEARCH_API, {
      params: {
        all: query,
        ft: "music",
        pn: pn,
        rn: limit,
        rformat: "json",
        encoding: "utf8",
      },
      headers: {
        "User-Agent": UA,
        Referer: "https://www.kuwo.cn/",
      },
      responseType: "text",
      timeout: 10000,
    });

    var data = parseKuwoResponse(res.data);
    if (!data || !data.abslist || !data.abslist.length) {
      return { isEnd: true, data: [] };
    }

    var total = parseInt(data.TOTAL) || 0;

    return {
      isEnd: pn + data.abslist.length >= total,
      data: data.abslist.map(function (item) {
        var songId = extractId(item.MUSICRID);
        return {
          id: item.MUSICRID,
          title: item.NAME || item.SONGNAME || "",
          artist: item.ARTIST || "",
          album: item.ALBUM || "",
          duration: parseInt(item.DURATION) || 0,
          artwork: item.PICPATH || "",
          // 扩展字段
          _songId: songId,
          _musicrid: item.MUSICRID,
          _formats: item.FORMATS || "",
          _artistid: item.ARTISTID || "",
          _albumid: item.ALBUMID || "",
        };
      }),
    };
  } catch (e) {
    console.error("[酷我音乐] 搜索失败:", e.message);
    return { isEnd: true, data: [] };
  }
}

/**
 * 获取播放链接
 */
async function getMediaSource(musicItem, quality) {
  var musicrid = musicItem._musicrid || musicItem.id;
  var format = getFormat(quality);

  try {
    var res = await axios.get(PLAY_API, {
      params: {
        type: "convert_url",
        rid: musicrid,
        format: format,
        response: "url",
      },
      headers: {
        "User-Agent": UA,
        Referer: "https://www.kuwo.cn/",
      },
      responseType: "text",
      timeout: 8000,
    });

    var url = typeof res.data === "string" ? res.data.trim() : "";
    if (!url || !url.startsWith("http")) {
      throw new Error("获取播放链接失败");
    }

    return { url: url };
  } catch (e) {
    console.error("[酷我音乐] 获取音源失败:", e.message);
    throw new Error("获取播放链接失败");
  }
}

/**
 * 获取歌词 - 酷我 API + Meting 兜底
 */
async function getLyric(musicItem) {
  var songId = musicItem._songId || extractId(musicItem.id);

  // 方案1：酷我原生歌词 API
  try {
    var res = await axios.get(LYRIC_API, {
      params: { musicId: songId },
      headers: {
        "User-Agent": UA,
        Referer: "http://m.kuwo.cn/",
      },
      timeout: 8000,
    });

    var data = res.data;
    if (data && data.status === 200 && data.data && data.data.lrclist) {
      var lrc = lrclistToLrc(data.data.lrclist);
      if (lrc) return { rawLrc: lrc };
    }
  } catch (e) {
    // 酷我歌词失败，尝试 Meting 兜底
  }

  // 方案2：Meting API 兜底（用 netease 源尝试）
  try {
    var metingUrl =
      "https://api.injahow.cn/meting/?server=netease&type=lrc&id=" + songId;
    var metingRes = await axios.get(metingUrl, {
      headers: { "User-Agent": UA },
      responseType: "text",
      timeout: 8000,
    });
    var metingLrc = metingRes.data;
    if (
      typeof metingLrc === "string" &&
      metingLrc.trim() &&
      metingLrc.indexOf("暂无歌词") === -1
    ) {
      return { rawLrc: metingLrc.trim() };
    }
  } catch (e2) {
    // Meting 也失败，放弃
  }

  return { rawLrc: "" };
}

// ===== 导出 =====
module.exports = {
  platform: "碳酸酷我",
  version: "1.0.0",
  author: "葡萄球君",
  shareURL: "https://gitee.com/nainoz_naa/music/raw/master/%E7%A2%B3%E9%85%B8%E9%85%B7%E6%88%91.js",
  description:
    "酷我音乐插件\n\n" +
    "数据来源：search.kuwo.cn / antiserver.kuwo.cn\n" +
    "支持搜索、播放、歌词\n" +
    "音质支持：标准 / 高品质 / 无损\n\n" +
    "注意：仅支持免费歌曲播放，VIP 歌曲可能无法获取音源",
  cacheControl: "no-cache",
  supportedSearchType: ["music"],

  search: search,
  getMediaSource: getMediaSource,
  getLyric: getLyric,
};
