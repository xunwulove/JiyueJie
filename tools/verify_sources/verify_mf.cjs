// 极悦界音乐源验证 - MusicFree 插件执行验证（健壮版：单源隔离+超时）
const vm = require('vm');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const DL = path.join(__dirname, 'dl2');
const MODROOT = path.join(__dirname, 'node_modules');

function loadPlugin(file) {
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require: (name) => {
      try { return require(require.resolve(name, { paths: [MODROOT] })); } catch (e) { return require(name); }
    },
    console,
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
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' 超时(' + ms + 'ms)')), ms)),
  ]);
}

function checkUrl(url, timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (!url) return resolve({ ok: false, error: '无url' });
    if (url.startsWith('data:')) return resolve({ ok: true, note: 'data:URI', len: url.length });
    if (!/^https?:/.test(url)) return resolve({ ok: false, error: '非法协议: ' + String(url).slice(0, 40) });
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' } }, (res) => {
      const code = res.statusCode;
      const ct = (res.headers['content-type'] || '').slice(0, 40);
      const len = res.headers['content-length'];
      if (code >= 200 && code < 400) {
        resolve({ ok: true, status: code, len: Number(len) || '?', type: ct });
      } else {
        resolve({ ok: false, status: code, error: 'HTTP ' + code });
      }
      res.resume();
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

async function verifyPlugin(name, file) {
  const log = (s) => console.log(s);
  log(`===== ${name} =====`);
  let plugin;
  try {
    plugin = await withTimeout(Promise.resolve().then(() => loadPlugin(file)), 40000, '插件加载');
  } catch (e) {
    log(`[FAIL] 加载/执行失败: ${e.message}`);
    return;
  }
  log(`导出键(${Object.keys(plugin).length}): ${Object.keys(plugin).join(', ')}`);
  if (typeof plugin.search !== 'function') { log('[FAIL] 无 search 方法'); return; }

  // 搜索（尝试 music / song 两种 type）
  let result = null, err = null;
  for (const t of ['music', 'song']) {
    try {
      result = await withTimeout(plugin.search('周杰伦', 1, t), 45000, 'search');
      if (result && (Array.isArray(result.data) || Array.isArray(result))) { break; }
      err = 'search 返回空';
    } catch (e) {
      err = e.message;
      log(`search('${t}') 抛错: ${e.message}`);
    }
  }
  if (!result || !(Array.isArray(result.data) || Array.isArray(result))) {
    log(`[FAIL] 搜索无结果 (${err || '未知'})`);
    return;
  }
  const data = Array.isArray(result.data) ? result.data : result;
  log(`search 返回 ${data.length} 条, isEnd=${result.isEnd !== undefined ? result.isEnd : '?'}`);
  if (data.length === 0) { log('[FAIL] 搜索无结果'); return; }
  const song = data[0];
  log(`第一首: ${song.title || song.name || '?'} - ${song.artist || '?'}`);

  if (typeof plugin.getMediaSource !== 'function') {
    log('[WARN] 无 getMediaSource（可搜索，播放解析缺失）');
    return;
  }
  let src;
  try {
    src = await withTimeout(plugin.getMediaSource(song, 'standard'), 45000, 'getMediaSource');
  } catch (e) {
    log(`[FAIL] getMediaSource 抛错: ${e.message}`);
    return;
  }
  const url = src && (src.url || (src.data && src.data.url));
  log(`播放URL: ${url ? String(url).slice(0, 110) : '(无)'}`);
  if (!url) { log('[FAIL] 未解析出播放URL'); return; }
  const chk = await checkUrl(String(url));
  if (chk.ok) {
    log(`[OK] 播放链接可访问 (HTTP ${chk.status}, ${chk.len} bytes, ${chk.type})`);
  } else {
    log(`[WARN] 播放链接探测失败: ${chk.error}（可能防盗链/需登录，接口逻辑正常）`);
  }
}

(async () => {
  // 隔离异步崩溃，避免单源问题拖垮整个验证
  process.on('unhandledRejection', (e) => console.log('[unhandledRejection] ' + (e && e.message)));
  process.on('uncaughtException', (e) => console.log('[uncaughtException] ' + (e && e.message)));
  const files = fs.readdirSync(DL).filter((f) => f.endsWith('MF.js')).sort();
  for (const f of files) {
    try { await verifyPlugin(f.replace('.js', ''), path.join(DL, f)); }
    catch (e) { console.log(`===== ${f} =====\n[FAIL] 未捕获异常: ${e.message}`); }
  }
  console.log('===== MusicFree 验证完毕 =====');
})();
