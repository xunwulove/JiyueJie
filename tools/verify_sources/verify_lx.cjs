// 极悦界音乐源验证 - 洛雪 LX 音源执行验证
// 宿主与 App 内 LxSourceEngine（修复后）保持一致：
//   lx 对象内挂 EVENT_NAMES/version/inited，request 支持回调式，utils.md5 为纯 JS 实现
// 验证方式：模拟播放器调用源注册的 request 事件处理器（官方事件驱动规范）或 lx.methods（新规范兜底）
const vm = require('vm');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const DL = path.join(__dirname, 'dl2');
const MODROOT = path.join(__dirname, 'node_modules');

function loadLx(file) {
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = {
    console,
    fetch: globalThis.fetch,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Buffer, process,
    URL, URLSearchParams, TextEncoder, TextDecoder,
    require: (name) => {
      try { return require(require.resolve(name, { paths: [MODROOT] })); } catch (e) { return require(name); }
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  // 预置洛雪官方宿主环境（与 App LxSourceEngine 修复后注入一致；IIFE 包裹避免与源顶层词法声明冲突）
  vm.runInContext(`
    (function() {
    var lx = {};
    lx.env = { appVersion: '1.0.0', platform: 'android', version: '1.0.0', os: 'android' };
    lx.config = {};
    lx.currentScriptInfo = { name: '', version: '1.0.0', author: '', desc: '', rawScript: '', updateUrl: '', updateTime: '' };
    var EVENT_NAMES = {
      request: 'request', inited: 'inited', login: 'login', logout: 'logout',
      updateConfig: 'updateConfig', getCheckUrl: 'getCheckUrl', getCookie: 'getCookie'
    };
    // 纯 JS MD5（与 App 内实现一致，QuickJS 无 crypto）
    function safeAdd(x, y) { var lsw=(x&0xFFFF)+(y&0xFFFF); var msw=(x>>16)+(y>>16)+(lsw>>16); return (msw<<16)|(lsw&0xFFFF); }
    function bitRotateLeft(num, cnt) { return (num<<cnt)|(num>>>(32-cnt)); }
    function md5cmn(q,a,b,x,s,t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a,q),safeAdd(x,t)),s),b); }
    function md5ff(a,b,c,d,x,s,t) { return md5cmn((b&c)|(~b&d),a,b,x,s,t); }
    function md5gg(a,b,c,d,x,s,t) { return md5cmn((b&d)|(c&~d),a,b,x,s,t); }
    function md5hh(a,b,c,d,x,s,t) { return md5cmn(b^c^d,a,b,x,s,t); }
    function md5ii(a,b,c,d,x,s,t) { return md5cmn(c^(b|~d),a,b,x,s,t); }
    function binlMD5(x, len) {
      x[len>>5] |= 0x80 << (len%32);
      x[((len+64)>>>9<<4)+14] = len;
      var a=1732584193,b=-271733879,c=-1732584194,d=271733878;
      for (var i=0;i<x.length;i+=16) {
        var olda=a,oldb=b,oldc=c,oldd=d;
        a=md5ff(a,b,c,d,x[i],7,-680876936); d=md5ff(d,a,b,c,x[i+1],12,-389564586);
        c=md5ff(c,d,a,b,x[i+2],17,606105819); b=md5ff(b,c,d,a,x[i+3],22,-1044525330);
        a=md5ff(a,b,c,d,x[i+4],7,-176418897); d=md5ff(d,a,b,c,x[i+5],12,1200080426);
        c=md5ff(c,d,a,b,x[i+6],17,-1473231341); b=md5ff(b,c,d,a,x[i+7],22,-45705983);
        a=md5ff(a,b,c,d,x[i+8],7,1770035416); d=md5ff(d,a,b,c,x[i+9],12,-1958414417);
        c=md5ff(c,d,a,b,x[i+10],17,-42063); b=md5ff(b,c,d,a,x[i+11],22,-1990404162);
        a=md5ff(a,b,c,d,x[i+12],7,1804603682); d=md5ff(d,a,b,c,x[i+13],12,-40341101);
        c=md5ff(c,d,a,b,x[i+14],17,-1502002290); b=md5ff(b,c,d,a,x[i+15],22,1236535329);
        a=md5gg(a,b,c,d,x[i+1],5,-165796510); d=md5gg(d,a,b,c,x[i+6],9,-1069501632);
        c=md5gg(c,d,a,b,x[i+11],14,643717713); b=md5gg(b,c,d,a,x[i],20,-373897302);
        a=md5gg(a,b,c,d,x[i+5],5,-701558691); d=md5gg(d,a,b,c,x[i+10],9,38016083);
        c=md5gg(c,d,a,b,x[i+15],14,-660478335); b=md5gg(b,c,d,a,x[i+4],20,-405537848);
        a=md5gg(a,b,c,d,x[i+9],5,568446438); d=md5gg(d,a,b,c,x[i+14],9,-1019803690);
        c=md5gg(c,d,a,b,x[i+3],14,-187363961); b=md5gg(b,c,d,a,x[i+8],20,1163531501);
        a=md5gg(a,b,c,d,x[i+13],5,-1444681467); d=md5gg(d,a,b,c,x[i+2],9,-51403784);
        c=md5gg(c,d,a,b,x[i+7],14,1735328473); b=md5gg(b,c,d,a,x[i+12],20,-1926607734);
        a=md5hh(a,b,c,d,x[i+5],4,-378558); d=md5hh(d,a,b,c,x[i+8],11,-2022574463);
        c=md5hh(c,d,a,b,x[i+11],16,1839030562); b=md5hh(b,c,d,a,x[i+14],23,-35309556);
        a=md5hh(a,b,c,d,x[i+1],4,-1530992060); d=md5hh(d,a,b,c,x[i+4],11,1272893353);
        c=md5hh(c,d,a,b,x[i+7],16,-155497632); b=md5hh(b,c,d,a,x[i+10],23,-1094730640);
        a=md5hh(a,b,c,d,x[i+13],4,681279174); d=md5hh(d,a,b,c,x[i],11,-358537222);
        c=md5hh(c,d,a,b,x[i+3],16,-722521979); b=md5hh(b,c,d,a,x[i+6],23,76029189);
        a=md5hh(a,b,c,d,x[i+9],4,-640364487); d=md5hh(d,a,b,c,x[i+12],11,-421815835);
        c=md5hh(c,d,a,b,x[i+15],16,530742520); b=md5hh(b,c,d,a,x[i+2],23,-995338651);
        a=md5ii(a,b,c,d,x[i],6,-198630844); d=md5ii(d,a,b,c,x[i+7],10,1126891415);
        c=md5ii(c,d,a,b,x[i+14],15,-1416354905); b=md5ii(b,c,d,a,x[i+5],21,-57434055);
        a=md5ii(a,b,c,d,x[i+12],6,1700485571); d=md5ii(d,a,b,c,x[i+3],10,-1894986606);
        c=md5ii(c,d,a,b,x[i+10],15,-1051523); b=md5ii(b,c,d,a,x[i+1],21,-2054922799);
        a=md5ii(a,b,c,d,x[i+8],6,1873313359); d=md5ii(d,a,b,c,x[i+15],10,-30611744);
        c=md5ii(c,d,a,b,x[i+6],15,-1560198380); b=md5ii(b,c,d,a,x[i+13],21,1309151649);
        a=md5ii(a,b,c,d,x[i+4],6,-145523070); d=md5ii(d,a,b,c,x[i+11],10,-1120210379);
        c=md5ii(c,d,a,b,x[i+2],15,718787259); b=md5ii(b,c,d,a,x[i+9],21,-343485551);
        a=safeAdd(a,olda); b=safeAdd(b,oldb); c=safeAdd(c,oldc); d=safeAdd(d,oldd);
      }
      return [a,b,c,d];
    }
    function binl2hex(binarray) {
      var hexTab='0123456789abcdef', str='';
      for (var i=0;i<binarray.length*4;i++) {
        str += hexTab.charAt((binarray[i>>2]>>((i%4)*8+4))&0xF) + hexTab.charAt((binarray[i>>2]>>((i%4)*8))&0xF);
      }
      return str;
    }
    function str2binl(str) {
      var bin=[], mask=(1<<8)-1;
      for (var i=0;i<str.length*8;i+=8) { bin[i>>5] |= (str.charCodeAt(i/8)&mask)<<(i%32); }
      return bin;
    }
    lx.utils = {
      md5: function(str) { var s=unescape(encodeURIComponent(String(str))); return binl2hex(binlMD5(str2binl(s), s.length*8)); },
      base64Encode: function(str) { return Buffer.from(str).toString('base64'); },
      base64Decode: function(str) { return Buffer.from(str, 'base64').toString(); },
      randomString: function(len) { var c='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', r=''; for(var i=0;i<len;i++) r+=c.charAt(Math.floor(Math.random()*c.length)); return r; }
    };
    var __reqCb = null;
    lx.on = function(event, callback) { if (event === 'request') { __reqCb = callback; lx.__reqCb = callback; } };
    lx.send = function(event, data) { if (event === 'inited') { lx.__inited = data; } };
    lx.request = function(url, options, callback) {
      return fetch(url, { method: (options && options.method) || 'GET', headers: (options && options.headers) || {}, body: (options && options.body) || undefined })
        .then(function(res) {
          return res.text().then(function(bodyStr) {
            var parsed = null;
            try { parsed = JSON.parse(bodyStr); } catch (e) { parsed = bodyStr; }
            var resp = { ok: res.ok, status: res.status, statusCode: res.status, url: url, body: parsed, text: bodyStr, headers: {} };
            if (typeof callback === 'function') callback(null, resp);
            return resp;
          });
        })
        .catch(function(e) {
          if (typeof callback === 'function') callback(e, null);
          return { ok: false, status: 0, url: url, body: null, text: '', headers: {} };
        });
    };
    lx.EVENT_NAMES = EVENT_NAMES;
    lx.version = '1.0.0';
    lx.inited = false;
    lx.__reqCb = null;
    globalThis.lx = lx;
    globalThis.EVENT_NAMES = EVENT_NAMES;
    })();
  `, sandbox, { filename: 'lx_host.js' });
  // LX官方源自带服务端配置，提前注入避免混淆代码引用缺失
  try {
    const m = code.match(/globalThis\['SERVER_SCRIPT_CONFIG'\] = (\{.*?\});/);
    if (m) {
      vm.runInContext('globalThis.SERVER_SCRIPT_CONFIG = ' + m[1] + ';', sandbox, { filename: 'lx_srv.js' });
    }
  } catch (e) {}
  vm.runInContext(code, sandbox, { filename: file, timeout: 60000 });
  return sandbox.lx || sandbox.globalThis.lx;
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
    const req = lib.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36', 'Referer': 'https://music.163.com/' } }, (res) => {
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

function pickSongs(result) {
  // 兼容洛雪多种返回形态：{songs:[...]} / {data:[...]} / 数组
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.songs)) return result.songs;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.result)) return result.result;
  return [];
}

async function verifyLx(name, file) {
  const log = (s) => console.log(s);
  log(`===== ${name} (LX) =====`);
  let lx;
  try {
    lx = await withTimeout(Promise.resolve().then(() => loadLx(file)), 90000, '加载');
  } catch (e) {
    log(`[FAIL] 加载/执行失败: ${e.message}`);
    return;
  }
  if (!lx) { log('[FAIL] 未定义全局 lx 对象'); return; }
  const inited = lx.__inited;
  if (inited && inited.sources) {
    const names = Object.keys(inited.sources).join(', ');
    log(`inited 上报 sources: ${names || '(空)'}`);
    const actions = new Set();
    Object.values(inited.sources).forEach((s) => (s.actions || []).forEach((a) => actions.add(a)));
    log(`actions: ${[...actions].join(', ') || '(空)'}`);
  } else {
    const srcNames = (lx.sources || []).map((s) => (typeof s === 'object' ? s.name : s)).join(', ');
    log(`sources: ${srcNames || '(空)'}`);
  }
  const hasMethods = lx.methods && typeof lx.methods.search === 'function';
  const hasReqCb = typeof lx.__reqCb === 'function';
  log(`调用入口: ${hasMethods ? 'methods式' : hasReqCb ? 'request事件式' : '无'}`);
  if (!hasMethods && !hasReqCb) { log('[FAIL] 无 search 调用入口'); return; }

  // 搜索
  let sr;
  try {
    const p = hasMethods
      ? Promise.resolve(lx.methods.search('周杰伦', 1, 'song'))
      : Promise.resolve(lx.__reqCb({ action: 'search', source: '', info: { keyword: '周杰伦', page: 1, type: 'music' } }));
    sr = await withTimeout(p, 50000, 'search');
  } catch (e) {
    log(`[FAIL] search 抛错: ${e.message}`);
    return;
  }
  const songs = pickSongs(sr);
  log(`search 结果: ${songs.length} 条${sr && sr.isEnd !== undefined ? ' (isEnd=' + sr.isEnd + ')' : ''}`);
  if (songs.length === 0) {
    log('[WARN] 搜索结果为空');
  }
  const first = songs[0];
  if (!first) return;

  // 播放链接
  let url;
  try {
    const info = {
      id: String(first.id || ''), name: first.name || '', singer: (first.singer && first.singer[0]) || first.singer || '',
      album: (first.album && first.album.name) || '', source: first.source || '', interval: 0, img: ''
    };
    const p = hasMethods && typeof lx.methods.musicUrl === 'function'
      ? Promise.resolve(lx.methods.musicUrl(info, '320k'))
      : Promise.resolve(lx.__reqCb({ action: 'musicUrl', source: '', info: { musicInfo: info, type: '320k' } }));
    const r = await withTimeout(p, 40000, 'musicUrl');
    url = (typeof r === 'string' && /^https?:/.test(r)) ? r : (r && (r.url || r.playUrl)) || '';
  } catch (e) {
    log(`[FAIL] musicUrl 抛错: ${e.message}`);
    return;
  }
  if (!url) { log('[FAIL] musicUrl 未返回可用地址'); return; }
  const cu = await checkUrl(url);
  log(`播放链接 ${cu.ok ? 'HTTP ' + cu.status : 'FAIL ' + (cu.error || '')}${cu.ok ? ' (' + (cu.len || '?') + 'B, ' + (cu.type || '') + ')' : ''}`);
  log(cu.ok ? `[OK] ${name} 搜索+播放可用` : `[FAIL] ${name} 播放链接不可达: ${cu.error}`);
}

async function main() {
  const files = [
    ['Flower源', path.join(DL, 'Flower源LX.js')],
    ['Huibq源', path.join(DL, 'Huibq源LX.js')],
    ['LX官方源', path.join(DL, 'LX官方源LX.js')],
    ['六音源', path.join(DL, '六音源LX.js')],
  ];
  for (const [name, file] of files) {
    if (!fs.existsSync(file)) { console.log(`===== ${name} (LX) =====`); console.log(`[SKIP] 文件不存在: ${file}`); continue; }
    try { await verifyLx(name, file); } catch (e) { console.log(`===== ${name} (LX) =====`); console.log(`[FAIL] 验证异常: ${e.message}`); }
  }
  console.log('===== LX 验证完毕 =====');
}

main().catch((e) => { console.error('脚本异常: ' + e.message); process.exit(1); });
