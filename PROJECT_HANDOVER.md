# 极悦界 项目交接文档（给接手 AI）

> 交接时间：2026-10-15 ｜ 交接人：原开发助手（豆包） ｜ 接收人：新 AI 助手
> 本文档是接手本项目的**唯一必读入口**：先读本文，再按需深入 `docs/` 各文档。

---

## 1. 项目速览

| 项 | 值 |
|---|---|
| 项目名 | 极悦界（JiyueJie） |
| 性质 | MusicFree 系 二次开发 的 React Native 安卓音乐播放器（fork 上游 maotoumao/MusicFree） |
| 当前版本 | 0.6.2.14（versionCode 400025） |
| 包名 | fun.upup.musicfree |
| 项目根 | `E:\xunwu\Deepseek\jiyuejie` |
| 上游 | https://github.com/maotoumao/MusicFree（AGPL） |

**远程仓库**：
- **GitHub**（源代码）：`github.com/xunwulove/JiyueJie`，main 分支。push 凭据已在 `.git/config` 的 origin URL 内（含 PAT，勿外泄、勿复制到公开文档）；直连 github.com 常断，兜底镜像 `https://ghfast.top/https://github.com/xunwulove/JiyueJie.git`。
- **Gitee**（软件更新仓）：`gitee.com/xunwulove/jiyuejie`，master 分支。结构：`updates/version.json`（更新兜底）+ Release tag `latest`（主更新地址，附件 = version.json / app-arm64-v8a-release.apk / app-universal-release.apk，**文件名不可变**）。gitee token 见原交接人对话记录，勿写入本文档。

---

## 2. 接手前必读（用户硬约束，违反会导致返工）

1. **不主动打包**：除非用户明确要求，绝不执行打包/构建命令、不升版本号、不产出 APK。
2. **较大代码改动前必须备份**被改部分到 `E:\Temp\Deepseek\`（备份命名 `<文件>.bak<序号>-<日期>`）。
3. **尽量不写 C 盘**；临时文件（日志/中间产物/备份）统一放 `E:\Temp\Deepseek\`，不散落 temp 根目录。
4. **UI 改动默认以平板/车机版为主**，手机版自适应由助手自行决定。
5. **打包版本规则**：每次打包 versionName 末位 `+0.0.1`、versionCode `+1`；改 `package.json` 必须 **UTF-8 无 BOM** 写入（BOM 会导致 RN autolink 解析失败）。
6. **文档修改慎重**：所有文档改动须符合实际代码（以 Grep/Read 源码为准），不臆断。
7. **APK 不入 git 仓库**；产物命名"极悦界 v版本 (abi).apk"放项目根。
8. 均衡器、启动页、gitee 发版等**已踩过的坑**见 `docs/问题排查与避坑记录.md`，动手前先查。

---

## 3. 技术栈与架构

- **React Native 0.76.5 + TypeScript**（`npx tsc --noEmit` 验证）；React 18.3.1。
- **播放**：react-native-track-player ^4.1.1（RNTP，ExoPlayer 内核）。
- **音效**（本项目自研原生模块）：Kotlin `android.media.audiofx`（Equalizer / BassBoost / Virtualizer），经反射读取 RNTP ExoPlayer 的 audioSessionId 后绑定；RN 侧 `src/core/soundEffect.ts` 统一封装。**全套避坑见 `docs/问题排查与避坑记录.md` 第2章**。
- **状态管理**：jotai；配置持久化：react-native-mmkv + `src/core/appConfig.ts`。
- **i18n**：`src/core/i18n/languages/`（zh-cn / zh-tw / en-us 三份 JSON）+ `src/types/core/i18n/index.d.ts` 类型声明（加 key 需三处同步）。
- **响应式**：`src/hooks/useIsTablet.ts`（宽屏判定）+ `src/utils/tablet.ts`（`rpx = (x/750)*窗口短边`）。
- **其他关键依赖**：react-native-linear-gradient（渐变背景）、react-native-svg（自绘图形，如均衡器曲线/竖向滑块）、react-native-track-player、@react-navigation、expo-splash-screen（启动页）、react-native-permissions（通知/存储权限）。

---

## 4. 目录导航

| 路径 | 内容 |
|---|---|
| `src/core/` | 核心逻辑：appConfig（配置）、soundEffect（音效封装）、i18n、pluginManager（音源） |
| `src/pages/` | 页面：`setting/settingTypes/` 下为各设置子页（**soundEffectSetting.tsx = 音效页**） |
| `src/hooks/` `src/utils/` | useIsTablet、tablet（rpx）、checkUpdate（更新检测，链路依赖 gitee latest tag） |
| `src/constants/` | defaultPluginSubscription（音源订阅，gitee 同仓 sources/） |
| `src/types/` | TS 类型（含 i18n 声明） |
| `android/app/src/main/java/fun/upup/musicfree/` | Kotlin 原生模块（`soundEffect/SoundEffectModule.kt` 等） |
| `android/app/src/main/res/` | 原生资源（splash 图标、window 背景、styles） |
| `docs/` | 整合后文档（见下表） |
| `E:\Temp\Deepseek\` | 项目外临时区：备份 *.bak*、打包日志 build-*.log、生成脚本 |

### docs/ 文档导航（23 份原文档已整合为 4 份，原文档归档于 `E:\Temp\Deepseek\docs-archive-20261015\`）

| 文档 | 查什么 |
|---|---|
| `docs/开发知识库.md` | 二次开发指南、PROJECT_DECISIONS、音源插件、onboarding 设计、UI 规范（字体/层级） |
| `docs/UI与适配核查记录.md` | 列表行/浮窗/卡片规范、16 条 UI 统一、尺寸类型、车机/横屏适配、P2 明细 |
| `docs/功能与代码核查记录.md` | 全量代码审查、功能全面核查、页面导航/返回层级、文档核对修正 |
| `docs/问题排查与避坑记录.md` | **卡顿、均衡器全套避坑、启动页白屏/系统 splash、开源启动图调研、gitee 发版避坑** |
| `docs/research/` | 6 份启动图源码调研分报告（保留未整合） |
| `readme.md` / `changelog.md` | 用户使用说明 / 版本历史（保留未动） |

---

## 5. 开发命令（在项目根或 android 目录执行）

| 操作 | 命令 |
|---|---|
| TS 类型检查 | `npx tsc --noEmit`（项目根） |
| Kotlin 编译验证 | `E:\xunwu\Deepseek\jiyuejie\android\gradlew.bat :app:compileDebugKotlin --console=plain` |
| 打包 arm64 | `android\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain` |
| 打包 universal（全 ABI，gitee 用） | `android\gradlew.bat assembleRelease --console=plain` |
| 产物位置 | `android\app\build\outputs\apk\release\app-{abi}-release.apk` |

**打包教训（重要）**：detached 后台打包会**卡死**（java CPU 零增长，日志停写）→ 必须用**前台方式**（PowerShell 前台执行，超时自动转后台后用 TaskOutput block 等待）；`--parallel` 也会挂起，勿用；arm64 约 8~15 分钟、universal 约 2 分钟。

---

## 6. 版本与发布流程

**版本号位置**（两处，改错会导致版本不生效）：
- versionName ← `package.json` 的 `"version"`（build.gradle `getVersion()` 读取，勿在 build.gradle 改字符串）
- versionCode ← `android/app/build.gradle` 的 `appVersionCode = 4000XX`

**发版步骤（每次用户要求"打包/上传"时）**：
1. 升版本号（package.json 无 BOM + build.gradle versionCode+1）
2. 前台打包 arm64 + universal → 重命名"极悦界 vX.Y.Z (abi).apk"到项目根
3. **GitHub push 源码**：直连重试 3 次失败 → 用 ghfast.top 镜像（命令与避坑见 `docs/问题排查与避坑记录.md` §6.3 及历史记录）；APK 不入库
4. **Gitee 更新**：**必须重建 release**（删 release → 重建 tag=latest + target_commitish=master → 分次上传 3 个附件，本地文件须预先命名成目标文件名）→ 同步更新仓库 `updates/version.json`（PUT contents，先 GET 拿 sha）→ curl -L 验证三链接 200。**"同名覆盖"是陷阱**（实为新增同名附件，链接仍指旧文件），完整流程见 `docs/问题排查与避坑记录.md` 第6章。

---

## 7. 当前状态与待办（交接时点）

**已完成（0.6.2.14 已发布并上传）**：
- 音效页底部"输出设备 + 效果器状态"只读诊断区（原生 getOutputDevice + 页面 diagRow）
- 系统 splash 图标音符放大至容器 75%（手机/平板占比统一）
- 均衡器全套：预设曲线跟随、自绘竖向滑块跟手修复（pageY-top 换算）、曲线粗细 vectorEffect 修复、宽窄屏响应式
- 扫描设置 UI 打磨、文档整合（23→4 份）

**待办/未决**：
- `docs/问题排查与避坑记录.md` 第6章（Gitee 发版避坑）**已写入但未提交 git**，接手后与用户确认是否提交
- 历史"待用户决策"项（如 UI 冲突 C14 歌单批量编辑入口等）原样保留在 `docs/UI与适配核查记录.md`，未代定论
- 卡顿根因（0.6.2.11）未最终定位，嫌疑与验证方法见避坑文档第1章
- gitee release 曾残留错误附件（重建后已干净），下次发版按第6章流程走即可

---

## 8. 交接备注（敏感信息）

- **GitHub PAT**：嵌在 `.git/config` origin URL 中（自动生效，可直接 push）；勿在文档/对话外泄露。
- **Gitee token**：账号 `xunwulove`，token 保存在原交接人（豆包）会话记忆里；接手 AI 需要时向用户索取，**不要写入本项目文档**（防文档泄露）。
- 项目约定沉淀：均衡器避坑已在文档第2章；gitee 发版避坑已在文档第6章；打包卡死/镜像推送等经验在本文 §5/§6。
- 用户偏好（长期）：见本会话 user-preferences（不主动打包、先备份、临时文件目录、平板优先、版本号规则等），上文 §2 已摘录关键项。
