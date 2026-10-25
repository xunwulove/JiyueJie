// 极悦界音乐源验证 - 第一步：索引URL可下载性 + JS语法检查
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const INDEX = {
  "六音源(LX)": { format: 'lx', url: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/sixyin/latest.js' },
  "LX官方源(LX)": { format: 'lx', url: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/lx/latest.js' },
  "Huibq源(LX)": { format: 'lx', url: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/huibq/latest.js' },
  "Flower源(LX)": { format: 'lx', url: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/flower/latest.js' },
  "网易云W音乐(MF)": { format: 'mf', url: 'https://raw.githubusercontent.com/ThomasBy2025/musicfree/refs/heads/main/plugins/wy.js' },
  "哔哩哔哩(MF)": { format: 'mf', url: 'https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/bilibili/index.js' },
  "酷狗(MF)": { format: 'mf', url: 'https://gitee.com/kevinr/tvbox/raw/master/musicfree/plugins/kugou.js' },
  "歌曲宝(MF)": { format: 'mf', url: 'https://gitee.com/kevinr/tvbox/raw/master/musicfree/plugins/gequbao.js' },
  "5sing(MF)": { format: 'mf', url: 'https://gitee.com/kevinr/tvbox/raw/master/musicfree/plugins/5sing.js' },
};

// github URL 优先走国内镜像（与 App SourceRepoUpdater 逻辑一致），gitee 直连
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
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(fetchOne(res.headers.location, timeoutMs));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, buf: Buffer.concat(chunks) }));
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
  });
}

(async () => {
  const outDir = path.join(__dirname, 'dl2');
  fs.mkdirSync(outDir, { recursive: true });
  console.log('=== 网络层验证（镜像优先，与App逻辑一致）===');
  const results = [];
  for (const [name, spec] of Object.entries(INDEX)) {
    let last = null;
    for (const cand of candidateUrls(spec.url)) {
      const r = await fetchOne(cand);
      last = r;
      if (r.ok && r.buf.length > 500) {
        const fname = name.replace(/[()]/g, '').replace(' ', '_') + '.js';
        fs.writeFileSync(path.join(outDir, fname), r.buf);
        console.log(`[OK] ${name} <- ${cand.replace('https://', '')} (${(r.buf.length / 1024).toFixed(1)} KB)`);
        results.push({ name, ok: true, bytes: r.buf.length });
        break;
      }
      // 记录失败原因，继续下一个镜像
    }
    if (!results.some((x) => x.name === name)) {
      console.log(`[FAIL] ${name} 所有通道失败: ${last ? last.error || ('HTTP ' + last.status) : '未知'}`);
      results.push({ name, ok: false, error: last ? last.error || ('HTTP ' + last.status) : '未知' });
    }
  }

  console.log('\n=== JS 语法检查（node --check）===');
  for (const f of fs.readdirSync(outDir)) {
    try {
      execFileSync('node', ['--check', path.join(outDir, f)], { stdio: 'pipe' });
      console.log(`[OK] 语法通过 ${f}`);
    } catch (e) {
      console.log(`[FAIL] 语法错误 ${f}: ${e.stderr ? e.stderr.toString().split('\n')[0] : e.message}`);
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n下载结果: ${okCount}/${results.length} 可用`);
})();
