# 极悦界（JiyueJie）发布仓库

本仓库统一托管极悦界（基于 MusicFree 二次开发的音乐播放器）的**软件更新**与**音源订阅**：

```
jiyuejie/
├── updates/   软件更新：version.json（版本信息）+ APK 安装包
└── sources/   音源订阅：plugins.json（音源订阅清单）
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
2. 并发验证每个插件 URL 可用性（HTTP 200 判为有效，间歇性超时需重测确认）；
3. **去除失效插件**（含间歇性超时、重测仍失败的）；
4. 与本地现有 `plugins.json` 按 URL 去重后整合；
5. 生成新 `plugins.json`（严格 MusicFree 格式）；
6. 覆盖上传仓库 `sources/plugins.json`（**文件名必须保持 `plugins.json`，勿改名**，否则订阅地址失效无法拉取）。

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

- **聚合器**（推荐补充）：https://musicfreepluginshub.2020818.xyz/plugins.json
- **官方**：https://gitee.com/maotoumao/MusicFreePlugins/raw/master/plugins.json
- **GitLab 综合**：https://gitlab.com/acoolbook/musicfree/-/raw/main/music.json
- **Huibq 综合**：https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/myPlugins.json
- **AkFace**：https://raw.githubusercontent.com/akFace/userScript/refs/heads/master/plugins.json

> 注意：聚合器中的「网易 / 酷我 / 酷我_1 / qq / mg」为失效源（music.haitangw.net，HTTP 418），整合时需排除。

### 2.6 更新记录

- **2026-10-13**：音源订阅从 `jishijie-release` 迁移至本仓库，全部音源验证有效。
- **2026-10-13**：整合 hebijunge 订阅站 + 聚合器补充插件，移除不稳定音源。
- **2026-10-15**：补录 hebijunge 新增「聚合」音源；移除 `probe_plugin.js` / `package.json`（验证脚本已废弃，不再维护）；订阅清单数量不再单独声明。
- **2026-10-16**：软件音效引擎切换为 **JamesDSP 核心算法库**（均衡器 15 段 + 输出增益/动态低音/立体声增强/混响/电子管/交叉馈送/卷积器等进阶音效），替换系统 AudioEffect；对应更新日志见 `updates/version.json` 的 `changeLog`。
- **2026-10-17**：发布 **0.6.2.15**——新增 **DDC 耳机补偿**（内置 5 款 AutoEQ 真实频响补偿 IR：QCY T13/AirPods Pro 2/Sony WH-1000XM4/Bose QC45/Sennheiser HD 650）、耳机补偿预设**导入**（三级文件选择器/48kHz WAV/可删除）、混响 5 预设替换为**真实空间 IR**、移除英文界面仅中文；完整日志见 `updates/version.json` 的 `changeLog`。
- **2026-10-17（同日同版本号重新发布 0.6.2.15）**：修复批次 16 项（播放失败重试链路、下载队列失败卡死、听歌统计失真、切歌换采样率 DSP 静默重置、IR 按引擎采样率重采样、插件歌单分页误判、平板面板遮挡等）+ 新增下载**断点续传与队列持久化**（重启恢复未完成任务并自动续跑）+ 全项目 **lint 清零**（pre-commit 校验恢复）。版本号未变：已装 0.6.2.15 的用户不会收到更新提示，需手动下载覆盖安装。
- **2026-10-18（同日同版本号再次重新发布 0.6.2.15）**：修复**两次闪退**——播放补充信息 artwork 空串导致 RNTP `updateMetadataForTrack` 崩溃（Java 层）、JamesDSP `nativeInit` 重初始化与 `setEqualizer` 并发竞态空指针崩溃（JNI 层 pthread 互斥锁根治）+ 全部文字胶囊统一固定 36/16/18（消除平板 600dp 临界跳变）+ WebDAV 设置改三级浮窗（修复原面板输入框弹不出键盘）+ 浮窗遮罩点击穿透修复 + 音效页文案调整（删除均衡器/生效提示/混响胶囊下说明）。版本号未变：已装 0.6.2.15 的用户不会收到更新提示，需手动下载覆盖安装。完整日志见 `updates/version.json` 的 `changeLog`。
- **2026-10-18（深夜，同日同版本号第三次重新发布 0.6.2.15）**：**两次闪退修复经打包生效**（artwork 空串、JamesDSP `setEqualizer` 竞态加锁，此前已提交未打包，用户端复现崩溃后紧急重发）+ 底部面板补 elevation（修复搜索结果列表三点菜单唤不出、浮窗遮罩点击穿透）+ 搜索失败音源改进（翻页从失败页重试不丢数据、同轮失败自动重试一次）+ 此前 10-18 全部改动。版本号未变：已装 0.6.2.15 的用户不会收到更新提示，需手动下载覆盖安装。完整日志见 `updates/version.json` 的 `changeLog`。
- **2026-10-19（同日同版本号第四次重新发布 0.6.2.15）**：**播放页与迷你播放条显示当前音质标识**（低音质/标准音质/高音质/超高音质，切音质实时刷新，全屏播放页标题区歌手行下居中标签 + 播放条 `标题 ·高音质`）。版本号未变：已装 0.6.2.15 的用户不会收到更新提示，需手动下载覆盖安装。完整日志见 `updates/version.json` 的 `changeLog`。
- **2026-10-19（同日同版本号第五次重新发布 0.6.2.15）**：**平板浮窗穿透修复**——Panel/Dialog 浮窗弹出时左 30% 播放区补透明拦截层，点击播放区/播放条只关闭浮窗，不再穿透进全屏播放页（含三级浮窗/嵌套 Dialog）。版本号未变：已装 0.6.2.15 的用户不会收到更新提示，需手动下载覆盖安装。完整日志见 `updates/version.json` 的 `changeLog`。
- **2026-10-19**：发布 **0.6.2.16**（正式发版，版本号 0.6.2.15→0.6.2.16，versionCode 400026→400027）——**平板浮窗穿透彻底根治**：Panel 遮罩交互层改 100% 全屏（点击浮窗外任意区域即关闭浮窗）、视觉暗色层仍限右 70% 内容区；Dialog 新增与弹窗本体同级同 elevation 16300 的 `screenTouchBlock` 全屏点击拦截层，删除早期两个补丁层；同步音源订阅清单修复（plugins.json 99→98 个插件）。已装 0.6.2.15 的用户会收到更新提示。完整日志见 `updates/version.json` 的 `changeLog`。
- **2026-10-19（同日同版本号第七次重新发布 0.6.2.16）**：**歌单歌曲列表与全屏播放页三点菜单改为三级浮窗 Dialog**（根治底部面板被 KeyboardAvoidingView/覆盖层压住只见阴影的问题）+ 核查问题批量修复——本地歌单详情页补 Header（收藏/批量入口恢复）、全屏版三点菜单文案走 i18n、Toast 补 elevation 16320（浮窗打开期间可见）、播放队列歌曲行加三点菜单、歌单删除加确认弹窗、平板全屏播放页弹窗整屏居中（读 fullPlayingAtom 对齐 Panel）；**下载音质选择改三级弹窗并高亮当前音质**；底部面板标题圆角直角阴影修复（wrapper overflow 裁剪）。版本号未变：已装 0.6.2.16 的用户不会收到更新提示，需手动下载覆盖安装。完整日志见 `updates/version.json` 的 `changeLog`。
