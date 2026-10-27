# 极悦界 项目交接文档（给接手 AI）

> 交接时间：2026-10-15 ｜ 交接人：原开发助手（豆包） ｜ 接收人：新 AI 助手
> 本文档是接手本项目的**唯一必读入口**：先读本文，再按需深入 `docs/` 各文档。

---

## 1. 项目速览

| 项 | 值 |
|---|---|
| 项目名 | 极悦界（JiyueJie） |
| 性质 | MusicFree 系 二次开发 的 React Native 安卓音乐播放器（fork 上游 maotoumao/MusicFree） |
| 当前版本 | 0.6.2.22（versionCode 400033） |
| 包名 | com.jiyuejie.music |
| 项目根 | `E:\xunwu\Deepseek\jiyuejie` |
| 上游 | https://github.com/maotoumao/MusicFree（AGPL） |
| 上游快照 | `E:\xunwu\deepseek\reference\musicfree-upstream\`（统一参考库，2026-10-19 更新至上游 master=d118b18b3d，即 v1.0.0-beta.4 tag 指向 commit；1.0.0-beta 完整源码作者尚未公开，正式版发布后才上主分支；2026-10 已移出本项目仓库，不随源码上传，已入 .gitignore） |

**远程仓库**：
- **GitHub**（源代码）：`github.com/xunwulove/JiyueJie`，main 分支。push 凭据已在 `.git/config` 的 origin URL 内（含 PAT，勿外泄、勿复制到公开文档）；**github.com:443 持续封锁，git 直连/镜像均不可靠——固定用 Git Data API 推送（api.github.com 走 REST，保留完整 commit 历史），脚本思路见 `docs/问题排查与避坑记录.md` §6.3**。
- **Gitee**（发布仓库，非源码仓）：`gitee.com/xunwulove/jiyuejie`，master 分支。结构：`updates/version.json`（更新兜底）+ `sources/`（音源订阅：`plugins.json` 正式 21 源 + `test-plugins.json` 测试订阅，探测软件依赖）+ Release tag `latest`（主更新地址，附件 = version.json / app-arm64-v8a-release.apk / app-universal-release.apk，**文件名不可变**）。gitee token 见原交接人对话记录，勿写入本文档。
  - **仓库分工硬约束（2026-10-26 确认）**：**gitee 只提交发布仓文件**（README / `sources/` / `updates/` / release 附件），**源码不进 gitee**——本地 main 是完整源码树（src/docs/tools/android…），**禁止把本地 main push 到 gitee master**（会把整套源码灌进公开仓、且删除 gitee 的 `sources/test-plugins.json`）。gitee 侧文件更新一律走 **API contents PUT**（GET sha → PUT base64+sha，见 `docs/音源全流程.md` §六 发布流程）；源码只存本地与 GitHub（Git Data API 推送）。

---

## 2. 接手前必读（用户硬约束，违反会导致返工）

1. **不主动打包**：除非用户明确要求，绝不执行打包/构建命令、不升版本号、不产出 APK。
2. **较大代码改动前必须备份**被改部分到 `E:\Temp\Deepseek\`（备份命名 `<文件>.bak<序号>-<日期>`）。
3. **尽量不写 C 盘**；临时文件（日志/中间产物/备份）统一放 `E:\Temp\Deepseek\`，不散落 temp 根目录。
4. **UI 改动默认以平板/车机版为主**，手机版自适应由助手自行决定。
5. **打包版本规则（2026-10 用户最新偏好，取代旧的"每次打包 +0.0.1"）**：**本地打包（构建 APK 验证/装机）时不更新版本号**——`package.json` version 与 `android/app/build.gradle` `appVersionCode` 均保持不变；仅**正式发布 gitee/GitHub** 时才升版本号（versionName 末位 +0.0.1、versionCode +1）；改 `package.json` 必须 **UTF-8 无 BOM** 写入（BOM 会导致 RN autolink 解析失败）。
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
| `tools/` | 音源辅助工具（见下）：verify_sources（音源验证脚本）、source-probe（音源探测软件） |

### tools/ 音源辅助工具（2026-10-25 归置）

| 工具 | 定位 | 用途 |
|---|---|---|
| `tools/verify_sources/` | 开发期 Node 脚本 | 电脑批量验证音源可用性（搜索→取链→可播→下载）：`verify_mf.cjs`（MusicFree 五维）/ `verify_downloads.cjs`（下载+语法），音源脚本存 `dl2/`，结果 probe-report.json 输出（2026-10-25 已删除洛雪 LX 体系，App 只支持 MusicFree 格式） |
| `tools/source-probe/` | 装机实测 App（独立 RN 工程，自带 git） | 打包「音源探测」APK 装机实测各音源能否真实搜索/播放；主仓库 `.gitignore` 已排除，仅文件归置在 tools/ |

> 关系：verify_sources = 电脑脚本快速判「可搜 + 可取链 + 可下载」；source-probe = 真机跑引擎判「可播」。
>
> **source-probe 当前版本 0.1.6**（2026-10-25 发版，versionCode 7）：报告升级 v2（五档分类 🟢全通/🟠可解析不可播/🟡半可用/🟣歌单型/🔴死源 + 19 列全字段明细 + classifyPlayError 归一聚合）+ 播放验证静音（`setVolume(0)`，不抢焦点）；构建修复（webview 变体失败=缓存脏，清缓存后三 ABI 全量构建 37m11s）。发版记录/打包避坑/已知问题（checkUpdate 误用主仓库 version.json）见 `tools/source-probe/PROJECT_HANDOVER.md` §9。

### docs/ 文档导航（原 23 份已整合为主文档，原文档归档于 `E:\Temp\Deepseek\docs-archive-20261015\`）

| 文档 | 查什么 |
|---|---|
| `docs/开发知识库.md` | 二次开发指南、PROJECT_DECISIONS、音源插件、onboarding 设计、UI 规范（字体/层级） |
| `docs/UI与适配核查记录.md` | **UI 现行规范（精简版，2026-10-25）**：字号/图标档位、全局组件规范、列表行规格、弹窗/面板视觉、布局与尺寸原则（短边法/rpx保留层）、音源进度弹窗与卡片标识、浮窗层级编码规范（**第8章**）；历史核查流水已归档至 `docs/archive/功能与代码核查记录.md` |
| `docs/问题排查与避坑记录.md` | **卡顿、均衡器全套避坑、启动页白屏/系统 splash、开源启动图调研、gitee 发版避坑** |
| `docs/音源全流程.md` | **音源全流程**（来源参考库全集→验证链路→档位处理→产出→发布→App生效；含 `tools/verify_sources`/`tools/source-probe` 用法与 probe_plugin.js 增强工具）；**§8 测试执行 SOP**（2026-10-25 固化：范围决策→电脑初筛→建测试音源依托 gitee→用户探测软件实测→报告回流→A档入库；测试结果不落档） |
| `docs/archive/` | 历史归档（不随主文档导航，需时自取）：功能与代码核查记录、多用户画像测试走查报告 + 走查子报告（6 份）、research 启动图调研汇总、音源清单-20261022 |
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
3. **GitHub push 源码**：**固定用 Git Data API 推送**（`api.github.com` REST：逐 commit 上传改动 blob → base_tree 建 tree → 建 commit → PATCH ref；保留完整历史，直连 github.com:443 持续封锁勿再试 git push/镜像）；APK 不入库
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
- **第二次 0.6.2.15 同版本号重新发布**（2026-10-18）：去算法混响"关闭"预设胶囊（UI 索引语义不变，底层 +1 映射）、全部文字胶囊统一固定 36/16/18（删除 rpx 缩放与平板双档，消除 600dp 临界跳变）、WebDAV 设置改三级浮窗（修复原面板输入弹不出键盘）、浮窗遮罩 elevation 点击穿透修复、音效页文案调整（删 eqDesc/hint/混响胶囊下说明，混响行加副标题）、**两次闪退修复**（播放补充信息 artwork 空串导致 RNTP 崩溃；JamesDSP nativeInit 与 setEqualizer 并发竞态——JNI 层加 pthread 互斥锁）；gitee 双 release 重建 + GitHub main 同步推送；同版本号更新盲区同上
- **第三次 0.6.2.15 同版本号重新发布**（2026-10-18 深夜）：**两次闪退修复打包生效**（此前 6aaa13c 提交未打包、用户端复现崩溃后紧急重发）+ 底部面板（Panel）遮罩/面板补 elevation 15300/15310（对称 Dialog 侧修复：三点菜单等 Panel 浮窗被播放条等 elevation 元素盖住唤不出、点击穿透）+ 搜索失败音源改进（翻页从失败页重试、同轮失败自动重试一次）；gitee 双 release 重建 + GitHub main 同步推送；同版本号更新盲区同上
- **第四次 0.6.2.15 同版本号重新发布**（2026-10-19）：**播放页与迷你播放条显示当前音质标识**（`useMusicQuality()` jotai 原子实时刷新；全屏播放页 titleBlock 歌手行下居中标签，迷你播放条 `标题 ·高音质`）；gitee 双 release 重建 + GitHub main 同步推送；同版本号更新盲区同上
- **第五次 0.6.2.15 同版本号重新发布**（2026-10-19）：**平板浮窗穿透修复**——Panel/Dialog 浮窗（tabletBound 右 70% 遮罩）时左 30% 播放区补透明触摸拦截层（`panelBase.tsx` + `dialogs/base/index.tsx` 的 `tabletLeftBlocker`），点击播放区/播放条只关闭浮窗、不再穿透触发 MusicBar tapGesture 进全屏播放页；elevation 15300/15310/16300 层级未动；gitee 双 release 重建 + GitHub main 同步推送；同版本号更新盲区同上
- **0.6.2.16 正式发版**（2026-10-19）：**平板浮窗穿透彻底根治**——Panel 遮罩交互层改 100% 全屏覆盖（点击浮窗外任意区域关闭浮窗，视觉暗色层仍限右 70% 内容区、不压暗左播放区）、Dialog 新增与弹窗本体同级同 elevation 16300 的全屏点击拦截层 `screenTouchBlock`，删除早期两个 blocker 补丁层；plugins.json 99→98（8 个死链更新 + 移除腾讯音乐源）；gitee 双 release 重建 + GitHub main 同步推送；已装 0.6.2.15 用户收到更新提示
- **第七次 0.6.2.16 同版本号重新发布**（2026-10-19）：**歌单歌曲列表与全屏播放页三点菜单改为三级浮窗 Dialog**（`MusicItemOptionsDialog`/`MusicItemLyricOptionsDialog`，根治底部面板被 KeyboardAvoidingView/覆盖层压住只见阴影的问题）+ 核查问题批量修复——本地歌单详情页补 Header（收藏/批量入口恢复）、全屏版三点菜单文案走 i18n（9 新 key 三处同步）、Toast 补 elevation 16320（浮窗打开期间可见）、播放队列歌曲行加三点菜单、歌单删除加确认弹窗、平板全屏播放页弹窗整屏居中（Dialog 平板分支读 `fullPlayingAtom` 对齐 panelBase）；**下载音质选择改三级弹窗并高亮当前音质**（`MusicQualityDialog`，play=播放音质/download=默认下载音质）；底部面板标题圆角直角阴影修复（wrapper `overflow:"hidden"` 裁剪直角渐变标题）；gitee 双 release 重建 + GitHub main 同步推送；同版本号更新盲区同上
- **未发版批次（2026-10-20，待下次升版本一并发布）**：**浮窗层级编码规范落地**——4 位编码（主层 01/05/09/13 间隔 4 + 同层近似区分 01/05/09/13，zIndex=elevation 统一：页面 0101 / 二级页 0501 / 沉浸播放 0505 / 沉浸 UI 0506 / Panel 遮罩 0509 / Panel 本体 0513 / Dialog 拦截 0901 / Dialog 容器 0905 / Dialog 本体 0909 / Toast 1301，elevation 由 1.5 万级降至 513~1301，详见 `docs/UI与适配核查记录.md` 第 8 章）；**弹窗点击外部退出**（backContainer 内补全区域关闭层 + 淡入层 `pointerEvents="none"`，手机/平板/全屏播放一律点外部退出）；**本地音乐音质标识显示但禁点**（本地单音质，标签保留、点击无反应）；**全屏播放页三点菜单行高 smallest(36)**（按 UI 规范档位，非压缩）；**平板弹窗宽度跟随 60% 限定**（全屏播放层只改位置不改宽度）；**自动搜索歌词默认开启**（`lyric.autoSearchLyric` 默认 true）；本地 commit `6b9cbbb`→`0e2e9d0` 共 5 个未推送，未打包、未改版本号
- **第九次 0.6.2.16 同版本号重新发布**（2026-10-20）：**自制封面缺陷修复**——合成封面改纯底图（去除歌名文字与底部压暗遮罩 `rgba(0,0,0,0.36)`，`syntheticCover.tsx` 去掉 titleWrap/Text，`songCover.tsx` 不再传 title）；修复播放页/全屏播放页合成封面「左右显示一半」（根因=FastImage 用 `StyleSheet.absoluteFill` 尺寸=容器 box，但取图位置平移量按真实图 cover 溢出算，导致把只有 box 大小的 view 移出容器露出背景；修复=FastImage 显示尺寸改显式 cover 缩放真实尺寸 `drawW×drawH` + `position:absolute;left/top:0`，容器 overflow hidden 裁掉溢出一侧后再 transform 平移 offset）；沉浸播放页保持不显示自选图（`immersiveLayer` 不集成）。本次打包同时纳入上一条「未发版批次」全部改动（浮层层级编码规范落地等）；gitee 双 release 重建 + GitHub main 同步推送；同版本号更新盲区同上
- **第十次 0.6.2.16 同版本号重新发布**（2026-10-20）：**沉浸播放页右边封面占位无封面时显示默认封面**（`immersiveLayer.tsx` coverBlock 无 `artwork` 时由 ♪ 占位改为 `ImgAsset.albumDefault`；背景/渐变/光效保持原样，不集成自制合成封面底图）；gitee 双 release 重建 + GitHub main 同步推送；同版本号更新盲区同上
- **第十一次 0.6.2.16 同版本号重新发布**（2026-10-20）：**更新订阅清单拉取改为并发**（`pluginManager/index.ts` `updatePluginsFromSubscription` 阶段1 由串行 for 循环改为 `runWithConcurrency` worker 池并发拉取，上限 10，多个订阅地址同时拉取不再被慢地址拖住整批；`needDownload` 并发 push 原子安全、版本对比不变）；gitee 双 release 重建 + GitHub main 同步推送；同版本号更新盲区同上
- **0.6.2.17 正式发版**（2026-10-20）：并入此前「未发版改动 2026.10.19」20 项（浮窗 Dialog 化、音质标识循环切换、浮窗层级编码规范、弹窗外部退出、自制封面底图+取图位置、听歌时长事件流统计等，详见 changelog）+ **弹窗 UI 全量统一**（标题行去分割线/列表项统一分隔线/歌曲菜单信息头渐变）+ 批量编辑弹窗性能修复 + **歌词本地缓存/更换** + 下载提示修复 + 自选封面取色优先 + Toast i18n 整理/删除 Hermes 采样；**插件批量安装性能优化**（下载/挂载分离 + 分批让出 JS 线程修混淆插件卡顿 + 进度显示 + 批量下载超时放宽 30s + 音源拉取分档 >300KB 手动安装 + gradle 堆内存 2G）
- **0.6.2.18 正式发版**（2026-10-20）：手机版卡片标题 2 行、订阅源可删除恢复默认、下载超时恢复全局
- **0.6.2.21 正式发版**（2026-10-21，versionCode 400032）：**音源探测播放验证方案 B + 50 个精选音源清单**（Node 沙箱真实搜索验证，`音源清单-20261022/`）+ **热门搜索改纯实时接口**（腾讯 musicu.fcg 主源 + 酷我 hotword.s 备源，移除本地搜索排行，6h 缓存）+ **首页三卡与统计页完全同源**（播放事件流真实收听秒数、短播<30s 剔除，统计页第二卡改"播放次数"）+ 本地歌曲时长双重兜底与重复去重 + 弹窗分隔线修复 + **平板/手机布局判定重写**（竖屏手机全宽 / 横屏车机平板双栏）+ **三 ABI 固化**（arm64-v8a/armeabi-v7a/x86_64）+ 关闭 release 构建期 lintVital
- **探测功能补全（2026-10-25，未发版）**：`src/core/probeService.ts` 由 search/parse/play 三维补全为 **5 维探测**（搜索/解析/播放/歌词/歌单）——歌词 = 搜索结果第 1 首 `getLyric`（5s 超时）返回非空记 lyric 维度；歌单 = `getRecommendSheetTags`（8s）→ 真实歌单（有封面）或标签 `getRecommendSheetsByTag`（8s）→ `getMusicSheetInfo`（8s）歌曲列表非空 + 歌单第 1 首解析（深度模式再静音真实可播），结果记入**独立 recommend 统计**、不写合成可用率（歌单显示有问题但播放路径正常的源不被拖累）；**总预算 60s→120s**（`PROBE_BUDGET_MS`），单步调用加超时保护，其余约束（串行 1.5s 间隔、互斥、失败不重试）不变；检测完成 Toast 增加「可歌词 n/N · 歌单 n/N」；`tsconfig.json` exclude 补 `tools/source-probe`（修复归置后主仓库 tsc 误扫独立工程）。**自动探测记账按维度化**（同日追加）：`lastRuns` 由"整源单时间戳"升级为**每源每维度时间戳**（旧数据 number 自动归一化兼容），自动探测**只执行缺失/ >24h 未探测的维度**（`probeSingle` 支持维度级执行，依赖前置自动补全：parse/lyric/play 需搜索样本自动跑 search，play 需解析地址自动跑 parse；已验维度不重跑，单维失败/超时不整源豁免）；play 维度只由手动深度维护；**真实播放成功刷新该源 play 维度探测时间戳**（`refreshPlayProbed`，trackPlayer 播放成功判定处调用——播放过即证明可播，24h 内不再重复探测播放功能；失败不刷新留给探测核实）
- **切歌预取方案 B（2026-10-25，未发版）**：**消除歌单连播切歌空白**——根因 = RNTP 队列只放「当前曲 + fake 占位」（`trackPlayer/index.ts` setQueue），切歌那一刻才 `getMediaSource` 动态解析 + load + 缓冲；`prewarmApiSongs` 只预热接口歌曲搜索匹配、不预取 URL 不预缓冲。实现：**当前曲剩余 ≤15s**（`PlaybackProgressUpdated` 判定，节流每 index 一次、单曲循环跳过）→ `prefetchNextTrack` 解析下一首真实源（接口歌曲先 `matchMusic` 匹配 + `replaceInPlayList` 原位替换；按音质顺序 `getMediaSource`）→ **`ReactNativeTrackPlayer.add([真曲], 1)` 插入队列 index 1（替换 fake 位，add 不重置当前播放）→ ExoPlayer 播放当前曲时预加载队列下一项**，播完自动无缝切歌；`PlaybackActiveTrackChanged` 新增**真曲转正分支**（index 0→1、非 fake/占位 URL、与 `prefetchCache` 匹配）→ `setCurrentMusic`/`setQuality` 同步 + `await remove([0])` 压缩队列（[cur,next,fake]→[next,fake]），下一轮预取继续。兜底：预取任何失败静默作废（切歌走原 `play` 链路）；预取 URL 失效 → `PlaybackError` → `handlePlayFail` 重试/换源（现有机制）；`play()` 入口与 `clearPlayList` 作废/清理预取缓存
- **0.6.2.22 正式发版**（2026-10-25，versionCode 400033）：并入此前「未发版批次」（探测补全 5 维、切歌预取方案 B）+ **下载扩展名 MIME 校正**（`Mp3UtilModule.kt` 新增 `getMimeType` 原生方法 + `downloader.ts` mimeToExt 映射，修复 flac/aac/m4a 无后缀 CDN 直链按错误扩展名解析导致封面/歌词内嵌静默失败的 P2 根因）+ **探测软件报告 v2**（`tools/source-probe` 五档分类 🟢🟠🟡🟣🔴 + 19 列全字段明细 + classifyPlayError 归一聚合）+ **播放验证静音**（`setVolume(0)`）；gitee `updates/version.json` 更新至 0.6.2.22（download 指向 v0.6.2.22 双 APK），latest 与 v0.6.2.22 双 release 重建（arm64/universal 附件），3 条下载直链验证 200；**仓库整理**：filter-branch 从历史 commit 移除误跟踪的 `updates/app-*-release.apk`（61.8MB/commit，已跟踪文件不受 .gitignore 约束所致），源码仓库体积回归；GitHub 源码推送已启动（Git Data API，clean 链 8 commit）

**待办/未决**：
- ✅ **【已修复·装机验证 2026-10-26】歌词/歌曲封面内嵌功能不能用**（原 2026-10-25 用户实测标记，已闭环）：根因=**MusicFree 插件 `getLyric` 约定返回 `{rawLrc, translation?}` 对象**（碳酸Meting/碳酸酷我/GD音乐台实测均如此），`downloader.ts:591-604` 直接把返回对象当字符串传给 `Mp3Util.setMediaTag({lyric})`，原生 `meta.getString("lyric")` 遇 Map 值抛异常 → 内嵌歌词静默失败；封面走 artwork（URL 字符串）所以一直正常；播放链路 `lyricManager.ts` 正确取 `lrcSource.rawLrc` 所以播放显示正常——**仅下载内嵌链路漏归一化**。修复（commit `79952c6`，tsc 通过）：①`downloader.ts` 取词结果归一化为字符串（`typeof lrc==="string" ? lrc : lrc?.rawLrc ?? lrc?.lrc ?? ""`），空串跳过；②`Mp3UtilModule.kt` `setMediaTag` 歌词字段类型防御（`meta.getType("lyric")==ReadableType.String` 才写，否则跳过而非抛异常）；③errorLog msg 改 `String()` 保证留痕。**装机验证（2026-10-26，0.6.2.22 本地打包）**：用户实测下载歌曲歌词+封面均可内嵌 ✓
- git 仓库已由接手 AI 整理：游离头恢复为本地 `main` 分支；根 `plugins.json`（97 源）与 `plugins_verify.json` 已于整理时删除，`docs/archive/音源清单-20261022/`（50 源精选，已归档）保留为历史探测产物；过时根 `version.json` 已移除（权威在 `updates/version.json`）；开源参考源码统一移至 `E:\xunwu\deepseek\reference\`（`musicfree-upstream` 不随本仓库上传，已入 .gitignore）；本地 `main` 与远端 `origin/main` 提交历史分叉，**不 merge 远端，推送固定走 Git Data API**。**0.6.2.22 发版（2026-10-25）**：本地 HEAD `3453afc`（filter-branch 已从历史移除误跟踪 APK blob 的干净链 8 commit）；gitee 发版已完成（latest/v0.6.2.22 双 release + version.json 更新 + 3 直链 200）；**GitHub 源码推送已按用户指示暂停**，续推时用 `E:\Temp\Deepseek\gh_push.py`（含磁盘缓存）以 `10a3c48` 为父起点、范围 `2b0241b..3453afc` 重跑即可

**已闭环（原待办，经代码核对确认）**：
- **订阅同步清理机制**（2026-10-26）：插件来源标记 + 连续 2 轮自动卸载（详见 `docs/音源全流程.md` §7.1）——`Plugin.sourceTag`（`{type:"subscription",url}` / `{type:"manual"}`）+ `missingRounds` 持久化（plugin.cache MMKV，lazyProps **与 setup 非 lazy 分支均恢复**，懒加载关闭不失效）；安装入口打标（订阅=subscription+订阅地址、手动导入/深链/备份恢复=manual）；`installFromCode`/`installPluginFromLocalFile` 替换同名旧插件时**继承 sourceTag 且 manual 永不被覆盖**（覆盖"维护者更新后软件内更新插件把标记弄丢"场景）；清理逻辑抽成公共方法 `cleanupSubscriptionPlugins`，**自动更新 `updatePluginsFromSubscription` 与手动「更新订阅」`onSubscribeClick` 共用**——来源=对应订阅地址且连续 2 轮不在清单 → 复用 `uninstallPlugin` 自动卸载，手动/其他订阅源不受影响；**跨订阅误删防护**：同名插件仍在本轮其他订阅清单中 → 只累计不卸载；README/音源全流程/PROJECT_HANDOVER 已同步
- ✅ **撤销声明解除（2026-10-26）**：前两条（扩展名 MIME 校正、封面+歌词内嵌）原因用户实测内嵌不生效而撤销闭环，现根因已定位（getLyric 返回对象未归一化，见"待办/未决"首条已修复）并装机验证通过，**闭环声明恢复**。
- **下载内嵌扩展名错配（P2）修复**（2026-10-25 已实现，2026-10-26 验证生效）：原生 `Mp3UtilModule.kt` 新增 `getMimeType`（MMR 探测真实 MIME）；`downloader.ts` copyFile 后按 `mimeToExt` 映射（兼容 m4a 报 `video/mp4`）探测校正——扩展名不符且受支持则 `moveFile` 改名后再内嵌/入库；失败保持原路径不影响入库。
- **下载音乐封面+歌词内嵌**（2026-10-25 核查确认已实现，2026-10-26 装机验证生效）：`downloader.ts:516-551` 下载完成 copyFile 后——①有 artwork → `Mp3Util.setMediaCover` 内嵌封面（网络 URL 下载转 JPEG，带 UA + 防盗链 Referer 重试 + 长边 >1024 降采样防 OOM，jaudiotagger 写 APIC）；②音源有 `getLyric` → 拉歌词 → **归一化为字符串**（`79952c6` 修复点，原直传对象导致原生 getString 抛异常）→ `Mp3Util.setMediaTag({lyric})` 写 LYRICS/USLT 标签（顺带 `recordLyricResult` 记歌词可用率）；两者失败均不影响入库（warn 留痕）。读取闭环：`localSongCover.tsx` 本地歌异步读内嵌封面显示；`plugin.ts:1057-1098` 播放本地歌时从文件读封面/歌词/元数据（内嵌即生效）
- **歌单可用率以「可播放」为前提——按方案 A 关闭**（2026-10-25）：探测链路（`probeService` 歌单段）已按"显示 + 第一首可解析/可播"判定写 `recordRecommendResult`；**推荐歌单页/首页横滑区真实拉取（`fetchPluginRecommendSheets`）保持轻量**（只记非空，不加额外抽查），可播前提由探测链路覆盖（play 维度已有真实可播数据，排序按可用率+耗时隐式覆盖）；决策理由=真实拉取加抽查会拖慢推荐区（额外串行 getMusicSheetInfo+getMediaSource），不划算
- **歌单可用率时延维度**（2026-10-25 已实现）：`recordRecommendResult` 增记拉取耗时（`timeCost/timeCount` 平均耗时 + `getRecommendLatencySync`）；`fetchPluginRecommendSheets`（超时/空壳/异常分支）与 `probeService` 歌单探测段统一计时；择优排序成功率相同 → 有耗时数据的优先、平均耗时短者优先
- 卡顿问题已解决，不再卡顿
- 歌单批量编辑入口重复（D1）：已落地——`navBar.tsx` 三点菜单已删（仅留搜索），`playAllBar.tsx` ✎ 按钮改弹 `MusicListEditorDialog`
- UI 冲突 C14（PanelHeader / Dialog.Title 两套规格）：实际共存状态即候选B（承认两套规格为有意区分），右侧浮出层用 PanelHeader、居中弹窗用 Dialog.Title，各自内部一致

---

## 8. 交接备注（敏感信息）

- **GitHub PAT**：嵌在 `.git/config` origin URL 中（自动生效，可直接 push）；勿在文档/对话外泄露。
- **Gitee token**：账号 `xunwulove`，token 保存在原交接人（豆包）会话记忆里；接手 AI 需要时向用户索取，**不要写入本项目文档**（防文档泄露）。
- 项目约定沉淀：均衡器/JamesDSP 音效引擎避坑已在文档第2章（并新增 JamesDSP 集成避坑节）；gitee 发版避坑已在文档第6章；打包卡死/GitHub API 推送等经验在本文 §5/§6。
- 用户偏好（长期）：见本会话 user-preferences（不主动打包、先备份、临时文件目录、平板优先、版本号规则等），上文 §2 已摘录关键项。
