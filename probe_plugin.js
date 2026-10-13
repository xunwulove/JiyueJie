#!/usr/bin/env node
// ============================================================
// 极悦界 · MusicFree 音源插件真实搜索功能验证脚本
// ------------------------------------------------------------
// 功能：加载 MusicFree 插件（.js），真实调用其搜索/榜单接口，
//       验证该音源"能否真正搜到歌"，而非仅 HTTP 可达。
// 用法：
//   npm install          # 安装 axios/cheerio 等依赖
//   node probe_plugin.js <插件.js路径或URL> [关键词]
//   node probe_plugin.js --file plugins.json    # 批量验证清单
// 输出：JSON，含 load(加载状态)/searchAPI(搜索接口)/found(是否搜到)
//       songs(歌曲数)/sample(样例歌曲)
// ============================================================
'use strict';
const fs = require('fs');
const vm = require('vm');
const zlib = require('zlib');

// 部分插件顶层会自执行（如 suno 加载即拉榜单），其失败不应导致整个脚本崩溃
process.on('unhandledRejection', (reason) => {
  console.warn(`[probe] 插件顶层未处理 rejection: ${reason && reason.message ? reason.message : reason}`);
});
process.on('uncaughtException', (e) => {
  console.warn(`[probe] 插件顶层异常: ${e && e.message}`);
});

// ---------- 真实依赖（需 npm install） ----------
let axios, cheerio, CryptoJS;
try { axios = require('axios'); } catch (e) { console.warn('[probe] 未安装 axios，axios 类插件将无法验证'); }
try { cheerio = require('cheerio'); } catch (e) { console.warn('[probe] 未安装 cheerio，HTML 解析类插件将无法验证'); }
try { CryptoJS = require('crypto-js'); } catch (e) { console.warn('[probe] 未安装 crypto-js，加密签名类插件可能无法验证'); }

// 给真实 axios 设全局默认超时，避免插件未设 timeout 时请求无限挂起
if (axios && axios.defaults) axios.defaults.timeout = 15000;

// pako（zlib 压缩）→ 用 node zlib 代替
const pako = {
  inflate: (d) => zlib.inflateSync(d), deflate: (d) => zlib.deflateSync(d),
  inflateRaw: (d) => zlib.inflateRawSync(d), deflateRaw: (d) => zlib.deflateRawSync(d),
};

// ---------- 网络层 mock（给不依赖 axios、直接用 fetch/network 的插件） ----------
async function doFetch(url, opts = {}) {
  const headers = Object.assign({ 'User-Agent': 'Mozilla/5.0' }, opts.headers || {});
  const method = (opts.method || 'GET').toUpperCase();
  let finalUrl = url;
  if (opts.params) {
    const qs = Object.entries(opts.params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;
  }
  const fOpts = { method, headers, signal: AbortSignal.timeout(10000) };
  if (opts.data && !['GET', 'HEAD'].includes(method)) {
    fOpts.body = typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data);
  }
  const resp = await fetch(finalUrl, fOpts);
  const text = await resp.text();
  return { status: resp.status, data: text, text: () => text, json: () => { try { return JSON.parse(text); } catch (e) { return {}; } } };
}

const network = {
  request: (options, cb) => {
    doFetch(options.url, { method: options.method || 'GET', headers: options.headers, params: options.params, data: options.body })
      .then(r => cb(null, { statusCode: r.status, body: r.data, headers: {} }))
      .catch(e => cb(e));
  },
};
const MusicHttp = network;
const http = network;

// ---------- 沙箱 ----------
const hostRequire = require;
const requireMock = function (name) {
  if (name === 'axios') return axios || {};
  if (name === 'cheerio') return cheerio || {};
  if (name === 'pako') return pako;
  if (name === 'crypto-js') return CryptoJS || {};
  try { return hostRequire(name); }
  catch (e) { console.warn(`[probe] 插件依赖未提供的模块 '${name}'，已 mock 为空，该插件可能无法完整运行`); return {}; }
};

// 防分析混淆插件可能调用 process.exit() 直接杀死整个脚本，注入受限版 process
const fakeProcess = Object.create(process);
fakeProcess.exit = (code) => { throw new Error(`插件调用 process.exit(${code}) 已拦截`); };
fakeProcess.exitCode = undefined;
fakeProcess.abort = () => { throw new Error('插件调用 process.abort() 已拦截'); };

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Buffer, URL, URLSearchParams, TextEncoder, TextDecoder, crypto: require('crypto'),
  fetch, axios, cheerio, network, MusicHttp, http, pako,
  window: {}, self: {}, global: {},
  MusicFree: {},
  require: requireMock,
  module: { exports: {}, require: requireMock }, exports: {},
  process: fakeProcess,
  globalThis: null,
};
sandbox.globalThis = sandbox;

// ---------- 调用搜索接口 ----------
async function callSearchAPI(mod, apiName, keyword, timeoutMs = 15000) {
  const t = (p) => Promise.race([Promise.resolve().then(p), new Promise((_, rej) => setTimeout(() => rej(new Error('超时')), timeoutMs))]);
  if (apiName === 'search') return t(() => mod[apiName](keyword, 1, 'music'));
  if (apiName === 'searchMusic') return t(() => mod[apiName](keyword, 1, 30));
  if (apiName === 'searchV2') return t(() => mod[apiName](keyword, 1, 30, { music: {} }));
  if (apiName === 'getTopLists') {
    // 榜单类插件：先拿榜单列表，再用第一个榜单调用 getTopListDetail 验证
    const lists = await t(() => mod[apiName]());
    const arr = Array.isArray(lists) ? lists : (lists && lists.data) || [];
    const first = (arr[0] && (arr[0].data || arr[0].list || [])[0]) || arr[0];
    if (first && typeof mod.getTopListDetail === 'function') {
      return await t(() => mod.getTopListDetail(first));
    }
    return lists;
  }
  return t(() => mod[apiName]({ id: '1ac7823f-8faf-474f-b14c-e4f7c7bb373f', title: '最新榜' }));
}

// ---------- 主流程 ----------
async function verifyOne(source, keyword) {
  const result = { source, keyword, load: 'ok', searchAPI: null, found: false, songs: 0, error: null, sample: null, pluginName: null, searchAPIs: null };
  let code;
  try {
    if (source.startsWith('http')) {
      const resp = await fetch(source, { signal: AbortSignal.timeout(15000) });
      if (!resp.ok) throw new Error(`下载失败 HTTP ${resp.status}`);
      code = await resp.text();
    } else {
      code = fs.readFileSync(source, 'utf-8');
    }
  } catch (e) {
    result.load = 'download-fail';
    result.error = e.message;
    return result;
  }

  // 每次验证用全新沙箱，避免插件间全局污染
  const sb = Object.assign({}, sandbox, { module: { exports: {}, require: requireMock }, exports: {} });
  sb.globalThis = sb;
  try {
    vm.createContext(sb);
    vm.runInContext(code, sb, { timeout: 20000 });
  } catch (e) {
    result.load = 'load-fail';
    result.error = `加载失败: ${e.message}`;
    return result;
  }

  let mod = sb.module.exports || {};
  // 老式插件（如碳酸氢钠混淆版）不导出 module.exports，而是挂到 window 全局
  if (!Object.keys(mod).length && sb.window) {
    const w = sb.window;
    for (const k of ['$carbonatePlugin', '$carbonateShareConfig', 'plugin', 'MusicFreePlugin', 'musicfreePlugin']) {
      if (w[k] && typeof w[k] === 'object') { mod = w[k]; break; }
    }
  }
  result.pluginName = mod.platform || mod.name || mod.pluginName || mod.author || '未知';

  const candidates = ['searchMusic', 'searchV2', 'search', 'getTopLists', 'getTopListDetail'];
  const foundAPIs = candidates.filter(c => typeof mod[c] === 'function');
  result.searchAPIs = foundAPIs;
  if (foundAPIs.length === 0) {
    result.load = 'no-search-api';
    result.error = `未找到搜索/榜单接口，可用导出: ${Object.keys(mod).slice(0, 15).join(',')}`;
    return result;
  }
  // 优先搜索接口，其次榜单接口
  result.searchAPI = foundAPIs[0];

  try {
    const out = await callSearchAPI(mod, result.searchAPI, keyword);
    const list = (out && (out.musicList || out.data || out.list || [])) || [];
    result.found = Array.isArray(list) && list.length > 0;
    result.songs = list.length;
    if (list[0]) {
      const s = list[0];
      result.sample = { name: s.name || s.title, artist: s.artist, album: s.album };
    }
    if (!result.found) {
      result.error = `接口返回但无歌曲: ${JSON.stringify(out).slice(0, 180)}`;
    }
  } catch (e) {
    result.found = false;
    result.error = `搜索调用失败: ${e.message}`;
  }
  return result;
}

// ---------- 批量模式（每个插件独立子进程，45s 硬超时，防止单个插件卡死拖垮全量） ----------
const { execFileSync } = require('child_process');

function verifyAll(listFile, keyword) {
  const list = JSON.parse(fs.readFileSync(listFile, 'utf-8'));
  const plugins = list.plugins || list;
  const results = [];
  for (const p of plugins) {
    const name = p.name || p.pluginName || '未知';
    let r;
    try {
      const out = execFileSync(process.execPath, [__filename, p.url, keyword], {
        timeout: 45000, encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      r = JSON.parse(out.trim());
    } catch (e) {
      r = {
        load: e.code === 'ETIMEDOUT' ? 'timeout(45s)' : 'child-error',
        error: e.code === 'ETIMEDOUT' ? '子进程超时被终止' : String(e.message || e).slice(0, 150),
        found: false, songs: 0,
      };
    }
    r.name = name;
    results.push(r);
    const flag = r.found ? '✓' : (r.load === 'ok' ? '✗' : '!');
    console.log(`[${flag}] ${name} | load=${r.load} api=${r.searchAPI} songs=${r.songs}`);
  }
  const ok = results.filter(r => r.found).length;
  const empty = results.filter(r => r.load === 'ok' && !r.found).length;
  const fail = results.filter(r => r.load !== 'ok' && !r.found).length;
  console.log(`\n===== 批量结果: ${ok}/${results.length} 真实可搜到歌 | 接口空 ${empty} | 加载/调用失败 ${fail} =====`);
  fs.writeFileSync('probe_results.json', JSON.stringify(results, null, 2));
  console.log('明细已写入 probe_results.json');
}

// ---------- 入口 ----------
(async () => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('用法: node probe_plugin.js <插件.js路径或URL> [关键词]');
    console.log('      node probe_plugin.js --file plugins.json [关键词]');
    process.exit(1);
  }
  const keyword = args[1] || '海阔天空';
  if (args[0] === '--file') {
    await verifyAll(args[1], keyword);
  } else {
    const r = await verifyOne(args[0], keyword);
    console.log(JSON.stringify(r)); // 单行 JSON，便于批量子进程解析
  }
})().catch(e => { console.log(JSON.stringify({ load: 'fail', error: e.message }, null, 2)); process.exit(1); });
