# 极悦界 · 同类项目功能对标与改进建议（Peer Review）

> 调研日期：2026-10-29
> 对标对象：MusicFree 上游生态 / Listen1 / LX Music（洛雪音乐）/ Salt Player（椒盐音乐）/ NeriPlayer / Mihon（扩展生态）/ 椒盐UI（SaltUI）/ QuickJS 引擎社区
> 目标：输出**能落到极悦界当前架构（RN 0.76 + MusicFree 内核 fork + 自研音源可用率择优 + gitee 插件市场）上**的功能改进建议，每条有真实开源项目依据。
> 核实口径：【已核实】= 调研时实际抓取过仓库/官方文档/更新日志；【推断】= 基于已核实事实在极悦界架构上的落地推演，未冒充核实。

---

## 一、核实基线（已实际抓取）

| 项目 | 仓库 / 链接 | 与极悦界的关系 |
|---|---|---|
| MusicFree 上游 | https://github.com/maotoumao/MusicFree （最新正式 v0.6.0，2025-07-24；changelog 经 jsDelivr 镜像逐字核对） | fork 内核源头，RN 0.76 同栈 |
| MusicFree 插件清单 | https://github.com/maotoumao/MusicFreePlugins （plugins.json = `{desc, plugins:[{name,url,version}]}`，已实抓） | gitee 市场同源协议 |
| MusicFree 桌面版 | https://github.com/maotoumao/MusicFreeDesktop | 插件协议共用 |
| LX Music（洛雪） | https://github.com/lyswhut/lx-music-desktop ；https://github.com/lyswhut/lx-music-mobile ；文档 https://lxmusic.toside.cn （自定义源协议/下载/缓存/睡眠定时等官方文档页均已抓取） | 自定义音源协议最成熟；移动版同为 RN |
| Salt Player（椒盐音乐） | https://github.com/Moriafly/SaltPlayerSource ；椒盐UI 基础库 https://github.com/Moriafly/SaltUI | 本地播放体验标杆；手机/平板/车机三 UI 模式 |
| NeriPlayer | https://github.com/cwuom/NeriPlayer （实测文 https://blog.xlap.top/post/tech/2026-08-02/neriplayer/ ） | 新晋多源播放器：自动换源/缓存/下载设计 |
| Mihon | https://github.com/mihonapp/mihon （扩展系统源码索引页已抓取） | 扩展生命周期/市场协议/健康度最佳工程参考 |
| QuickJS | https://bellard.org/quickjs/quickjs.html （§3.4.1/3.4.8/3.4.9 已核实原文）；产品化封装 https://sebastianwessel.github.io/quickjs/docs/runtime-options.html | 极悦界跑 JS 音源插件的引擎层 |

> 排除项：「络腮胡」核实为非开源音乐项目；`ansgoo.github.io/music-free-site` 为 Extism/WASM 服务端刮削体系，与 maotoumao 的 JS 插件协议无关，均不采纳。

---

## 二、改进建议清单（15 条）

### ① 功能补强

### 1. 跨源同曲兜底搜索——给"可用率择优"补上最后闭环【P0 / M】
- **借鉴对象**：NeriPlayer（https://github.com/cwuom/NeriPlayer ）——实测文明确：网易云不可播/无直链/只回试听片段时，先音质降级，再由 `PlayerManagerNeteaseAutoSourceSwitch` 按歌名、歌手、时长评分自动匹配 B 站音源兜底。【已核实】
- **我们的现状**：可用率体系按**源维度**打分排序（播放60%+解析30%+搜索10%），解决"下次用哪个源"；但**正在播的这首歌**在首选源返回 403/空 URL/试听片段时，只切到次优源播"同歌在该源的 ID"，若该源没这首歌就直接失败。
- **差距**：缺"源里没有 → 去别的源搜同名同歌手"这一层。【推断】
- **建议**：播放失败（URL 空 / HTTP 403/404 / 实际音频时长 < 标注时长 50%）时：① 按可用率取次优播放源 → ② 用 `${歌名} ${歌手}` 重新 `searchMusic` → ③ 按 `|候选时长-歌曲时长|` 打分（≤2s 满分）取 Top1 → ④ 命中即播，并把"该源对这首歌不可播"作为负样本喂回可用率统计。全部复用现有插件 `search`+`play` 接口，无需改插件协议。
- **优先级**：P0（直接提升播放成功率，是"择优"故事的完整闭环）。**改动量**：M（播放管线加 fallback 分支 + 时长打分工具 + mini-player"已自动换源"提示）。

### 2. 插件市场版本化 + 更新通知/批量更新【P1 / M】
- **借鉴对象**：上游 MusicFree（https://github.com/maotoumao/MusicFree ）changelog：v0.1.1「插件页批量更新」、v0.1.2「打开软件自动更新插件、安装时不校验版本」、v0.0.1-alpha.5「网络源安装的插件可直接更新」；插件清单结构 `plugins:[{name,url,version}]` 已实抓。【已核实】LX Music 自定义源协议另有 `EVENT_NAMES.updateAlert`（插件主动发"源更新"弹窗，`log`≤1024 字符、`updateUrl` 引导更新，每次运行只调一次）：https://lxmusic.toside.cn/desktop/custom-source 【已核实】
- **我们的现状**：gitee 市场已做安装/卸载/探测/分档，但清单无 `version` 字段、无版本比对、无更新角标/一键更新。
- **差距**：插件作者发新版后老用户不知道，jsjiami 老插件长期漂移，卡死风险叠加。【推断】
- **建议**：① gitee 市场 index 每插件加 `version`（对齐上游三字段）；② 安装时持久化版本，进市场页/启动时 diff，展示"可更新 N 个"角标 + 一键批量更新；③ 加「启动时自动更新插件」开关（对齐上游 v0.1.2）；④ 可选在运行时桥新增 `onPluginUpdate` 事件给插件作者主动通知通道（兼容老插件不报错）；⑤ 更新后复用可用率探测重验该源。

### 3. 歌词多轨：翻译 / 罗马音 / 双语对照【P1 / M】
- **借鉴对象**：LX Music 自定义源协议 `lyric` 返回结构 `{lyric, tlyric, rlyric, lxlyric}`（翻译/罗马音/逐字卡拉OK 格式 `[mm:ss.xxx]<offset,duration>文字`）：https://lxmusic.toside.cn/desktop/custom-source 【已核实】；NeriPlayer 支持逐词/逐字高亮、翻译、音译、歌词偏移（同上实测文）。【已核实】
- **我们的现状**：有歌词本地缓存 + 搜索候选取词换歌词，但为单轨 LRC。
- **差距**：日语/英语歌曲体验明显弱于 LX Music。【推断】
- **建议**：① 插件 `lyric()` 返回类型扩为 `{lyric, tlyric?, rlyric?}`，老插件返回 string 时降级单轨；② 播放页歌词视图加"双语模式"开关（原文在上、翻译在下按时间戳逐行对齐）；③ 逐字高亮（lxlyric）作为 P2 延后。

### 4. 插件 Cookie 管理器 + cookie 容错统一【P2 / M】
- **借鉴对象**：上游 MusicFree changelog v0.0.1-alpha.4「插件新增 Cookie 管理器」、v0.5.0「修复插件网络请求无法传递 cookie」、2025-07-17「增强 cookie 处理容错」、v0.6.0「修复移动端 axios cookie 与桌面版不一致」。【已核实】
- **我们的现状**：已知痛点含"B 站音源挂载问题"，这类平台音源高度依赖 cookie/签名；fork 后未提及 Cookie 管理 UI 与容错。
- **差距**：登录态维持与排障吃力，用户无法自查/刷新 cookie。【推断】
- **建议**：移植 per-plugin Cookie 管理器（查看/清空入口），统一内核 axios 的 cookie jar 行为；与错误日志面板（见第 8 条）配套。

### 5. 资源缓存管理：迁出系统 cacheDir + LRU 上限 + 清理入口【P1 / M】
- **借鉴对象**：LX Music 移动版 v1.7.0 起歌曲缓存不再存系统缓存目录（防第三方清理软件误清），设置→其他→资源缓存管理 显式清理：https://lxmusic.toside.cn/mobile/datapath 【已核实】；NeriPlayer 用 SimpleCache + LRU，默认上限 1GB（同上实测文）。【已核实】
- **我们的现状**：有歌词本地缓存；未提及音频流缓存目录策略与清理入口。
- **差距**：车机/平板存储偏小，缓存膨胀比手机更突出；系统清理可能误删缓存导致重下。【推断】
- **建议**：① 播放缓存目录从默认 cacheDir 迁到 `filesDir/audio_cache`（app-private 非 cacheDir）；② 设置页新增"资源缓存"项：显示音频+歌词缓存占用、一键清理；③ LRU 上限默认 512MB（可设 256MB/1GB/无上限）；④ 首次启动做旧缓存迁移（参考 LX v1.7.0）。

### 6. 下载队列（持久化 + 并发控制 + 元数据嵌入）【P2 / L】
- **借鉴对象**：LX Music 桌面版下载（自定义路径、文件名模板、可选同步歌词与封面、按音质下载）：https://lxmusic.toside.cn/download 【已核实】；NeriPlayer：默认并发 6（可设最高 8）、队列持久化重启可恢复、保存歌词/封面/元数据/音频标签（同上实测文）。【已核实】注意：LX **移动版明确不支持下载**（https://lxmusic.toside.cn/mobile/faq ）。
- **我们的现状**：纯流媒体 + 歌词缓存架构，无下载功能。
- **差距**：车机地库/隧道等无网场景体验断裂。【推断】
- **建议**：RN 后台下载库（如 `react-native-background-downloader` 或 ExoPlayer DownloadManager）；队列持久化到 MMKV/AsyncStorage，崩溃恢复；并行拉歌词+封面写入 ID3/FLAC tag；文件名模板 `${artist} - ${title}.${ext}` 可配置；下载完成走本地播放管线，与在线播放统一接口。

### ② 体验优化

### 7. 把"可用率"升级为可见健康度：健康徽章 + 一键测试源 + 连续失败自动熔断【P1 / S-M】
- **借鉴对象**：Mihon 把加载/校验失败的扩展显式显示为 `NotLoaded(原因)`，细分 `Untrusted/Filtered/Unsigned/UnsupportedLibVersion/Malformed/Failed`，并标 `isObsolete/hasUpdate`（https://github.com/mihonapp/mihon ，扩展系统源码索引已核实）。【已核实】
- **我们的现状**：已有三维度可用率探测（比 Mihon 的"能不能加载"更细），但分只用于自动排序择优，UI 上无健康视觉、无主动熔断；反复超时/失败的"毒源"仍会被反复选中探测（浪费、卡顿）。
- **差距**：缺"把分变成可见健康度 + 主动摘除毒源"。【推断】
- **建议**：① 音源/市场卡片加健康徽章：绿(≥阈值)/黄(中)/红(差或熔断)，直接显示成功率+平均耗时；② 管理页加"测试此源"按钮，按需跑播放/解析/搜索/歌词四维度，逐项展示通过/失败；③ **熔断**：某源连续 K 次超时（接第 10 条的 `PluginTimeoutError`）或连续失败 → 自动置"熔断停用"，自动择优跳过，直到用户手动"重新测试"才恢复。

### 8. 插件错误日志 / 调试面板【P1 / M】
- **借鉴对象**：上游 MusicFree changelog：v0.0.1-alpha.12「调试配置及调试面板查看插件错误信息」、v0.1.0-alpha.5「开发选项-查看错误日志」、v0.1.2-alpha.2「调试面板打印插件 console 语句」。【已核实】
- **我们的现状**：可用率只记录成功率/平均耗时（聚合指标），看不到具体报错堆栈/console；jsjiami 卡死源难定位，分档跳过只是规避不是诊断。
- **差距**：缺诊断层。【推断】
- **建议**：插件执行 try/catch + console 转发落盘，开发者选项内"错误日志"弹窗按插件分组展示最近 N 条（含超时/网络/解析异常）；与可用率统计联动（点某源低成功率 → 直接看其错误日志）。对排查 B 站音源挂载、混淆插件卡死直接有效。

### 9. ErrorBoundary 崩溃隔离：坏插件不再整页白屏【P1 / S】
- **借鉴对象**：上游 MusicFree 2025-07-06 提交「chore: 新增ErrorBoundary」；changelog v0.6.0「优化播放器稳定性，减少闪退/播放自动暂停」。【已核实】
- **我们的现状**：混淆插件分档只跳过"自动挂载"，用户手动启用坏插件、或插件驱动的页面（搜索结果/歌单详情）抛错时仍可能整页白屏甚至带崩 JS 线程。
- **差距**：缺页面级兜底。【推断】
- **建议**：给插件驱动的关键页面（搜索结果、歌单详情、推荐歌单、播放页局部）包 React ErrorBoundary，错误时展示"页面出错，点击重试"并把错误信息上报到第 8 条日志面板；插件执行异常不冒泡到根。

### 10. 悬浮歌词 + 车机蓝牙歌词（MediaSession）【P1 / L】
- **借鉴对象**：Salt Player（https://github.com/Moriafly/SaltPlayerSource ）官方商店介绍确认：车载蓝牙歌词、系统级状态栏歌词、桌面歌词、悬浮窗歌词等（app.flyme.cn/apps/public/detail?package_name=com.salt.music 已抓取）。【已核实】
- **我们的现状**：多尺寸 UI 适配（手机/平板/车机），但歌词只在播放页；车机场景视线不能长时间盯中控。
- **差距**：缺多形态歌词，车机差异化未做满。【推断】
- **建议**：① Android 起 foreground service + `SYSTEM_ALERT_WINDOW` 做悬浮/桌面歌词（车机 ROM 一般默认允许悬浮窗）；② 通过 `MediaSession` 把当前歌词行/标题/艺术家推给车机蓝牙 AVRCP（大部分车机中控直接显示）；③ RN 侧只做"当前歌词行"事件桥。

### 11. 多尺寸 UI：升级为"手机/平板/车机"三档布局模式 + 断点测试纪律【P2 / M】
- **借鉴对象**：Salt Player 三档 UI——Standard Mobile UI / Tablet Mode（Pad 多列）/ Car Mode（车载简化 UI），官方适配小米 CarWith、vivo Joviincar（https://deepwiki.com/Moriafly/SaltPlayerSource/5.1-themes-and-customization 已核实）；椒盐UI 抽出的基础库 SaltUI（https://github.com/Moriafly/SaltUI ）；Android 官方 window size class 三断点方法论（https://kotlinlang.org/docs/multiplatform/compose-adaptive-layouts.html ）。【已核实】
- **我们的现状**：已做多尺寸适配且有 UI 规范文档，但大概率是"响应式弹性拉伸"而非按设备形态切布局。
- **差距**：车机应有**专门简化**的 UI（大按钮、少信息、驾驶友好），不是手机版硬塞。【推断】
- **建议**：① 用设备/窗口尺寸信号驱动三档（compact=手机单栏；expanded=平板多列；车机=独立 Car UI）；② 在现有 UI 规范文档加"车机模式简化规则"+"逐断点核对清单"（compact/medium/expanded 每个阈值查卡片、三级弹窗、插件徽章大小位置）；③ SaltUI 是 Compose 实现——**只借方法论与三模式划分，不引入代码**。

### ③ 性能 / 稳定性

### 12. QuickJS 看门狗中断：插件调用限时，死循环不再卡死整个 App【P0 / L】
- **借鉴对象**：QuickJS 官方文档——单 runtime 内**不支持多线程**（§3.4.1），`JS_SetInterruptHandler()` 是唯一能中断死循环的官方机制（"可用来实现执行超时，命令行解释器用它实现 Ctrl-C"，§3.4.9），配合 `JS_SetMemoryLimit`/`JS_SetMaxStackSize`（§3.4.8）：https://bellard.org/quickjs/quickjs.html 【已核实】；真实封装 `@sebastianwessel/quickjs` 已产品化：`executionTimeout`/`maxStackSize`/`memoryLimit`，超时后宿主 terminate worker 重启获得干净状态：https://sebastianwessel.github.io/quickjs/docs/runtime-options.html 【已核实】
- **我们的现状**：只在**挂载期**按文件大小/混淆度分档跳过；运行期 `search/parse/play/lyric/songlist` 无硬超时。jsjiami 死循环跑在哪个 runtime 里，哪个 runtime 就被永久占住——这就是"大混淆插件卡死整个软件"的**结构根因**。
- **差距**：缺运行期看门狗。【推断】
- **建议**：① native QuickJS 桥为每个 runtime 注册 `JS_SetInterruptHandler`；② 每次调用前写 deadline（建议 search 8s / 播放取流 10s / lyric 5s / songlist 6s），handler 读墙上时钟超时即中断，宿主包成 `PluginTimeoutError` 回传 RN；③ 同时设内存上限（单 runtime 64–128MB）+ 栈上限；④ 所有插件调用放独立 native 后台线程，绝不占用 RN JS 线程/UI 线程；⑤ 连续 N 次超时触发第 7 条熔断。

### 13. 每音源独立 JSRuntime（一源一 runtime），炸一个销毁重建【P0 / L】
- **借鉴对象**：QuickJS §3.4.1"多个 runtime 可共存但不可交换对象"——多 runtime 天然隔离（https://bellard.org/quickjs/quickjs.html ）【已核实】；Mihon 扩展哲学：每个扩展是独立安装的 APK、跑在独立进程/沙箱，单源崩溃不带垮阅读器（https://github.com/mihonapp/mihon ）【已核实】；`@sebastianwessel/quickjs`"宿主可随时 terminate 单个 worker 重启恢复干净状态"。【已核实】
- **我们的现状**：所有插件在同一宿主 JS 环境执行（MusicFree 内核模型），一源脏代码会污染/占住全局环境。
- **差距**：爆炸半径没有锁死。【推断】
- **建议**：① 改"一源一 runtime"（或小池 LRU 淘汰），插件脚本只在自己的 runtime eval，全局对象不共享；② 该 runtime 触发超时/内存熔断后 `JS_FreeRuntime` 销毁并按需重建，不留脏状态；③ **兜底重武器**（前两步仍不够时）：对体积大、混淆度高、用户确实要用的插件，放独立 Android `:plugin` 进程或 WebView 沙箱，BoundService/消息通道调用，子进程死了主进程（UI/播放）依然存活——Mihon"独立 APK"路线的 RN 版终极隔离。

### ④ 架构 / 通用性

### 14. 音源生命周期状态机：Available/Installed/Active/Disabled/Timeout/Malformed【P1 / M】
- **借鉴对象**：Mihon 扩展 sealed 状态机——`Extension.Available/Installed/Loaded/NotLoaded(Reason)`，`NotLoaded.Reason` 细分 `Untrusted/Filtered/Unsigned/UnsupportedLibVersion/Malformed/Failed`；`ExtensionManager` 以响应式 Flow 暴露状态；`ExtensionInstallReceiver` 用协程 `Channel` **串行化**安装/卸载事件防竞态；`checkForUpdates()` + `ExtensionUpdateNotifier` 主动更新通知（源码索引页 https://deepwiki.com/mihonapp/mihon/7-extension-system 已核实）。【已核实】
- **我们的现状**：有安装/卸载/探测/分档/择优，但缺统一、带"为什么不可用"细分原因的状态机；更新通知弱。
- **差距**：用布尔标志拼状态，排查与 UI 表达都吃力。【推断】
- **建议**：① 定义音源状态：`市场可见/已安装/运行中/用户禁用/超时熔断/版本不兼容/损坏`，单一响应式状态流推给管理页；② 安装/卸载/探测事件走串行队列，避免并发写坏插件表；③ 定期比对 gitee index 版本与本地已装版本，有更新在管理页角标提示一键升级。

### 15. 规范化 gitee 市场清单协议：apiMin/apiMax 兼容门 + sha256 校验 + 多仓库去重【P1 / M】
- **借鉴对象**：Mihon 扩展仓库 `index.min.json` 元数据字段 `name/pkgName/versionCode/libVersion/lang/isNsfw/apkName/apkUrl/iconUrl/repoUrl/signatureHash`；libVersion 必须落在 `LIB_VERSION_MIN(1.4)~MAX(1.5)` 区间否则 `UnsupportedLibVersion`；下载后校验签名 hash、`TrustExtension` 受信签名库；多仓库聚合按签名 key 去重、`ExtensionRepoConflictDialog` 处理冲突（源码索引页已核实）。【已核实】
- **我们的现状**：gitee 市场已有安装/卸载/探测，清单协议简单（大概率只有 name/url）。
- **差距**：缺兼容门（内核升级后旧插件直接跑崩）、完整性校验（下载包被替换无感知）、多仓库去重（未来加第二仓库冲突）。【推断】
- **建议**：① gitee 市场放静态 `index.json`（可再出 `.min.json`），每条字段：`id, version, apiMin, apiMax, sizeBytes, sha256, obfuscationTier(大混淆标记), iconUrl, downloadUrl, changelog`；② 加载前先看 `apiMin/apiMax` 是否覆盖当前内核版本，不匹配 → 进"版本不兼容"状态（接第 14 条），不强行挂载；③ 安装时按 `sha256` 校验下载包；④ 预留多仓库：合并时按 `id` 去重，冲突给用户选择。

---

## 三、落地顺序建议

1. **P0 先做（终结头号痛点）**：#12 QuickJS 看门狗 + #13 一源一 runtime——把"混淆插件卡死"从挂载期规避推进到**运行期熔断**，这是唯一能真正终结该问题的工程手段；同时 #1 跨源兜底（小改动高收益）。
2. **P1 小步快跑**：#7 健康徽章+熔断（复用现有探测基建，S-M 改动）→ #9 ErrorBoundary（S）→ #2 市场版本化更新 → #14 状态机 + #15 清单协议（为多仓库/更新打地基）→ #8 错误日志面板 → #3 歌词多轨 → #5 缓存管理 → #10 悬浮/蓝牙歌词。
3. **P2 按场景排**：#4 Cookie 管理（B 站源排障）→ #11 三档布局 → #6 下载队列。
4. **明确不抄**：上游 MusicFree v0.3.0「自动换源」——极悦界自研的三维度可用率择优换源精度已高于该被动换源，属**反超项**。

## 四、附注（自查/备查，未单列）

- **音源重定向对齐【推断】**：上游 v0.6.0 新增"音源重定向"功能，极悦界版本号晚于上游，**很可能 fork 已带入**——先在本地 `src/` 检索 redirect 相关逻辑确认；若未含再对照上游补齐（与可用率择优互补：重定向偏 URL 级修正，可用率偏源级切换）。
- **备查**（已核实存在但本期不建议做）：LX 睡眠定时、Salt Player 10 段 EQ、gapless 无缝播放（依赖源文件效果不稳）、NeriPlayer 歌单同步（独立大特性另立课题）、LX「不喜欢的歌曲」跳过规则（S 级随手可加）、`getMusicComments` 评论区（需插件生态配合）、桌面版自动更新（当前为 APK 分发，无自有渠道）。

## 五、与近期已做工作的衔接提示

- 本轮已提交/打包内容（音源可用率排序全序化、定向统计广播、弹窗/徽章口径统一）正好是 #7「健康度可视化」的地基；下一步做 #7 时**优先复用** `pluginReliability.ts` 的 `getDisplayByAbilitySync` 口径与订阅机制，避免两套口径再次分叉。
