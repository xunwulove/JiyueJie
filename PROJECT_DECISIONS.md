# 极悦界（MusicFree fork）项目决策记录

本文件记录项目级决策与约束，供后续会话直接参考，避免重复讨论。

---

## 版本与插件兼容策略（2026-10-08）

**背景**：插件安装时，App 会校验当前版本号是否满足插件声明的 `appVersion` 范围（semver，如 `>=0.6.0 <0.7.0`，实现见 `src/core/pluginManager/plugin.ts` checkValid）。不满足 → 插件标记"与 App 版本不兼容"，无法使用。部分插件不声明 `appVersion`，永不参与校验。

**现状**：极悦界版本 0.6.2；主流音源插件生态（musicfree-plugins）范围围绕 MusicFree 0.6.x 声明，当前兼容。

**决策**：
1. **主策略**：版本号跟随 MusicFree 上游版本线（0.6.x 小版本递增），不主动跳大版本；插件生态更新范围时自然兼容。
2. **跳大版本预案**：若未来需跳到 1.x，实施"兼容线校验"——校验时用映射的兼容版本（如 0.6.2）匹配插件 `appVersion`，而非真实版本号；真实版本号照常升，插件兼容不受影响。
3. **兜底**：可把"不检查插件版本"（`basic.notCheckPluginVersion`）默认值改为开，代价是失去兼容性提示。

---

## 界面层级最深约束（2026-10-08）

**决策**：一般**三级页面就是最底层界面**（不再往下层）；迫不得已需要在三级页面下再弹出窗口时，**弹出的页面仍必须遵守三级页面的规范**（顶部渐变标题行、底部等高同渐变选项行、平板右内容区中心定位等）。

---

## 发版与更新链路规范（2026-10-09）

**规范**（已实施并验证链路）：
1. **版本号**：跟随上游 MusicFree 0.6.x 线小步递增。当前 **0.6.2.1**（versionCode 400012）。`package.json` 的 `version` 是唯一版本源（`android/app/build.gradle` 的 versionName 读取它）；versionCode 在 build.gradle 手动递增。compare-versions 支持多段版本号（`0.6.2.1 > 0.6.2` 成立，可触发更新检测）。
2. **更新源（gitee）**：仓库 `xunwulove/jiyuejie-updates`，**固定 tag `latest` 的 release 附件直链**（文件名固定：`version.json` / `app-arm64-v8a-release.apk` / `app-universal-release.apk`，链接因此不随版本变）；仓库根 `raw/master/version.json` 仅作兜底（gitee raw 有反爬）。`src/utils/checkUpdate.ts` 的 updateList 已固定，**发版零代码改动**。
3. **发版流程**（每次发版照做）：
   - `cd android; .\gradlew.bat assembleRelease`（产物含 ABI 拆分 + universal，共 5 个 APK）；
   - 升 `package.json` version 与 build.gradle versionCode；
   - gitee：删除旧 latest release → 重建同名 tag release → 上传 version.json + 两个 APK 附件（`curl -F "file=@path;filename=xxx"`，规避 multipart 自动加前缀；**不能**删除 release 内旧附件，405 → 必须重建 release）；
   - version.json 中 `version` 必须 > 当前安装版本，否则检测不到；
   - GitHub：上传源码与软件包（token `ghp_…` 为只读，push/建仓 403；需写权限 token 才能自动推送，待补）。
4. **软件内下载更新**：点"下载更新"在 App 内下载（进度条 + 实时速度），完成自动拉起系统安装器（FileProvider，authority `fun.upup.musicfree.fileprovider`，`res/xml/file_paths.xml` 覆盖 ExternalDirectoryPath）。

---

## 品牌视觉规范（2026-10-09）

**核心品牌图**：候选 1"经典高清"——蓝紫渐变圆角方形 + 白色同心圆唱片 + 音符弧线。生成原图为**纯白底**（四角/四边全 255），已程序化抠图：包围盒裁切白边 + 圆角 mask（四角 alpha=0，主体 alpha=255，PIL rounded_rectangle 抗锯齿），得到透明版 `brand-assets/品牌图标-透明圆角版.png`（1360×1361 RGBA）。

**启动页定稿**（1536×2048 → `drawable-nodpi/splashscreen_logo.png`）：
- 底图：浅蓝→淡青 **135° 对角渐变** `#D8E9FA → #F0F8F3`（色差明显、保持浅色柔和）；
- 图标：透明抠图**正中央**直贴（宽 = 画布 44%，像素保真不重绘不裁切）；
- 字标：**"极悦界"华文行楷**（`C:\Windows\Fonts\STXINGKA.TTF`），字宽 = 图标宽 **60%**，深蓝灰 `#2B3A4A`，位于图标下方 88px。

**图标资源**（mipmap 全密度，mdpi 48 → xxxhdpi 192）：
- `ic_launcher.png / ic_launcher_round.png`（legacy）= 蓝紫渐变方形底（135° `#5264C8→#C1D2FD`，与 adaptive background 一致）+ 透明图标叠加 → 四角为渐变无白角；
- `ic_launcher_foreground.png`（108→432）= 纯透明抠图 → Android 8+ 自适应图标下与背景融合。

**应用内品牌图**（`src/assets/imgs`）：`brand-logo.png`（平板播放区顶部）、`logo.png`（trackPlayer 引用）、`logo-transparent.png`（bootstrap 弹窗）全部替换为透明抠图；原图备份在 `brand-assets/原版logo备份/`。

**归档与脚本**：`brand-assets/` 保存 4 张候选原图、透明抠图、各迭代版本启动页、原版备份；合成脚本 `C:\Users\minli\AppData\Local\Doubao\User Data\Profile 8\.doubao\agent_mode\workspace\make_brand_v4.py`（改参数可重跑）。

---

## 功能与交互决策（2026-10-08 ~ 10-09）

1. **软件内下载更新**：下载更新改为软件内（进度+速度+自动安装），备用链接保留；翻译开关移入三点菜单且默认开启（全屏页）。
2. **权限管理**：二级页压成**三级浮窗** `PermissionSettingDialog`（悬浮窗/文件读写两行开关 + 点击行申请 + 回前台自动重查 + 底部完成）；bootstrap 首启引导保留（key `app.skipBootstrapStorageDialog`）。
3. **Toast 尺寸自适应**：容器 minWidth/maxWidth/minHeight 随内容变化，不再固定宽高。
4. **全屏播放页功能三级化**：功能区仅保留 倍速(speedometer)/定时关闭(alarm-outline，倒计时高亮) + 垂直模式心形 + 下载按钮；字号/歌词偏移/歌词进度移入三点菜单（SetFontSizeDialog/SetLyricOffsetDialog）；三点菜单新增"从该播放列表移除"（TrackPlayer.remove）与"永久删除"（本地，SimpleDialog 确认）；翻译/评论/歌词四项死入口删除（代码接口同步删）。
5. **音源管理**：三点菜单由面板改**三级浮窗 MenuDialog**（支持 switch 项），新增"订阅设置"→ SubscriptionSettingDialog（三级内再弹三级，仍守三级规范）。
6. **列表行样式统一**（2026-10-08 全项目 80+ 文件核查）：两套行体系收敛为基座档位 big64/normal56/small48/smallest36；修复清单见《列表行与浮窗样式一致性核查报告.md》（合并版，遗留 3 项见上篇第 6 节）。
7. **检查更新弹窗**：有新版 → DownloadDialog 三级浮窗（changelog 滚动 + 跳过此版本 + 下载更新 + 备用链接）；无新版 → Toast"当前已是最新版本"。
8. **三级浮窗字体统一**（2026-10-09）：三级浮窗选项行统一 **14sp（subTitle 档）+ medium 字重**，选中高亮由 primary 图标承担（不再用粗体区分）；三分支例外——导入歌单/文件选择器维持 13sp（记录为差异）；分组标题惯例 = 14sp + bold，primary 着色可作品牌强调（仅下载设置有分组标题）。同步修复：手机端搜索页返回手势（去 isTablet 限制回首页 tab）、Android 12+ 启动页图标（改引用正方形透明图标 `splashscreen_icon.png`，系统图标区不再拉伸变形）。

---

## 音源订阅源规范（2026-10-09）

**背景**：用户要求"根据 https://music.nairocy.com/（MusicFree 插件收集站）写音源文件，放 gitee，让软件自动可以更新源"。

**订阅源内容**：`plugins.json`（28 个可用插件清单，格式 `{plugins:[{name,version,url}]}`）。源自 nairocy 站 38 个插件，逐个 HTTP 验证后剔除 10 个失效（9 个 403 = nainoz_naa/other 仓库被 gitee 风控锁定、1 个 451 = maotoumao/plugins-list1/kuwo.js 法律失效）；保留网易音乐/腾讯音乐/酷狗/酷我_xixi/B站/千千/Navidrome/WebDAV 等。

**分发通道（关键踩坑）**：
- ❌ 新建 gitee 仓库 `xunwulove/jiyuejie-plugins`：**raw 与 release 附件下载全部 403**（改仓库描述无效，疑似 gitee 对新仓库/含"音乐"语义仓库的自动风控），仓库已弃用（未删，待用户决定）。
- ⚠️ 中间方案：`jiyuejie-updates` 更新仓库 latest release 附件（与 version.json 同机制，下载 200 稳定）——但附件不可覆盖（405），更新清单需删 release 重建。
- ✅ **最终方案（2026-10-09，用户要求"覆盖更新"路径）**：发布到 **`jishijie-release` 仓库 master 分支 raw 直链**：
  `https://gitee.com/xunwulove/jishijie-release/raw/master/plugins.json`（已验证匿名 200；备用 CDN `https://raw.giteeusercontent.com/xunwulove/jishijie-release/raw/master/plugins.json`）。
  **更新流程 = git push 覆盖**：本地 clone（`E:\xunwu\jishijie-release`，clone URL 内嵌 token）→ 覆盖 `plugins.json` → `git add/commit/push` → 软件内"更新订阅"或下次启动自动拉取即生效（URL 不变，无需重建 release）。已验证：push 覆盖后 raw 立即返回新内容（6763 字节）。
- gitee contents API 的 PUT 覆盖接口返回 400 空 body（不可用），**更新一律走 git push**。

**软件内置（开箱即用）**：
- 新常量 `src/constants/defaultPluginSubscription.ts`：`DEFAULT_PLUGIN_SUBSCRIPTION_URL`；
- 订阅设置弹窗 `subscriptionSettingDialog.tsx`：未配置订阅时列表回退显示默认源；
- 更新订阅 `pluginList.tsx onSubscribeClick`：未配置时直接用默认源拉取（不再提示"没有订阅"）；
- 启动自动更新 `bootstrap.ts extraMakeup`：首次（未配置订阅）写入默认订阅并拉取一次，与已装插件更新共用 24h 防抖（`app.pluginUpdateTime`），失败静默。

**注意**：`basic.autoUpdatePlugin`（默认开）决定启动是否拉取；拉取 = installPluginFromUrl(plugins.json) 逐个安装清单内插件。后续换源/加源只需 **git push 覆盖 gitee 的 plugins.json**（URL 不变）+ 软件内"更新订阅"（或等下次启动 24h 窗口）。

---

## 音源排序页修复与可用率排序生效（2026-10-09）

**背景**：用户反馈"排序页点按可用率/按平台，列表上方有空白"。核查（全程只读源码）定位三处问题：

1. **列表上方空白（用户点名）**：`pluginSort.tsx` 顶部 `marginTop = rpx(188) + StatusBar.currentHeight` 本为拖拽坐标换算专用（`SortableFlatList` 内部 `offsetRef = pageY - marginTop`，**不参与布局**）；但非手动模式（reliability/platform）的普通 `FlatList` 直接 `style={{ marginTop }}` → 列表被顶出 188rpx+状态栏 空白。**修复**：移除该样式。
2. **拖动列表空白/不全**：`sortingPlugins` 仅挂载初始化一次，插件异步加载后不同步。**修复**：useEffect 在初始为空且 plugins 加载后同步填充。
3. **"按可用率排序"开关形同虚设（实质缺失）**：设置项 `basic.sortPluginByReliability`（默认开）此前只影响已废弃的 playMatcher 内部排序；实际使用链路（搜索/推荐歌单/歌单详情解析）的插件顺序 `getSortedPluginsWithAbility` 只按手动 order。**修复**：`pluginManager/index.ts getSortedPluginsWithAbility` 在开关开启时按 `pluginReliability.getReliabilitySync(platform)` **可用率降序**排序，可用率相同（含无数据默认 0.5）回退手动 order。现在常用且解析成功率高的音源会真实地优先使用。

**可用率统计链路（已核查正常）**：搜索有结果/异常（useSearch 120/164）、播放解析成功/失败/换源成功（trackPlayer 529/559/587）、playMatcher（260）均按 `plugin.instance.platform` 记录；`pluginReliability.ts` 持久化于 StorageKeys.PluginReliability。排序键为插件名 name（meta.ts order），保存/读取一致。

---

## 设置列表分隔线统一（2026-10-09）

**背景**：用户反馈"设置齿轮里的列表之间有横线，备份管理的设置里没有"。

**核查结果**（全设置列表页）：仅「基本设置」用 `ListDivider marginLeft=16`；「备份与恢复」列表行之间**无任何分隔线**（不一致）；音源管理=网格卡片、主题设置=卡片式、关于=段落 Divider、排序页=拖动列表，均非列表行形态，无分隔线需求。

**修复**：`backupSetting.tsx` 本地备份组（3 行）与 Webdav 组（3 行）行间补 `ListDivider marginLeft={16}`，与基本设置一致。恢复模式行（单行）无需分隔线。

---

## 关于页重写（2026-10-09）

**背景**：原关于页为 MusicFree 官方内容（猫头猫作者/公众号/B站/小红书/QQ频道/开发者的话）。

**重写内容**（`aboutSetting.tsx`）：
- 头部：极悦界品牌图（`ImgAsset.brandLogo`，点击检查更新）+ 动态应用名 + 动态版本号 + "点击品牌图标检查更新"；
- 章节：关于极悦界（基于 MusicFree 二次开发、插件式音源架构、个人自用不对外分发）；开源声明（AGPL-3.0，保留出处 `github.com/maotoumao/MusicFree`，致谢原作者）；更新与音源（软件内检查更新/gitee 托管、音源订阅自动更新）；插件安全提示（保留）；by: 极悦界。
- 删除：猫头猫头像/公众号二维码/官方联系方式/原开发者的话。

---

## 权限设置开关修复（2026-10-09）

**背景**：用户反馈"权限设置点开关好像没用"。

**根因**：`PermissionSettingDialog` 两行开关是**只读状态指示器**（ThemeSwitch 无 onValueChange），仅整行点击才触发权限申请；且申请后不主动重查状态（仅依赖 AppState 回前台，已授权/立即返回场景开关不刷新）。

**修复**：开关绑定 onValueChange（动作=申请对应权限，与整行点击一致）；悬浮窗权限申请后 500ms 兜底重查（跳系统设置返回由 AppState 监听双保险）；存储权限申请后 800ms 兜底重查（Android 13+ 系统对话框在应用内弹出）。

---

## 三级弹窗底部空白修复（2026-10-09）

**背景**：用户反馈"设置页（主题设置）和下载管理页（下载设置）的三级窗口，最下边有空白行"。

**根因**：`Dialog.Content` 平板分支 `maxHeight: "70%"`（字符串百分比）——Android 上父容器（dialogContainer）高度为 auto 时百分比 maxHeight 失效，内容多的弹窗高度失控、底部布局异常；两弹窗均为 needScroll（内容可滚动）。

**修复**（`dialogs/components/base/index.tsx`）：
- Content maxHeight 统一为数值 `vh(70)`（平板/手机同口径），并加 `flexShrink: 1` 防止内容撑破弹窗；
- needScroll 的 ScrollView 显式 `contentContainerStyle={{ paddingBottom: 0 }}`；
- 下载设置弹窗 Content `paddingBottom 8 → 0`（与主题设置同规范：内容区底紧贴按钮行分割线）。

---

## 发版记录与 gitee API 踩坑（2026-10-09 v0.6.2.2）

**已发版**：极悦界 **0.6.2.2**（versionCode 400013，gitee release id 1191757，tag `latest`），附件 = version.json + app-arm64-v8a-release.apk + app-universal-release.apk（下载验证：version.json 200、APK 302 可跟随）。本轮修复：音源排序页空白 + 可用率排序生效、订阅源覆盖更新路径、推荐歌单点击播放对齐原版、权限开关、三级窗底部空白、备份页分隔线、关于页重写。

**gitee API 踩坑（本次实测）**：
1. **创建 release 用 `curl -d '{"tag_name":...}'`（JSON）→ 400**；改用 **`-F` 表单方式**（`-F access_token=... -F tag_name=latest -F target_commitish=master`）→ 201 成功。后续创建 release 一律用 `-F` 表单。
2. **创建 release 必须带 `target_commitish`**（如 `master`），否则 400。
3. **删除 release 不删 tag**：直接 POST 重建同名 tag 仍 400（tag 残留冲突）。流程=先 DELETE release → 确认 tag 已随 release 消失（若残留则 DELETE tags/latest）→ 再 POST 重建。
4. **PATCH 更新 release 名称/正文必须带 `tag_name`**（否则 400 `tag_name is missing`）；`-F` 表单传中文 name/body 正常（JSON 中文曾 400，疑似编码）。
5. 附件上传：`POST releases/{id}/attach_files?name=xxx -F "file=@path;filename=xxx"`（201）。删除 release 内附件 405 → 必须重建 release。
6. 本地 `git commit` 会被上游 **lint-staged 钩子**拦截（npm run lint 失败 → 自动回滚暂存，工作区改动保留）。**不要用 --no-verify**；如需提交快照，先修 lint 或改走其他方式（历史一直以工作区未提交状态开发，commit 非必需）。

**GitHub 上传**：既定意图=源码+包上传 GitHub（`xunwulove`），但现有 token `ghp_…` 实测只读（push/建仓 403）；需用户提供**有写权限的 token** 才能自动推送，或手动上传。gitee 更新链路不受影响。

---

## 版本线更新与近期决策（2026-10-10 ~ 10-11）

**版本现状**：0.6.2.9（versionCode 400020），`package.json` version 为唯一版本源；发版链路不变（gitee latest tag 固定附件）。0.6.2.4（fork 基线）→ 0.6.2.5 → 0.6.2.6 → 0.6.2.7 → 0.6.2.8 → 0.6.2.9，各版本变更见 `changelog.md` 顶部极悦界段。

### 推荐歌单体系（两级结构 + 独立可用率）

1. **两级结构对齐官方协议**：`getRecommendSheetTags`（标签无封面）→ `getRecommendSheetsByTag(tag,page)`（真实歌单带 artwork）；歌单详情播放走插件 `getMediaSource`（与官方同构，放弃自建 playMatcher 全局匹配）。每日推荐链路 = 随机标签 → 缓存拉真实歌单 → 随机歌单带 `pluginHash` 进歌单详情。
2. **缓存**：键 `Plugin.RecommendCache`（每日）/ `Plugin.RecommendTagCache`（`${pluginHash}:${tagId}`，每日）/ `Plugin.TopListCache`；`getCachedRecommendSheetsByTag` 加 8s `Promise.race` 超时；首页推荐区首屏不阻塞（applyFeed 先 setLoaded + selectedTagRef 防覆盖）。**每日缓存 = 防封禁策略**（网易/QQ 元数据接口每日一次）。
3. **独立可用率**（用户明确要求"独立统计"）：键 `plugin-recommend-reliability`，**不与通用可用率混入**；推荐歌单择优按此独立率排序优先。"设为推荐源"功能曾加又按用户要求**删除并彻底移除**；推荐歌单来源选择改为三级浮窗（含"恢复默认"按钮，底部选项行=取消/确认/恢复默认）。
4. **封面兜底**：歌单详情头部无封面时取首曲封面（header.tsx artwork→coverImg→musicList[0]）。

### 沉浸歌词层计时规则（0.6.2.8 修复定稿）

- **仅播放中**计时：播放 15s 且无操作 → 自动进入沉浸层；**暂停不计时**（不能用负向 isPaused 判定，Android RNTP 暂停后 state 为 Ready，需正向判定 playing）；有操作（点击/滑动）→ 计时重置；切歌后重新计时。
- 退出：点击/手势回全屏页；沉浸页仅全屏页可进入（左侧播放区与全屏页共用同一层）。

### 三处歌词统一（卡拉OK + 滚动 + 渐隐，2026-10-11）

- 全屏/沉浸/左侧播放区三处歌词区统一 FlatList 平滑滚动 + `fadingEdgeLength` 边缘渐隐（平板 160/手机 120，左侧 120），首尾 blank=±(区域高−行高)/2，`onScrollToIndexFailed` 120ms 兜底。
- **卡拉OK进度染色**（用户选 B：三处都做 + 去加粗 + "按推荐来"配色）：`src/components/base/karaokeText.tsx`（useProgress(200)；逐字切已唱段/未唱段；支持多行）。配色：全屏=primary 已唱 / 普通歌词色 α0.6 未唱；沉浸=白 0.98 / 半透明白 0.5；左侧=primary / textSecondary。
- 沉浸页歌词区下端与右封面下端**精确齐平**：仅保留 `lyricWrapTablet paddingBottom:64`（勿在 leftPane 重复加，双重 64 会导致歌词区上移）。

### 白天背景方案 A+B（2026-10-11，用户选定）

- **A 全局浅品牌色微渐变**：白天背景 `LinearGradient [#F2F5FC → #F8F9FA]`（pageBackgroundTop 新字段，`pageBackground.tsx`）；深色保持单色 `#0F172A` 不受影响；零性能成本。
- **B 播放封面氛围取色**：`useAlbumTintColor`（复用 `react-native-image-colors`，Android dominant/average/vibrant，同封面缓存）；背景顶部叠加 `封面主色 α0.05 → 0` 极浅渐变，仅白天；取色失败/无封面回退 A。切歌低频取色，不影响性能。
- 深色模式不启用 A/B（保持纯深色）。

### 尺寸固定 dp 体系（延续 43 条清单，2026-10-11 补完）

- 组件尺寸一律固定 dp（fontSizeConst/iconSizeConst 档位、卡片圆角 14、列表行 big64/normal56/small48/smallest36）；rpx 仅保留"按屏比例的元素"（弹窗宽 60%/86%、网格 gap、沉浸层光带等背景特效）。
- 本轮补完历史残留：全屏歌词页 9 处（拖拽浮层 76/84/152 等）+ 歌单详情头部 6 处（封面 176×176 圆角 20 等）rpx → 固定 dp，rpx import 已清理。**遗留提醒**：immersiveLayer 光带/光斑按 SCREEN_W 比例属背景特效，合理保留。

### 设置页缓存惰性统计（0.6.2.5）

- 官方原版进设置页即 `useEffect` 全量遍历 music/lyric/image 三缓存目录 → 卡顿根因；极悦界改为**惰性统计**：进页显示 "--"，点击缓存行才统计对应**单个**目录，清缓存后只刷新该目录（`useCacheSize` + queried 状态）。这是相对官方的性能改进。

### 歌单/音乐库交互对齐（0.6.2.5 ~ 0.6.2.6）

- 我的页返回手势 → 首页；音乐库返回手势 → 首页（手机）；设置页返回 → 上一层级。
- 音乐库排序行移至四卡片下方（固定表头，不随列表滚动）。
- 下载文件命名设置（歌名/作者在前）。
- 设置页分组标题统一 primary；标题行高度各层级各自统一（一级/二级/三级各自保持规范，不是全部一样高）。
- 全屏页功能区顺序（用户定稿）：**字号 / 速度表 / 定时关闭 / 爱心 / 下载**；歌词偏移等移入三点菜单。




