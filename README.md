# 极悦界（JiyueJie）发布仓库

本仓库统一托管极悦界（基于 MusicFree 二次开发的音乐播放器）的**软件更新**与**音源订阅**。**仓库定位：纯发布仓，只放发布文件，不存源码**——源码位于本地与 GitHub 私有仓库（`xunwulove/JiyueJie`），禁止将源码树 push 到此仓库（2026-10-26 确认）。

```
jiyuejie/
├── updates/   软件更新：version.json（版本信息）+ APK 安装包
└── sources/   音源订阅：plugins.json（音源订阅清单）
```

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

### 2.2 音源获取来源（参考库全集，2026-10-26 更新）

音源为 **MusicFree 插件格式**，来自**订阅站聚合 + 开源源仓库 + 聚合站**，经去重、去失效、A 档筛选后整合维护（完整流程见项目 `docs/音源全流程.md`）：

| 参考库 | 类型 | 说明 |
|---|---|---|
| 订阅站聚合（插件Hub 聚合器 + onemusic/moro） | 订阅站 | one-* 系列源；筛选口径 HTTP 200 + ≥1KB + 特征词 |
| **Nairocy 音源插件聚合站**（2026-10-25 登记） | 聚合站 | `https://music.nairocy.com/down`，索引 38 插件，含自托管 7 个（酷狗Thomas / 酷我音乐Thomas / 腾讯音乐 / 网易音乐 / 网易专辑 / GD音乐台 / GitCode）+ 弥音QQ / 云云音乐 等独特源 |
| maotoumao/MusicFreePlugins（**官方插件库**） | 开源仓库 | `gitee.com/maotoumao/MusicFreePlugins`（Hi~Res音乐 为猫头猫原生库插件，走 `adad23u.appinstall.life` CDN） |
| kevinr/tvbox | 聚合仓库 | `gitee.com/kevinr/tvbox` `musicfree/plugins/`（含千千音乐 = `qianqian.js`） |
| ThomasBy2025/musicfree | GitHub 单插件 | 走国内镜像 ghproxy.net / gh-proxy.com |
| GuGuMur/MusicFreePlugin-NeteaseRadio | CDN 双通道 | `cdn.jsdelivr.net` / `fastly.jsdelivr.net` |
| GitLab acoolbook | 综合订阅 | `gitlab.com/acoolbook/musicfree/-/raw/main/music.json` |
| Huibq keep-alive | 综合订阅（CDN） | `fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/myPlugins.json` |
| AkFace userScript | 综合订阅 | `raw.githubusercontent.com/akFace/userScript/refs/heads/master/plugins.json` |

> **2026-10-25 首轮真机实测拍板**：正式 `sources/plugins.json` 更新为 **21 源**（A 档 19 全通 + 歌单型 one-QQ / Hi~Res音乐；剔除猫耳FM、5sing、弥音QQ；碳酸系保留）。

### 2.3 新增音源工作流程（创造新音源，AI + 用户协作）

1. **从参考库拉取音源**：从 §2.2 参考库全集（订阅站聚合 / Nairocy 聚合站 / 官方 MusicFreePlugins / kevinr/tvbox / ThomasBy2025 / CDN 双通道）拉取候选插件清单；
2. **AI 探测脚本初筛**：`verify_downloads` 下载 + 语法检查 → `verify_mf` 五维探测（搜索/解析/播放/歌词/歌单，并发 5 / 预算 120s）→ 档位归类（A / A1 / B1 / B2 / C / X）；
3. **建立 gitee 测试音源**：把初筛后的集合写成测试订阅 JSON（`sources/` 下独立文件，如 `test-plugins.json`，**不覆盖正式 plugins.json**，PUT base64 + 先 GET sha）→ 提供订阅链接 → **你用探测软件（source-probe）** 在"订阅设置"添加链接拉取实测，获取探测报告（播放静音）；
4. **AI 二次筛选**：读取你的探测报告，与电脑初筛结果**比对**（电脑可播/真机不可播的差异源重点复核）→ 档位归类 + 建议动作 → 分级清单；
5. **用户确认后覆盖正式音源**：确认的 **A 档（真机可播）** PUT 覆盖 `sources/plugins.json`（**文件名必须保持 `plugins.json`**，base64 + 先 GET sha）→ 直链验证（主链 + 备用 CDN `raw.giteeusercontent.com`）。

> 对应完整执行细节（责任分工/交接物/档位表）见项目 `docs/音源全流程.md` §8 测试执行 SOP。

### 2.5 订阅同步清理（增量更新自动卸载无用源）

增量更新只增不删会导致**从清单移除的旧源长期滞留**。极悦界已实现来源标记 + 自动清理（2026-10-26）：

- 每个已装插件带**来源标记**：订阅清单安装 = `subscription + 订阅地址`；手动导入（本地/URL/备份恢复）= `manual`；
- 软件内「更新插件」（维护者更新）**继承旧标记**，标记链路不断；
- **自动更新与手动「更新订阅」共用同一清理逻辑**：对**来源=当前订阅地址**、且**连续 2 轮不在清单**的已装插件自动卸载；
- **手动导入的源永不自动清理**；其他订阅地址装的源只受其自身订阅影响；
- **跨订阅误删防护**：同名插件仍在本轮其他订阅地址清单中 → 只累计不卸载；
- **关闭懒加载（`basic.lazyLoadPlugin=false`）下标记仍恢复**，清理不会静默失效；
- 从清单移除某源后，已装用户连点 2 次「更新订阅」即自动卸载，无需手动处理。

> 实现细节（Plugin.sourceTag / missingRounds 持久化、`cleanupSubscriptionPlugins` 入口）见项目 `docs/音源全流程.md` §7.1 与源码 `src/core/pluginManager/index.ts`。

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

