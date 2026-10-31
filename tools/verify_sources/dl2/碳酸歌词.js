"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const axios = require("axios");
const CryptoJs = require("crypto-js");
const qs = require("qs");
const bigInt = require("big-integer");
const he = require("he");
const cheerio = require("cheerio");

// ============================================================
//  网易云音乐 — AES+RSA 加密工具函数
// ============================================================
function create_key() {
  var d, e,
    b = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    c = "";
  for (d = 0; 16 > d; d += 1)
    (e = Math.random() * b.length), (e = Math.floor(e)), (c += b.charAt(e));
  return c;
}

function AES_encrypt(a, b) {
  var c = CryptoJs.enc.Utf8.parse(b),
    d = CryptoJs.enc.Utf8.parse("0102030405060708"),
    e = CryptoJs.enc.Utf8.parse(a),
    f = CryptoJs.AES.encrypt(e, c, { iv: d, mode: CryptoJs.mode.CBC });
  return f.toString();
}

function Rsa(text) {
  text = text.split("").reverse().join("");
  const d = "010001";
  const e =
    "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7";
  const hexText = text.split("").map(function (_) { return _.charCodeAt(0).toString(16); }).join("");
  const res = bigInt(hexText, 16).modPow(bigInt(d, 16), bigInt(e, 16)).toString(16);
  return Array(256 - res.length).fill("0").join("").concat(res);
}

function getParamsAndEnc(text) {
  const first = AES_encrypt(text, "0CoJUm6Qyw8W8jud");
  const rand = create_key();
  const params = AES_encrypt(first, rand);
  const encSecKey = Rsa(rand);
  return { params: params, encSecKey: encSecKey };
}

// ============================================================
//  公共常量
// ============================================================
const PAGE_SIZE = 20;

const WY_HEADERS = {
  authority: "music.163.com",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
  "content-type": "application/x-www-form-urlencoded",
  accept: "*/*",
  origin: "https://music.163.com",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  referer: "https://music.163.com/search/",
  "accept-language": "zh-CN,zh;q=0.9",
};

const KG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

const QQ_HEADERS = {
  referer: "https://y.qq.com",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
  Cookie: "uin=",
};

// ============================================================
//  源 1：网易云音乐 — 歌词搜索
//  API: POST music.163.com/weapi/search/get (type=1006)
//  返回带 rawLrcTxt 的结果
// ============================================================
async function neteaseSearchLyric(query, page) {
  try {
    var data = {
      s: query,
      limit: PAGE_SIZE,
      type: 1006,
      offset: (page - 1) * PAGE_SIZE,
      csrf_token: "",
    };
    var pae = getParamsAndEnc(JSON.stringify(data));
    var paeData = qs.stringify(pae);

    var res = (await axios({
      method: "post",
      url: "https://music.163.com/weapi/search/get",
      headers: WY_HEADERS,
      data: paeData,
    })).data;

    var songs = res.result.songs || [];
    return songs.map(function (it) {
      var _a, _b;
      return {
        title: it.name,
        artist: (_a = it.ar) !== null && _a !== void 0
          ? _a.map(function (_) { return _.name; }).join(", ")
          : "",
        id: it.id,
        artwork: (_b = it.al) !== null && _b !== void 0 ? _b.picUrl : "",
        album: it.al ? it.al.name : "",
        rawLrcTxt: (it.lyrics || []).join("\n"),
        source: "\u7F51\u6613\u4E91",
      };
    });
  } catch (e) {
    return [];
  }
}

// ============================================================
//  源 2：酷狗音乐 — 歌词搜索
//  API: songsearch.kugou.com → lyrics.kugou.com/search → download
// ============================================================
async function kugouSearchLyric(query, page) {
  try {
    // Step 1: 搜索歌曲
    var searchRes = (await axios.get("https://songsearch.kugou.com/song_search_v2", {
      headers: KG_HEADERS,
      params: {
        keyword: query,
        page: page,
        pagesize: PAGE_SIZE,
        userid: 0,
        clientver: "",
        platform: "WebFilter",
        filter: 2,
        iscorrection: 1,
        privilege_filter: 0,
        area_code: 1,
      },
    })).data;

    var lists = searchRes.data.lists || [];
    if (lists.length === 0) return [];

    // Step 2: 并行获取每首歌的歌词
    var promises = lists.map(function (song) {
      return (async function () {
        var fileHash = song.FileHash || (song.Grp && song.Grp[0] && song.Grp[0].FileHash) || "";
        var songName = song.SongName || song.OriSongName || "";
        var singerName = song.SingerName || (song.Singers && song.Singers[0] && song.Singers[0].name) || "";
        var albumName = song.AlbumName || (song.Grp && song.Grp[0] && song.Grp[0].AlbumName) || "";
        var artwork = (song.Image || (song.Grp && song.Grp[0] && song.Grp[0].Image) || "").replace("{size}", "1080");
        var duration = song.Duration || 0;
        var lyricText = "";

        try {
          var lyricSearch = (await axios({
            url: "http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword="
              + encodeURIComponent(songName) + "&hash=" + fileHash + "&timelength=" + duration,
            headers: {
              "KG-RC": 1,
              "KG-THash": "expand_search_manager.cpp:852736169:451",
              "User-Agent": "KuGou2012-9020-ExpandSearchManager",
            },
            method: "get",
            xsrfCookieName: "XSRF-TOKEN",
            withCredentials: true,
          })).data;

          if (lyricSearch.candidates && lyricSearch.candidates.length > 0) {
            var info = lyricSearch.candidates[0];
            var downloadRes = (await axios({
              url: "http://lyrics.kugou.com/download?ver=1&client=pc&id=" + info.id
                + "&accesskey=" + info.accesskey + "&fmt=lrc&charset=utf8",
              headers: {
                "KG-RC": 1,
                "KG-THash": "expand_search_manager.cpp:852736169:451",
                "User-Agent": "KuGou2012-9020-ExpandSearchManager",
              },
              method: "get",
              xsrfCookieName: "XSRF-TOKEN",
              withCredentials: true,
            })).data;

            lyricText = he.decode(
              CryptoJs.enc.Base64.parse(downloadRes.content).toString(CryptoJs.enc.Utf8)
            );
          }
        } catch (e) {
          // 歌词获取失败，返回空歌词
        }

        return {
          title: songName,
          artist: singerName,
          id: fileHash,
          artwork: artwork,
          album: albumName,
          duration: duration,
          rawLrcTxt: lyricText,
          source: "\u9177\u72D7",
        };
      })();
    });

    var results = await Promise.allSettled(promises);
    return results
      .filter(function (r) { return r.status === "fulfilled" && r.value; })
      .map(function (r) { return r.value; });
  } catch (e) {
    return [];
  }
}

// ============================================================
//  源 3：QQ音乐 — 歌词搜索
//  API: POST u.y.qq.com/cgi-bin/musicu.fcg (type=7)
// ============================================================
async function qqSearchLyric(query, page) {
  try {
    var res = (await axios({
      url: "https://u.y.qq.com/cgi-bin/musicu.fcg",
      method: "POST",
      data: {
        req_1: {
          method: "DoSearchForQQMusicDesktop",
          module: "music.search.SearchCgiService",
          param: {
            num_per_page: PAGE_SIZE,
            page_num: page,
            query: query,
            search_type: 7,
          },
        },
      },
      headers: QQ_HEADERS,
      xsrfCookieName: "XSRF-TOKEN",
      withCredentials: true,
    })).data;

    var list = (res.req_1.data.body.song || {}).list || [];
    return list.map(function (it) {
      var albumMid = (it.album || {}).mid || "";
      return {
        title: it.title || it.songname || "",
        artist: (it.singer || []).map(function (s) { return s.name; }).join(", "),
        id: it.id || it.songid || "",
        songmid: it.mid || it.songmid || "",
        artwork: albumMid
          ? "https://y.gtimg.cn/music/photo_new/T002R800x800M000" + albumMid + ".jpg"
          : "",
        album: (it.album || {}).title || (it.album || {}).name || "",
        rawLrcTxt: it.content || "",
        source: "QQ\u97F3\u4E50",
      };
    });
  } catch (e) {
    return [];
  }
}

// ============================================================
//  源 4：汽水音乐（抖音）— 歌词搜索
//  API: api-vehicle.volcengine.com/v2/search/type → custom/contents
// ============================================================
async function qishuiSearchLyric(query, page) {
  try {
    var offset = (page - 1) * PAGE_SIZE;

    // Step 1: 搜索歌曲
    var searchRes = (await axios.get("https://api-vehicle.volcengine.com/v2/search/type", {
      params: {
        keyword: query,
        search_type: "music",
        limit: PAGE_SIZE,
        real_offset: offset,
        search_source: "qishui",
      },
    })).data;

    var list = (searchRes.data && searchRes.data.list) || [];
    if (list.length === 0) return [];

    // Step 2: 并行获取歌词
    var promises = list.map(function (item) {
      return (async function () {
        try {
          var detailRes = (await axios.get("https://api-vehicle.volcengine.com/v2/custom/contents", {
            params: {
              sources: "qishui",
              need_author: true,
              need_album: true,
              need_ugc: true,
              need_stat: true,
              item_ids: item.item_id,
            },
          })).data;

          var detail = (detailRes.data && detailRes.data.list && detailRes.data.list[0]) || {};
          var lyricInfo = detail.lyric_info || {};

          return {
            title: item.title || "",
            artist: (item.author_info || {}).name || "",
            id: item.item_id,
            artwork: item.cover_url || "",
            album: (item.album_info || {}).name || "",
            rawLrcTxt: lyricInfo.lyric_text || "",
            source: "\u6C7D\u6C34\u97F3\u4E50",
          };
        } catch (e) {
          return {
            title: item.title || "",
            artist: (item.author_info || {}).name || "",
            id: item.item_id,
            artwork: item.cover_url || "",
            album: "",
            rawLrcTxt: "",
            source: "\u6C7D\u6C34\u97F3\u4E50",
          };
        }
      })();
    });

    var results = await Promise.allSettled(promises);
    return results
      .filter(function (r) { return r.status === "fulfilled" && r.value; })
      .map(function (r) { return r.value; });
  } catch (e) {
    return [];
  }
}

// ============================================================
//  源 5：歌词网 (followlyrics.com) — 歌词搜索+抓取
//  API: zh.followlyrics.com/search → 页面解析
// ============================================================
async function geciwangSearchLyric(query, page) {
  try {
    var searchUrl = "https://zh.followlyrics.com/search?q=" + encodeURIComponent(query);
    var res = (await axios.get(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    })).data;

    var $ = cheerio.load(res);
    var results = [];

    // 尝试多种选择器匹配搜索结果
    $("a[href]").each(function (i, el) {
      if (results.length >= PAGE_SIZE) return false;

      var href = $(el).attr("href") || "";
      var text = $(el).text().trim();

      // 匹配歌词页链接
      if (!text || text.length < 2) return;
      if (!/\/lyrics?\/|\/song\/|song\//i.test(href) && !/lyrics?/i.test(href)) return;

      results.push({
        title: text,
        artist: "",
        id: href,
        artwork: "",
        album: "",
        rawLrcTxt: "",
        source: "\u6B4C\u8BCD\u7F51",
        _lyricUrl: href.startsWith("http") ? href : "https://zh.followlyrics.com" + href.replace(/^\//, "/"),
      });
    });

    // 如果上面没匹配到，尝试用通用选择器
    if (results.length === 0) {
      $(".list-item a, .song-item a, .result-item a, a[href*='song'], a[href*='lyric']").each(function (i, el) {
        if (results.length >= PAGE_SIZE) return false;
        var href = $(el).attr("href") || "";
        var text = $(el).text().trim();
        if (!text || text.length < 2) return;
        results.push({
          title: text,
          artist: "",
          id: href,
          artwork: "",
          album: "",
          rawLrcTxt: "",
          source: "\u6B4C\u8BCD\u7F51",
          _lyricUrl: href.startsWith("http") ? href : "https://zh.followlyrics.com" + href.replace(/^\//, "/"),
        });
      });
    }

    // Step 2: 抓取每首歌的歌词
    var enriched = await Promise.allSettled(
      results.map(function (item) {
        return (async function () {
          if (item._lyricUrl) {
            try {
              var lyricRes = (await axios.get(item._lyricUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
                },
              })).data;

              var $$ = cheerio.load(lyricRes);
              // 尝试多种歌词容器选择器
              var lrcText = $$("div#lyrics, .lyrics, .lyric-text, .song-text, pre, .lyric-content")
                .first().text().trim();

              if (!lrcText) {
                // 尝试从页面中提取任意大段文本作为歌词
                lrcText = $$("body").text().split(/\n{2,}/).filter(function (t) {
                  return t.length > 50;
                })[0] || "";
              }

              item.rawLrcTxt = lrcText;
            } catch (e) {
              // 歌词抓取失败
            }
          }
          delete item._lyricUrl;
          return item;
        })();
      })
    );

    return enriched
      .filter(function (r) { return r.status === "fulfilled" && r.value; })
      .map(function (r) { return r.value; });
  } catch (e) {
    return [];
  }
}

// ============================================================
//  聚合搜索 — 交叉显示
//  轮流从每个源取一条结果，循环直到所有源耗尽
// ============================================================
async function search(query, page, type) {
  if (type !== "lyric") {
    return { isEnd: true, data: [] };
  }

  var sources = [
    { name: "\u7F51\u6613\u4E91", fn: neteaseSearchLyric },
    { name: "\u9177\u72D7", fn: kugouSearchLyric },
    { name: "QQ\u97F3\u4E50", fn: qqSearchLyric },
    { name: "\u6C7D\u6C34\u97F3\u4E50", fn: qishuiSearchLyric },
    { name: "\u6B4C\u8BCD\u7F51", fn: geciwangSearchLyric },
  ];

  // 并行查询所有源
  var settled = await Promise.allSettled(
    sources.map(function (s) {
      return s.fn(query, page).catch(function () { return []; });
    })
  );

  var arrays = settled.map(function (r, i) {
    var data = r.status === "fulfilled" ? r.value : [];
    return data;
  });

  // 交叉（轮询）合并
  var interleaved = [];
  var maxLen = 0;
  for (var i = 0; i < arrays.length; i++) {
    if (arrays[i].length > maxLen) maxLen = arrays[i].length;
  }

  for (var i = 0; i < maxLen; i++) {
    for (var j = 0; j < arrays.length; j++) {
      if (i < arrays[j].length) {
        interleaved.push(arrays[j][i]);
      }
    }
  }

  return {
    isEnd: true,
    data: interleaved,
  };
}

// ============================================================
//  getLyric — 根据 source 字段调用对应平台的歌词API
// ============================================================
async function getLyric(musicItem) {
  var source = musicItem.source || "";

  // ---- 网易云 ----
  if (source === "\u7F51\u6613\u4E91" || (!source && typeof musicItem.id === "number")) {
    try {
      var headers = {
        Referer: "https://y.music.163.com/",
        Origin: "https://y.music.163.com/",
        authority: "music.163.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
      };
      var data = { id: musicItem.id, lv: -1, tv: -1, csrf_token: "" };
      var pae = getParamsAndEnc(JSON.stringify(data));
      var paeData = qs.stringify(pae);
      var res = (await axios({
        method: "post",
        url: "https://interface.music.163.com/weapi/song/lyric?csrf_token=",
        headers: headers,
        data: paeData,
      })).data;
      return { rawLrc: (res.lrc || {}).lyric || "" };
    } catch (e) {
      return { rawLrc: musicItem.rawLrcTxt || "" };
    }
  }

  // ---- QQ音乐 ----
  if (source === "QQ\u97F3\u4E50" || musicItem.songmid) {
    try {
      var songmid = musicItem.songmid;
      var result = (await axios({
        url: "http://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=" + songmid
          + "&pcachetime=" + new Date().getTime()
          + "&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0",
        headers: { Referer: "https://y.qq.com", Cookie: "uin=" },
        method: "get",
        xsrfCookieName: "XSRF-TOKEN",
        withCredentials: true,
      })).data;

      var jsonStr = result.replace(/callback\(|MusicJsonCallback\(|jsonCallback\(|\)$/g, "");
      var parsed = JSON.parse(jsonStr);

      var lrc = "";
      if (parsed.lyric) {
        lrc = he.decode(CryptoJs.enc.Base64.parse(parsed.lyric).toString(CryptoJs.enc.Utf8));
      }

      // 翻译歌词
      var translation = "";
      if (parsed.trans) {
        translation = he.decode(CryptoJs.enc.Base64.parse(parsed.trans).toString(CryptoJs.enc.Utf8));
      }

      return { rawLrc: lrc, translation: translation || undefined };
    } catch (e) {
      return { rawLrc: musicItem.rawLrcTxt || "" };
    }
  }

  // ---- 酷狗 ----
  if (source === "\u9177\u72D7" && musicItem.title) {
    try {
      var lyricSearch = (await axios({
        url: "http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword="
          + encodeURIComponent(musicItem.title)
          + "&hash=" + (musicItem.id || "")
          + "&timelength=" + (musicItem.duration || 0),
        headers: {
          "KG-RC": 1,
          "KG-THash": "expand_search_manager.cpp:852736169:451",
          "User-Agent": "KuGou2012-9020-ExpandSearchManager",
        },
        method: "get",
        xsrfCookieName: "XSRF-TOKEN",
        withCredentials: true,
      })).data;

      if (lyricSearch.candidates && lyricSearch.candidates.length > 0) {
        var info = lyricSearch.candidates[0];
        var downloadRes = (await axios({
          url: "http://lyrics.kugou.com/download?ver=1&client=pc&id=" + info.id
            + "&accesskey=" + info.accesskey + "&fmt=lrc&charset=utf8",
          headers: {
            "KG-RC": 1,
            "KG-THash": "expand_search_manager.cpp:852736169:451",
            "User-Agent": "KuGou2012-9020-ExpandSearchManager",
          },
          method: "get",
          xsrfCookieName: "XSRF-TOKEN",
          withCredentials: true,
        })).data;

        return {
          rawLrc: he.decode(
            CryptoJs.enc.Base64.parse(downloadRes.content).toString(CryptoJs.enc.Utf8)
          ),
        };
      }
    } catch (e) {
      // 降级返回已有歌词
    }
    return { rawLrc: musicItem.rawLrcTxt || "" };
  }

  // ---- 汽水音乐 ----
  if (source === "\u6C7D\u6C34\u97F3\u4E50" || (musicItem.id && String(musicItem.id).length > 15)) {
    try {
      var detailRes = (await axios.get("https://api-vehicle.volcengine.com/v2/custom/contents", {
        params: {
          sources: "qishui",
          need_author: true,
          need_album: true,
          need_ugc: true,
          need_stat: true,
          item_ids: musicItem.id,
        },
      })).data;

      var detail = (detailRes.data && detailRes.data.list && detailRes.data.list[0]) || {};
      var lyricInfo = detail.lyric_info || {};
      return { rawLrc: lyricInfo.lyric_text || musicItem.rawLrcTxt || "" };
    } catch (e) {
      return { rawLrc: musicItem.rawLrcTxt || "" };
    }
  }

  // ---- 歌词网 / fallback ----
  return { rawLrc: musicItem.rawLrcTxt || "" };
}

// ============================================================
//  插件导出
// ============================================================
module.exports = {
  platform: "\u78B3\u9178\u6B4C\u8BCD",
  author: "\u8461\u8404\u7403\u541B",
  version: "2.0.0",
  srcUrl: "https://gitee.com/nainoz_naa/music/raw/master/NaH.js",
  cacheControl: "no-store",
  primaryKey: ["id", "source"],
  hints: {
    importMusicSheet: [],
    importMusicItem: [],
  },
  supportedSearchType: ["lyric"],
  search: search,
  getLyric: getLyric,
};
