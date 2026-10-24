# UI与适配核查记录

> 本文档由以下 7 份原文档合并而成（合并时间：2026-10-15）：
> 1. `E:\xunwu\Deepseek\jiyuejie\UI_ALIGNMENT_CHECK.md`
> 2. `E:\xunwu\Deepseek\jiyuejie\UI冲突统一处理报告.md`
> 3. `E:\xunwu\Deepseek\jiyuejie\UI统一16条改动位置清单.md`
> 4. `E:\xunwu\Deepseek\jiyuejie\列表行与浮窗样式一致性核查报告.md`
> 5. `E:\xunwu\Deepseek\jiyuejie\设置页功能核查报告.md`
> 6. `E:\xunwu\Deepseek\jiyuejie\尺寸类型修正与车机适配验证报告.md`
> 7. `E:\xunwu\Deepseek\jiyuejie\docs\手机横屏尺寸适配核查报告.md`
>
> 合并原则：保留全部关键事实、结论、数字、日期、文件路径与"文档与实际代码不符"的修正说明；内容按主题重排；重复内容去重但不丢信息；冲突以实际代码为准。
> 合并者仅做只读核对与重组，未修改任何源码；原文档由组织者另行归档。

## 目录

- [第1章 核查总览与 UI 冲突统一处理](#第1章-核查总览与-ui-冲突统一处理)
  - [1.1 核查目标与方法](#11-核查目标与方法)
  - [1.2 全局基础规范（字号/图标/全局组件）](#12-全局基础规范字号图标全局组件)
  - [1.3 逐页 9 要素核查记录](#13-逐页-9-要素核查记录)
  - [1.4 差异点处理结果（2026-10-07）](#14-差异点处理结果2026-10-07)
  - [1.5 对齐进度总览与待补缺口](#15-对齐进度总览与待补缺口)
  - [1.6 二级页面全面对齐·第二轮（逐页 9 要素）](#16-二级页面全面对齐第二轮逐页-9-要素)
  - [1.7 统一平板判断与扫描设置页落地](#17-统一平板判断与扫描设置页落地)
  - [1.8 功能接入核查轮（#42~#47）](#18-功能接入核查轮4247)
  - [1.9 全面代码与功能核查轮（#50，2026-10-07）](#19-全面代码与功能核查轮502026-10-07)
  - [1.10 字体字号行距统一核查与修复（2026-10-08）](#110-字体字号行距统一核查与修复2026-10-08)
  - [1.11 品牌视觉轮与同轮修复（2026-10-09）](#111-品牌视觉轮与同轮修复2026-10-09)
  - [1.12 遗留待办汇总](#112-遗留待办汇总)
  - [1.13 UI 冲突统一处理总览（2026-10-14）](#113-ui-冲突统一处理总览2026-10-14)
  - [1.14 冲突逐条处理明细 C01~C22](#114-冲突逐条处理明细-c01c22)
  - [1.15 规范文档同步与漂移修正](#115-规范文档同步与漂移修正)
  - [1.16 待决策清单与后续决策记录](#116-待决策清单与后续决策记录)
- [第2章 UI 统一改动位置清单（16 条）](#第2章-ui-统一改动位置清单16-条)
  - [2.1 按软件中位置索引](#21-按软件中位置索引)
  - [2.2 按改动性质分组](#22-按改动性质分组)
  - [2.3 用户验收自查清单](#23-用户验收自查清单)
- [第3章 列表行与浮窗样式一致性核查](#第3章-列表行与浮窗样式一致性核查)
  - [3.1 全局基准（比对零点）](#31-全局基准比对零点)
  - [3.2 分页面行样式快照](#32-分页面行样式快照)
  - [3.3 一致性结论与硬差异分级 HD-1~HD-10](#33-一致性结论与硬差异分级-hd-1hd-10)
  - [3.4 修复建议 F1~F14 与执行记录（2026-10-08）](#34-修复建议-f1f14-与执行记录2026-10-08)
  - [3.5 全项目浮窗核查结论（88 条）](#35-全项目浮窗核查结论88-条)
  - [3.6 P0 明细（6 条，已修）](#36-p0-明细6-条已修)
  - [3.7 P1 明细（43 条）](#37-p1-明细43-条)
  - [3.8 P2 明细（39 条）](#38-p2-明细39-条)
  - [3.9 覆盖清单与一致项验证](#39-覆盖清单与一致项验证)
- [第4章 设置页功能核查](#第4章-设置页功能核查)
  - [4.1 结论先行与冲突/重复清单](#41-结论先行与冲突重复清单)
  - [4.2 死代码清单及清理确认](#42-死代码清单及清理确认)
  - [4.3 正常保留项（32 项设置 + 21 个二级页配置键）](#43-正常保留项32-项设置--21-个二级页配置键)
  - [4.4 待确认项与处置优先级](#44-待确认项与处置优先级)
- [第5章 尺寸类型修正与车机适配验证](#第5章-尺寸类型修正与车机适配验证)
  - [5.1 结论与 43 条修正清单](#51-结论与-43-条修正清单)
  - [5.2 改固定后仍须补充的触控动作（5+1 处）](#52-改固定后仍须补充的触控动作51-处)
  - [5.3 车机分支与架构发现](#53-车机分支与架构发现)
  - [5.4 大屏档位切换方案评估](#54-大屏档位切换方案评估)
  - [5.5 应保留 rpx 的布局层与改动联动](#55-应保留-rpx-的布局层与改动联动)
- [第6章 手机横屏尺寸适配核查](#第6章-手机横屏尺寸适配核查)
  - [6.1 问题背景与根因分析](#61-问题背景与根因分析)
  - [6.2 重叠组件清单](#62-重叠组件清单)
  - [6.3 固定 dp 大值与 rpx 使用清单](#63-固定-dp-大值与-rpx-使用清单)
  - [6.4 QQ音乐/网易云音乐尺寸策略对照](#64-qq音乐网易云音乐尺寸策略对照)
  - [6.5 合格判定与修复建议](#65-合格判定与修复建议)
- [附录：原文档章节映射](#附录原文档章节映射)

---

## 第1章 核查总览与 UI 冲突统一处理

> 本章合并来源：`UI_ALIGNMENT_CHECK.md`（fork 项目 UI 的逐页核查总记录，任务 #27~#50）与 `UI冲突统一处理报告.md`（2026-10-14，"少数服从多数"原则统一字号/载体冲突）。

### 1.1 核查目标与方法

- 目标：fork 项目（MusicFree 内核）UI 全面规范化。只考虑白天模式；设置页放行（不逐项查）；手机端按"美观可用"自定；平板严格按用户规范。
- 9 大要素：①层级定位 ②布局结构 ③配色体系 ④字号字重 ⑤间距尺寸 ⑥组件样式 ⑦交互行为 ⑧文案图标 ⑨动效与状态。
- 验证口径：所有改动均通过 `npx tsc --noEmit`（exit 0）；多轮"未打包、未装机验证"（用户叫停打包），后续 0.6.2.x 发版才装机。

### 1.2 全局基础规范（字号/图标/全局组件）

#### 字号档位 `src/constants/uiConst.ts`

| 档位 | 值 | 对应旧项目 |
|---|---|---|
| tag | 10 | 角标 10sp |
| caption | 11 | 小标签/统计手机标签 11sp |
| description | 12 | 描述/辅助 12sp |
| normal | 13 | 列表项标题/歌单名 13sp |
| subTitle | 14 | 次要文字 14sp |
| body | 15 | 卡片文字 15sp |
| content | 16 | 正文/区块标题 16sp |
| title | 18 | 标题 18sp |
| large | 22 | 大数字 22sp |
| xlarge | 32 | 平板顶栏 Tab/问候语大字号（C20 新增，见 1.14） |
| appbar | 18 | AppBar 标题（C01 起顶栏实际使用此档，见 1.14） |

> ⚠️ 修正核对：合并时读取 `src/constants/uiConst.ts`（第 6~29 行）确认——`xlarge: 32` 与 `appbar: 18` 两档均在位；`iconSizeConst` small16/light20/normal24/big32/large40 与文档一致。原文档首轮记录"图标 small16/light20/normal24/big32/large40"属实。

#### 图标档位 `iconSizeConst`
small 16 / light 20 / normal 24 / big 32 / large 40 —— 标准图标 24dp。

#### 全局组件对齐结果（#33）

| 组件 | 对齐结果 |
|---|---|
| AppBar | 高度 56dp；标题 appbar(18) Bold；背景 background 色；菜单宽 280 圆角 12 |
| ListItem | 行高 big64/normal56/small48/smallest36；默认 padding 16；封面 48dp 圆角 8；副行间距 2 |
| MusicItem | 序号宽 40；本地图标 20；更多按钮宽 40；描述 12sp |
| MusicList | ITEM_HEIGHT 64；滚动角标 36dp |
| panelBase | 圆角 16；平板左 30%/右 70% 右滑入不盖 tab（#22/#25 实现） |
| panelHeader | 高度 56；按钮宽 72；padding 16；渐变 primary α0.14→0.04 |
| Button | 高 48 圆角 12 |
| Input | padding 16；默认字号 content(16)（C03，见 1.14） |
| typeTag | 12sp；选中 primary 底白字；未选中 surfaceVariant 底（#27） |

### 1.3 逐页 9 要素核查记录

#### #27 首页 HomePage ✅
层级=统计行→金刚区→推荐→歌单（同旧项目）；平板 22/14sp、50dp 图标块 min110dp，手机 18/11sp、32dp 块、圆角 16；卡片渐变 primary α0.14→0.03、start(0,0)→end(220,260)；PlaylistCard 130dp 封面圆角 12；交互=每日推荐/排行榜/我的喜欢(defaultSheet "favorite")/最近播放。"每日推荐"图标后由 fire 近似改为新增 calendar-days（见 1.4）。

#### #28 搜索页 SearchPage ✅
历史+热门双栏；历史 chip 圆角 14，热门两列网格宽 48.5% 圆角 12；surfaceVariant α0.6 底/textSecondary 字；搜索框高 56 圆角 12（M3 Outlined）；navBar 顶栏 56；热门搜索=QQ gethotkey 主源+网易云降级+MMKV 24h 缓存。

#### #29 音乐库 LibraryPage+子层 ✅
四卡=歌曲/专辑/歌手/扫描（媒体来源）；第 4 卡"扫描/媒体来源"点击进扫描（#41 后改 navigate(SCAN_SETTINGS)，见 1.7）；子层歌曲列表走全局 MusicList。"扫描"图标用 arrow-path 近似（语义等同 Refresh）。

#### #30 我的页 MinePage ✅（整页重写）
平板：双大卡片并排+"我的音乐"3 卡行+"数据与设置"3 卡行；手机：单长条+3 统计卡+竖排列表。用户卡 primary α0.12；统计卡 primaryContainer；头像 24sp、昵称 18sp Bold、版本 18sp、统计 22/14、列表 15sp Medium。fork 无歌单管理/备份管理二级页（入口映射调整，后续 #44/#49 迁出独立页，见 1.8）。

#### #31 全屏播放页 PlayingPage ✅（本轮重排）
平板左 6 右 4 分栏；左区=顶栏+标题+歌词+进度+控制，手机=顶栏+标题+封面/歌词+底部；背景纯 background 色（原黑底+模糊封面弃用）；图标 text/primary/textSecondary（原白色弃用）；顶栏"正在播放"16sp Bold；平板歌名 32sp/歌手 18sp、手机 19sp/13sp；进度时间 11sp；手机封面 240dp 圆角 20、平板封面圆角 28。

#### #32 二级页面（抽查代表页）
最近播放 HISTORY=AppBar+MusicList(showIndex)+MusicBar；统计 STATISTICS=汇总渐变卡+常听 Top10/播放日历 50% 分栏；下载 DOWNLOADING=ListItem 行+状态描述；歌单详情 sheetDetail=AppBar+header+MusicList；排行 topList=boardPanel+网格。批量修复 9 处 `width: rpx(750)`→`"100%"`（平板内容区溢出根因）。设置页放行。

#### #33 三级弹窗与全局组件 ✅
panelBase 圆角 16、平板右内容区定位（浮窗中心=内容区中心不含 tab）；panelHeader 标题行 56 高、渐变 primary α0.14→0.04；平板第三级窗口透明框 #4 已修。

### 1.4 差异点处理结果（2026-10-07）

| # | 差异点 | 状态 |
|---|---|---|
| 1 | "每日推荐"图标 | ✅ 新增 calendar-days 图标（`src/assets/icons/calendar-days.svg`+重生成 icon.tsx），对齐 Today 日历语义 |
| 2 | "扫描/媒体来源" arrow-path 近似 | ✅ arrow-path（Heroicons 旋转箭头）与 Material Refresh 同义，语义已对齐 |
| 3 | 我的页歌单管理/备份管理入口 | ⏸️ 用户放行保持 fork 现状（后于 #44/#49 迁出独立页） |
| 4 | 我的歌单区双 tab+加号/导入 | ⏸️ 用户放行 |
| 5 | 统计页播放日历 | ✅ 已实现本月播放日历热力图（surfaceVariant 底圆角 14、"本月播放日历"13sp Bold、星期表头 10sp α0.6、7 列网格圆角 5 gap 3、色阶 primary α0.08/0.25/0.5/0.75/1.0、有播放白字 Bold）；数据源 musicHistory.playedAt |
| 6 | 全屏播放页顶栏分享按钮 | ✅ 移除分享按钮→右 48dp 占位（对齐旧 Spacer 48.dp） |
| 7 | 设置页 | ⏸️ 用户放行不逐项查 |

### 1.5 对齐进度总览与待补缺口

结论：**主要页面骨架已对齐，但"每个已检查页面都完整 9 要素对齐"尚未成立**（2026-10-07 盘点）。

| 范围 | 页面/组件 | 状态 |
|---|---|---|
| ✅ 完整核查 | 首页、搜索页、音乐库、我的页、全屏播放页核心布局 | 逐项过完 |
| ⚠️ 抽查 | 历史、统计、下载、歌单详情、排行 | 只核对结构/尺寸 |
| ⚠️ 部分遗留 | 全屏播放页歌词区（lyricItem/lyricOperations/draggingTime）、封面操作区（albumCover/operations、heartIcon） | 主控件对齐，细部未逐项 |
| ❌ 未检查 | 专辑详情、歌手详情、本地音乐、列表编辑器、插件歌单详情、推荐歌单、搜索结果列表、排行详情、本地分组、文件选择器、权限页、自定义主题 | 只修屏宽溢出 |
| ❌ 组件未覆盖 | 网格卡片、状态组件（listEmpty/listFooter）、panelFullscreen、其余 panel 类型、divider、tag | 后续补 |
| ⏸️ 放行 | 设置页 | 不动 |

待补缺口顺序：①歌词区/封面操作区逐项对齐；②剩余二级页逐页 9 要素；③网格卡片/状态组件/panel/divider/tag 全局组件。

### 1.6 二级页面全面对齐·第二轮（逐页 9 要素）

> 用户指令：按 9 要素对齐所有二级页面，只放行设置页。方法=逐页读旧 `.kt`→fork `.tsx`，9 要素比对→改 fork→记录。

**二级顶栏字号规则**：多数二级页 18sp Bold（AppBar 默认）；最近播放与歌单详情原为 20sp Bold，**后于 2026-10-07 统一改回 18sp Bold**（删 20sp style 覆盖）。

#### 6.1 最近播放 HISTORY ✅（重写 `src/pages/history/index.tsx`）
自绘列表行（字符块 44dp 圆角 8 无封面无序号无更多钮）；标题 20sp→18sp（统一后）；字符 18sp primary；歌名 15sp Medium、歌手 12sp、空态 14sp；行 padding 10/8、字符块距 12；点击整行 playWithReplacePlayList；顶栏 actions 直接清空按钮（trash-outline），移除编辑入口（旧项目无）；空态图标 clock-outline 64dp。

#### 6.2 统计页 STATISTICS ✅（重写 `src/pages/statistics/index.tsx`）
补维度 chips（今日/本周/今年）；总览改 2 渐变卡；排行改白底列表；日历独立卡；渐变 primary 0.14→0.03；0 次格子 surfaceVariant α0.5；value 22 Bold/label 14/subtitle 10 α0.7/排行标题 15 Bold/歌名 14 Medium/副行时长 12/chips 13/日历标题 13 Bold；图标块 46 圆角 14 图标 26；排行方块 32dp 圆形；时长格式化"x小时x分钟"；数据按 playedAt 过滤维度×duration。

#### 6.3 下载页 DOWNLOADING ✅（重写 `src/pages/downloading/{index,downloadingList}.tsx`）
标题"下载管理"；行卡片化（圆角 14）；状态图标 24（下载 arrow-down-tray/失败 exclamation-circle）+进度条 4dp；任务标题 15 Medium/副行状态 12/% 11/空态 14。**差异记录**：TabRow 无法对齐——fork 下载完成即移出队列入本地音乐库，无"已下载"列表数据源；批量暂停/继续 fork 内核无 API。下载设置后于 #49 迁出为独立 3 级弹窗（见 1.8/1.9）。

#### 6.4 排行榜 TOP_LIST ✅（重写 `topListItem.tsx`、`boardPanel.tsx`）
行式对齐：40dp 渐变块（fire 图标 20 白）+名称 15 Medium+描述 12+箭头"›"+Divider start 70；标题"排行榜"。**架构差异**：fork 榜单歌曲走独立 topListDetail 页（旧项目同页双级改导航，交互等价）；fork 保留多音源 Tab（内核特性）。空态用 fork NoPlugin 组件（后续对齐文案）。

#### 6.5 歌单详情 SHEET_DETAIL ✅（重写 `sheetDetail/components/{navBar,sheetMusicList}.tsx`）
移除 Header/PlayAllBar（旧项目无）；顶栏两行标题（歌单名+"N 首歌曲"）；播放全部入顶栏；序号块 44 圆角 8 surfaceVariant/序号 primary；歌单名后统一 18sp Bold；歌名 15 Medium、歌手 12；自绘序号块行（无封面/无更多钮）；播放全部 playWithReplacePlayList。**功能差异记录**：fork 原有编辑/排序/删除/歌单内搜索菜单移除对齐 UI（旧项目无），功能损失记录需要可恢复。

#### 6.6 播放队列 PLAY_QUEUE ✅（对齐 `components/panels/types/playList/body.tsx`）
**架构差异**：fork 队列从播放面板/播放器弹出（showPanel PlayList），非独立二级页。行布局=序号+歌名+歌手+"播放中"；当前曲 primary；序号 14/歌名 15（当前 Bold 否则 Medium）/歌手 12/"播放中" 11；保留 x-mark 删除（fork 功能，旧项目无）。

> ⚠️ 修正：来源报告 P0-1（第3章）曾称 PlayList 面板 Header 整行 rpx(80)≈40dp 溢出。合并时核对 `src/components/panels/types/playList/header.tsx`，该文件已整体改为复用 `<PanelHeader hideButtons title=.../>`（23 行，注释自证"与其他右侧浮出层统一"），即 C14 第 2 项载体决定已落地，P0-1 已闭环。

#### 6.7 音源管理 SOURCES 📝
fork 插件管理原属设置页体系（放行）。**后于 #44 迁出为独立二级页 `plugin-sources`**（见 1.8）：PluginList 顶栏标题改"音源管理"，mineTab"音源管理"卡与抽屉条目统一 navigate(PLUGIN_SOURCES)。功能超集：添加/删除/仓库三级弹窗齐全。

#### 6.8 备份管理 BACKUP 📝
fork 备份原在设置页体系。**后于 #49 迁出为独立二级页 `backup`**（见 1.8）：`src/pages/backup/index.tsx` 复用 backupSetting。功能超集：WebDAV（坚果云）+本地 JSON+恢复模式。

#### 6.9 扫描设置 SCAN_SETTINGS ✅（原差异→#41 已实现，见 1.7）

#### 6.10 均衡器 EQ ✅（JamesDSP 音效引擎已实现，替代早期 AudioEffect 待办 #15）
原 fork 无均衡器（expo-audio 无内置），早期方案为系统 AudioEffect 桥接（已弃）。现已切换为 **JamesDSP 核心算法库**（NDK `libjiyuejie_dsp` + ExoPlayer AudioProcessor 注入），音效页 `soundEffectSetting.tsx` 提供：**15 段均衡器**（自绘竖向滑块，轨道 2dp/圆球 12dp，平板全显、手机横向滚动）+ 进阶音效（输出增益/动态低音/立体声增强/混响/电子管/交叉馈送/卷积器 IR）。详见 `docs/问题排查与避坑记录.md` §2.7。

#### 6.11 排行详情 TOP_LIST_DETAIL ✅（重写 `pages/topListDetail/index.tsx`）
AppBar 标题改榜单名；自绘封面行：行 padding 16/8、序号宽 32/normal13、封面 44→48（F6 修后）圆角 8、歌名 14 Medium（后 F6 改 body15，见第3章）；点击 playWithReplacePlayList；保留 fork 分页 loadMore（功能增强）。

#### 6.12 歌单管理 PLAYLIST_MANAGE 📝
fork 无独立管理页：歌单入口/管理承载于我的页横滑区+歌单详情。新建歌单后于 #47 改 3 级弹窗（见 1.8）。

#### 6.13 标签编辑 TAG_EDIT 📝
fork 本地音乐只读，无标签写回。**#49 可行性分析结论**：原生能力已就绪——`Mp3UtilModule.kt` 已实现 setMediaTag/getMediaTag/getMediaCoverImg（JAudiotagger），权限 MANAGE_EXTERNAL_STORAGE 已声明；差距=无编辑 UI、字段少（原生 5 字段 vs 旧 10）、封面写入未做。推荐 v1=弹窗（除封面外 10 字段）+入口+保存刷新，v2=封面编辑。

#### 6.14 fork 特有二级页（保留现状）
albumDetail、artistDetail、pluginSheetDetail、recommendSheets、searchMusicList、localGroup、fileSelector、permissions、setCustomTheme、musicListEditor——旧项目无对应页，fork 保留其实现与全局组件样式。

#### 6.17 二级页面风格规范统一性核查
结论基本统一：背景色=FullOverlay=`colors.background`；顶栏 AppBar 高 56dp/标题 18 Bold/返回 arrow-left/paddingH 8（14 页直接使用）；列表行=全局 MusicList/ListItem；容器=VerticalSafeAreaView edges top/bottom。**特例**：①sheetDetail 两行顶栏（对齐旧 PlaylistDetailPage）；②fileSelector 顶栏由 rpx(88)→56、背景 appBar→background、路径文本 16→title(18) Bold。

#### 6.18 三级界面按旧版 Level3Dialog 规范实现
改动 `src/components/dialogs/components/base/index.tsx`：容器圆角 20、细边框 outlineVariant α0.35/shadow；平板宽 60%/手机 86%；标题行 52dp+水平品牌渐变（primary 0.10→primaryContainer 0.07→透明）+4×20 胶囊条+淡蓝线 α0.12；正文 13sp/行高 21/onSurfaceVariant/padding 24/16；按钮行同 52dp 渐变+上分割线；BottomButton 改透明文字按钮（confirm primary 14sp Medium/dismiss textSecondary）。ThirdLevelModal（subPageOverlay.tsx）圆角 20、宽 60%/86%、最大高 70%、中心定位=内容区中心不盖 tab。

#### 6.19 操作逻辑核查：任何界面点 tab 切对应一级页
修复 `src/pages/home/index.tsx`：`switchTab = useCallback(tab => { setSubPages([]); setSelectedTab(tab); })`，平板/手机 TabBar 与搜索退出统一走 switchTab。任何界面点 tab→清空覆盖层栈+切一级页。

#### 6.20 平板全屏播放页改全屏覆盖
新增 `fullPlayingAtom`（tabletNav.ts）；tabletPanel 播放区点击 navigate(MUSIC_DETAIL)→setFullPlaying(true)；home/index.tsx 新增 FullPlayingLayer（absoluteFill zIndex 2000 渲染 MusicDetail，盖住左播放区+内容区+tab 栏）；Android 返回键先关全屏层。手机端不变（原生栈本已全屏）。

### 1.7 统一平板判断与扫描设置页落地

#### 7.1 统一 isTablet 工具（#40）
实现 `src/utils/tablet.ts`（isTabletScreen 非组件场景）+`src/hooks/useIsTablet.ts`（组件场景响应式），替换 11 处散落 `Dimensions.get("window").width >= 600`（panelBase、dialog base、home/index、statistics、subPageOverlay、mineTab、libraryTab、statsRow、operations、router）。

> ⚠️ 修正：来源文档（含第5、6章）当时均称 `isTabletScreen() = window.width >= 600`（按宽度判定）。合并时核对 `src/utils/tablet.ts` 第 7~17 行，当前实现已改为**短边法**：`min(width,height) >= 600`，并加 720p 大屏兜底（minPx≥720 且 density≤1.75 算平板）。即"手机横屏误判平板"根因（见第6章）已通过短边法修复；后续文档中"按宽度判定"的表述为历史状态。

#### 7.2 扫描设置页 SCAN_SETTINGS ✅（#41）
实现 `src/core/scanSettings.ts`+`src/pages/scanSettings/index.tsx`+接入 `localMusicSheet.ts`：开始扫描卡（渐变圆角 14+arrow-path+扫描中 ActivityIndicator）；SectionTitle"媒体库/设置/被屏蔽的文件夹"；开关行 20 图标 primary+15 标题+12 副行；添加屏蔽=SimpleDialog（Input+选文件夹→FILE_SELECTOR）；功能全落地——媒体库开关/自定义文件夹/60 秒过滤/屏蔽目录前缀跳过。入口=libraryTab 第 4 卡 navigate(SCAN_SETTINGS)。fork 无 MediaStore 桥，"使用 Android 媒体库"语义=扫描默认目录（Music+Download）。

### 1.8 功能接入核查轮（#42~#47）

> 原则：已有能力直接复用/接入，不重复造。

- **#44 音源管理迁独立二级页**：新路由 `PLUGIN_SOURCES="plugin-sources"`；PluginList 顶栏标题改"音源管理"；mineTab（平板 toolCards+手机 entryItems）+抽屉条目统一 navigate(PLUGIN_SOURCES)。
- **#42 首页推荐歌单数据链路**：`homeBody/recommendSection.tsx` 数据源=音源插件 `getRecommendSheetsByTag`/`getRecommendSheetTags`，无插件整区隐藏。fork 为插件体系，网易/QQ 即插件，无需内置。
- **#43 WebDAV 备份**：`backupSetting.tsx` 已完整实现 WebDAV（webdav 库 createClient、备份到 `/MusicFree/MusicFreeBackup.json`、恢复、本地备份/恢复、URL 恢复、恢复模式 Append/Overwrite）。
- **#45 下载功能核查**：`src/core/downloader.ts` 状态机 Pending/Preparing/Downloading/Completed/Error+队列+事件；失败原因分类；音质选择与播放降级。差异：旧下载写公共 `Music/极悦界`，fork 写应用目录（pathConst）；旧公共文件可通过"扫描设置→自定义文件夹"接入。
- **#46 三级页面全核查**：对照旧项目 Level3Dialog 16 处调用点，fork 凡走 dialog 的均已统一 Dialog base（3 级样式）。差异：①新建歌单/加入歌单原为底部 panel（#47 改 3 级弹窗）；②行政区划选择器（fork 榜单不按地区）；③均衡器（fork 无）；④下载设置/WebDAV 配置原在设置页（#49 迁出）。
- **#47 新建歌单/加入歌单改 3 级弹窗**：新增 `createMusicSheetDialog.tsx`、`addToMusicSheetDialog.tsx`（注册 dialogs map）；5+1 处调用点替换（homeBody/sheets 新建"+"、musicItemOptions、musicListEditor bottom、playAllBar、pluginItem、importMusicSheet:64 第 6 处），非 dialog 后调用用 `setTimeout(0)` 延后打开。旧 panel 文件删除（零引用）。

### 1.9 全面代码与功能核查轮（#50，2026-10-07）

> 4 个并行分区全量只读核查+修复无争议小 bug；功能缺失/大改动仅列清单待决策。基线 tsc exit 0→最终 exit 0。

**已修清单（择要）**：importMusicSheet:64 漏网第 6 处调用点；musicDetail 歌词/封面操作区/心形/播放键多处白色→主题色（P1）；localMusicSheet 注释修正；downloadingList 错误文案重复拆 errorDetail；dialog base:365 删除调试红底；permissions 删除 console.log；删除死 panel（addToMusicSheet/createMusicSheet）；musicBar:83 裸宽度 `<600`→useIsTablet()（全 src 裸宽度=0）；home/index renderTab 传 switchTab。

**#50 五项实际落盘修复**：①手机端设置齿轮（mineTab userCard 右上角 absolute 齿轮→navigate(SETTING,{type:"basic"})）；②全屏播放页定时关闭入口（musicDetail operations clock-outline→SetScheduleCloseTimeDialog）；③弹窗 i18n（createMusicSheetDialog/downloadSettingsDialog/addToMusicSheetDialog 全部改 t()，三语言文件补 key）；④checkUpdate 地址改个人 gitee 仓库（xujin621/Photo releases V1.0.0/version.json）；⑤albumDetail 标题改 albumItem.title。

**待决策清单（后于 2026-10-09 拍板）**：手机设置入口缺失（已修①）、全屏定时关闭入口（已修②）、新弹窗标题硬编码中文（已修③）、死代码 HomeDrawer/homeBodyHorizontal（已删）、albumDetail 标题（已修⑤）、checkUpdate 更新源（已改 gitee）、commonConst.ts:57 ".acc" 疑笔误（行为无影响保留）。已知差异维持：均衡器、下载暂停/重试（内核无 API）、行政区划选择器、封面写入、歌单管理独立页。备份入口实际可达=mineTab 2 处（抽屉未挂载属死代码）。

**回归确认**：#47 六处调用点统一；#48 basicSetting 无下载组残留；dialogs 12 组件/panels/types 18 项/pages 24 目录零遗漏；全 src 裸宽度=0；无 rpx(750) 回归。

### 1.10 字体字号行距统一核查与修复（2026-10-08）

> 4 个子代理并行核查一级页/二级页/三级弹窗面板/全局组件+列表行，2 专项（音乐库图片、状态栏）。

**统一结论**：
- 字体：全项目 0 处 fontFamily 散落，统一系统默认。
- 修复后：二级页 AppBar 标题全部 18 Bold 零 20sp 残留；歌曲行标题全站事实标准 body(15) Medium（后于 2026-10-14 C08 进一步统一为 content(16) Medium，见 1.14）；菜单/面板/弹窗选项行 16sp；序号 subTitle(14)；空态 subTitle(14)；Dialog 正文 13sp/行高 21；按钮 subTitle(14) Medium。
- 行距：Dialog 正文 21、面板/输入框 24、tip 18；8 处 rpx 字号全部档位化。

**专项修复**：
1. 下载管理三点菜单根因=AppBar 内建锚定气泡（两段式/平板错位）→弃用气泡，新增通用面板 AppBarMore（PanelBase 三级面板），5 处 menu= 调用点统一迁移（downloading/localMusic/artistDetail/musicSheetPage navBar/pluginList）。
2. 二级窗口状态栏图标变白根因=`base/statusBar.tsx` 默认 barStyle="light-content"→改默认跟随主题（`theme.dark?light-content:dark-content`）。
3. 音乐库图片：新增 `mediaItem/localSongCover.tsx`（异步读内嵌封面、进程内缓存、剥离 file://、失败降级渐变占位、非本地歌曲返回 null），接入 libraryTab 歌曲行与 MusicList 共享行。

**裁决不改项**：ListItem.Content 字符串标题 16sp（菜单/面板事实标准）；死组件（button.tsx color white/textButton/chip/sheetDetail header）；colorPicker/errorBoundary；topListDetail 序号 13/歌名 14、sheetDetail 序号 14（符合旧项目实测）；裸字面量有意特例 6 处（Dialog 正文 13/21、进度时间 11、平板歌名 20、播放页 32/19、插件项 12、扫描页行高 18）。

### 1.11 品牌视觉轮与同轮修复（2026-10-09）

- **启动页定稿 v4**：迭代历程=文生图音符❌→图生图锚点❌→4 变体用户选经典高清✅→白底未抠❌→包围盒裁切+圆角 mask⚠️（alpha 误压）→修正 mask+defringe✅→渐变增强 `#D8E9FA→#F0F8F3` 对角+华文行楷 60% 字宽✅。实现：透明图标 1360×1361（radius=22% 边长 mask）、启动页图标宽=画布 44%、mipmap 全密度替换（legacy 渐变底+透明图标、foreground 纯透明、adaptive 背景 `#5264C8→#C1D2FD` 不动）；应用内 brand-logo/logo/logo-transparent 改透明抠图（原图备份 `brand-assets/原版logo备份/`）。
- **Android 12+ 启动页变形修复**：根因 windowSplashScreenAnimatedIcon 引用整图（图标+字标）被系统缩放进 200dp 方形区→新增 `drawable-nodpi/splashscreen_icon.png`（1536² 正方形透明图标），styles.xml 改引用，背景渐变统一品牌 135°。代价：Android 12+ 系统启动页 API 无字标槽位，手机启动页无"极悦界"字标；API<31 平板仍走 fitCenter 整图。
- **搜索页返回手势手机端修复**：根因 BackHandler 仅平板搜索态注册→去掉 isTablet 限制，手机搜索态返回 switchTab(HOME)。
- **下载设置浮窗字体统一**：downloadSettingsDialog 选项行 normal(13)→subTitle(14)、选中 bold→medium（高亮由 primary 对勾承担）；分组标题 subTitle(14)+bold+primary 为三级浮窗唯一一家、结构吻合保留。

### 1.12 遗留待办汇总

- [x] 装机验证：0.6.2.1 起分批发版打包装机（2026-10-09）。
- [x] #50 待决策清单拍板：手机设置齿轮/全屏定时关闭/弹窗 i18n/checkUpdate gitee/albumDetail 标题均已修；HomeDrawer 死代码已删。
- [x] 功能迁移：均衡器已切换 JamesDSP 音效引擎完成（15 段自绘滑块 + 进阶音效）；标签编辑 v2 封面写入（Kotlin setArtwork+选图源）仍待决策。
- [ ] GitHub 自动推送源码与包：token 只读（push 403），需写权限 token。

### 1.13 UI 冲突统一处理总览（2026-10-14）

> 原则（用户拍板）：**每一个矛盾冲突先看同类组件多数派，少数服从多数**；逐条收集全部出现点→统计次数→出现最多者=统一标准→修改少数派；势均力敌或多数派本身不合理则保留"⏳ 待用户决策"。验证：改前 tsc exit 0→四组并行改→合并后全量复验 exit 0。备份 `E:\Temp\Deepseek\jiyuejie-ui-conflict-backup-20261014\`（22 个文件）。

| 状态 | 数量 | 冲突编号 |
|---|---|---|
| ✅ 已按多数派统一 | 16 | C01 C02 C03 C04 C05 C06 C07 C08 C11 C12 C13 C17 C18 C19 C20 C22 |
| ✅ 用户已拍板 | 5 | C09 C10 C15 C16 C21 |
| ⏳ 待用户决策 | 1 | C14 |

> **更新（2026-10-14 晚）**：C17（悬浮歌词滑块行）与 C19（分组标题）均**已按用户要求恢复原状**。当前有效统一为 **13 条**（C01~C08、C11、C12、C13、C18、C20、C22）；C12/C13 为"维持现状+文档成文"无代码改动。

### 1.14 冲突逐条处理明细 C01~C22

- **C01 AppBar 标题语义档** ✅：全项目 `fontSize="appbar"` 作 prop=0 次、`fontSize="title"`=31 次；AppBar 为唯一拥有专属语义档却错用 title 的离群点。AppBar 顶栏标题 title→appbar（像素同为 18，零视觉变化）。修改 `src/components/base/appBar.tsx:76`。
  > ⚠️ 修正核对：合并时 Grep `appBar.tsx` 确认第 96 行 `fontSize="appbar"`（行号由 76 漂移至 96，改动在位）。
- **C02 Checkbox 勾内图标 size=18** ✅：对话框/面板勾选图标全部 iconSizeConst.light(20) 为多数。Checkbox "✓" 18→20。修改 `checkbox.tsx:35`。
- **C03 Input 未内置默认字号** ✅：基础文字组件全部内置默认 fontSize，Input 唯一例外；12 调用方仅 3 个显式 content(16)。Input 增加默认 `fontSize: fontSizeConst.content`(16)。修改 `input.tsx` defaultStyle。
- **C04 LinkText 链接色硬编码 #66ccff** ✅：交互强调色全项目走 colors.primary。LinkText 改 colors.primary（明 #2F6FED/暗 #5A8FFF），下划线保留，按下态 alpha 0.4 派生。修改 `linkText.tsx`。
- **C05 Tip/Toast 用原生 Text** ✅：ThemeText 全项目 346 处/94 文件。Tip 气泡→ThemeText description(12)；Toast 消息→content(16)+colors.text；Toast action→content(16)+white。修改 `tip.tsx`、`toast.tsx`。
- **C06 ErrorBoundary rpx 硬编码** ✅：9 处原生 Text→ThemeText（设备信息 label description12/value body15+medium；错误详情 description12；堆栈 caption11+monospace）。修改 `errorBoundary/index.tsx`。
- **C07 歌单卡标题档位** ✅：normal(13)+medium 3 处（PlaylistCard 体系）为多数；搜索结果歌单卡（SheetItem→ImageBtn）subTitle(14)+regular→normal(13)+medium。修改 `imageBtn.tsx:27-28`。
- **C08 列表行标题 body(15) vs ListItem.Content content(16)** ✅：content(16)+medium 约 38 处为多数。TitleAndTag 系 4 处+topListItem+libraryTab LocalSongItem+playList/body 共 7 处 body(15)→content(16)。修改 `titleAndTag.tsx:16`、`topListItem.tsx:57-59`、`libraryTab.tsx:586-590`、`playList/body.tsx:56`。
  > ⚠️ 修正核对：合并时 Grep `titleAndTag.tsx:16` 确认为 `fontSize="content" fontWeight="medium"`（改动在位）。
- **C09 三级浮窗底部按钮行有无** ✅ 用户拍板候选A：24/28 对话框渲染 Actions 为多数，但即改即生效型（开关/滑块/单选，4 个）不渲染 Actions 整块，内容区贴底。代码现状已符合，无改动，规则成文。
- **C10 对话框底部按钮自布局 vs 基座 BottomButton** ✅ 用户拍板候选B：22/24 用基座为多数，保留 DownloadDialog/SortDialog 自布局特例，规范"自布局必须行高 52+subTitle(14) 起步"。无代码改动。
- **C11 EditSheetDetailDialog 缺 Dialog.Title** ✅：27/28 有标题为多数。补 `<Dialog.Title withDivider>`（i18n `panel.editMusicSheetInfo.title`）。修改 `editSheetDetail.tsx:97-100`。
- **C12 Dialog.Content 正文实际 13px** ✅ 文档修正：基座 defaultFontStyle=13/行高 21，全部对话框正文实际 13px。规范"对话框正文=normal(13)/行高 21 独立档位，不从 content(16) 派生"。无代码改动。
- **C13 基座 BottomButton 无 danger 类型** ✅ 维持现状：危险操作=SimpleDialog(okText="删除" type=primary)（约 7 处为多数）；内容区红底按钮仅用于"取消定时"即时执行型。无代码改动。
- **C14 PanelHeader 与 Dialog.Title 视觉规格差异** ⏳ 待用户决策（倾向候选B：承认两套规格为有意区分）：PanelHeader（9 处右侧浮出层标题条：56dp 对角渐变无胶囊）vs Dialog.Title（29 处居中弹窗：52dp 水平三段渐变带胶囊）内部各自一致、无跨体系多数派。2026-10-14 用户四项载体决定已隐含印证：①歌曲选项/全屏歌词头部保留特例；②播放队列头部并入 PanelHeader；③搜索歌词落位与其他面板一致；④图片查看由全屏面板迁入三级弹窗（新建 imageViewerDialog）。
- **C15 TimingClose 双载体** ✅ 用户拍板：保留居中浮窗版 TimingCloseDialog，下线面板版（musicItemOptions"定时关闭"改 showDialog），面板文件与注册移除。
- **C16 SetFontSize 双载体** ✅ 用户拍板：下线面板版（入口在浮窗版 musicItemLyricOptions，面板版全库无调用=死代码），文件与注册移除。
- **C17 设置页滑块标签行** ⚠️ 已统一后回退：原 basicSetting 悬浮歌词 4 滑块"标签+滑块同行无数值"曾改 backgroundCustom 式"标签行在上+右数值+滑块在下"；2026-10-14 晚用户指示恢复原状（标签+滑块同行、无数值、行高 48），已回退。
- **C18 设置行标题字号** ✅：content(16)+medium 绝对多数。scanSettings 三行标题（管理外部存储权限/不扫描 60 秒以下音频/添加被屏蔽文件夹）body(15)+regular→content(16)+medium；AddRow 后改与权限行完全一致（正文色+20 图标 primary+右箭头）。修改 `scanSettings/index.tsx:265/347/381`。
- **C19 页面分组/区块标题字号颜色** ⚠️ 已统一后回退：原 mineTab 3 处/recommendSection/libraryTab 共 5 处 content(16)+bold+text 曾改 subTitle(14)+bold+primary；2026-10-14 晚用户指示"恢复黑色，与设置页不需要统一"，已回退 content(16)+bold text 色。
- **C20 ThemeText fontSize prop 被 inline 覆盖** ✅：tabBar 平板顶栏 Tab 文字与 tabletPanel 问候语两处死 prop（实际 inline fontSize:32）→新增档位 `xlarge:32`，删 inline 覆盖（渲染仍 32px，prop 成真实来源）。修改 `uiConst.ts:24-26`、`tabBar.tsx:166-179`、`tabletPanel.tsx:157-162`。
  > ⚠️ 修正核对：合并时读取 `uiConst.ts` 第 25~26 行确认 `xlarge: 32` 在位（注释"平板顶栏 Tab/问候语大字号"）。
- **C21 首页入口卡标题（手机版）** ✅ 用户拍板候选C 分级：三写法各 1 处平手→横排入口卡（金刚区/音乐库四入口）统一 title(18)+bold，紧凑竖排统计卡（MineStatCard）保持 normal(13)+bold。operations.tsx:184 body(15)→title(18)。
- **C22 多处硬编码 fontSize** ✅ 部分统一：①mineTab 头像"极"字 24→large(22)；②pluginItem 可用率标签 12→description、pluginSort 平台徽章 11→caption；③播放页 hero 大字号（musicDetail 32/19、immersiveLayer 34/26/50 等）内部一致全部硬编码、按 isTablet 自适应并与 lineHeight 紧耦合→判定保留硬编码、登记《播放页专用字号表》。

### 1.15 规范文档同步与漂移修正

`docs/UI规范-字体与层级.md` 同步：第 8 章 22 条冲突全部标注状态；第 1 章档位表新增 xlarge:32；第 2~7 章漂移修正（AppBar fontSize=appbar、LinkText=primary、Tip/Toast 迁 ThemeText、Checkbox light20、Input 默认 content16、ErrorBoundary 入档、TitleAndTag 系 content16、ImageBtn 统一 normal13、对话框正文=13 独立档、危险操作=SimpleDialog primary、editSheetDetail 补标题、AppBar 默认字重 medium→bold 修正、C17/C19 回退注记、scanSettings content16+medium、tabBar/tabletPanel xlarge、头像 large22、新增播放页专用字号表）。

### 1.16 待决策清单与后续决策记录

- **C14**：⏳ 待用户明确确认承认 PanelHeader/Dialog.Title 两套规格（2026-10-14 四项载体决定已隐含印证，建议候选B）。
- **附注（C17 统计口径）**：按"滑块组"口径 backgroundCustom 2 组 vs basicSetting 1 组；按"渲染行"口径 4:2 反向。用户最终选择恢复原状（保留写法A）。
- **附注（C01 语义判定）**：按"AppBar 拥有专属语义档 appbar 却错用 title"判定离群点；像素同 18 零视觉变化，若倾向全局 title 可一键回退。
- **后续决策 D1（歌单批量编辑入口合并，2026-10-14）**：插件/API/专辑歌单详情页原同时存在顶栏三点菜单"批量编辑"与头部 ✎ 编辑按钮（功能重复）。用户拍板：删三点菜单（连同无剩余项的三点按钮），头部 ✎ 改 showDialog("MusicListEditorDialog")。修改 `musicSheetPage/components/navBar.tsx`（仅留搜索）、`base/playAllBar.tsx`（✎ 改浮窗版）。保留：MUSIC_LIST_EDITOR 独立二级页仍被歌手详情/本地音乐"批量编辑"使用；本地歌单详情页不受影响。备份 `E:\Temp\Deepseek\jiyuejie-sheeteditor-merge-20261014\`。

---

## 第2章 UI 统一改动位置清单（16 条）

> 来源：`UI统一16条改动位置清单.md`（2026-10-14，派生自第1章 1.14 的冲突处理）。**更新（2026-10-14 晚）：C17/C19 已恢复原状，当前有效 13 条**（C01~C08、C11、C12、C13、C18、C20、C22）；其中 C12/C13 无代码改动，其余 11 条有代码改动。行号为改动当时位置（可能随开发漂移，以文件内注释/就近定位为准）。

### 2.1 按软件中位置索引

| # | 冲突 | 软件中位置（用户视角） | 改动内容 | 代码文件 |
|---|---|---|---|---|
| C01 | AppBar 标题语义档 | 所有页面顶部标题栏 | 标题语义 title→appbar（像素同 18，零视觉变化） | `src/components/base/appBar.tsx:76` |
| C02 | 复选框勾选图标尺寸 | 勾选/多选场景 Checkbox | 框内 ✓ 18→20（iconSizeConst.light） | `src/components/base/checkbox.tsx:35` |
| C03 | 输入框默认字号 | 所有输入框（12 处） | 未设字号 9 处系统默认≈14→16（content） | `src/components/base/input.tsx`（defaultStyle） |
| C04 | 链接文字颜色 | 链接文字（关于页/协议） | #66ccff→主题色 primary（明 #2F6FED/暗 #5A8FFF） | `src/components/base/linkText.tsx` |
| C05 | Tip/Toast 原生 Text | 全局提示气泡 Tip 与轻提示 Toast | 气泡/消息/按钮文字迁 ThemeText（12/16 档） | `tip.tsx`、`toast.tsx` |
| C06 | 错误页字号 | 错误兜底页 ErrorBoundary | 设备信息/详情/堆栈 9 处→ThemeText（12/15/11） | `errorBoundary/index.tsx` |
| C07 | 歌单卡标题档位 | 搜索结果歌单卡 SheetItem | 卡标题 14→13（normal+medium） | `src/components/base/imageBtn.tsx:27-28` |
| C08 | 列表行标题字号 | 音乐/专辑/歌词/歌手行、榜单行、本地歌曲行、播放队列行（7 处） | 行标题 15→16（content+medium） | `titleAndTag.tsx:16`、`topListItem.tsx:57-59`、`libraryTab.tsx:586-590`、`playList/body.tsx:56` |
| C11 | 编辑歌单信息弹窗缺标题 | 歌单信息编辑弹窗 | 补渐变标题条"编辑歌单信息" | `dialogs/components/editSheetDetail.tsx:97-100` |
| C12 | 对话框正文 13px | 所有居中对话框正文 | 成文"对话框正文=normal(13)/行高 21"，无代码改动 | 文档成文（`docs/UI规范-字体与层级.md`） |
| C13 | 危险按钮无 danger 类型 | 删除类确认对话框 | 维持 SimpleDialog(okText="删除" type=primary)+文档注明，无代码改动 | 文档成文 |
| C17 | 悬浮歌词滑块行写法 | 设置→悬浮歌词 4 滑块 | ~~改标签行在上+右数值+滑块在下~~ **已恢复原状**（标签+滑块同行、无数值） | `settingTypes/basicSetting.tsx`（恢复 sliderContainer 原写法） |
| C18 | 扫描设置行标题字号 | 扫描音乐设置页 3 行标题 | 行标题 15→16（content+medium） | `pages/scanSettings/index.tsx:265/347/381` |
| C19 | 页面分组标题不统一 | 首页推荐歌单区、我的页 3 处、音乐库排序行 | ~~改 14+bold+primary~~ **已恢复原状**（16+bold text 黑色，与设置页不统一） | `mineTab.tsx`（3 处）、`recommendSection.tsx:204`、`libraryTab.tsx:382` |
| C20 | 平板顶栏 Tab/问候语死 prop | 平板顶部 Tab 文字、问候语 | 新增 xlarge=32 档，删 inline 32（渲染仍 32） | `constants/uiConst.ts:24-26`、`tabBar.tsx:166-179`、`tabletPanel.tsx:157-162` |
| C22 | 散落硬编码字号 | 我的页头像"极"字、插件可用率标签、插件排序徽章；播放页 hero 保留 | 头像 24→22(large)；可用率 12→description；徽章 11→caption；hero 登记专表 | `mineTab.tsx:196-198/691-695`、`pluginItem.tsx:288`、`pluginSort.tsx:269` |

### 2.2 按改动性质分组

- **A. 基础组件层（改一处全局生效）**：C01 appBar.tsx:76；C02 checkbox.tsx:35；C03 input.tsx defaultStyle；C04 linkText.tsx；C05 tip.tsx/toast.tsx；C06 errorBoundary/index.tsx（9 处）；C07 imageBtn.tsx:27-28。
- **B. 列表/页面层**：C08 四处文件；C17 basicSetting.tsx:640-725（已回退）；C18 scanSettings/index.tsx:265/347/381；C19 mineTab/recommendSection/libraryTab（已回退）；C20 tabBar/tabletPanel（档位 uiConst.ts:24-26）；C22 mineTab/pluginItem/pluginSort。
- **C. 对话框层**：C11 editSheetDetail.tsx:97-100；C12/C13 无代码改动。

### 2.3 用户验收自查清单

1. 顶部标题栏字号无变化（C01）。
2. 设置页任何输入框文字为 16（C03）。
3. 关于页链接文字为蓝色主题色（C04）。
4. 搜索结果歌单卡标题比之前小 1px（C07）。
5. 音乐列表/播放队列歌名比之前大 1px（C08）。
6. 长按歌单→编辑信息，弹窗有渐变标题条（C11）。
7. 设置→悬浮歌词 4 滑块：**标签+滑块同行、无数值**（C17 已恢复原状）。
8. 扫描设置页 3 个行标题略大（C18）。
9. 首页"推荐歌单"、我的页分组标题为**黑色标题（16+bold text 色），与设置页不统一**（C19 已恢复原状）。
10. 插件管理可用率/徽章字号归档（C22）。

---

## 第3章 列表行与浮窗样式一致性核查

> 来源：`列表行与浮窗样式一致性核查报告.md`（合并版）。上篇=《MusicFree列表行样式统一性核查报告》（行体系 HD-1~10+F1~F14）；下篇=《全项目列表浮窗样式一致性核查报告》（浮窗/面板/全项目 88 条，P0×6/P1×43/P2×39）。
> 换算口径：rpx(x)=x/750×短边，@375dp 宽≈x/2 dp。早期报告开发根记为 `E:\xunwu\MusicFreeApp\MusicFree`（历史路径，当前项目根为 `E:\xunwu\Deepseek\jiyuejie`，源码相对路径一致）。

### 3.1 全局基准（比对零点）

| 项 | 值 | 出处 |
|---|---|---|
| heightType 档 | big64/normal56(默认)/small48/smallest36/none | listItem.tsx |
| 左右 padding | 16（默认 left/rightPadding=16） | listItem.tsx |
| Content 字符串标题 | ThemeText 未传 fontSize→content=16（后 C08/F14 字重 medium） | themeText/listItem |
| Content 字符串副标题 | description12/textSecondary，marginTop 2 | listItem.tsx |
| ListItemImage 封面 | 48×48，borderRadius 8 | listItem.tsx |
| ListItemIcon 默认 | iconSize=normal24，left 时 marginRight=16 | listItem.tsx |
| 按压态 | TouchableHighlight underlayColor=colors.listActive；行无圆角/背景 | listItem.tsx |
| 分隔线 | ListItem 无内建；Divider 全宽 1dp/colors.divider | divider.tsx |
| ListItemHeader | smallest36、subTitle14/bold/textSecondary、marginTop12 | listItem.tsx |
| fontSizeConst | tag10/caption11/description12/normal13/subTitle14/body15/content16/title18/large22（+xlarge32/appbar18） | uiConst.ts |
| iconSizeConst | small16/light20/normal24/big32/large40 | uiConst.ts |
| 三级浮窗基座 | Content paddingH24（行内 ListItem 再叠16→文字距窗40）；标题行 52/title18 bold；按钮行 52/subTitle14 medium | dialogs/base |

### 3.2 分页面行样式快照

**共享媒体行**：歌曲行 musicItem.tsx=big64/封面48·8带 LocalSongCover/标题 body15·medium/副 description12·textSecondary(高亮 primary)/序号槽40·subTitle14 italic/三点 normal24·槽宽40；LyricItem/albumItem 同款；playlistCard=宽130/封面130·12/标题 normal13·medium/副 caption11/角标 tag10；topListItem=paddingH16·V10/图标块40·10 渐变 fire20/标题 body15·medium/副 description12/分隔线 marginLeft70 textSecondaryα0.15/按压 primaryα0.06；本地歌曲行 libraryTab=自绘封面 LocalSongCover size44·8/标题 content16·medium/副 normal13/三点20/分隔线 marginLeft56。

**一级页面**：抽屉入口行 normal56/content16·regular/图标24；歌手结果行 big64+封面48·8+body15·medium；入口卡=自绘 Pressable+渐变（minHeight84~140、标题多档、圆角16~20、多数原无按压态）；我的竖排入口行 paddingV14/body15·medium/Icon20 primary。

**二级页面**：播放队列行 playList/body=序号 subTitle14(当前 bold)/歌名 body15(当前 bold 否则 medium)/副 description12/删除 small16/radius10；最近播放 history=paddingV10·H8/首字符块44·8·title18 primary/歌名 body15·medium/副 description12/无封面无三点；本地歌单详情 sheetDetail=序号块44²·8 surfaceVariant/subTitle14 primary/歌名 body15·medium/副 description12/estimatedItemSize64；排行歌曲行 topListDetail=paddingH16·V8/封面44·8/歌名 subTitle14·medium/序号 width32·normal13/分隔线 marginLeft92；歌单管理行卡 sheetManager=padding12/标题 content16·medium/副 normal13/图标块48·10/删除20/radius14 surfaceVariant；本地分组行 localGroup=paddingV6·H16/body15·medium/副 description12/图标块48·10/Icon26/分隔线 marginLeft68；下载任务卡 downloadingList=padding12/body15·medium/副 description12/状态图标24/radius14/separator height8；接口歌单网格卡 apiSheets=封面1:1·radius12/标题 normal13·medium/副 caption11/角标22·11；统计页=总览卡 minHeight110·radius18·value large22 bold/排行行 subTitle14·medium/rankBox32·圆16。

**设置族**：basicSetting=small48/content16/组卡 radius rpx14/行间 hairline marginLeft rpx16；备份/主题/订阅源行原默认 normal56；pluginItem=paddingV rpx18/名称 title18/版本 subTitle14/容器原 rpx8≈4dp；scanSettings=自绘开关行 paddingH4·V6/标题 body15/Icon20/无分隔线；fileSelector fileItem=height rpx96≈48/路径 normal13/图标 light20；permissions=big64/content16。

**三级浮窗**：addToMusicSheetDialog=small48/Image48·8/content16；menuDialog=small48/图标 light20/content16；radioDialog=small48/图标原 normal24；importMusicSheetDialog 选源行原漏传 heightType→normal56；downloadSettingsDialog=自定义 Pressable paddingV6·paddingH4/标签 normal13/选中 check-circle light20 primary。

**面板**：musicItemOptions/musicItemLyricOptions/appBarMore=small48/light20/content16/头部封面 rpx140；simpleSelect=small48/无图标；setUserVariables/importMusicSheet（面板版）原漏传→normal56；musicQuality/playRate=自定义 height rpx96≈48/paddingH rpx24≈12。

**全屏歌词**：lyricItem=居中 Text/字号 rpx24·30·36·42≈12·15·18·21/paddingH rpx64≈32/paddingV rpx14≈7/普通 opacity0.6/高亮 primary；lyricOperations=栏高 rpx56≈28/图标 normal24·textSecondary。

### 3.3 一致性结论与硬差异分级 HD-1~HD-10

一致面：small48 是菜单/选项行事实主流；媒体行标题均 body15；副标题统一 description12/textSecondary；浮窗/面板菜单行图标 light20；卡片圆角 sheetManager/downloading/scanCard/统计卡统一 14；封面占位 48/8。

硬差异：
- **HD-1（高）歌曲行本体 5 套变体**：封面 48 vs 44、标题 body15 vs subTitle14、行高 64 vs padding 自然高。
- **HD-2（高）选项/选源行高 48 vs 56**：3 处漏传 heightType（importMusicSheetDialog、panels/importMusicSheet、setUserVariables）。
- **HD-3（高）菜单行标题双轨**：基座 Content 默认 content16/regular vs 媒体行 TitleAndTag body15/medium；与 uiConst 注释"列表项标题=normal13"也不符。
- **HD-4（中）radioDialog 图标 normal24 ≠ 菜单系 light20**。
- **HD-5（中）radioDialog getItemLayout=56 与实际 48 错位**。
- **HD-6（中）面板/页面行左右 padding 三档 16/12/4**。
- **HD-7（中）歌单详情头副行双实现**：musicSheetPage"共N首"=description12 vs sheetDetail"N首歌曲"=subTitle14。
- **HD-8（中）分隔线五套缩进+三套颜色**：56/8/68/70/92。
- **HD-9（低）pluginItem 卡片圆角 rpx8≈4dp**。
- **HD-10（低）自绘卡片普遍无按压态**。

合理差异：全屏歌词行、首页/我的/音乐库入口卡、网格卡、timingClose/chip/TypeTag、平板 vs 手机尺寸分档、drawer 入口行 normal56。

### 3.4 修复建议 F1~F14 与执行记录（2026-10-08）

> 执行后全树 SHA-256 比对 src 差异恰为 22 文件；逐项核验；`npx tsc --noEmit` exit 0；未打包未 commit。

| 项 | 修复内容（前→后） | 文件 |
|---|---|---|
| F1 | radioDialog getItemLayout normal(56)→small(48) | dialogs/components/radioDialog.tsx |
| F5 | radioDialog 行图标补 iconSize light(20)（原默认 normal24） | 同上 |
| F2 | importMusicSheetDialog 选源 ListItem 补 heightType="small" | dialogs/components/importMusicSheetDialog.tsx |
| F3 | 同上 | panels/types/importMusicSheet.tsx（第 395 行 height:56 经核为圆角输入框非列表行，未动） |
| F4 | 同上 | panels/types/setUserVariables.tsx |
| F11a | 新增命名导出 ListDivider（hairline、marginLeft 默认 60 可覆盖、colors.divider） | base/divider.tsx |
| F14 | 【原需产品决策，按默认执行】Content 字符串标题字重 regular(400)→medium(500)（字号仍 content16） | base/listItem.tsx |
| F6 | topListDetail 歌名 subTitle(14)→body(15)；封面 44→48（圆角8）；分隔线改 ListDivider marginLeft92 | pages/topListDetail/index.tsx |
| F7 | sheetDetail 不整体复用 MusicItem（理由：序号块锚点设计语言不同/本页有意无封面/MusicList 重构回归风险），序号块 44²→48²、paddingVertical 10→8（行高保持 64） | pages/sheetDetail/components/sheetMusicList.tsx |
| F8 | 副行"N首歌曲" subTitle(14)→description(12)（对齐 musicSheetPage） | sheetDetail/components/header.tsx |
| F9 | musicQuality/playRate 行 paddingHorizontal rpx24≈12→16（仅 body，header 不动） | panels/types/musicQuality.tsx、playRate.tsx |
| F10 | downloadSettingsDialog OptionRow/pathRow 与 scanSettings 各设置行 paddingHorizontal 4→16（对齐 basicSetting） | dialogs/components/downloadSettingsDialog.tsx、pages/scanSettings/index.tsx |
| F11b | 五处分隔线替换 ListDivider：libraryTab(56)/basicSetting 组内×5(16)/localGroup(68)/topListItem(70)/topListDetail(92)；rgba(128,128,128,0.25/0.18) 清零 | libraryTab/basicSetting/localGroup/topListItem/topListDetail |
| F12 | pluginItem 容器 borderRadius rpx8≈4→rpx28≈14dp（内嵌徽章 rpx8 不动） | pluginItem.tsx |
| F13 | 自绘卡补按压态：statsRow 统计卡、operations 金刚区(α0.08→0.06)、mineTab 三处、libraryTab 四入口卡、historyPanel 热门网格项 | statsRow/operations/mineTab/libraryTab/historyPanel |

**F11b 有意偏离"统一 marginLeft=60"**：各行左槽宽度不同（libraryTab 封面44、localGroup 图标块48、topListItem 16+40+14、topListDetail 32+48、basicSetting 卡片内无前置图标行），统一 60 会与文字左缘错位。故统一同一组件+统一 colors.divider+统一 hairline，缩进按各行左槽对齐（56/16/68/70/92）。

**遗留项**：libraryTab 本地歌曲行封面仍 44（若统一 48 其 ListDivider 缩进需联动 60）；radioDialog 右侧选中 check 图标仍 normal24（F5 只列左侧）；localGroup 等自绘行无按压态；第 5 节待补查（iconButton/themeSwitch/checkbox 内部尺寸、ImageBtn 内部、AppBar/PanelHeader 内部、estimatedItemSize 偏差）后续由下篇覆盖。

### 3.5 全项目浮窗核查结论（88 条）

> 触发：全屏播放页点歌单弹出的歌曲列表"规范不一致"。5 个并行子代理+组织者自核 2 片，覆盖 panels/dialogs/mediaItem/musicList/musicSheetPage/musicBar/base/全 pages 列表浮窗。总计 **P0=6、P1=43、P2=39**。2026-10-13 核对：P0-1~P0-6 全部已在 0.6.2.9 代码中修复。

要点：
1. **投诉根因 P0-1**：PlayList 面板 Header 原整行 rpx（height rpx(80)≈40dp@375），行内两个 IconTextButton 实高 48dp→溢出/挤压；共享 PanelHeader 固定 56dp，此 Header 是唯一自绘≈40dp 标题行。
   > ⚠️ 修正：合并时核对 `playList/header.tsx` 已整体改为 `<PanelHeader hideButtons>`（循环/清空按钮移至 body.tsx 底部工具条），P0-1 已闭环（即 1.14 C14 第 2 项载体决定）。
2. **滚动定位 P0×4**：musicItemOptions:43、musicItemLyricOptions:31 getItemLayout 用 rpx(96) 而真实行高 small=48；musicListEditor 拖拽列表 itemHeight=rpx(120) vs 共享 MusicItem 64；pluginSort:22 ITEM_HEIGHT=rpx(96)。P1 另有 4 处 estimatedItemSize 用 rpx 估算 vs 固定 64（searchLrc/LyricList、artistDetail/resultList、searchMusicList/searchResult、searchPage/resultWrapper）。
3. **触控 P0**：apiSheets:213-218 收藏钮 26×26+hitSlop4=34dp<48。
4. **行/控件 rpx 残留**（P1+P2 70 余条）：自绘 Header/操作栏/分组标题行高、面板容器高度、滑块/进度条/输入框/搜索框/芯片、图标槽、Tab 标签宽、卡片圆角（basicSetting 组卡 rpx14≈7dp）等，跨 360→800dp 漂移 2.2 倍。
5. **早期遗留核实**：仍在——radio/sort/playRate 右侧选中 check normal24、libraryTab 本地歌曲行封面 44、localGroup 自绘行无按压态、statistics 排行歌名 subTitle14。**未复现**——订阅源行已 small（subscriptionSettingDialog:136）、localMusicList 封面已 48（44 仅 libraryTab）。
6. **已修基线零回退**：43 条尺寸修正+F1~F14 全部保持；菜单/选项/单选行高全项目 small48（无漏传 56）；共享媒体行统一 big64+封面48/8+body15/medium；getItemLayout 在 radioDialog/sortDialog 已正确。

### 3.6 P0 明细（6 条，已修）

| # | 文件 | 行号 | 现值→建议值 | 理由 |
|---|---|---|---|---|
| P0-1 | panels/types/playList/header.tsx | 52-56/61-63 | rpx750·rpx80·rpx24·rpx18·rpx12 → "100%"·56·16·12·12（或改共享 PanelHeader） | 40dp 行装 48dp 按钮溢出；全项目唯一自绘≈40dp 面板标题行。**实际已改为 PanelHeader** |
| P0-2 | panels/types/musicItemOptions.tsx | 43 | ITEM_HEIGHT=rpx(96)→48 | @375 碰巧 48，@480+ 每行偏移多算 13~54dp |
| P0-3 | panels/types/musicItemLyricOptions.tsx | 31 | 同上→48 | 孪生文件 |
| P0-4 | pages/musicListEditor/components/musicList.tsx | 18/45 | ITEM_HEIGHT=rpx(120)→64；itemPaddingRight=rpx(100)→50 | SortableFlatList 拖拽绝对定位，@800=128dp 逐级错位 |
| P0-5 | settingTypes/pluginSetting/views/pluginSort.tsx | 22 | ITEM_HEIGHT=rpx(96)→48 | @360=46.1<48 触控线，同源漏改 |
| P0-6 | pages/apiSheets/index.tsx | 213-223/283 | starButton 26×26+hitSlop4=34dp→按钮 40×40 或 hitSlop 补 11（=48） | 低于 48dp 触控底线 |

### 3.7 P1 明细（43 条）

同模式多位置项：
- **P1-A Tab 标签宽 rpx(160)（6 处）**：topListBody:49、artistDetail/body:59、recommendSheets:111、apiSheets:97、resultPanel:58、searchLrc:162→固定 120 或 padding 自适应。
- **P1-B 单选行右侧选中 check 未传 iconSize→normal24（3 处）**：radioDialog:114-117、sortDialog:111-114、playRateDialog:49-52→补 light(20)。
- **P1-C estimatedItemSize 用 rpx vs 固定 64（4 处）**：searchLrc/LyricList:32、artistDetail/resultList:12（另 L44/48 折叠阈值联动）、searchMusicList/searchResult:12、resultWrapper:80（sheet 网格分支保留比例估计）。
- **P1-D 面板内容/输入框 padding/margin/圆角 rpx（6 处）**：simpleInput:110-111、associateLrc:110-111、searchLrc:102/90、setUserVariables:109-111、sheetTags:93→margin12/radius6/paddingV8/内容行 paddingH16。
- **P1-E 面板容器高度 rpx（6 处）**：musicQuality:35/simpleSelect:24/setFontSize:26/setLyricOffset:41=rpx(520)、timingClose:49=rpx(450)、colorPicker:185=rpx(750)→统一 vh/vmax。
- **P1-F 菜单行 ListItemIcon 槽宽 rpx(48)≈24（4 处）**：musicItemOptions:269、musicItemLyricOptions:242、appBarMore:67/99→width28（图标20+间距8）。

面板族其余：musicQuality 音质选项行高 rpx96→48；timingClose 控制簇 rpx→80/48/12。

弹窗族（11 条）：volumeSettingDialog 滑块 height rpx64/marginH rpx24→40/12；updateDownloadDialog 进度条 height rpx14/radius rpx7→8/4；timingCloseDialog timeItem paddingV rpx16→10+hitSlop4；setScheduleCloseTimeDialog inputContainer minHeight rpx72/borderWidth rpx2→48/1；setFontSizeDialog 4 档标签绝对 rpx 定位→flex 均分（rpx646@375=323dp 超宽溢出）+sliderContainer rpx80→40；editSheetDetail row rpx120/cover rpx100·rpx28→60/56×56·8；musicListEditorDialog header rpx64·rpx8→48/16。

共享行组件（3 条）：SortableFlatList:364/430 拖拽手柄 width rpx100→48；musicList/index:178-179 定位当前曲圆钮 36→44 或 hitSlop6；iconButton 无内置触控盒/chips 关闭钮 small16 无 hitSlop→补 44×44 或默认 hitSlop。

歌单/榜单页：topListDetail estimatedItemSize 60→64；artistDetail 吸顶折叠阈值随 rpx 漂移按固定 64 重算；statistics 排行歌名 subTitle14·medium→body15·medium；网格封面圆角 12→14（apiSheets:199/recommendSheets:324）；musicListEditor body 操作栏 rpx88·rpx24→56/16、bottom 操作栏 rpx144·rpx12→88/6；topListDetail:184/190 双重 paddingH16→去一层。

搜索/本地页：searchMusicList 搜索框 borderRadius/height rpx64→40/20；localGroup 自绘行无按压态→补 pressed primary α0.06；sheetManager 删除图标 size20+padding4=28→hitSlop10；downloadingList 删除按钮 hitSlop8+24=40→hitSlop12。

设置族（5 条）：basicSetting 跳转箭头 rpx24→light20/16；basicSetting:526-528 与 backupSetting:372-374 分组标题行 paddingH rpx24·height rpx56→36/16；组卡圆角 rpx14≈7≠14（basicSetting:537/backupSetting:383/mode:63-68）→14；mode:31 ListItem 漏传 heightType→small；basicSetting:696-699 悬浮歌词字号 Slider 值 rpx→固定 dp。

音乐详情/首页（3 条）：navBar.tsx 顶栏整条 rpx（height rpx88/maxHeight rpx64/图标 rpx32）→56/40/20；libraryTab:540 LocalSongCover size44→48（L424 ListDivider marginLeft 56 联动 60）；libraryTab:543-551 本地歌曲行标题 content16·medium/副 normal→对齐媒体行 body/medium+description。

### 3.8 P2 明细（建议性优化）

> 完整 37 条编号逐条列出（原报告标题称 39 条，系"同模式多位置按一条计"的统计口径差异；编号 1~37 行中第 1/5/9/10/14/35 等行内含多个文件位置）。完整 39 条源自原报告（已归档）。

| # | 切片 | 文件:行号 | 现值 | 建议值 | 理由 |
|---|---|---|---|---|---|
| 1 | 面板 | panels/types/ 11 文件死样式 | 含 rpx() 的 width/padding/height 定义，JSX 未引用（musicQuality:87-91、simpleSelect:69-80、simpleInput:98-108、setUserVariables:90-100、timingClose:98-105、setFontSize:63-67、setLyricOffset:97-101、sheetTags:85-98、associateLrc:101-108、colorPicker:347-354/426-428、searchLrc/index:93-100） | 删除 | 冗余代码，避免死 rpx 误判 |
| 2 | 面板 | base/panelBase.tsx:266-267 | `borderTopLeftRadius/RightRadius: 16` | 14 | 面板基座圆角 16 vs 卡片规范 14，观感微差 |
| 3 | 面板 | setLyricOffset.tsx:112-113 | `btn { width/height: rpx(144) }` | 固定 72 | 大按钮触控达标，仅跨设备放大到 153dp |
| 4 | 面板 | imageViewer.tsx:77 | `button { paddingHorizontal: rpx(200) }` | 固定 96 | 全屏预览操作按钮 padding 漂移 |
| 5 | 面板 | musicItemOptions.tsx:300-302/292、musicItemLyricOptions.tsx:273-275/265 | 详情头封面 `rpx(140)`/圆角 `rpx(16)`/header 高 `rpx(200)` | 封面固定 72（或按"封面比例"保留） | 70→150dp 放大，非列表行 |
| 6 | 面板 | searchLrc/index.tsx:174 | 指示条 `height: rpx(4)`（另 resultPanel/index.tsx:70 同款） | 固定 3/hairline | 纯视觉线（与 P1-A Tab 宽同文件） |
| 7 | 弹窗 | menuDialog.tsx:56/80 | `width={rpx(48)}` 未传 fixedWidth | 删除或改 `fixedWidth width={48}` | listItem.tsx:161 未传 fixedWidth 时 width 被忽略，死属性（早期报告"槽宽rpx48"实为误读） |
| 8 | 弹窗 | volumeSettingDialog.tsx:46-49 | `<Icon size={24}>` 字面量 | `iconSizeConst.normal` | 值正确，未走常量体系 |
| 9 | 弹窗 | updateDownloadDialog.tsx:267/283 | `progressRow paddingH: rpx(8)`、`percentText { marginLeft: rpx(16), width: rpx(72) }` | 固定 8/12/36 | 非触控内边距/预留宽 |
| 10 | 弹窗 | setScheduleCloseTimeDialog.tsx:137-138/153/121-123 | inputContainer paddingH rpx(16)/textInput paddingV rpx(12)/dialogContent padding rpx(24,20) | paddingH 16、paddingV 6、dialogContent 复用基座 Content | 内边距漂移；dialogContent 与基座 paddingH24 叠加达 36dp 偏宽 |
| 11 | 弹窗 | checkStorage.tsx:82-85 | `scrollView { paddingHorizontal: rpx(26) }` | 固定 13 | 正文滚动区内边距 |
| 12 | 弹窗 | downloadDialog.tsx:128/149 | `scrollView paddingH rpx(26)`、`button { paddingLeft: rpx(28) }` | 固定 13/14 | 内边距小幅漂移，buttonGroup height52 已达标 |
| 13 | 弹窗 | permissionSettingDialog.tsx:145-148 | `description { paddingHorizontal: rpx(24), paddingVertical: rpx(16) }` | paddingH 改 0、paddingV 8 | 与基座 paddingH24 叠加致 36dp，与 ListItem(16) 不对齐 |
| 14 | 弹窗 | subscriptionSettingDialog.tsx:203/209/212-213 | `addRow paddingH rpx(4)`、`input paddingV rpx(8)`、`addBtn { paddingH rpx(12), paddingV rpx(8) }` | addRow 16、addBtn 12/8 | addBtn 有 hitSlop8 兜底达标；输入行内边距漂移 |
| 15 | 弹窗 | setFontSizeDialog.tsx:75/78 | `container { paddingHorizontal: rpx(24), height: rpx(200) }` | 固定 100/24 | 与标签定位问题同文件，建议一并 flex 重构 |
| 16 | 弹窗 | subscriptionSettingDialog.tsx:122-152 | FlatList 未传 estimatedItemSize | 补 `estimatedItemSize={48}` | 行高固定 48，滚动性能略损 |
| 17 | 共享行 | base/checkbox.tsx:60-61 | `borderRadius: rpx(2), borderWidth: rpx(1)` | 固定 2 / hairline | 勾选框本体已固定，细线 0.48→1.07dp |
| 18 | 共享行 | mediaItem/musicItem.tsx:119-121 | `leftCover { marginRight: 12 }` | 16 | 与 albumItem/LyricItem 封面间距 16 差 4dp |
| 19 | 歌单榜单 | sheetDetail/components/sheetMusicList.tsx:146/136 | 容器 paddingH16+行 paddingH8 → 序号块距屏 24dp | row 改 0 | 与 16/32 三档不齐（F7 后遗留的 padding 层差） |
| 20 | 歌单榜单 | statistics/index.tsx:502-506 | `chip { paddingHorizontal:14, paddingVertical:6 }` | paddingV 10（≈40dp） | 筛选 chip≈30dp，低于 base/chip 40dp 档 |
| 21 | 歌单榜单 | statistics/index.tsx:515 | `overviewCard { borderRadius: 18 }` | 14 | 与日历卡 radius14 同页并存两种圆角 |
| 22 | 歌单榜单 | statistics/index.tsx:579-586 | `rankBox { width/height:32, radius16 }`（早期遗留） | 保持 32（或随 P1 歌名放大） | 展示块非触控，与 topListDetail 序号 32 视觉一致 |
| 23 | 歌单榜单 | sheetDetail/components/sheetMusicList.tsx:139-141 | `separator { height: 2 }` 透明行距 | 改 `<ListDivider/>` 或明确卡片化设计 | F11b 已全仓推 ListDivider，本页观感不齐 |
| 24 | 歌单榜单 | sheetMusicList.tsx:147、topListDetail/index.tsx:192 | `row { borderRadius: 10 }` | 0（对齐 ListItem 无圆角行） | 行按压圆角非卡片 14 范畴，两页自绘行同值 |
| 25 | 搜索本地 | resultSubPanel.tsx:112 | 二级 Tab 标签宽 `rpx(140)` | 固定 70/自适应 | 与 P1-A 同模式（67→149dp） |
| 26 | 搜索本地 | searchMusicList/index.tsx:65 | `minWidth: rpx(375)` | 固定 180 | flex:1 已撑满，仅下限 |
| 27 | 搜索本地 | history/index.tsx:149-150 | 首字符块 `44×44/8`（早期 1.3 记录） | 可对齐 48（或保留字母头像设计） | 行高 64 精确匹配，仅 4dp 微差 |
| 28 | 搜索本地 | localGroup/index.tsx:142 | `<Icon size={26}>` 不在档位 | `iconSizeConst.normal`(24) | 26 落 24/32 之间 |
| 29 | 搜索本地 | localGroup/index.tsx:161 | `<Icon name="play" size={18}>` | `iconSizeConst.light`(20) | 18 介于 small/light |
| 30 | 搜索本地 | downloading/downloadingList.tsx:280-295 | FlashList 无 estimatedItemSize | 补 80 | 卡片高度不一，影响滚动估算 |
| 31 | 搜索本地 | sheetManager/index.tsx:20 | `import rpx from "@/utils/rpx"` 未使用 | 删除 | 死导入 |
| 32 | 搜索本地 | searchPage/.../defaultResults.tsx:3 | `import rpx ...` 未使用 | 删除 | 死导入 |
| 33 | 设置族 | pluginSort.tsx:203 | `sortWrapper { height: rpx(64) }` | 固定 48/56 或去固定高 | ≈32dp@375，含"完成"按钮 |
| 34 | 设置族 | pluginSort.tsx:23 | `marginTop = rpx(188)+statusBar` | 可选固定 | 列表顶部偏移（布局层） |
| 35 | 详情首页 | home/components/ActionButton.tsx:45 | 金刚区卡片图标 `size={rpx(40)}`（卡片本体 140×144 rpx 属保留层） | 图标固定 20/24 | 图标 20→42.7dp 漂移；卡片随金刚区放大属 RD-2 合理差异 |
| 36 | 详情首页 | musicDetail/.../playControl.tsx:34-87 | 手机档侧钮 34dp/队列钮 26dp 裸图标 | 补 hitSlop | 触控<48dp（播放圆钮 56dp 达标） |
| 37 | 详情首页 | panels/types/playList/body.tsx:165 | `musicItem { borderRadius: 10 }` | 0 | 行按压圆角与 ListItem 无圆角行不一致（body 本体已对齐） |

> P2"保留层 rpx"已全部甄别不列（页面/卡片外边距间距、网格 gap、封面比例（imageBtn 210×290、musicSheetPage/header 封面210、artist 头像144、musicDetail 封面240）、弹窗宽 86%/60%、flex gap、圆角/阴影、toast/listEmpty/loading 内边距、Tab 下划线装饰线）。

### 3.9 覆盖清单与一致项验证

| 切片 | 覆盖范围 | 文件数 | P0/P1/P2 |
|---|---|---|---|
| 面板族 | src/components/panels/** | 27 | 3/7/6 |
| 弹窗族 | src/components/dialogs/**（base+27 对话框） | 30 | 0/11/10 |
| 共享行组件 | mediaItem/**、musicList、musicSheetPage、musicBar、base | 30+ | 0/3/2 |
| 歌单榜单页 | sheetDetail/topList/topListDetail/albumDetail/artistDetail/recommendSheets/pluginSheetDetail/apiSheets/statistics/musicListEditor 等 | 25 | 2/8/6 |
| 搜索本地页 | searchPage/searchMusicList/downloading/history/localMusic/localGroup/sheetManager | 21 | 0/6/10 |
| 设置族（自核） | setting/**、settingTypes/**、scanSettings、pluginSources、backup | 15 | 1/5/2 |
| 音乐详情+首页（自核） | musicDetail/**、home/** | 28 | 0/3/3 |

一致/合理项：弹窗 Header（52dp）与面板 PanelHeader（56dp）为两家族独立规范（Level3Dialog 52 vs Panel 56），非缺陷；全屏播放页顶栏 56/底部控制固定分档/seekBar 28·caption11/封面 240·20/heartIcon normal24/歌词系全部一致；aboutSetting、scanSettings、fileSelectorDialog、downloadSettingsDialog、immersiveSettingDialog、lyricSettingDialog、tabletPanel、mineTab、homeBody 系一致；早期预测"订阅源行仍 56""localMusicList 封面 44"经核实未复现。

---

## 第4章 设置页功能核查

> 来源：`设置页功能核查报告.md`。全程只读核查，3 个并行子代理（文件/UI 盘点、55 配置键全仓追踪、迁移与二级页核查），关键结论组织者二次 grep 复核。范围：`src/pages/setting/**`、`src/core/**`、`config.d.ts`、已迁出的 backup/pluginSources/downloading/scanSettings、全屏歌词菜单、`src/native/lyricUtil`。

### 4.1 结论先行与冲突/重复清单

1. **无真实冲突/重复**：设置页当前 6 组 32 项与已迁出功能（备份/下载管理/音源管理/全屏歌词菜单/扫描设置）之间不存在"同一行为两个入口"或"同一配置键两处 UI 写"。悬浮歌词键与全屏菜单歌词键集合完全不相交。
2. **确定死代码 8 处**（见 4.2）。
3. **没必要保留 2 类**：开发选项底层休眠残留（UI 已删净，config 键/日志门控/VDebug 覆盖层仍在）；`background.tsx` 大段注释死代码。
4. **`backupSetting.tsx` 不是死代码**：虽已迁出设置注册表，但被独立备份二级页 `src/pages/backup/index.tsx:8` 整体复用。
5. **迁移清理基本干净**：setting `type="basic"` 界面内已无备份/下载/音源/非悬浮歌词/开发选项残留入口。

近似重复（非缺陷）：
- `theme.customColors` 与 `theme.colors` 同值双写（customColors 只写不读，colors 才是读取方）→ 删 customColors。
- `lyric.detailFontSize` 双库重复：App.config 版从不读写，真实功能在 App.PersistStatus（按歌曲写于 musicItemLyricOptions，读于 lyric/index）→ 删 App.config 版。
- `theme.followSystem` 耦合：手动切换 themeSetting/mode.tsx；选自定义背景自动置 false（background.tsx:96,107）——两处写入语义互斥但一致，注意改背景会覆盖手动选择。

### 4.2 死代码清单及清理确认

| # | 级别 | 位置 | 处置 |
|---|---|---|---|
| 1 | P0 死文件 | `setting/settingTypes/themeSetting/logoCard.tsx` | 全仓 0 import，删除 |
| 2 | P0 死页面容器 | `themeSetting/index.tsx`（注册于 settingTypes/index.ts:20-24）；type="theme" 全仓无导航发起（真实主题入口=basicSetting:418 ThemeSettingDialog 浮窗复用 mode/background） | 删除容器与注册，mode/background/themeCard 保留 |
| 3 | P0 死分支 | `setting/index.tsx:19-26` type==="plugin" 分支（PluginList 真实入口=pluginSources 二级页） | 删除分支与 import |
| 4 | P0 死配置键 | `basic.pluginCacheControl`（定义 config.d.ts:18、迁移 appConfig.ts:49，全仓无读写；缓存策略读插件实例 instance.cacheControl） | 删除定义与迁移映射 |
| 5 | P0 死键+近似重复 | `theme.customColors`（写 theme.ts:173，读方仅 theme.colors:96） | 删除键定义与写入 |
| 6 | P0 死键同名双库 | `lyric.detailFontSize` App.config 版（config.d.ts:61、迁移 appConfig.ts:99，从不读写；功能版在 persistStatus.ts:40） | 删 App.config 版，PersistStatus 版保留 |
| 7 | P2 死面板 | `panels/types/setLyricOffset.tsx`（注册 panels/types/index.ts:9,46；歌词偏移已内联进 lyricSettingDialog，按歌曲 mediaExtra.lyricOffset 存储） | 删除组件与注册 |
| 8 | P2 多余导出 | `basicSetting.tsx:544` `export function LyricSetting`（无外部 import） | 去 export |

> ⚠️ 修正核对：原报告 2026-10-13 注记称死代码 #1~#8 已清理。合并时 Glob `themeSetting/*` 仅余 `mode.tsx、background.tsx、backgroundCustom.tsx、themeCard.tsx`——logoCard.tsx 与 themeSetting/index.tsx 确已删除，与注记一致。

### 4.3 正常保留项（32 项设置 + 21 个二级页配置键）

**设置页 type="basic" 实际渲染 32 项**：
- 播放（8 项）：默认播放音质/音质缺失顺序/启动自动播放/播放失败换源/失败自动暂停/与其他应用同时播放/被打断方式/音量降低幅度（basicSetting.tsx:146-210）。
- 网络与缓存（6 项）：移动网络播放/下载/音乐缓存上限/清除音乐·歌词·图片缓存 3 动作（basicSetting:276/298/320→fileUtils:105 clearCache；大小统计 fileUtils:92 getCacheSize）。
- 常规（4 项）：最大历史/详情页默认/详情页常亮/通知栏关闭按钮（basicSetting:334-359）。
- 歌单与专辑（3 项）：点搜索结果/点专辑曲目/本地歌单排序（basicSetting:367-405）。
- 悬浮歌词（8 项）：showStatusBarLyric/topPercent/leftPercent/align/color/backgroundColor/widthPercent/fontSize（用户明确要求保留在设置页；原生链路 `native/lyricUtil/index.ts:18-44`→Android LyricUtilModule.kt；iOS 无原生实现=平台差异）。
- 更多（3 项）：主题设置（ThemeSettingDialog 浮窗）/权限设置（PermissionSettingDialog）/关于（navigate about）。

**已迁出二级页、键仍在使用（勿误删）**：
- 下载 5 键（downloadPath/defaultDownloadQuality/downloadQualityOrder/downloadNameOrder/maxDownload）：UI 在下载管理页三点→downloadSettingsDialog（129/147/171/185/213），消费者 core/downloader.ts:110/188/206/247/249。
- 插件 4 键（autoUpdatePlugin/notCheckPluginVersion/lazyLoadPlugin/sortPluginByReliability）：音源管理页 pluginList.tsx:60-85，消费者 bootstrap.ts:218/274、pluginManager/index.ts:117、pluginReliability.ts:39。
- 沉浸歌词 3 键（immersiveEnable/Delay/Effect）：全屏 navBar:36"衣服"图标→ImmersiveSettingDialog，消费者 immersiveLayer.tsx:53-55。
- 歌词 2 键（associateLyricType/lyric.autoSearchLyric）：全屏三点菜单→lyricSettingDialog:56/67，消费者 musicItemOptions:182、lyricManager.ts:223。
- 备份 4 键（resumeMode/webdav.url·username·password）：备份二级页复用 backupSetting（223/307-333）。
- 订阅 1 键（subscribeUrl）：音源管理三点→SubscriptionSettingDialog:62-65，消费者 bootstrap.ts:224。
- 音乐库排序 2 键（musicLibrarySort/musicLibrarySortDirection）：libraryTab.tsx:92-93，消费者 libraryTab.tsx:63/67。

更新入口不缺：关于页 aboutSetting.tsx:91（useCheckUpdate:24）、我的页 mineTab.tsx:267/337、启动自检 BootstrapComponent.tsx:17。

### 4.4 待确认项与处置优先级

待确认：①theme.followSystem 选自定义背景强制 false 是否预期；②basicSetting.tsx:409 注释过时（称"权限已迁出"但 421-427 仍有权限入口，权限弹窗入口合理、注释需更新）；③debug 底层残留（log.ts 门控）去留取决于是否需运行时调试；④iOS 悬浮歌词=Android-only 平台差异，如需 iOS 需另开发原生模块。

观察：下载配置类设置全部在"下载管理页→三点→下载设置"浮窗（设置页无下载组，维持现状自洽）；播放音质与下载音质键不同消费者不同无冲突；旧键名 setting.basic.* 仅存 appConfig.ts:31-120 一次性迁移映射（迁移后 removeStorage）无活跃残留；歌词偏移按歌曲存 mediaExtra.lyricOffset（mediaExtra.ts:21、lyricManager.ts:159-172 持久化）与悬浮歌词全局键无关。

---

## 第5章 尺寸类型修正与车机适配验证

> 来源：`尺寸类型修正与车机适配验证报告.md`（统一版），整合《尺寸类型rpx与固定dp误用核查报告》（审计 A，14 文件 43 条，P0=10/P1=23/P2=10）与《车机适配-rpx固定化逐项验证报告》（验证 B，43/43 独立复算）。只读精读未改代码；行号两子代理逐条核对。
> 换算：rpx(n)=(n/750)×minWindowEdge（`src/utils/rpx.ts`）；k₃₆₀=0.480、k₄₈₀=0.640、k₆₀₀=0.800、k₈₀₀=1.067。验收：触控≥48dp、正文≥14/标题≥18dp、跨设备一致优先。

### 5.1 结论与 43 条修正清单

1. 全项目 14 文件 43 处"应固定 dp 却写成 rpx()"，A/B 独立核对 43/43 属实。
2. rpx 在车机短边 360~800dp 漂移 2.2 倍：360dp 小车多数触控不达标（开关高 19dp、勾选框有效触控 40dp、FAB 42dp、列表按钮 27dp、chip 27dp、playAllBar 40dp），800dp 大车放大到 85~94dp。
3. 改固定 dp 后跨设备恒定；其中 5 处改完仍 <48dp 需补 hitSlop（见 5.2）。
4. 独立发现必修：tabBar.tsx:323 平板顶栏 height rpx(56) 在 360dp 仅 26.9dp，而栏内图标/字号已固定 32dp——容器比内容矮约 5dp，720p 车机溢出。
5. 修正初始线索两处取值：TAB_BAR_HEIGHT 固定 **56dp**（非 48，与 appBar.tsx:112 height56 同源）；全屏歌词 ITEM_HEIGHT 固定 **46dp**。

**P0（10 条）触控/文字直接不达标**：
- switch.tsx：width rpx80→52、height rpx40→32（<48 补 hitSlop）、borderRadius rpx40→16、thumb rpx34→22、thumb borderRadius rpx17→11、thumb left rpx3→5、fixedWidth rpx40→20（=52−22−5×2 行程重算）。
- checkbox.tsx：box rpx36→22、对勾 Icon rpx34→18（后 C02 改 light20）、slop rpx24→**14**（box22+14×2=50≥48；12 仅 46）。

**P1（23 条）**：
- dialogs/base:27 TAB_BAR_HEIGHT rpx56→56；panels/base:38 同（两处应抽共享常量）。
- tabBar.tsx：平板顶栏高 rpx56→56（车机必修）、searchBar rpx56→40、手机底栏图标 rpx44→24(normal)。
- musicBar：播放条高 rpx132→72、封面 rpx96→56、封面圆角 rpx48→28、列表 Icon rpx56→40(large，补 hitSlop)、环形描边 rpx4/rpx2→3/2、环形半径 rpx36→24。
- lyricOperations:128 操作行高 rpx56→48。
- lyric/index：fontSizeMap rpx{24,30,36,42}→{20,25,30,36}；当前行 fontSize+10→+9（对齐 34dp）。
- lyricItem:75 paddingHorizontal rpx64→32。
- fab.tsx：rpx88→56、borderRadius rpx44→28、right rpx36→24、bottom rpx72→16（竖屏建议按 orientation 分支与 MusicBar 72 错开）。
- chip.tsx：高 rpx56→**40**（B 修正 36→40，36<48）、paddingHorizontal rpx18→14、borderRadius rpx28→18。
- playAllBar:113 高 rpx84→56（=listItem normal56）。

**P2（10 条）**：iconTextButton paddingHorizontal rpx16→16、paddingVertical rpx8→**14**（总高 36→48）、marginLeft rpx8→8；draggingTime rpx8/6/12→8/6/8（纯展示气泡非触控）；textButton paddingHorizontal rpx24→16、hitSlop rpx28→14；simpleInput padding rpx12→12（同类 setUserVariables/associateLrc/searchLrc 同步）；lyric/index ITEM_HEIGHT rpx92→46。

### 5.2 改固定后仍须补充的触控动作（5+1 处）

| # | 位置 | 动作 |
|---|---|---|
| 1 | switch.tsx L68 | 高 32<48，补 hitSlop 上下 12→56dp |
| 2 | checkbox.tsx L14 | slop 直接取 14→50dp |
| 3 | iconTextButton.tsx L38 | paddingV 8→14→48dp（或 hitSlop） |
| 4 | chip.tsx L47 | 高取 40，或 36+hitSlop{6} |
| 5 | musicBar/index.tsx L111 | 列表 Icon 40 裸 Icon 补 hitSlop 上下 8→56dp |
| 6 | tabBar.tsx L323（必修） | 平板顶栏 rpx56@360=26.9<固定内容32，固定 56dp |

### 5.3 车机分支与架构发现

> ⚠️ 修正：本报告当时称 `isTabletScreen()=window.width>=600`（`src/utils/tablet.ts:5`，按宽度判定），横屏车机 width=长边恒≥600 全部走平板分支（MusicBar 隐藏、主播放区用 tabletPanel、弹窗强制平板 60% 宽）。合并时核对 `src/utils/tablet.ts` 第 7~17 行，当前实现已改为**短边法 `min(width,height)>=600`**+720p 大屏兜底（minPx≥720 且 density≤1.75），即"按宽度判定"为历史状态，根因已修复。后续档位/分支判断须用短边（min(宽,高)），rpx 本身也用短边，两者口径现已统一。

### 5.4 大屏档位切换方案评估

| 维度 | 纯 rpx（旧） | 纯固定 dp（43 条） | 大屏档位切换（按短边分档） |
|---|---|---|---|
| 跨设备一致性 | 差（2.2×） | 最好 | 良（档内一致、档间≈1.15×） |
| 触控达标（360 小车） | 低 | 高（补 hitSlop 后全≥48） | 高 |
| 文字可读性 | 差 | 好（正文≥14/标题≥18） | 好 |
| 大屏观感（800） | 过大（85-94dp） | 偏小稀疏 | 较好 |
| 实现成本 | 已完成 | 最低（rpx→常量） | 中（useBreakpoint+档位表） |

结论：纯 rpx 废弃；先 43 条固定 dp 即达车机底线；档位切换仅作后续大屏观感增强（歌词字号/列表间距），**按短边分档、不碰触控尺寸**。建议档位边界：短边<480（小车机/手机）、480-600（标准车机）、>600（大平板/宽车机）。

### 5.5 应保留 rpx 的布局层与改动联动

**保留 rpx（勿误改）**：页面/卡片外边距与间距、网格/封面比例（imageBtn 210×290、musicSheetPage/header 封面210）、弹窗宽手机 86%/平板 60%、操作按钮 flex 行/金刚区/gap/圆角/阴影、toast/errorBoundary/listEmpty/loading 等展示空态内边距。反向（该 rpx 却写死 dp）扫过 src/components 未发现实质反例。

联动注意：①switch fixedWidth 重算 52−22−5×2=20；②TAB_BAR_HEIGHT 两处重复+tabBar 顶栏本体抽单一共享常量 56dp；③全屏歌词 fontSizeMap 改后 L316 当前行偏移、ITEM_HEIGHT(L24)、拖拽覆盖层 top 居中(L358) 一并回归（无 getItemLayout 滚动逻辑不改）；④musicBar 仅手机渲染勿误改布局类 rpx；⑤checkbox/iconTextButton/chip 按 §5.2 修正值落地。

---

## 第6章 手机横屏尺寸适配核查

> 来源：`docs/手机横屏尺寸适配核查报告.md`（2026-10-12）。范围：手机横屏组件重叠、rpx/dp 合格性、QQ/网易云对照。仅核查未改代码。

### 6.1 问题背景与根因分析

背景：手机横屏时屏幕宽度≥600dp，触发 useIsTablet()=true 走平板布局（左播放区 30%+右内容区 70%），但此时屏幕高度仅约 360~420dp（远小于真平板≥768dp），平板布局中按高屏设计的固定 dp 组件在矮屏溢出重叠。

- **根因 1 判断逻辑缺陷**（当时 `src/utils/tablet.ts:5`）：仅以宽度≥600dp 为判据。典型手机横屏 iPhone 12 Pro 844×390dp、Pixel 7 915×412dp——宽度远超 600 但高度仅 ~390~412dp。代码未区分真平板（高≥700dp）与手机横屏（高~390dp）。
- **根因 2 布局结构**：平板"左 30% 播放区+右 70% 内容区"（home/index.tsx:243-248），左 TabletPanel 内部大量固定 dp 高度按真平板设计。
- **rpx 不是问题**：`src/utils/rpx.ts:9` 基于 minWindowEdge（横屏=短边~390dp），横屏自动缩小不放大。问题全部来自固定 dp 与平板分栏结构。

> ⚠️ 修正：合并时核对 `src/utils/tablet.ts`，当前 isTabletScreen 已改短边法 `min(width,height)>=600`+720p 兜底——本报告所述"仅看宽度不看高度、手机横屏误判平板"的判断逻辑缺陷已在后续修复中解决（详见 1.7/5.3 修正注记）。本报告其余矮屏溢出/布局数值清单仍具历史参考价值。

### 6.2 重叠组件清单

**🔴 高严重度**：
- 3.1 TabletPanel 封面固定 200dp（tabletPanel.tsx:371-372）：左面板总高≈390dp，固定合计 header56+marginBottom16+bottom区(padding24+slider28+gap4+controlBar52)+paddingBottom16≈196dp，playContent 可用 194dp，而封面 200+16=216dp 超出整个 playContent→封面溢出、歌词弹性区压至近 0、歌名与进度条/控制栏垂直重叠。
- 3.2 Panel 弹出层覆盖顶部 Tab 栏（panelBase.tsx:193）：平板分支仅传 {left:"30%",width:"70%"} 未传 top:TAB_BAR_HEIGHT(56)；遮罩 maskWrapper 用 tabletBound（含 top:56）正确，但面板本体 panelBody 在 horizontal 分支取 height:vh(100)−safeAreaInsets.top、bottom:0，横屏 safeArea.top≈0→面板从 top:0 到底部覆盖 TabBar。
- 3.3 统计页左右分栏矮屏压扁（statistics/index.tsx:468-475）：右内容区可用≈334dp，AppBar44+chips40+overview卡 min110+margins30≈224，splitRow 仅剩≈110dp；日历卡 padding24+header20+weekRow20=64 后仅够 1~1.5 行（正常 5~6 行）；排行 topCount=floor((110−28)/44)=1 被 clamp 到最小 3 行（3×44=132>110）→排行行溢出。

**🟡 中严重度**：
- 3.4 首页首屏内容过高（statsRow.tsx:221 minHeight110 + operations.tsx:223 minHeight96）：StatsRow 150dp+Operations 136dp=286dp，右内容区 334dp 仅剩 ~48dp 给推荐区标题→推荐歌单横滑区在首屏下方需滚动。
- 3.5 全屏播放页播放钮 80dp 过大（playControl.tsx:28 `playBtnSize=isTablet?80:56`）：横屏 leftPane 固定≈230dp，歌词区≈160dp 勉强可用；80dp 占屏高 20% 比例失调；rightPane 封面 aspectRatio:1 在 40% 宽(~337dp)下高≈296dp 接近溢出。

**🟢 低严重度**：
- 3.6 TabBar 水平模式字号 32sp 偏挤（tabBar.tsx:170，图标 32+文字行高≈38→总高≈50dp 在 56dp 栏内勉强放下，不溢出）。
- 3.7 插件列表底部空白 rpx(200)（pluginList.tsx:454≈104dp，FlatList footer 空白不影响结构）。

### 6.3 固定 dp 大值与 rpx 使用清单

固定 dp ≥200：tabletPanel cover 200×200（全部分支，横屏致命）；albumCover/index.tsx:25 height240（仅竖屏）；Onboarding 320/260（引导页不涉横屏）。平板分支 minHeight≥96：mineTab userCard140、statsRow cardBgTablet110、statistics overviewCard110、mineTab mineCardBg112、libraryTab cardBgTablet96、operations cardBgTablet96。

横屏 rpx（minWindowEdge≈390dp）：panelBase width rpx750=390（平板时被 width70% 覆盖无影响）；panelBase useAnimatedBase rpx750=390（滑入距离=短边合理）；tabBar searchBar minWidth rpx375=195（OK）；tabBar padding/margin rpx6~16=3~8（极小）；pluginList footer rpx200=104（无风险）；pluginList gridRow padding rpx24/gap rpx12=12.5/6.2（无风险）。

结论：rpx 体系横屏合格（基于短边自动缩小）；此前"43 条 rpx→固定 dp"方向正确，但引入的固定 dp 值（如封面 200dp）在矮屏成新问题。

### 6.4 QQ音乐/网易云音乐尺寸策略对照

重要前提：反编译包为车机/IoT 版——`com.tencent.qqmusiccar`（QQ音乐车机版，dimens 大量 `*_grandland_*`）、`com.netease.cloudmusic.iot`（网易云 IoT/车机版）。它们的"横屏"是车机抬头屏本身固定横屏，非手机旋转横屏。反编译产物无 AndroidManifest.xml，screenOrientation 无法直接验证。

两包策略：业务横屏专属 layout-land 0/1 个（均库文件）；业务 sw600dp 专属布局 0 个；业务 dimens 无 land/sw600dp 覆盖（所有限定符 dimens 经核对全来自 AndroidX/Material 库）；QQ 平板判断 `bool/is_tablet=(sw600dp) true`；业务尺寸=dp（控件）+sp（文字）一套走天下。

启示：①这两家是"从一开始为固定横屏设计一套布局"，非"竖屏+横屏分支"；②若我方定位车机/平板/电视固定横屏，可学——一套默认布局+dp/sp 固定+bool/is_tablet 程序化分支；③若我方是手机 App 想支持横屏，这两个包无可借鉴（主流手机音乐 App 通常锁竖屏），需对照应反编译手机版读 AndroidManifest screenOrientation；④横屏宽度变化交给 flex/weight/比例吸收，不要每组件写两套 dp。

### 6.5 合格判定与修复建议

| 模块 | 判定 |
|---|---|
| 平板布局框架（左30%+右70%） | ⚠️ 结构合理但未适配矮屏 |
| TabletPanel 左播放区 | 🔴 封面 200dp 在 390dp 屏必然溢出 |
| Panel/Dialog 浮窗定位 | 🔴 面板本体缺 top:56 覆盖 Tab 栏 |
| 统计页分栏 | 🔴 日历+排行并排需 ~400dp 高，横屏仅 110dp |
| 首页内容区（ScrollView） | 🟡 可滚动但首屏被占满 |
| 音乐库 Tab / 我的 Tab / 底部音乐栏 / VerticalSafeAreaView / rpx 体系 | ✅ 合格 |
| 全屏播放页（横屏分栏） | 🟡 歌词区 ~160dp 可用但 80dp 钮过大 |
| useIsTablet 判断逻辑 | 🔴（当时）仅看宽度不看高度——**后续已改短边法修复** |

总体判定（2026-10-12 当时）：**不合格**。核心=useIsTablet 只看宽度不看高度致手机横屏误走平板布局，TabletPanel 200dp 封面+56dp header+108dp 控制栏≈364dp 固定高在 390dp 矮屏几乎占满，歌词区与内容必然挤压重叠。

修复建议：
- **P0**：①tabletPanel.tsx:371-372 封面自适应（`Dimensions.height<500?130:200`，或 aspectRatio:1+maxHeight）；②panelBase.tsx:193 平板分支补 `top:TAB_BAR_HEIGHT,bottom:0`，horizontal 分支判 !isTablet 才用 vh(100)−safeArea.top。
- **P1**：③statistics/index.tsx:468-475 分栏条件改 `isTablet && height>=500`，矮屏退化上下排列；④playControl.tsx:28 增加高度判断 `height<500?56:(isTablet?80:56)`；⑤statsRow/operations 矮屏缩小至 70~80dp 或改手机竖排。
- **P2**：⑥useIsTablet/tablet.ts 增高度维度（`isLargeScreen()=width>=600&&height>=500` 或 useIsRealTablet）——**后续已落地为短边法**；⑦tabletPanel.tsx:102 问候语 fontSize32 矮屏改 20~24（后 C20 入档 xlarge32）。

策略级建议：方案 A（推荐）锁定手机竖屏（AndroidManifest portrait，平板/车机仍可横屏，与主流手机音乐 App 一致，改动最小风险最低）；方案 B 保留横屏走紧凑平板布局（需逐页适配矮屏，工作量大）；方案 C 按设备类型（react-native-device-info isTablet）判断而非屏幕尺寸（最符合直觉，需验证折叠屏/小平板准确性）。

---

## 第7章 音源安装进度弹窗与卡片标识改动（2026-10-23）

背景：音源管理走查发现「下载/载入音源」的进度不是三级弹窗（整页替换为自绘进度卡），且音源卡片缺可点击提示、可用率标签口径不含歌词源。以下 3 项已落地（tsc 通过，未打包）：

### 7.1 安装进度 → 三级弹窗（列表不再整页替换）

- 新增 `src/components/dialogs/components/pluginInstallProgressDialog.tsx`：标准 Dialog（Title"安装音源" / Content 三行进度 / Actions"后台运行"），三行布局与探测软件一致（行1 状态+计数、行2 进度条+百分比、行3 当前插件名）；无进度数据（卸载全部等）时 Content 内转圈 + "正在安装…"。
- `pluginList.tsx`：移除 `loading` 整页替换分支，FlatList 常驻；`loading` 时在页面上声明式渲染进度弹窗（props 实时更新，不走命令式 showDialog 快照）。
- 各入口进度补齐：订阅批量安装（原有）、手动安装大插件（mount 0/1）、本地导入（逐个文件 mount i/n）、网络安装（补 onProgress）、更新全部（download i/n）。
- 「后台运行」按钮语义：仅收起弹窗，安装任务继续后台执行（installPluginsFromUrls 无法中途取消）；任务完成后的结果汇总 Toast 不变。
- 弹窗规格自动继承 Dialog base：平板右 70% 内容区 60% 宽（全屏播放页 42%）、从 tab 行 56dp 下起、手机 86%，圆角 20、elevation 909。

### 7.2 音源卡片名字可点击 → 主题色提示

- `pluginItem.tsx`：有 `userVariables`（可进设置表单）的插件，名字颜色改 `colors.primary`（主题色）；无 userVariables 不可点时保持默认文本色（text）。与按下 opacity 0.6 反馈并存。

### 7.3 可用率标签口径修正

- 无统计数据的普通音源：标签**常显 "50%"**（原仅在有统计数据时显示百分比；底色 textSecondary）。
- 纯歌词源（`supportedMethods` 含 `getLyric` 且不含 `search`/`getMediaSource`，如歌词千寻/歌词网）：标签**显示"歌词"**（底色主题色），不显示百分比——此类源按搜索/解析口径统计可用率无意义（必然偏低），区分"功能型差异"与"插件损坏"。
- 有统计数据的普通源：行为不变（≥80% 绿 / 50~80% 主色 / <50% 红）。

---

## 附录：原文档章节映射

| 原文档 | 原内容要点 | 合并后所在章节 |
|---|---|---|
| 1. UI_ALIGNMENT_CHECK.md | 标题+目标说明（fork UI 对齐、9 要素、tsc 验证） | 1.1 |
| 1. UI_ALIGNMENT_CHECK.md | 一、全局基础（字号档/图标档/全局组件 #33） | 1.2 |
| 1. UI_ALIGNMENT_CHECK.md | 二、逐页检查记录（#27~#33 首页/搜索/音乐库/我的/播放页/二级页/三级弹窗） | 1.3 |
| 1. UI_ALIGNMENT_CHECK.md | 三、差异点处理结果（7 项，2026-10-07） | 1.4 |
| 1. UI_ALIGNMENT_CHECK.md | 四、对齐进度总览与待补缺口 | 1.5 |
| 1. UI_ALIGNMENT_CHECK.md | 五、遗留待办（装机/功能迁移/设置页） | 1.12 |
| 1. UI_ALIGNMENT_CHECK.md | 六、二级页面全面对齐第二轮（6.1~6.20：历史/统计/下载/排行/歌单详情/队列/音源/备份/扫描/EQ/排行详情/歌单管理/标签编辑/fork 特有页/风格统一/三级界面/操作逻辑/全屏覆盖） | 1.6 |
| 1. UI_ALIGNMENT_CHECK.md | 七、#40 统一 isTablet + #41 扫描设置页 | 1.7 |
| 1. UI_ALIGNMENT_CHECK.md | 八、#42~#49 功能接入核查（推荐歌单/WebDAV/音源独立页/下载/三级全核查/歌单改弹窗/备份下载迁出/标签编辑可行性） | 1.8 |
| 1. UI_ALIGNMENT_CHECK.md | 九、#50 全面代码与功能核查（分区/修复清单/5 项落盘/交叉验证/待决策/回归/遗留） | 1.9 |
| 1. UI_ALIGNMENT_CHECK.md | 十、字体字号行距统一（10.1~10.7）+品牌视觉轮（10.8）+下载浮窗字体（10.9） | 1.10、1.11 |
| 1. UI_ALIGNMENT_CHECK.md | 十一、遗留待办（2026-10-09 更新） | 1.12 |
| 2. UI冲突统一处理报告.md | 一、结果总览（22 条状态+晚间断恢复注记） | 1.13 |
| 2. UI冲突统一处理报告.md | 二、逐条处理明细 C01~C22 | 1.14 |
| 2. UI冲突统一处理报告.md | 三、文档同步记录（UI规范-字体与层级.md 漂移修正表） | 1.15 |
| 2. UI冲突统一处理报告.md | 四、待用户决策清单（6 条+2 附注） | 1.16 |
| 2. UI冲突统一处理报告.md | 五、备份清单（22 文件路径） | 1.13（备份路径段） |
| 2. UI冲突统一处理报告.md | 六、验证与合规声明 | 1.13 |
| 2. UI冲突统一处理报告.md | 七、后续决策 D1（歌单批量编辑入口合并） | 1.16 |
| 3. UI统一16条改动位置清单.md | 头部注记（C17/C19 恢复原状、有效 13 条） | 第2章引言 |
| 3. UI统一16条改动位置清单.md | 按软件中位置索引表（16 条） | 2.1 |
| 3. UI统一16条改动位置清单.md | 按改动性质分组（A 基础组件/B 列表页面/C 对话框） | 2.2 |
| 3. UI统一16条改动位置清单.md | 快速自查清单（10 项） | 2.3 |
| 4. 列表行与浮窗样式一致性核查报告.md | 第一部分 0. 全局基准 | 3.1 |
| 4. 列表行与浮窗样式一致性核查报告.md | 第一部分 1. 分页面行样式快照（1.1~1.7） | 3.2 |
| 4. 列表行与浮窗样式一致性核查报告.md | 第一部分 2. 统一性结论（一致/不一致） | 3.3 |
| 4. 列表行与浮窗样式一致性核查报告.md | 第一部分 3. 不一致项分级 HD-1~HD-10+合理差异 | 3.3 |
| 4. 列表行与浮窗样式一致性核查报告.md | 第一部分 4. 修复建议 F1~F14 | 3.4（建议部分） |
| 4. 列表行与浮窗样式一致性核查报告.md | 第一部分 5. 待补查 + 6. 修复记录（2026-10-08 执行）+F7/F11b 理由+遗留项 | 3.4 |
| 4. 列表行与浮窗样式一致性核查报告.md | 第二部分 一、结论先行（88 条/根因/滚动类/触控/rpx 残留/早期遗留核实/已收敛） | 3.5 |
| 4. 列表行与浮窗样式一致性核查报告.md | 第二部分 二、P0 六条 | 3.6 |
| 4. 列表行与浮窗样式一致性核查报告.md | 第二部分 三、P1 四十三条（3.1~3.8 分区） | 3.7 |
| 4. 列表行与浮窗样式一致性核查报告.md | 第二部分 四、P2 三十九条表 | 3.8 |
| 4. 列表行与浮窗样式一致性核查报告.md | 第二部分 五、覆盖清单 + 六、一致/合理项+已修基线验证 + 七、来源证据 | 3.9 |
| 5. 设置页功能核查报告.md | 一、结论先行（无冲突/死代码 8 处/backupSetting 非死代码/迁移干净） | 4.1 |
| 5. 设置页功能核查报告.md | 二、冲突/重复清单（customColors/detailFontSize/followSystem） | 4.1 |
| 5. 设置页功能核查报告.md | 三、死代码清单 #1~#8 | 4.2 |
| 5. 设置页功能核查报告.md | 四、没必要保留清单（开发选项残留/background 注释） | 4.2/4.4 |
| 5. 设置页功能核查报告.md | 五、正常保留项（32 项+二级页 21 键+更新入口） | 4.3 |
| 5. 设置页功能核查报告.md | 六、待确认项 4 条 + 七、观察建议 5 条 + 八、处置优先级 | 4.4 |
| 6. 尺寸类型修正与车机适配验证报告.md | 一、结论先行（43 条/2.2 倍漂移/5 处触控/tabBar 必修/架构发现/取值修正） | 5.1、5.3 |
| 6. 尺寸类型修正与车机适配验证报告.md | 二、修改清单 P0/P1/P2（43 条） | 5.1 |
| 6. 尺寸类型修正与车机适配验证报告.md | 三、车机验证摘要 + 四、A/B 共识与差异 | 5.1 |
| 6. 尺寸类型修正与车机适配验证报告.md | 五、改固定后仍须补充动作（5+1 处） | 5.2 |
| 6. 尺寸类型修正与车机适配验证报告.md | 六、车机分支与架构发现 | 5.3 |
| 6. 尺寸类型修正与车机适配验证报告.md | 七、大屏档位切换方案评估 | 5.4 |
| 6. 尺寸类型修正与车机适配验证报告.md | 八、应保留 rpx 层 + 九、改动联动 + 十、证据来源 | 5.5 |
| 7. docs/手机横屏尺寸适配核查报告.md | 一、问题背景 + 二、根因分析（判断逻辑/布局结构/rpx 非问题） | 6.1 |
| 7. docs/手机横屏尺寸适配核查报告.md | 三、重叠组件清单（高/中/低严重度 3.1~3.7） | 6.2 |
| 7. docs/手机横屏尺寸适配核查报告.md | 四、固定 dp 大值清单 + 五、rpx 使用清单 | 6.3 |
| 7. docs/手机横屏尺寸适配核查报告.md | 六、QQ/网易云对照（车机前提/策略对照/启示） | 6.4 |
| 7. docs/手机横屏尺寸适配核查报告.md | 七、合格判定表 + 总体不合格 | 6.5 |
| 7. docs/手机横屏尺寸适配核查报告.md | 八、修复建议（P0/P1/P2/策略 A/B/C）+ 九、附录（文件清单/对照产物/核查约束） | 6.5 |

## 第8章 浮窗层级编码规范（2026-10-20 定稿并迁移）

### 8.1 编码规则

- **4 位数字编码**：`前两位 = 主层级`，`后两位 = 同层近似区分`。
- **主层级用间隔 4**：`01 / 05 / 09 / 13 / 17 / 21`——每段之间留 3 个空位，未来插层无需重排既有值。
- **近似区分用间隔 4**：`01 / 05 / 09 / 13`——同层内成员按数值从小到大排（低在下、高在上）。
- **数值越大越靠上**；**zIndex 与 elevation 统一使用同一编码**（消除此前 zIndex/elevation 不一致，如 Dialog 容器 zIndex 16301 / elevation 16300）。
- **主层语义**：01=页面内容（最底层）→ 05=次级界面层 → 09=弹窗层 → 13=Toast（最高层）→ 17/21=预留。
- **页面内元素**（播放条 MusicBar elevation=6、FAB、页面内 zIndex 等）属 01 层内部细节，不纳入编码、不参与浮窗层级语义。
- **代码中数值写法**：JS 数字字面量不支持前导零（`0501` 会被解析为八进制字面量报 TS1121），实际 zIndex/elevation 使用**去前导零的十进制**（0501→`501`、0901→`901`）；概念编码（0501 等四位写法）仅用于文档与注释的可读性。
- **全屏播放页语义**：与播放区/内容区互斥替换（同档内容），但渲染上作为浮层**必须高于二级页面**（编码 0505），否则平板右 70% 二级页面会压在全屏播放页上。
- **沉浸播放区**：指全屏播放页内的沉浸 UI（隐藏按钮/信息的沉浸状态），编码 0506（0505 沉浸播放层内部高一档）；不是独立外部层级。

### 8.2 编码表（2026-10-20 迁移完成）

| 主层 | 成员 | 编码 | 组件/文件 |
|---|---|---|---|
| 01 | 页面内容（播放区/内容区） | 0101 | 页面子树（现有 elevation 不改） |
| 05 | 二级页面 | 0501 | `pages/home/components/subPageOverlay.tsx` |
| 05 | 沉浸播放（全屏播放页） | 0505 | `pages/home/index.tsx` fullPlayingLayer |
| 05 | 沉浸播放内沉浸 UI | 0506 | `pages/musicDetail/components/immersiveLayer.tsx` |
| 05 | Panel 遮罩 | 0509 | `components/panels/base/panelBase.tsx` maskWrapper / `panelFullscreen.tsx` |
| 05 | Panel 本体 | 0513 | `panelBase.tsx` wrapper/kbContainer / `panelFullscreen.tsx` |
| 09 | Dialog 拦截层 | 0901 | `components/dialogs/components/base/index.tsx` screenTouchBlock |
| 09 | Dialog 容器（含淡入层） | 0905 | `base/index.tsx` backContainer / container |
| 09 | Dialog 本体 | 0909 | `base/index.tsx` dialogContainer |
| 13 | Toast | 1301 | `components/base/toast.tsx` |

**排序验证**：0101 < 0501 < 0505 < 0506 < 0509 < 0513 < 0901 < 0905 < 0909 < 1301

### 8.3 各页面浮窗层级记录

| 页面 | 浮窗 | 层/编码 |
|---|---|---|
| 首页 | 推荐源/新建歌单/排序/加入歌单等 Dialog；播放队列 Panel | 09 弹窗层 / 05 面板层 |
| 歌单页 | 歌曲三点 MusicItemOptionsDialog、编辑歌单 Dialog | 09 弹窗层 |
| 全屏播放页 | 三点 MusicItemLyricOptionsDialog、沉浸设置/倍速/定时/音量/音质/搜索歌词/封面/队列 | 09 弹窗层 / 05 面板层 |
| 搜索页 | 歌曲三点 MusicItemOptionsDialog | 09 弹窗层 |
| 设置页 | 主题/权限/歌词颜色/WebDAV/文件选择/插件/下载设置等 34 个 Dialog | 09 弹窗层 |
| 播放列表（队列） | Panel | 05 面板层（0509/0513） |
| 二级页面（平板） | SubPageOverlay 容器 | 05 次级界面（0501） |
| 沉浸播放（平板） | FullPlayingLayer 容器 | 05 次级界面（0505） |

### 8.4 备注

- Toast 内层卡片阴影 elevation=2 为卡片自身阴影，非层级编码，不动。
- `components/base/portal.tsx` PortalHost 为备用宿主（当前无 portal 内容），zIndex 20000 未纳入编码；启用时按宿主语义定值。
- Panel/Dialog/Toast elevation 由 1.5 万级降至 513~1301：Android 阴影在高值区饱和，观感差异预计很小（装机确认）。
