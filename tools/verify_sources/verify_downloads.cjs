// 极悦界音乐源验证 - 网络层：全量拉取 gitee 音源清单 plugins.json → 下载插件 JS → 语法检查
//
// 与 App 内"更新订阅"同源同口径：
// - 清单来源 = gitee 公开仓库 xunwulove/jiyuejie 的 sources/plugins.json（App 内置 DEFAULT_PLUGIN_SUBSCRIPTION_URL）
// - 镜像策略 = github 地址优先走国内镜像（ghproxy.net / gh-proxy.com），gitee 与其它直连
// - 输出 = dl2/<name>.js（全量清单，供 verify_mf.cjs 做五维执行验证）
// 改造记录（2026-10-25 P1）：INDEX 硬编码 9 源抽查 → gitee plugins.json 全量拉取；
//   删除洛雪 LX 相关（verify_lx.cjs / 4 个 LX 源 / INDEX 中 LX 条目——极悦界为 MusicFree 插件体系，不支持 LX）。
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/** 音源清单（App 内置同源，raw 200 已验证）；可用 CLI 参数覆盖：node verify_downloads.cjs <URL|本地文件路径> */
const PLUGINS_JSON_URL =
  process.argv[2] && (process.argv[2].startsWith('http') || fs.existsSync(process.argv[2]))
    ? process.argv[2]
    : 'https://gitee.com/xunwulove/jiyuejie/raw/master/sources/plugins.json';

// github URL 优先走国内镜像（与 App SourceRepoUpdater 逻辑一致），gitee / jsdelivr / moro 直连
function candidateUrls(rawUrl) {
  if (rawUrl.includes('githubusercontent.com') || rawUrl.includes('github.com')) {
    return [
      'https://ghproxy.net/' + rawUrl,
      'https://gh-proxy.com/' + rawUrl,
      rawUrl,
    ];
  }
  return [rawUrl];
}

function fetchOne(url, timeoutMs = 20000) {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location;
          res.resume();
          if (loc.includes('://')) { resolve(fetchOne(loc, timeoutMs)); return; }
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, buf: Buffer.concat(chunks) }));
      });
      req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
    } catch (e) {
      resolve({ ok: false, status: 0, error: 'Invalid URL: ' + String(url).slice(0, 60) });
    }
  });
}

(async () => {
  const outDir = path.join(__dirname, 'dl2');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('=== 拉取音源清单 plugins.json ===');
  let listResp;
  if (fs.existsSync(PLUGINS_JSON_URL)) {
    const buf = fs.readFileSync(PLUGINS_JSON_URL);
    listResp = { ok: true, status: 200, buf };
    console.log(`  本地文件: ${PLUGINS_JSON_URL}`);
  } else {
    listResp = await fetchOne(PLUGINS_JSON_URL, 25000);
    if (!listResp.ok) {
      console.log(`[FAIL] plugins.json 拉取失败: ${listResp.error || ('HTTP ' + listResp.status)}`);
      process.exit(1);
    }
  }
  let manifest;
  try {
    manifest = JSON.parse(listResp.buf.toString('utf8'));
  } catch (e) {
    console.log(`[FAIL] plugins.json 解析失败: ${e.message}`);
    process.exit(1);
  }
  const plugins = Array.isArray(manifest.plugins) ? manifest.plugins : [];
  if (!plugins.length) {
    console.log('[FAIL] plugins.json 无 plugins 数组');
    process.exit(1);
  }
  console.log(`清单共 ${plugins.length} 个音源插件：`);
  console.log(`  说明: ${manifest.desc || '(无)'}`);

  // 去重（同名源保留首个；plugins.json 内 W电台/W电台_1 为 CDN 双通道同名异源，保留）
  const seen = new Set();
  const list = plugins.filter((p) => {
    if (!p || !p.name || !p.url) return false;
    if (typeof p.url !== 'string' || !p.url.includes('://')) return false; // 防御：清单结构错位（url 拿成 version 等）
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });

  console.log(`\n=== 网络层验证（去重后 ${list.length} 个，镜像优先，与App逻辑一致）===`);
  const results = [];
  for (const p of list) {
    let last = null;
    let saved = null;
    for (const cand of candidateUrls(p.url)) {
      const r = await fetchOne(cand);
      last = r;
      if (r.ok && r.buf.length > 500) {
        const fname = p.name.replace(/[\\/:"*?<>|]/g, '_').replace(/\s+/g, '_') + '.js';
        const fp = path.join(outDir, fname);
        fs.writeFileSync(fp, r.buf);
        saved = { fname, bytes: r.buf.length, from: cand.replace('https://', '') };
        console.log(`[OK] ${p.name} v${p.version || '?'} <- ${saved.from} (${(r.buf.length / 1024).toFixed(1)} KB -> ${fname})`);
        break;
      }
    }
    if (saved) {
      results.push({ name: p.name, version: p.version, ok: true, bytes: saved.bytes, file: saved.fname });
    } else {
      console.log(`[FAIL] ${p.name} v${p.version || '?'} 所有通道失败: ${last ? last.error || ('HTTP ' + last.status) : '未知'}`);
      results.push({ name: p.name, version: p.version, ok: false, error: last ? last.error || ('HTTP ' + last.status) : '未知' });
    }
  }

  console.log('\n=== JS 语法检查（node --check）===');
  const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.js')).sort();
  let syntaxOk = 0;
  for (const f of files) {
    try {
      execFileSync('node', ['--check', path.join(outDir, f)], { stdio: 'pipe' });
      syntaxOk += 1;
    } catch (e) {
      console.log(`[FAIL] 语法错误 ${f}: ${e.stderr ? e.stderr.toString().split('\n')[0] : e.message}`);
    }
  }
  console.log(`语法检查: ${syntaxOk}/${files.length} 通过`);

  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n下载结果: ${okCount}/${results.length} 可用`);
  console.log('=== 网络层验证完毕 ===');
})();
