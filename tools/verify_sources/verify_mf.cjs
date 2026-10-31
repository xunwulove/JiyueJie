// 极悦界音乐源执行验证（MusicFree 插件，五维）
//
// 对齐 App 内 probeService（2026-10-25 补全的 5 维口径）：
// - 搜索   : search(keyword, 1, 'music') 有结果（music 无果自动试 'song'）→ searchOk
// - 解析   : getMediaSource 按音质序（standard→high→lossless）取到播放地址 → mediaSourceOk
// - 播放   : Range 请求前 64KB，content-type 非文本页且有数据 → playableOk
//            （Node 无播放器，等价 App 深度"静音真播"的产物验证：排掉假页面/防盗链 HTML）
// - 歌词   : getLyric 返回 rawLrc/translation 非空（仅具备能力源）→ lyricOk
// - 歌单   : getRecommendSheetTags → 真实歌单 → getMusicSheetInfo → 列表非空
//            且第一首能解析并 Range 可播（歌单可用率以可播放为前提）→ sheetsOk（含耗时）
//
// P1 工程化（2026-10-25）：
// - 清单：dl2/ 下 *.js（由 verify_downloads.cjs 从 gitee plugins.json 全量下载）
// - 并发：PROBE_CONCURRENCY=5 worker 池；总预算 PROBE_BUDGET_MS=120s，超时放弃剩余源
// - 报告：控制台五档汇总 + Markdown 明细 + probe-report.json（全字段，可投喂 AI）
// - 清理：已删除洛雪 LX 相关（极悦界为 MusicFree 插件体系，不支持 LX 格式）
const vm = require('vm');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const DL = path.join(__dirname, 'dl2');
const MODROOT = path.join(__dirname, 'node_modules');
const REPORT_JSON = path.join(__dirname, 'probe-report.json');

/** 并发 worker 数（与探测软件 PROBE_CONCURRENCY 一致） */
const PROBE_CONCURRENCY = 5;
/** 单轮总预算（与 App probeService PROBE_BUDGET_MS 一致）；可用 CLI 参数覆盖秒数：node verify_mf.cjs 600 */
const PROBE_BUDGET_MS = (Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 120) * 1000;
/** 探测样本关键词（中文歌在各源命中率高，App 同口径） */
const PROBE_KEYWORD = '海阔天空';
/** 音质尝试序（App 默认 standard 优先） */
const QUALITY_ORDER = ['standard', 'high', 'lossless'];

/* ============ 插件沙箱加载（与 App plugin.ts 一致：module.exports / exports.default / __musicFreeCore__） ============ */

function loadPlugin(file) {
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require: (name) => {
      try { return require(require.resolve(name, { paths: [MODROOT] })); } catch (e) { return require(name); }
    },
    // 插件自身 console 静音：避免源脚本内部分支打印搜索结果/歌词 JSON 刷屏
    // （脚本自身的 log 走外层 console，插件错误由 probeFile 捕获记录）
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    fetch: globalThis.fetch,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Buffer, process,
    URL, URLSearchParams, TextEncoder, TextDecoder,
    env: { getUserVariables: () => ({}), getProperty: () => undefined, setProperty: () => {} },
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file, timeout: 30000 });
  let exp = module.exports;
  if (exp && exp.default && (typeof exp.default.search === 'function' || typeof exp.default === 'object' && exp.default.search)) {
    exp = exp.default; // Babel 编译产物：exports.default
  }
  if (exp && Object.keys(exp).length) return exp;
  if (sandbox.window.__musicFreeCore__) return sandbox.window.__musicFreeCore__;
  if (sandbox.__musicFreeCore__) return sandbox.__musicFreeCore__;
  return exp;
}

function withTimeout(p, ms, label) {
  return Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' 超时(' + ms + 'ms)')), ms)),
  ]);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Range 音频验证：前 64KB + 非文本页判定（Node 侧"静音可播"产物验证） */
async function verifyAudioFetchable(url, headers) {
  if (!url) return { ok: false, error: '无url' };
  if (url.startsWith('data:')) return { ok: true, note: 'data:URI', len: url.length };
  if (!/^https?:/.test(url)) return { ok: false, error: '非法协议: ' + String(url).slice(0, 40) };
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const req = lib.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/',
        'Range': 'bytes=0-65535',
        ...(headers || {}),
      },
    }, (res) => {
      const code = res.statusCode;
      const ct = (res.headers['content-type'] || '').slice(0, 60).toLowerCase();
      const isTextPage =
        ct.includes('text/html') || ct.includes('text/plain') || ct.includes('application/json');
      const chunks = [];
      let len = 0;
      res.on('data', (c) => { chunks.push(c); len += c.length; });
      res.on('end', () => {
        if (code !== 200 && code !== 206) {
          resolve({ ok: false, status: code, error: 'HTTP ' + code });
          return;
        }
        if (isTextPage) {
          resolve({ ok: false, status: code, error: '返回文本页(' + ct + ')，非音频' });
          return;
        }
        if (len > 0) {
          resolve({ ok: true, status: code, len, type: ct, bytes: Buffer.concat(chunks) });
        } else {
          resolve({ ok: false, status: code, error: '无数据' });
        }
      });
      res.on('error', (e) => resolve({ ok: false, error: e.message }));
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

/* ============ 声明面 ============ */

function collectDeclared(plugin) {
  const keys = Object.keys(plugin);
  return {
    search: typeof plugin.search === 'function',
    getMediaSource: typeof plugin.getMediaSource === 'function',
    getLyric: typeof plugin.getLyric === 'function',
    getRecommendSheetTags: typeof plugin.getRecommendSheetTags === 'function',
    getMusicSheetInfo: typeof plugin.getMusicSheetInfo === 'function',
    getTopLists: typeof plugin.getTopLists === 'function',
  };
}

/* ============ 错误分类（对齐探测软件 classifyPlayError） ============ */

function classifyError(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('403') || m.includes('forbidden')) return '403 访问被拒';
  if (m.includes('404') || m.includes('not found')) return '404 资源不存在';
  if (m.includes('timeout')) return '超时';
  if (m.includes('network') || m.includes('connect') || m.includes('socket') || m.includes('dns') || m.includes('unreachable')) return '网络错误';
  if (m.includes('unsupported') || m.includes('format') || m.includes('codec') || m.includes('decode')) return '音频格式不支持';
  if (m.includes('auth') || m.includes('token') || m.includes('sign') || m.includes('防盗链') || m.includes('鉴权')) return '鉴权/防盗链';
  return msg || '未知错误';
}

/** 建议动作（供人工/维护者处置，对齐探测软件 report.ts suggestAction） */
function suggestAction(playError, mediaSourceError) {
  const reason = classifyError(playError || mediaSourceError || '');
  const m = reason.toLowerCase();
  if (m.includes('403') || m.includes('鉴权') || m.includes('防盗链')) return '需补 headers/Referer 或更新插件';
  if (m.includes('404')) return '直链失效，源可能已死';
  if (m.includes('超时') || m.includes('网络')) return '接口不稳定或直链时效短，可重试/播放时动态取链';
  if (m.includes('格式')) return 'URL 实际格式与插件声明不符';
  return '原因未分类，需人工复核';
}

/* ============ 单源五维探测（搜索 → 解析/播放 → 歌词 → 歌单，一次性完成） ============ */
async function probeFile(name, file) {
  const t0 = Date.now();
  const result = {
    name,
    file: path.basename(file),
    declared: { search: false, getMediaSource: false, getLyric: false, getRecommendSheetTags: false, getMusicSheetInfo: false, getTopLists: false },
    searchOk: false,
    mediaSourceOk: false,
    playableOk: false,
    lyricOk: false,
    sheetsOk: false,
    searchError: '',
    mediaSourceError: '',
    playError: '',
    lyricError: '',
    sheetsError: '',
    sheetMs: 0,
    sampleTitle: '',
    sampleArtist: '',
    durationMs: 0,
  };

  let plugin;
  try {
    plugin = await withTimeout(Promise.resolve().then(() => loadPlugin(file)), 40000, '插件加载');
  } catch (e) {
    result.searchError = '加载/执行失败: ' + e.message;
    result.durationMs = Date.now() - t0;
    return result;
  }
  if (!plugin || typeof plugin.search !== 'function') {
    result.searchError = '无 search 方法（不是 MusicFree 插件）';
    result.durationMs = Date.now() - t0;
    return result;
  }
  result.declared = collectDeclared(plugin);

  // —— 搜索（music 优先，无果试 song）——
  let data = [];
  for (const t of ['music', 'song']) {
    try {
      const r = await withTimeout(plugin.search(PROBE_KEYWORD, 1, t), 20000, 'search');
      const arr = r && (Array.isArray(r.data) ? r.data : Array.isArray(r) ? r : []);
      if (arr && arr.length > 0) { data = arr; break; }
      if (!result.searchError) result.searchError = `search('${t}') 无结果`;
    } catch (e) {
      result.searchError = `search('${t}') 抛错: ${e.message}`;
    }
  }
  result.searchOk = data.length > 0;
  const song = data[0] || null;
  if (song) {
    result.sampleTitle = song.title || song.name || '';
    result.sampleArtist = song.artist || '';
  }
  if (!song) {
    result.mediaSourceError = '无样本歌曲，跳过解析';
    result.lyricError = '无样本歌曲，跳过歌词';
    result.durationMs = Date.now() - t0;
    return result;
  }

  // —— 解析 + 播放（Range 验证）——
  if (typeof plugin.getMediaSource === 'function') {
    let url = null;
    let headers = null;
    for (const q of QUALITY_ORDER) {
      try {
        const src = await withTimeout(plugin.getMediaSource(song, q), 15000, 'getMediaSource');
        const u = src && (src.url || (src.data && src.data.url));
        if (u) { url = u; headers = src.headers || null; break; }
      } catch (e) {
        if (!result.mediaSourceError) result.mediaSourceError = `getMediaSource('${q}') 抛错: ${e.message}`;
      }
    }
    result.mediaSourceOk = !!url;
    if (result.mediaSourceOk) {
      const chk = await verifyAudioFetchable(url, headers || undefined);
      result.playableOk = chk.ok;
      result.playError = chk.ok ? '' : (chk.error || '');
      if (!chk.ok) result.mediaSourceError = result.mediaSourceError || '播放链接验证失败';
    } else {
      result.playError = result.mediaSourceError || '无播放地址，跳过播放验证';
    }
  } else {
    result.mediaSourceError = '未实现 getMediaSource';
    result.playError = '未实现 getMediaSource，跳过播放验证';
  }

  // —— 歌词（有 getLyric 能力才探测）——
  if (typeof plugin.getLyric === 'function') {
    try {
      const lrc = await withTimeout(plugin.getLyric(song), 5000, 'getLyric');
      result.lyricOk = !!(lrc && (lrc.rawLrc || lrc.translation));
      if (!result.lyricOk) result.lyricError = '无歌词';
    } catch (e) {
      result.lyricError = 'getLyric 抛错: ' + e.message;
    }
  } else {
    result.lyricError = '未实现 getLyric';
  }

  // —— 歌单（独立口径：歌单能显示 + 第一首能解析并 Range 可播；记录耗时）——
  if (typeof plugin.getRecommendSheetTags === 'function') {
    const sheetT0 = Date.now();
    try {
      const tags = await withTimeout(plugin.getRecommendSheetTags(), 8000, 'getRecommendSheetTags');
      if (!tags || (!Array.isArray(tags.pinned) && !Array.isArray(tags.data))) {
        result.sheetsError = '歌单标签无数据';
      } else {
        const pinned = (tags.pinned || []).filter(Boolean);
        const groups = (tags.data || []).filter((g) => g && g.title && Array.isArray(g.data) && g.data.length);
        const pool = [...pinned, ...groups.flatMap((g) => g.data || [])];
        // 优先真实歌单（带封面），否则第一个可用项
        const real = pool.find((it) => it && (it.coverImg || it.artwork));
        const sheetItem = real || pinned[0] || (groups[0] && groups[0].data[0]) || null;
        let musicList = [];
        if (sheetItem) {
          const hasCover = !!(sheetItem.coverImg || sheetItem.artwork);
          if (hasCover) {
            const info = await withTimeout(plugin.getMusicSheetInfo ? plugin.getMusicSheetInfo(sheetItem, 1) : Promise.resolve(null), 8000, 'getMusicSheetInfo');
            musicList = (info && info.musicList) || [];
          } else if (typeof plugin.getRecommendSheetsByTag === 'function') {
            const list = await withTimeout(plugin.getRecommendSheetsByTag(sheetItem, 1), 8000, 'getRecommendSheetsByTag');
            const first = (list && list.data || []).find((it) => it && (it.coverImg || it.artwork));
            const target = first || (list && list.data && list.data[0]) || null;
            if (target) {
              const info = await withTimeout(plugin.getMusicSheetInfo ? plugin.getMusicSheetInfo(target, 1) : Promise.resolve(null), 8000, 'getMusicSheetInfo');
              musicList = (info && info.musicList) || [];
            }
          } else if (plugin.getMusicSheetInfo) {
            const info = await withTimeout(plugin.getMusicSheetInfo(sheetItem, 1), 8000, 'getMusicSheetInfo');
            musicList = (info && info.musicList) || [];
          }
        }
        // 歌单可用率以可播放为前提：第一首能解析 + Range 可播
        if (musicList.length > 0 && typeof plugin.getMediaSource === 'function') {
          let sheetUrl = null;
          let sheetHeaders = null;
          for (const q of QUALITY_ORDER) {
            try {
              const src = await withTimeout(plugin.getMediaSource(musicList[0], q), 15000, 'getMediaSource(sheet)');
              const u = src && (src.url || (src.data && src.data.url));
              if (u) { sheetUrl = u; sheetHeaders = src.headers || null; break; }
            } catch (e) {
              if (!result.sheetsError) result.sheetsError = '歌单第一首解析失败: ' + e.message;
            }
          }
          if (sheetUrl) {
            const chk = await verifyAudioFetchable(sheetUrl, sheetHeaders || undefined);
            result.sheetsOk = chk.ok;
            if (!chk.ok) result.sheetsError = result.sheetsError || ('歌单第一首不可播: ' + chk.error);
          } else {
            result.sheetsError = result.sheetsError || '歌单第一首解析无地址';
          }
        } else if (musicList.length === 0) {
          result.sheetsError = '歌单列表为空';
        }
      }
    } catch (e) {
      result.sheetsError = '歌单探测抛错: ' + e.message;
    }
    result.sheetMs = Date.now() - sheetT0;
  } else {
    result.sheetsError = '未实现 getRecommendSheetTags';
  }

  result.durationMs = Date.now() - t0;
  return result;
}

/* ============ 五档分类（对齐探测软件 report.ts tierOf） ============ */

function tierOf(r) {
  if (r.playableOk) return '全通';
  if (!r.searchOk && r.sheetsOk) return '歌单型';
  if (r.mediaSourceOk && !r.playableOk) return '可解析不可播';
  if (r.searchOk || r.lyricOk || r.sheetsOk) return '半可用';
  return '死源';
}

/* ============ 报告生成（v2 五档 + 全字段明细） ============ */

function classifyPlayError(r) {
  return classifyError(r.playError || r.mediaSourceError || '');
}

function buildReport(results, total, usedMs) {
  const tiers = { 全通: 0, 可解析不可播: 0, 半可用: 0, 歌单型: 0, 死源: 0 };
  results.forEach((r) => { tiers[tierOf(r)] += 1; });

  const n = (fn) => results.filter(fn).length;
  const playable = n((r) => r.playableOk);
  const search = n((r) => r.searchOk);
  const media = n((r) => r.mediaSourceOk);
  const sheets = n((r) => r.sheetsOk);
  const lyric = n((r) => r.lyricOk);
  const parsedOnly = n((r) => r.mediaSourceOk && !r.playableOk);

  // 失败原因分布（仅不可播源）
  const reasonCount = {};
  results.filter((r) => !r.playableOk).forEach((r) => {
    const k = classifyPlayError(r);
    reasonCount[k] = (reasonCount[k] || 0) + 1;
  });
  const reasonSummary = Object.entries(reasonCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}个`);

  const lines = [];
  lines.push('# 音源探测报告（verify_mf 电脑脚本）');
  lines.push('');
  lines.push(`- 生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`);
  lines.push(`- 探测音源：${total} 个（全部出结果 ${results.length} 个）`);
  lines.push(`- 实际耗时：${usedMs}ms（预算 120000ms）`);
  lines.push('');
  lines.push('## 一、总览');
  lines.push('');
  lines.push('| 指标 | 数量 |');
  lines.push('| --- | --- |');
  lines.push(`| 🟢 全通（真能播放） | ${tiers['全通']} |`);
  lines.push(`| 🟠 可解析不可播（半死源，可修复） | ${tiers['可解析不可播']} |`);
  lines.push(`| 🟡 半可用（部分能力可用） | ${tiers['半可用']} |`);
  lines.push(`| 🟣 歌单型源（搜索无结果，非失效） | ${tiers['歌单型']} |`);
  lines.push(`| 🔴 死源（全能力失败） | ${tiers['死源']} |`);
  lines.push('| --- | --- |');
  lines.push(`| 可搜索 | ${search} |`);
  lines.push(`| 可解析播放地址 | ${media} |`);
  lines.push(`| 真能播放（Range 音频判定） | ${playable} |`);
  lines.push(`| 有歌单（首可播口径） | ${sheets} |`);
  lines.push(`| 有歌词 | ${lyric} |`);
  lines.push('');
  lines.push(`播放失败原因分布：${reasonSummary.length > 0 ? reasonSummary.join('，') : '无'}`);
  lines.push('');
  lines.push('> 档位判定优先级：全通 > 可解析不可播 > 半可用 > 歌单型 > 死源。');
  lines.push('> 播放=Range 前 64KB 音频判定（Node 脚本无播放器，等价 App 静音真播的产物验证）。');
  lines.push('');

  const recommend = results.filter((r) => r.playableOk);
  lines.push('## 二、推荐音源（真能播放）');
  lines.push('');
  if (recommend.length === 0) {
    lines.push('（无——所有音源均未通过播放验证）');
    lines.push('');
  } else {
    lines.push('| 音源 | 搜索 | 解析 | 歌单 | 歌词 | 样本 | 耗时(ms) |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    recommend.forEach((r) => {
      lines.push(`| ${r.name} | ${r.searchOk ? '✓' : '✗'} | ${r.mediaSourceOk ? '✓' : '✗'} | ${r.sheetsOk ? '✓' : '✗'} | ${r.lyricOk ? '✓' : '✗'} | ${r.sampleTitle || '—'} | ${r.durationMs} |`);
    });
    lines.push('');
  }

  const parsedOnlyList = results.filter((r) => r.mediaSourceOk && !r.playableOk);
  if (parsedOnlyList.length > 0) {
    lines.push('## 三、可解析但播放失败（半死源）');
    lines.push('');
    lines.push('> 能搜索、能解析出播放地址，但 Range 音频验证失败。**不是死源**：多数是防盗链/直链时效/接口不稳定。');
    lines.push('');
    lines.push('| 音源 | 失败原因 | 建议动作 | 样本 | 搜索 | 歌单 | 歌词 |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    parsedOnlyList.forEach((r) => {
      lines.push(`| ${r.name} | ${classifyPlayError(r)} | ${suggestAction(r.playError, r.mediaSourceError)} | ${r.sampleTitle || '—'} | ${r.searchOk ? '✓' : '✗'} | ${r.sheetsOk ? '✓' : '✗'} | ${r.lyricOk ? '✓' : '✗'} |`);
    });
    lines.push('');
  }

  const semi = results.filter((r) => tierOf(r) === '半可用');
  if (semi.length > 0) {
    lines.push('## 四、半可用（部分能力可用，但不可播放）');
    lines.push('');
    lines.push('| 音源 | 搜索 | 解析 | 歌单 | 歌词 | 说明 |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    semi.forEach((r) => {
      lines.push(`| ${r.name} | ${r.searchOk ? '✓' : '✗'} | ${r.mediaSourceOk ? '✓' : '✗'} | ${r.sheetsOk ? '✓' : '✗'} | ${r.lyricOk ? '✓' : '✗'} | ${r.playError || r.searchError || r.sheetsError || '—'} |`);
    });
    lines.push('');
  }

  const sheetOnly = results.filter((r) => !r.searchOk && r.sheetsOk);
  if (sheetOnly.length > 0) {
    lines.push('## 五、歌单型源（搜索无结果属正常，非失效）');
    lines.push('');
    lines.push('| 音源 | 歌单 | 解析 | 播放 | 说明 |');
    lines.push('| --- | --- | --- | --- | --- |');
    sheetOnly.forEach((r) => {
      lines.push(`| ${r.name} | ${r.sheetsOk ? '✓' : '✗'} | ${r.mediaSourceOk ? '✓' : '✗'} | ${r.playableOk ? '✓' : '✗'} | ${r.sheetsError || '—'} |`);
    });
    lines.push('');
  }

  const dead = results.filter((r) => tierOf(r) === '死源');
  if (dead.length > 0) {
    lines.push('## 六、死源（全能力失败）');
    lines.push('');
    lines.push('| 音源 | 搜索 | 解析 | 歌单 | 歌词 | 说明 |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    dead.forEach((r) => {
      lines.push(`| ${r.name} | ${r.searchOk ? '✓' : '✗'} | ${r.mediaSourceOk ? '✓' : '✗'} | ${r.sheetsOk ? '✓' : '✗'} | ${r.lyricOk ? '✓' : '✗'} | ${r.searchError || r.playError || r.sheetsError || ''} |`);
    });
    lines.push('');
  }

  lines.push('## 七、全部明细');
  lines.push('');
  lines.push('| 音源 | 档位 | 搜索 | 解析 | 播放 | 歌单 | 歌词 | 歌单耗时(ms) | 样本 | 失败原因 | 耗时(ms) |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  results.forEach((r) => {
    lines.push(`| ${r.name} | ${tierOf(r)} | ${r.searchOk ? '✓' : '✗'} | ${r.mediaSourceOk ? '✓' : '✗'} | ${r.playableOk ? '✓' : '✗'} | ${r.sheetsOk ? '✓' : '✗'} | ${r.lyricOk ? '✓' : '✗'} | ${r.sheetMs || '—'} | ${r.sampleTitle || '—'} | ${classifyPlayError(r) === '未知错误' && !r.playError ? (r.searchError || r.sheetsError || '—') : (r.playError || r.mediaSourceError || r.searchError || r.sheetsError || '—')} | ${r.durationMs} |`);
  });
  lines.push('');

  lines.push('---');
  lines.push('> 说明：本报告由 verify_mf.cjs（五维，并发 5 / 预算 120s）生成，供人工复核与 AI 二次整理。');
  lines.push('');
  return lines.join('\n');
}

/* ============ 主流程：并发 worker + 总预算 ============ */

(async () => {
  // 隔离异步崩溃，避免单源问题拖垮整个验证
  process.on('unhandledRejection', (e) => console.log('[unhandledRejection] ' + (e && e.message)));
  process.on('uncaughtException', (e) => console.log('[uncaughtException] ' + (e && e.message)));

  const files = fs.readdirSync(DL).filter((f) => f.endsWith('.js')).sort();
  if (files.length === 0) {
    console.log('dl2/ 下无插件文件，请先运行 verify_downloads.cjs 全量下载音源清单。');
    process.exit(1);
  }
  console.log(`共 ${files.length} 个插件待探测（并发 ${PROBE_CONCURRENCY} / 总预算 ${PROBE_BUDGET_MS}ms）`);

  const startTime = Date.now();
  const results = [];
  let index = 0;
  let budgetExhausted = false;

  const worker = async () => {
    while (index < files.length) {
      if (Date.now() - startTime > PROBE_BUDGET_MS) {
        budgetExhausted = true;
        return;
      }
      const i = index++;
      const f = files[i];
      const name = f.replace(/\.js$/, '');
      try {
        const r = await probeFile(name, path.join(DL, f));
        results.push(r);
        console.log(`[${results.length}/${files.length}] ${name} -> ${tierOf(r)}${r.playableOk ? ' 🟢' : r.sheetsOk && !r.searchOk ? ' 🟣' : r.mediaSourceOk ? ' 🟠' : r.searchOk || r.lyricOk ? ' 🟡' : ' 🔴'} ${r.durationMs}ms`);
      } catch (e) {
        console.log(`[${results.length + 1}/${files.length}] ${name} -> 未捕获异常: ${e.message}`);
        results.push({ name, file: f, searchError: '未捕获异常: ' + e.message, durationMs: 0 });
      }
    }
  };

  const workerCount = Math.min(PROBE_CONCURRENCY, Math.max(files.length, 1));
  await Promise.all(Array.from({ length: workerCount }, worker));
  const usedMs = Date.now() - startTime;

  results.sort((a, b) => (a.name < b.name ? -1 : 1));
  const md = buildReport(results, files.length, usedMs);
  console.log('\n' + md);

  // 全字段 JSON（可投喂 AI）
  const json = {
    generatedAt: new Date().toISOString(),
    total: files.length,
    probed: results.length,
    usedMs,
    budgetMs: PROBE_BUDGET_MS,
    budgetExhausted,
    tiers: {},
    plugins: results,
  };
  results.forEach((r) => { json.tiers[tierOf(r)] = (json.tiers[tierOf(r)] || 0) + 1; });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(json, null, 2), 'utf8');
  console.log(`\n全字段 JSON 已写入: ${REPORT_JSON}`);
  console.log('===== MusicFree 验证完毕 =====');
  if (budgetExhausted) {
    console.log(`[WARN] 总预算耗尽，剩余源未探测（${files.length - results.length} 个）`);
    process.exitCode = 2;
  }
})();
