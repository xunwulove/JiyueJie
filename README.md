# 极悦界（JiyueJie）发布仓库

本仓库统一托管极悦界（基于 MusicFree 二次开发的音乐播放器）的**软件更新**与**音源订阅**：

```
jiyuejie/
├── updates/   软件更新：version.json（版本信息）+ APK 安装包
└── sources/   音源订阅：plugins.json（当前 100 个音源）+ probe_plugin.js 验证脚本
```

原音源仓库 `jishijie-release` 已弃用（仓库 `jiyuejie-updates` 已改名为 `jiyuejie`），音源订阅收口到本仓库。

## 一、软件更新（version.json + APK）

软件内「检查更新」读取本仓库的 `version.json`，有新版本时在软件内下载安装包并提示安装。

- `version.json` 字段：`version`（版本号）、`changeLog`（更新日志）、`download`（APK 直链数组）
- APK 附件通过 gitee release（固定 tag `latest`）托管，文件名保持 `version.json` / `app-arm64-v8a-release.apk` / `app-universal-release.apk` 不变，链接才固定

## 二、音源订阅（plugins.json）

### 2.1 MusicFree 订阅地址

在 MusicFree / 极悦界中订阅本仓库清单：

```
https://gitee.com/xunwulove/jiyuejie/raw/master/sources/plugins.json
```

备用 CDN（主地址被限时换用）：

```
https://raw.giteeusercontent.com/xunwulove/jiyuejie/raw/master/sources/plugins.json
```

### 2.2 音源获取来源

统一从 MusicFree 插件订阅站获取，经去重、去失效后整合维护：

- 订阅站：https://hebijunge.github.io/musicfree-plugins/
- 主清单：https://hebijunge.github.io/musicfree-plugins/plugins.json
- 备用通道（内容一致，主通道失效时换用）：
  - fastly：https://hebijunge.github.io/musicfree-plugins/plugins-fastly.json
  - gcore：https://hebijunge.github.io/musicfree-plugins/plugins-gcore.json
  - ghproxy：https://ghproxy.net/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins-ghproxy.json

### 2.3 更新流程（AI 按此自动执行）

1. 下载订阅站主清单 `plugins.json`；
2. 先用仓库内 `probe_plugin.js` 对插件做**真实搜索功能验证**（调用插件搜索接口，确认能否搜到歌）；
3. 再并发验证每个插件 URL 可用性（HTTP 200 判为有效）；
4. **去除失效插件**（含间歇性超时、重测仍失败的）；
5. 与本地现有 `plugins.json` 按 URL 去重后整合；
6. 生成新 `plugins.json`（严格 MusicFree 格式）；
7. 覆盖上传仓库 `sources/plugins.json`（**文件名必须保持 `plugins.json`，勿改名**，否则订阅地址失效无法拉取）。

### 2.4 格式规范（必须严格遵循 MusicFree）

```json
{
  "desc": "说明文字",
  "plugins": [ { "name": "插件名", "version": "版本", "url": "插件js地址" } ]
}
```

- 顶层**只允许** `desc` + `plugins` 两个字段；
- 每个插件条目**只允许** `name` / `version` / `url` 三字段；
- 缺失 version 的补占位 `1.0.0`；
- 禁止添加额外字段，避免影响 MusicFree 导入识别。

### 2.5 其他可用订阅站（备用/补充来源）

以下订阅站经验证可用，可作 hebijunge 之外的补充音源来源：

- **聚合器**（推荐补充）：https://musicfreepluginshub.2020818.xyz/plugins.json （34 个插件）
- **官方**：https://gitee.com/maotoumao/MusicFreePlugins/raw/master/plugins.json （12 个插件）
- **GitLab 综合**：https://gitlab.com/acoolbook/musicfree/-/raw/main/music.json （11 个插件）
- **Huibq 综合**：https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/myPlugins.json （5 个插件）
- **AkFace**：https://raw.githubusercontent.com/akFace/userScript/refs/heads/master/plugins.json （5 个插件）

> 注意：聚合器中的「网易 / 酷我 / 酷我_1 / qq / mg」为失效源（music.haitangw.net，HTTP 418），整合时需排除。

### 2.6 更新记录

- **2026-10-13**：音源订阅从 `jishijie-release` 迁移至本仓库（100 个音源，全部有效）。
- **2026-10-13**：整合 hebijunge 订阅站 + 聚合器补充插件，移除不稳定音源，当前共 **100** 个音源。
- **2026-10-13**：新增 `probe_plugin.js` 真实搜索功能验证脚本，首轮全量验证 100 个音源：**25 个真实可搜到歌**、55 个接口返回空（多为签名/风控限制）、20 个加载失败（其中 酷我_xixi / 酷狗_xixi 源站 js.258008.xyz 返回 403，**确认失效，建议下轮移除**）。

### 2.7 音源真实搜索功能验证（probe_plugin.js）

**为什么需要**：插件 URL 能打开（HTTP 200）≠ 插件能用。很多音源插件内部接口已失效、被风控或签名不通过，需要**真实调用插件的搜索接口**验证。

**脚本位置**：仓库 `sources/probe_plugin.js`（配套 `sources/package.json` 声明依赖）。

**运行方式**（需要 Node.js ≥ 18）：

```bash
npm install            # 安装 axios / cheerio / crypto-js
node probe_plugin.js <插件.js路径或URL> [关键词]   # 验证单个插件
node probe_plugin.js --file plugins.json [关键词]  # 批量验证整个清单
```

**输出说明**（JSON）：

| 字段 | 含义 |
| --- | --- |
| `load` | `ok` 加载成功 / `load-fail` 加载报错 / `no-search-api` 无搜索接口 / `timeout(45s)` 超时 / `child-error` 子进程异常 |
| `searchAPI` | 找到的搜索接口（`search` / `searchMusic` / `getTopLists` 等） |
| `found` | **是否真实搜到歌**（true/false） |
| `songs` | 返回歌曲数 |
| `sample` | 样例歌曲（歌名-歌手） |

**批量验证**：每个插件在独立子进程运行，45 秒硬超时，单个插件卡死不会拖垮全量；结果写入 `probe_results.json`。

**首轮全量验证结果（2026-10-13）**：100 个音源 → **25 个真实可搜到歌**、55 个接口返回空、20 个加载/调用失败。确认失效：酷我_xixi、酷狗_xixi（js.258008.xyz 返回 403）。说明：接口返回空 ≠ 一定失效，部分主流源（网易/腾讯/酷狗等）需签名或在 App 内完整环境才可搜索，脚本环境只能验证不依赖复杂签名的插件。
