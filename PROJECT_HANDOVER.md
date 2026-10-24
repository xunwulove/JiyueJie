# 极悦界 项目交接文档（给接手 AI）

> 交接时间：2026-10-15 ｜ 交接人：原开发助手（豆包） ｜ 接收人：新 AI 助手
> 本文档是接手本项目的**唯一必读入口**：先读本文，再按需深入 `docs/` 各文档。

---

## 1. 项目速览

| 项 | 值 |
|---|---|
| 项目名 | 极悦界（JiyueJie） |
| 性质 | MusicFree 系 二次开发 的 React Native 安卓音乐播放器（fork 上游 maotoumao/MusicFree） |
| 当前版本 | 0.6.2.16（versionCode 400027） |
| 包名 | fun.upup.musicfree |
| 项目根 | `E:\xunwu\Deepseek\jiyuejie` |
| 上游 | https://github.com/maotoumao/MusicFree（AGPL） |
| 上游快照 | `MusicFree-upstream/`（原版源码快照，2026-10-19 更新至上游 master=d118b18b3d，即 v1.0.0-beta.4 tag 指向 commit；1.0.0-beta 完整源码作者尚未公开，正式版发布后才上主分支） |

**远程仓库**：
- **GitHub**（源代码）：`github.com/xunwulove/JiyueJie`，main 分支。push 凭据已在 `.git/config` 的 origin URL 内（含 PAT，勿外泄、勿复制到公开文档）；**github.com:443 持续封锁，git 直连/镜像均不可靠——固定用 Git Data API 推送（api.github.com 走 REST，保留完整 commit 历史），脚本思路见 `docs/问题排查与避坑记录.md` §6.3**。
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

**待办/未决**：
- 已装 0.6.2.16 的用户收不到第七次重发提示（同版本号），如需覆盖提示需在下次升版本时发布
- 下一次发版应**升版本号**（0.6.2.17），避免同版本号重发的更新盲区

**已闭环（原待办，经代码核对确认）**：
- 卡顿问题已解决，不再卡顿
- 歌单批量编辑入口重复（D1）：已落地——`navBar.tsx` 三点菜单已删（仅留搜索），`playAllBar.tsx` ✎ 按钮改弹 `MusicListEditorDialog`
- UI 冲突 C14（PanelHeader / Dialog.Title 两套规格）：实际共存状态即候选B（承认两套规格为有意区分），右侧浮出层用 PanelHeader、居中弹窗用 Dialog.Title，各自内部一致

---

## 8. 交接备注（敏感信息）

- **GitHub PAT**：嵌在 `.git/config` origin URL 中（自动生效，可直接 push）；勿在文档/对话外泄露。
- **Gitee token**：账号 `xunwulove`，token 保存在原交接人（豆包）会话记忆里；接手 AI 需要时向用户索取，**不要写入本项目文档**（防文档泄露）。
- 项目约定沉淀：均衡器/JamesDSP 音效引擎避坑已在文档第2章（并新增 JamesDSP 集成避坑节）；gitee 发版避坑已在文档第6章；打包卡死/GitHub API 推送等经验在本文 §5/§6。
- 用户偏好（长期）：见本会话 user-preferences（不主动打包、先备份、临时文件目录、平板优先、版本号规则等），上文 §2 已摘录关键项。
