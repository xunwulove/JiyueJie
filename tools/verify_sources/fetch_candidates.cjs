// 极悦界音源候选拉取：从 9 个参考库（音源全流程 §二 / gitee README §2.2）拉取插件清单 → 合并去重 → candidates.json
// 产物：candidates.json（{desc, sources: [...], plugins:[{name,version,url,from}]}）
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function fetchOne(url, timeoutMs = 25000) {
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

// 兼容多种清单形态：{plugins:[{name,version,url}]} / [{name,version,url}] / {plugins:{"name":url}} / {data:[...]}
function parseManifest(buf, from) {
  const txt = buf.toString('utf8');
  let obj;
  try { obj = JSON.parse(txt); } catch (e) { return { ok: false, error: 'JSON 解析失败: ' + e.message.slice(0, 80) }; }
  let arr = null;
  if (Array.isArray(obj)) arr = obj;
  else if (Array.isArray(obj.plugins)) arr = obj.plugins;
  else if (Array.isArray(obj.data)) arr = obj.data;
  else if (obj.plugins && typeof obj.plugins === 'object') {
    arr = Object.keys(obj.plugins).map((k) => ({ name: k, url: obj.plugins[k] }));
  }
  if (!arr) return { ok: false, error: '未知清单结构, keys=' + Object.keys(obj).slice(0, 6).join(',') };
  const plugins = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    if (typeof it === 'string') continue;
    const name = it.name || it.title || it.id;
    const url = it.url || it.src || it.download;
    if (!name || !url) continue;
    plugins.push({ name: String(name), version: String(it.version || '1.0.0'), url: String(url), from });
  }
  return { ok: plugins.length > 0, plugins };
}

// gitee API 列目录（kevinr/tvbox musicfree/plugins）→ 每个 .js 视为一个源
async function fetchGiteeDir(owner, repo, dir) {
  const api = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${dir}`;
  const r = await fetchOne(api, 30000);
  if (!r.ok) return { ok: false, error: 'gitee dir HTTP ' + r.status };
  let list;
  try { list = JSON.parse(r.buf.toString('utf8')); } catch (e) { return { ok: false, error: 'gitee dir 解析失败' }; }
  if (!Array.isArray(list)) return { ok: false, error: 'gitee dir 非数组' };
  const plugins = list
    .filter((f) => f.type === 'file' && f.name.endsWith('.js'))
    .map((f) => ({ name: f.name.replace(/\.js$/, ''), version: '1.0.0', url: f.download_url, from: `${owner}/${repo} ${dir}` }));
  return { ok: plugins.length > 0, plugins };
}

async function main() {
  const out = path.join(__dirname, 'candidates.json');
  const all = [];
  const report = [];

  // 1. 订阅站聚合：插件Hub 聚合器
  {
    const r = await fetchOne('https://musicfreepluginshub.2020818.xyz/plugins.json');
    const p = r.ok ? parseManifest(r.buf, '插件Hub聚合器') : { ok: false, error: 'HTTP ' + r.status };
    if (p.ok) { all.push(...p.plugins); report.push(`插件Hub聚合器: ${p.plugins.length} 个`); }
    else report.push(`插件Hub聚合器: 失败(${p.error || ''})`);
  }
  // 2. onemusic/moro 订阅站（先试根清单，失败标记）
  {
    const r = await fetchOne('https://moro.cn.mt/plugins.json', 15000);
    if (r.ok) {
      const p = parseManifest(r.buf, 'moro订阅站');
      if (p.ok) { all.push(...p.plugins); report.push(`moro订阅站: ${p.plugins.length} 个`); }
      else report.push(`moro订阅站: 结构异常(${p.error})`);
    } else report.push(`moro订阅站: 无根清单(HTTP ${r.status})，one-* 从其它来源覆盖`);
  }
  // 3. Nairocy 聚合站（HTML 索引解析 /file/*.js 或 JSON；最多重试 2 次，再失败试主页）
  {
    let r = null;
    for (let i = 0; i < 2; i++) {
      r = await fetchOne('https://music.nairocy.com/down', 25000);
      if (r.ok) break;
    }
    if (r && r.ok) {
      const txt = r.buf.toString('utf8');
      const jsonTry = parseManifest(r.buf, 'Nairocy');
      if (jsonTry.ok) { all.push(...jsonTry.plugins); report.push(`Nairocy: ${jsonTry.plugins.length} 个(JSON)`); }
      else {
        const urls = [...txt.matchAll(/https?:\/\/music\.nairocy\.com\/file\/[^"'<>\s]+\.js/gi)].map((m) => m[0]);
        const uniq = [...new Set(urls)];
        const list = uniq.map((u) => ({ name: u.split('/').pop().replace(/\.js$/, ''), version: '1.0.0', url: u, from: 'Nairocy聚合站' }));
        if (list.length) { all.push(...list); report.push(`Nairocy: ${list.length} 个(HTML 解析)`); }
        else report.push('Nairocy: 未解析到插件链接');
      }
    } else {
      const r2 = await fetchOne('https://music.nairocy.com/', 20000);
      if (r2.ok) {
        const urls = [...r2.buf.toString('utf8').matchAll(/https?:\/\/music\.nairocy\.com\/file\/[^"'<>\s]+\.js/gi)].map((m) => m[0]);
        const uniq = [...new Set(urls)];
        const list = uniq.map((u) => ({ name: u.split('/').pop().replace(/\.js$/, ''), version: '1.0.0', url: u, from: 'Nairocy聚合站' }));
        if (list.length) { all.push(...list); report.push(`Nairocy: ${list.length} 个(主页解析)`); }
        else report.push('Nairocy: 主页也未解析到插件链接');
      } else report.push(`Nairocy: /down 与主页均失败(HTTP ${r2.status})`);
    }
  }
  // 4. MusicFree 官方库（raw/v0.1/dist/plugins.json，失败试 raw/master/plugins.json）
  {
    let got = null;
    for (const u of [
      'https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/plugins.json',
      'https://gitee.com/maotoumao/MusicFreePlugins/raw/master/plugins.json',
    ]) {
      const r = await fetchOne(u, 25000);
      if (r.ok) { const p = parseManifest(r.buf, '官方MusicFreePlugins'); if (p.ok) { got = p; break; } }
    }
    if (got) { all.push(...got.plugins); report.push(`官方MusicFreePlugins: ${got.plugins.length} 个`); }
    else report.push('官方MusicFreePlugins: 失败');
  }
  // 5. kevinr/tvbox（gitee 目录）
  {
    const r = await fetchGiteeDir('kevinr', 'tvbox', 'musicfree/plugins');
    if (r.ok) { all.push(...r.plugins); report.push(`kevinr/tvbox: ${r.plugins.length} 个`); }
    else report.push(`kevinr/tvbox: 失败(${r.error})`);
  }
  // 6. ThomasBy2025/musicfree（GitHub 递归树找全部 js，避免根目录无 js 漏源）
  {
    let r = await fetchOne('https://api.github.com/repos/ThomasBy2025/musicfree/git/trees/master?recursive=1', 30000);
    if (!r.ok) {
      r = await fetchOne('https://api.github.com/repos/ThomasBy2025/musicfree/git/trees/main?recursive=1', 30000);
    }
    if (r.ok) {
      let tree; try { tree = JSON.parse(r.buf.toString('utf8')).tree; } catch (e) { tree = null; }
      const js = (Array.isArray(tree) ? tree : []).filter((f) => f.type === 'blob' && f.path.endsWith('.js'));
      const ps = js.map((f) => ({ name: f.path.split('/').pop().replace(/\.js$/, ''), version: '1.0.0', url: 'https://raw.githubusercontent.com/ThomasBy2025/musicfree/master/' + f.path, from: 'ThomasBy2025' }));
      if (ps.length) { all.push(...ps); report.push(`ThomasBy2025: ${ps.length} 个(${js.map((j) => j.path).join(',')})`); }
      else report.push('ThomasBy2025: 全树无 js');
    } else report.push(`ThomasBy2025: GitHub API HTTP ${r.status}`);
  }
  // 7. GuGuMur 网易云电台 CDN 双通道（已知直链）
  {
    const urls = [
      'https://cdn.jsdelivr.net/gh/GuGuMur/MusicFreePlugin-NeteaseRadio@master/dist/plugin.js',
      'https://fastly.jsdelivr.net/gh/GuGuMur/MusicFreePlugin-NeteaseRadio@master/dist/plugin.js',
    ];
    const ps = urls.map((u, i) => ({ name: i === 0 ? 'W电台' : 'W电台_1', version: '1.0.0', url: u, from: 'GuGuMur CDN' }));
    all.push(...ps);
    report.push(`GuGuMur CDN: 2 个(W电台/W电台_1)`);
  }
  // 8. GitLab acoolbook 综合订阅
  {
    const r = await fetchOne('https://gitlab.com/acoolbook/musicfree/-/raw/main/music.json', 25000);
    if (r.ok) { const p = parseManifest(r.buf, 'GitLab acoolbook'); if (p.ok) { all.push(...p.plugins); report.push(`GitLab acoolbook: ${p.plugins.length} 个`); } else report.push(`GitLab acoolbook: 结构异常`); }
    else report.push(`GitLab acoolbook: HTTP ${r.status}`);
  }
  // 9. Huibq keep-alive 综合订阅
  {
    const r = await fetchOne('https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/myPlugins.json', 25000);
    if (r.ok) { const p = parseManifest(r.buf, 'Huibq'); if (p.ok) { all.push(...p.plugins); report.push(`Huibq: ${p.plugins.length} 个`); } else report.push(`Huibq: 结构异常`); }
    else report.push(`Huibq: HTTP ${r.status}`);
  }
  // 10. AkFace userScript 综合订阅（重试 2 次）
  {
    let r = null;
    for (let i = 0; i < 2; i++) {
      r = await fetchOne('https://raw.githubusercontent.com/akFace/userScript/refs/heads/master/plugins.json', 25000);
      if (r.ok) break;
    }
    if (r && r.ok) { const p = parseManifest(r.buf, 'AkFace'); if (p.ok) { all.push(...p.plugins); report.push(`AkFace: ${p.plugins.length} 个`); } else report.push(`AkFace: 结构异常`); }
    else report.push(`AkFace: 失败(HTTP ${r ? r.status : '0'})`);
  }

  // 合并去重（同名+同 url 去重；同名异 url 保留 CDN 双通道语义：仅当来自不同通道且原名即区分）
  const seen = new Set();
  const merged = [];
  for (const p of all) {
    const key = p.name + '|' + p.url;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }
  const byName = new Map();
  for (const p of merged) {
    if (!byName.has(p.name)) byName.set(p.name, []);
    byName.get(p.name).push(p);
  }
  // 同名多 url：仅保留"官方 CDN 双通道"(W电台/W电台_1)与 gitee plugins.json 内 W电台 特例；其余同名取首个
  const final = [];
  for (const [name, items] of byName) {
    if (items.length > 1 && name === 'W电台') { final.push(...items); continue; } // 双通道保留两个
    if (items.length > 1 && name === 'W电台_1') { final.push(...items); continue; }
    final.push(items[0]);
  }

  const manifest = {
    desc: `参考库候选（${report.length} 个来源，${new Date().toISOString().slice(0, 10)}）`,
    sources: report,
    plugins: final,
  };
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log('=== 参考库候选拉取报告 ===');
  report.forEach((r) => console.log('  ' + r));
  console.log(`\n原始条目: ${all.length} → 去重后: ${merged.length} → 同名去重后: ${final.length}`);
  console.log('产物: ' + out);
}

main().catch((e) => { console.error(e); process.exit(1); });
