# 极悦界 项目交接文档（给接手 AI）

> 交接时间：2026-10-15 ｜ 交接人：原开发助手（豆包） ｜ 接收人：新 AI 助手
> 本文档是接手本项目的**唯一必读入口**：先读本文，再按需深入 `docs/` 各文档。

---

## 1. 项目速览

| 项 | 值 |
|---|---|
| 项目名 | 极悦界（JiyueJie） |
| 性质 | MusicFree 系 二次开发 的 React Native 安卓音乐播放器（fork 上游 maotoumao/MusicFree） |
| 当前版本 | 0.6.2.15（versionCode 400026） |
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
- **音效**（JamesDSP 音效引擎）：基于 RootlessJamesDSP 核心算法库，NDK 编译 `libjamesdsp` → `libjiyuejie_dsp`（139 个 C 文件，见 `android/app/src/main/jniLibs`）；fork 本地 kotlinaudio 模块（`android/kotlinaudio/`，包名 `com.doublesymmetry.kotlinaudio.jamesdsp`），通过 `JamesDSPRenderersFactory` 向 ExoPlayer 注入 `JamesDSPProcessor`（AudioProcessor）；RN 桥 `jamesdsp/JamesDSPModule.kt`（经 `SoundEffectPackage` 注册，`NativeModules.JamesDSPModule`），RN 侧 `src/core/jamesdsp.ts` 统一封装。能力：**15 段均衡器 + 输出增益 + 限幅器 + 动态低音(DBB) + 立体声增强 + 混响(Progenitor2) + 电子管模拟 + 交叉馈送(Crossfeed) + 卷积器(IR，5 内置预设)**。旧系统 `android.media.audiofx`（`SoundEffectModule`，Equalizer/BassBoost/Virtualizer）已废弃，仅保留注册做兼容兜底，不再作为主引擎。均衡器/JamesDSP 相关避坑见 `docs/问题排查与避坑记录.md`。
- **状态管理**：jotai；配置持久化：react-native-mmkv + `src/core/appConfig.ts`；下载队列/下载任务表/已下载列表走 `@/utils/storage`（AsyncStorage 封装，key：`download-queue-v1`/`download-tasks-v1`/`downloaded-music-list`）——下载支持**断点续传**（确定性 `<uniqueKey>.<ext>.part` 临时文件 + Range 侧车 `.tail` 拼接；RNFS Android 原生 downloadFile 为截断写、无续传能力，详见 `src/core/downloader.ts` 注释）。
- **i18n**：`src/core/i18n/languages/`（zh-cn / zh-tw 两份 JSON；en-us 已于 0.6.2.15 移除）+ `src/types/core/i18n/index.d.ts` 类型声明（加 key 需三处同步：zh-cn.json、zh-tw.json、index.d.ts）。
- **响应式**：`src/hooks/useIsTablet.ts`（宽屏判定）+ `src/utils/tablet.ts`（`rpx = (x/750)*窗口短边`）。
- **其他关键依赖**：react-native-linear-gradient（渐变背景）、react-native-svg（自绘图形，如均衡器曲线/竖向滑块）、react-native-track-player、@react-navigation、expo-splash-screen（启动页）、react-native-permissions（通知/存储权限）。

---

## 4. 目录导航

| 路径 | 内容 |
|---|---|
| `src/core/` | 核心逻辑：appConfig（配置）、soundEffect（旧 AudioEffect 封装，已删迁移遗留死代码，仅保留挂载状态/诊断兜底）、jamesdsp（JamesDSP 封装）、downloader（下载：队列持久化 + 断点续传）、i18n、pluginManager（音源） |
| `src/pages/` | 页面：`setting/settingTypes/` 下为各设置子页（**soundEffectSetting.tsx = 音效页**） |
| `src/hooks/` `src/utils/` | useIsTablet、tablet（rpx）、checkUpdate（更新检测，链路依赖 gitee latest tag） |
| `src/constants/` | defaultPluginSubscription（音源订阅，gitee 同仓 sources/） |
| `src/types/` | TS 类型（含 i18n 声明） |
| `android/app/src/main/java/fun/upup/musicfree/` | Kotlin 原生模块（`jamesdsp/JamesDSPModule.kt` 音效桥、`soundEffect/` 旧 AudioEffect 模块 + 自绘 EQ 滑块 VerticalSliderView） |
| `android/kotlinaudio/` | fork 的 kotlinaudio 本地模块（`com.doublesymmetry.kotlinaudio.jamesdsp`：JamesDSPRenderersFactory/JamesDSPBridge/JamesDSPProcessor，ExoPlayer 音效注入） |
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
| TS 类型检查 | `npx tsc --noEmit`（项目根；exclude 已含 node_modules / MusicFree-upstream / jiyuejie-resources） |
| ESLint | `npm run lint`（= `eslint . --ext .js,.jsx,.ts,.tsx src --fix`；pre-commit 钩子。当前 **0 error / 145 warning**，error 清零后提交不再需要 `--no-verify`）。非交付代码排除见 `.eslintignore`（`src/lib/*`、`MusicFree-upstream/`、`jiyuejie-resources/`），**勿修改这些目录内容来迁就 lint** |
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

**已完成（0.6.2.15 已发布并上传；JamesDSP 音效引擎已接入）**：
- **音效引擎迁移**：系统 AudioEffect → **JamesDSP 核心算法库**（NDK `libjiyuejie_dsp`），ExoPlayer AudioProcessor 注入；能力 = 15 段均衡器 + 输出增益/限幅器/动态低音/立体声增强/混响/电子管/交叉馈送/卷积器(5 内置 IR)
- 均衡器 15 段**自绘竖向滑块**（弃用系统 SeekBar，轨道 2dp/圆球 12dp，竖直 y→value 触摸映射，saveLayer 防残影与黑屏）
- 音效页底部"输出设备 + 效果器状态"只读诊断区（原生 getOutputDevice + 页面 diagRow）
- 系统 splash 图标音符放大至容器 75%（手机/平板占比统一）
- 扫描设置 UI 打磨、文档整合（23→4 份）
- **下载队列持久化 + 断点续传**（2026.10.17 已发版）：AsyncStorage 落盘队列/任务表，重启恢复续跑；`.part` 确定性命名 + Range 侧车拼接（RNFS Android 无原生续传，已源码证实）；启动清理只删孤儿半截文件
- **lint 欠账清零**（2026.10.17 已发版）：src error 1117→0（排除非交付代码 + eslint --fix + 死代码删除），`npm run lint` exit 0，pre-commit 钩子恢复正常，提交不再需要 `--no-verify`
- **0.6.2.15 同版本号重新发布**（2026-10-17）：gitee `latest` + `v0.6.2.15` 双 release 重建（version.json + 两个 APK 附件），GitHub 源码 main 同步推送；因版本号不变，已装 0.6.2.15 用户收不到更新提示（手动覆盖安装）

**待办/未决**：
- 已装 0.6.2.15 的用户收不到本次重发提示（同版本号），如需覆盖提示需在下次升版本时发布
- 下一次发版应**升版本号**（0.6.2.16），避免同版本号重发的更新盲区

**已闭环（原待办，经代码核对确认）**：
- 卡顿问题已解决，不再卡顿
- 歌单批量编辑入口重复（D1）：已落地——`navBar.tsx` 三点菜单已删（仅留搜索），`playAllBar.tsx` ✎ 按钮改弹 `MusicListEditorDialog`
- UI 冲突 C14（PanelHeader / Dialog.Title 两套规格）：实际共存状态即候选B（承认两套规格为有意区分），右侧浮出层用 PanelHeader、居中弹窗用 Dialog.Title，各自内部一致

---

## 8. 交接备注（敏感信息）

- **GitHub PAT**：嵌在 `.git/config` origin URL 中（自动生效，可直接 push）；勿在文档/对话外泄露。
- **Gitee token**：账号 `xunwulove`，token 保存在原交接人（豆包）会话记忆里；接手 AI 需要时向用户索取，**不要写入本项目文档**（防文档泄露）。
- 项目约定沉淀：均衡器/JamesDSP 音效引擎避坑已在文档第2章（并新增 JamesDSP 集成避坑节）；gitee 发版避坑已在文档第6章；打包卡死/镜像推送等经验在本文 §5/§6。
- 用户偏好（长期）：见本会话 user-preferences（不主动打包、先备份、临时文件目录、平板优先、版本号规则等），上文 §2 已摘录关键项。
