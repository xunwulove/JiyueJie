const axios = require("axios");

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
const PAGE_SIZE = 30;

function coverUrl(path) {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return "https://imagev2.xmcdn.com/" + path;
}

function formatMusicItem(t) {
  return {
    id: String(t.id ?? t.trackId),
    title: t.title,
    artist: t.nickname ?? t.anchorName,
    album: t.albumTitle,
    duration: +(t.duration ?? 0), // 喜马拉雅时长单位就是秒
    artwork: coverUrl(t.coverPath ?? t.albumCoverPath),
  };
}

function formatAlbumItem(a) {
  return {
    id: String(a.albumId),
    title: a.title,
    artist: a.nickname,
    artwork: coverUrl(a.coverPath),
    description: a.intro,
    worksNum: a.tracksCount,
    playCount: a.playCount,
  };
}

async function search(query, page, type) {
  const isAlbum = type === "album";
  const res = await axios.get("https://www.ximalaya.com/revision/search/seo", {
    params: {
      kw: query,
      page,
      rows: PAGE_SIZE,
      spellchecker: true,
      condition: "relation",
      device: "iPhone",
      core: isAlbum ? "album" : "track",
      isGrayFilter: true,
    },
    headers: {
      "user-agent": UA,
      referer: "https://www.ximalaya.com/search/" + encodeURIComponent(query),
    },
  });
  const data = res.data?.data;
  if (!data) return { isEnd: true, data: [] };
  const list = isAlbum ? data.album : data.track;
  if (!list) return { isEnd: true, data: [] };
  const docs = list.docs ?? [];
  // 坑: album/track 搜索的 totalPage 均恒为 1 (接口bug, total 数千但 totalPage=1),
  // 翻页仍有数据, 只能统一用空页判断 isEnd。
  const isEnd = docs.length === 0;
  return {
    isEnd,
    // 过滤付费内容：播放接口对 isPaid 内容返回 407 webtk缺失，无法直链播放
    data: docs.filter((d) => !d.isPaid).map(isAlbum ? formatAlbumItem : formatMusicItem),
  };
}

async function getAlbumInfo(albumItem, page) {
  const res = await axios.get("https://m.ximalaya.com/revision/album/getTracksList", {
    params: { albumId: albumItem.id, pageNum: page, pageSize: PAGE_SIZE },
    headers: {
      "user-agent": UA,
      referer: "https://m.ximalaya.com/album/" + albumItem.id,
    },
  });
  const data = res.data?.data;
  if (!data) return { isEnd: true, musicList: [] };
  const tracks = data.tracks ?? [];
  const total = data.trackTotalCount ?? 0;
  return {
    isEnd: page * PAGE_SIZE >= total || tracks.length === 0,
    musicList: tracks.filter((t) => !t.isPaid).map(formatMusicItem),
  };
}

async function getMediaSource(musicItem, quality) {
  const res = await axios.get("https://m.ximalaya.com/tracks/" + musicItem.id + ".json", {
    headers: { "user-agent": UA },
  });
  const data = res.data;
  if (!data || !data.play_path_64) return null; // 407 webtk缺失 / 无音源
  const url = quality === "low" ? data.play_path_32 : data.play_path_64;
  return url ? { url } : null;
}

module.exports = {
  platform: "喜马拉雅_C",
  version: "0.1.0",
  author: "葡萄球君",
  cacheControl: "no-cache",
  supportedSearchType: ["music", "album"],
  search,
  getAlbumInfo,
  getMediaSource,
};
