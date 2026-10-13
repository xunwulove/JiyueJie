# 极悦界 UI 规范（字体与层级）

> 项目：极悦界音乐 App（React Native + TypeScript，桌面/平板/车机优先）
> 本文性质：**从现有代码反推的事实规范**，以代码为唯一事实基准；标注"待用户决策"的条目为同类内容在项目内存在不同写法的分歧点，本文不擅自选定。
> 采集与成文日期：2026-10-14

## 前言

### 事实基准与修正说明

- 本文所有字号、字重、颜色、间距数值均直接取自 `src/` 代码，行号精确到用法出现行；采集时已逐项核对 `src/constants/uiConst.ts`、`src/core/theme.ts`，与基准档位表完全一致。
- **事实修正（相对早期规格 1.8#5）**：早期记录"下载设置弹窗按钮为 取消/保存"有偏差。经核实 `components/dialogs/components/downloadSettingsDialog.tsx:238-251`，底部按钮构成确为"取消(normal) + 确定(primary)"，但**确定按钮文案是 `t("common.confirm")="确认"`**（`zh-cn.json:28`），并非"保存"；`zh-cn.json:12` 的 `common.save` 未被该弹窗引用。本文第 4 章相应对话框条目按"取消/确认"记录，是否改为"保存"列入决策项。
- 其余已确立现状均已核实：scanSettings 的 AddRow 为 body(15)（与同级权限行/开关行同档）；MenuDialog 底部为 取消+确定（确定仅关闭）；音源管理加号弹 MenuDialog 三级浮窗（本地安装→FileSelectorDialog、网络安装→SimpleDialog+Input）；订阅设置按钮栏为 取消/恢复默认/更新订阅。

### 通用约定

- **设备优先级**：UI 以平板/车机版为主，手机版为兼容形态；同一组件存在平板/手机两档字号时，本文分别注明。
- **浮出层位置**：右侧浮出层（平板下面板/三级浮窗）必须从内容页 tab 行（56dp）下方开始，即 `top=56（TAB_BAR_HEIGHT）`、`bottom=0`、`left=30%/width=70%`，不得遮挡 tab 栏与左播放区。
- **页面背景**：所有页面统一为纵向渐变背景——顶部 `pageBackground` → 底部 `pageBackgroundTop`（白天顶部偏白、底部带品牌蓝氛围；暗色同理），由 `components/base/pageBackground.tsx` 的 LinearGradient 实现，另有封面 tint 氛围层与自定义背景层叠加。
- **主题色**：明/暗两套完整色表（见 1.4 节），颜色一律通过主题色键引用，禁止在组件内散落硬编码色值（现存硬编码已列入第 8 章冲突清单）。
- **启动页三段体系**：系统 splash / 窗口背景 / RN BrandSplash 的白屏治理已有专题文档 `docs/启动页白屏问题与实现路径.md`，本文不重复起草，涉及启动页问题直接参阅该文档。

### 阅读指引

- 第 1 章为全局档位表（字号/字重/图标/颜色/字体基元契约），是全文引用基准。
- 第 2~7 章按组件域成文，每条给出：所在文件与行号、组件名、字号（档位 key + 像素）、字重、颜色角色、其他关键规格。
- 第 8 章为全局冲突清单（编号 C01~C22），每条标注来源采集文件与原组内编号，全部"待用户决策"。

---

## 第 1 章 字体与层级体系总览

### 1.1 字号档位 fontSizeConst

定义于 `src/constants/uiConst.ts:6-27`。**所有文字必须从以下档位取 fontSize，禁止散落裸数字**（现存例外见第 8 章）。

| 档位 key | 像素(px) | 代码内用途注释 |
|---|---|---|
| tag | 10 | 角标 / 播放量 |
| caption | 11 | 小标签 / 歌单副行 / 统计手机标签 |
| description | 12 | 描述 / 辅助文本 / 分类 tab |
| normal | 13 | 列表项标题 / 歌单名 / 新歌标题 |
| subTitle | 14 | 副标题 / 次要文字 |
| body | 15 | 卡片文字 / 播放按钮 |
| content | 16 | 正文 / 区块标题 |
| title | 18 | 标题 / 卡片标题 |
| large | 22 | 大数字（统计） |
| appbar | 18 | AppBar 标题（与 title 同值，语义档） |
| xlarge | 32 | 平板顶栏 Tab / 问候语大字号（C20 新增，沉浸式大标题） |

### 1.2 字重 fontWeightConst

定义于 `src/constants/uiConst.ts:29-35`：regular=400 / medium=500 / semibold=600 / bold=700 / bolder=800。

### 1.3 图标尺寸 iconSizeConst

定义于 `src/constants/uiConst.ts:37-43`：small=16 / light=20 / normal=24（对齐标准 24dp 图标，AppBar、列表"更多"等用）/ big=32 / large=40。

### 1.4 颜色体系

**colorMap 语义映射**（`uiConst.ts:45-51`）：normal→text、secondary→textSecondary、highlight→textHighlight、primary→primary。

**主题色表**（`src/core/theme.ts:9-78`，明/暗两套）：

| 色键 | light | dark |
|---|---|---|
| text | #1E293B | #E2E8F0 |
| textSecondary | #64748B | #94A3B8 |
| primary | #2F6FED | #5A8FFF |
| pageBackground | #F8F9FA | #0F172A |
| pageBackgroundTop | #EAF0FA | #182848 |
| appBar | #2F6FED | #2F6FED |
| appBarText | #FFFFFF | #FFFFFF |
| musicBar | #FFFFFF | #1E293B |
| musicBarText | #1E293B | #E2E8F0 |
| divider | #E2E8F0 | #334155 |
| mask | rgba(30,41,59,0.2) | rgba(15,23,42,0.8) |
| surfaceVariant | #F1F5F9 | #334155 |
| tabBar | #F8F9FA | #0F172A |
| success | #08A34C | #08A34C |
| danger | #EF4444 | #F87171 |
| info | #0A95C8 | #0A95C8 |
| card | #FFFFFF | #1E293B |

代码另补充 shadow、listActive、backdrop、placeholder、notification 等色键（采集文件核实项，非冲突）。颜色取值机制：`useColors`（`hooks/useColors.ts:44-60`）从主题取色并合并 CustomizedColors，textSecondary 缺省回退 `Color(text).alpha(0.7)`；`useTextColor`（`hooks/useTextColor.ts:3-6`）直接返回主题 text 色。

### 1.5 字体基元 ThemeText 契约

`src/components/base/themeText.tsx:20-39`：

- props：`color`（直接色值，优先）/ `fontColor`（CustomizedColors 色键）/ `fontSize`（fontSizeConst 档 key）/ `fontWeight`（fontWeightConst 档 key）/ `opacity`。
- 默认值：fontSize="content"(16)、fontColor="text"、fontWeight="regular"(400)。
- 恒有：`allowFontScaling={false}`、`includeFontPadding=false`（行 30、39）。
- **规范要求**：项目内一切文字应优先走 ThemeText；现存 Tip/Toast 等直接用原生 Text 的例外见第 8 章。

### 1.6 列表行基元 ListItem 写法示范

`src/components/base/listItem.tsx`：

- **行高体系 Size**（:42-48）：big=64（歌曲行）/ normal=56（默认）/ small=48 / smallest=36（分区标题行）/ none。
- **布局**：默认左右 padding=16dp（:39）；右操作区固定宽 actionWidth=48（:40）；underlayColor=colors.listActive。
- **Content 标题**（:253-257）：ThemeText 默认 content(16) + medium(500)、numberOfLines=1。
- **Content 描述**（:263-271）：description(12) + textSecondary、numberOfLines=1、marginTop=2。
- **ListItemHeader 分区标题**（:291-297）：subTitle(14) + bold(700) + textSecondary、行高 smallest(36)、marginTop=12。
- **ListItemIcon**（:146-172）：默认 iconSize=normal(24)、colors.text。
- **ListItemImage 封面**（:216-228、:323-327）：48×48、borderRadius=8；maskIcon 为 normal(24)、color="red"。

---

## 第 2 章 基础组件规范（components/base/）

### 2.1 容器与背景

- **PageBackground**（`pageBackground.tsx:24-45`）：LinearGradient 纵向 colors=[pageBackground, pageBackgroundTop]，从顶部 (0,0) 到底部 (0,1)；叠加封面 tint 氛围层（白天 alpha 0→0.05）与自定义背景层。
- **Divider / ListDivider**（`divider.tsx:14-23、36-51`）：颜色 colors.divider（缺省 #999999）；水平高 1、垂直宽 1；ListDivider 用 hairlineWidth、默认 marginLeft=60（封面 48+gap 12）。
- **StatusBar**（`statusBar.tsx:15-32`）：barStyle 跟随主题（浅色→dark-content、深色→light-content）；状态栏透明 + 底部覆盖层高=StatusBar.currentHeight。
- **HorizontalSafeAreaView / VerticalSafeAreaView**：分别保左右安全区 / 上下安全区（平板只保 bottom，手机保 top+bottom）。
- **Portal**（`portal.tsx:15-78`）：zIndex=20000、absoluteFill，纯逻辑传送门。

### 2.2 AppBar 顶栏

`src/components/base/appBar.tsx`：

- **标题**（:75-87）：appbar(18) + bold(700)、numberOfLines=1；颜色 contentColor=colors.text（可经 titleTextOpacity 调透明）。注意：此处用语义档 "appbar"（原为 "title"，C01 已按多数派统一，二者像素同为 18）。
- **返回键/操作图标**（:60-71、92-101）：sizeType="normal"→iconSize 24、颜色 contentColor。
- **尺寸**：顶栏高 56dp（:112）；paddingHorizontal=8；内容区 paddingHorizontal=12；右侧按钮 marginLeft=16。

### 2.3 按钮族

- **Button**（`button.tsx:33-35`）：文字 content(16) + regular(400)；normal 类型文字默认 text 色、背景 colors.placeholder；primary 类型文字 color="white"、背景 colors.primary；按钮高 48dp、圆角 12。
- **TextButton**（`textButton.tsx:33`）：content(16) + regular(400)，fontColor 缺省 text；可选 paddingHorizontal=16、hitSlop 缺省 14。
- **IconButton**（`iconButton.tsx:48-61`）：fontColor="normal"→colors.text；sizeType="normal"→iconSize 24、minWidth=size（支持 size 精确覆盖）；IconButtonWithGesture 版用 TapGestureHandler 包裹。
- **IconTextButton**（`iconTextButton.tsx:25-28`）：文字 content(16) + regular(400)、colors.text；图标 light(20)、colors.text；文字 marginLeft=8；paddingHorizontal=16、paddingVertical=14（总高 48dp）。
- **Fab**（`fab.tsx:28-32`）：56×56 圆形（圆角 28）；图标 normal(24)、colors.text；容器背景 colors.backdrop；阴影 offset y=5/opacity 0.34/radius 6.27/elevation 10；定位 right=24、bottom=16。

### 2.4 文字与标签组件

- **Tag 角标**（`tag.tsx:21-23`）：tag(10) + regular(400)、colors.text；容器背景 colors.card、边框 colors.divider、borderWidth=1、圆角 rpx(24)、高 rpx(32)、paddingHorizontal rpx(12)、marginLeft rpx(12)。
- **Chip 标签**（`chip.tsx:29-31`）：subTitle(14) + regular(400)、colors.text；容器高 40、paddingHorizontal=14、圆角 18；关闭按钮 IconButton sizeType="small"→16、hitSlop=6、marginLeft rpx(8)。
- **TypeTag 分类标签**（`typeTag.tsx:47-54`）：description(12)；选中 bold(700)+白字、未选中 regular(400)+onSurfaceVariant ?? colors.text；选中背景/边框 colors.primary，未选中背景 surfaceVariant ?? card、边框透明；paddingHorizontal=14、paddingVertical=6、圆角 16、marginHorizontal=4。
- **LinkText**（`linkText.tsx:19-37`）：继承 ThemeText 默认 content(16)；**颜色 colors.primary**（原硬编码 "#66ccff"，C04 已按多数派统一）、下划线、按下 alpha 0.4（由 primary 派生）。
- **Paragraph**（`paragraph.tsx:8-17`）：content(16) + regular(400)；lineHeight=28.8（content×1.8）、marginVertical=2、letterSpacing=0.25。
- **KaraokeText**（`karaokeText.tsx:60-126`）：纯渲染组件，fontSize/lineHeight/fontWeight/sungColor/unsungColor 全部由外部 props 传入；支持多行歌词，进度染色模式 200ms 刷新、uniform 模式零订阅。
- **Tip 气泡**（`tip.tsx:183、208、303-306`）：description(12)、lineHeight=18；文字缺省 colors.text、背景缺省 colors.notification；paddingH rpx(16)/paddingV rpx(8)、圆角 rpx(8)、maxWidth rpx(300)、三角箭头 rpx(12)。
- **Toast**（`toast.tsx:133-137、184-188`）：content(16)、includeFontPadding=false；message 色 colors.text、actionText 色 white；图标 appbar(18)（success #457236 / warn #de7622）；容器 minWidth rpx(420)/maxWidth rpx(688)/minHeight rpx(88)/圆角 rpx(12)；action 按钮宽 rpx(120)/高 rpx(58)/圆角 rpx(30)/背景 colors.primary。
- **Tip 与 Toast 已迁移到 ThemeText**（C05 已按多数派统一），统一 allowFontScaling=false / includeFontPadding=false 约束；Toast 图标仍用 appbar(18)（跨档借用 iconSizeConst，未改）。

### 2.5 输入、选择与开关

- **Input**（`input.tsx:15-33`）：**默认 fontSize=content(16)**（C03 已按多数派统一，与 Button/TextButton 内置默认对齐）；fontColor 缺省 colors.text、placeholderTextColor=Color(text).alpha(0.7)；paddingVertical=0、paddingHorizontal=16（hasHorizontalPadding 时）。
- **Checkbox**（`checkbox.tsx:34-36`）：框体 22×22、圆角 2、borderWidth=1；勾选时边框/背景 colors.primary、未勾选边框 colors.text、勾内图标 colors.appBarText；**勾内图标 size=iconSizeConst.light(20)**（原 18 硬编码，C02 已按多数派统一）；hitSlop=14。
- **Switch（ThemeSwitch）**（`switch.tsx:50-62`）：轨道 52×32、圆角 16；开启背景 colors.primary、关闭 colors.textSecondary、滑块白色；滑块 22×22、圆角 11、left=5、滑动 fixedWidth=20；hitSlop top/bottom=12。

### 2.6 图片与图标

- **Icon**（`icon.tsx:179-191`）：生成式 SVG 图标库（80+），width/height 默认取 size，颜色由 props.color 传入，无内置默认尺寸。
- **Image / FastImage**：uri 字符串自动转 {uri}；空串/错误回退 emptySrc / placeholderSource，纯加载组件无文字规格。
- **ColorBlock**（`colorBlock.tsx:13-28`）：色块预览，宽 rpx(76)、高 rpx(50)、borderWidth=1、边框 #ccc，色值由 prop 传入。
- **ImageBtn 封面卡片**（`imageBtn.tsx:26-31`）：文字 subTitle(14) + regular(400)、numberOfLines=2 tail；封面 rpx(210)×rpx(210)、圆角 rpx(12)、marginBottom rpx(16)；卡片宽 rpx(210)、高 rpx(290)。

### 2.7 列表辅助态

- **Empty**（`empty.tsx:15-17`）：title(18) + regular(400)、colors.text；容器 flex:1、minHeight rpx(300)、居中。
- **ListEmpty**（`listEmpty.tsx:22-42`）：已结束态 title(18)+regular(400)、minHeight rpx(540)、gap rpx(36)；加载中态 title(18)+semibold(600)、ActivityIndicator size=appbar(18)；错误+重试态错误文字 title(18)+regular、重试按钮 content(16)+regular、paddingV rpx(24)/paddingH rpx(48)/圆角 rpx(36)/背景 rgba(128,128,128,0.2)。
- **ListFooter**（`listFooter.tsx:32-52`）：加载失败/加载中/已到底三态均 content(16)+regular(400)+textSecondary；失败态"点击重试"带下划线；加载中 ActivityIndicator size=appbar(18)、colors.textSecondary；行高 rpx(120)、columnGap rpx(24)。
- **Loading 全屏加载**（`loading.tsx:23-29`）：title(18) + semibold(600)、color prop 缺省 colors.text；ActivityIndicator colors.text；文字 marginTop rpx(48)。
- **NoPlugin 无插件提示**（`noPlugin.tsx:16-25`）：标题 title(18)+regular(400)；描述 subTitle(14)+regular(400)+textSecondary、marginTop rpx(24)。
- **PlayAllBar 全部播放栏**（`playAllBar.tsx:62`）：文字 body(15)+medium(500)、colors.text；播放图标 normal(24)、colors.text、marginRight rpx(12)；右操作 IconButton normal(24)、marginLeft rpx(36)；栏高 56、paddingHorizontal rpx(24)；收藏图标选中硬编码 #e31639。
- **SortableFlatList 拖拽手柄**（`SortableFlatList.tsx:388-455`）：手柄图标 "bars-3"、normal(24)、useTextColor()→colors.text；手柄区宽 48 居右。

### 2.8 ErrorBoundary 错误页

`src/components/errorBoundary/index.tsx`：

- **主标题**（:146-152）：title(18)+bold(700)、colors.text、居中、paddingTop rpx(40)、marginBottom rpx(48)。
- **区块小标题**（:58-64、160-213）：subTitle(14)+bold(700)、colors.text；card 背景 + divider 边框、圆角 rpx(16)、borderWidth rpx(2)、padding rpx(24)。
- **设备信息 label/value**（:67-77、287-296）：ThemeText，label=description(12)+textSecondary、value=body(15)+medium(500)+text（原 rpx(28) 硬编码，C06 已按多数派统一）。
- **错误详情文本**（:167-169、306-309）：ThemeText description(12)+textSecondary、lineHeight rpx(36)（原系统默认字号，C06 已统一）。
- **堆栈文本**（:176-178、316-320）：ThemeText caption(11)+monospace、lineHeight rpx(32)、colors.textSecondary、maxHeight rpx(300)、背景 rgba(0,0,0,0.05)（原 rpx(24) 硬编码，C06 已统一）。
- **反馈链接**（:218-237）：标签 content(16)+medium(500)、LinkText content(16)、提示 description(12)+italic。
- 该页硬编码字号已全部迁移到 ThemeText 档位（C06 已按多数派统一）。

---

## 第 3 章 列表与卡片组件（mediaItem / musicList / musicBar / musicSheetPage）

### 3.1 标题组件 TitleAndTag

`src/components/mediaItem/titleAndTag.tsx:16-18`：标题 content(16)+medium(500)，titleFontColor prop 缺省 colors.text、可传 "primary" 高亮；numberOfLines=1，右侧跟 Tag（tag=10px）。注意：ListItem.Content 字符串标题为 content(16)+medium(500)，音乐/专辑行标题经 TitleAndTag 渲染同为 content(16)——原 body(15) 为少数派，C08 已按多数派统一。

### 3.2 MusicItem 歌曲行

`src/components/mediaItem/musicItem.tsx`：

- **标题**（:74-80，委托 TitleAndTag）：content(16)+medium(500)；highlight 时 primary、否则 text。
- **副文本（歌手-专辑）**（:91-97）：description(12)+regular(400)+textSecondary（highlight 时 primary）；本地歌曲带 check-circle 图标 size=20、色 #11659a、marginRight=4；descContainer marginTop=2。
- **序号**（:63-71）：subTitle(14)+regular(400)（highlight primary、否则 text）；fixedWidth=40、italic、居中、padding=2。
- **布局**：行高 big=64；封面 LocalSongCover 48×48、圆角 8、marginRight=16；"更多"图标宽 40。

### 3.3 AlbumItem / LyricItem 同级行

- **AlbumItem**（`albumItem.tsx:16-39`）：标题走 TitleAndTag（content 16/medium）、描述 description(12)+textSecondary；行高 big=64、封面 48×48 圆角 8。
- **LyricItem**（`LyricItem.tsx:14-33`）：结构与上一致（标题 content 16/medium、描述 description 12/textSecondary、行高 big=64）。

### 3.4 PlaylistCard / SheetItem / ImageBtn 歌单卡片

- **PlaylistCard**（`playlistCard.tsx`）：
  - 标题（:97-104）：normal(13)+medium(500)、colors.text、numberOfLines=1 tail、marginTop=2；封面 130×130、圆角 12、marginBottom=6。
  - 副行（:106-113）：caption(11)+regular(400)+textSecondary、marginTop=2。
  - 播放量角标（:90-94）：tag(10)+regular(400)+白字；背景 rgba(0,0,0,0.5)、圆角 6、paddingH 6/paddingV 2、定位 right/bottom=6。
- **SheetItem**（`sheetItem.tsx:18-31`）：委托 ImageBtn，标题 normal(13)。
- ImageBtn（normal 13）与 PlaylistCard（normal 13）同为"封面+标题"歌单卡片——原 ImageBtn 为 subTitle(14) 少数派，C07 已按多数派统一为 normal(13)+medium(500)。

### 3.5 TopListItem 榜单行

`src/components/mediaItem/topListItem.tsx`：

- **标题**（:56-61）：content(16)+medium(500)、colors.text、numberOfLines=1（原 body(15)，C08 已按多数派统一）。
- **描述**（:63-68）：description(12)+regular(400)+textSecondary；行 paddingHorizontal=16、paddingVertical=10；底部分隔线 marginLeft=70。
- **右侧箭头**（:71-76）：用 "›" 字符（非图标）body(15)+regular(400)+textSecondary、marginRight=4。
- **图标块**：40×40、圆角 10、渐变 primary 0.85→0.45、fire 图标 size=20 白色、marginRight=14。

### 3.6 LocalSongCover 本地封面

`src/components/mediaItem/localSongCover.tsx:69-147`：默认 size=48、圆角 8；占位渐变 colors.primary→alpha 0.75；占位音符图标白字、size=Math.round(size×0.45)（随封面缩放，48 时≈22，非档位值）。

### 3.7 MusicList 歌曲列表

`src/components/musicList/index.tsx:35、123-142`：ITEM_HEIGHT=64；行内容走 MusicItem（TitleAndTag content 16/medium + description 12）；高亮项 highlight→primary；FlashList estimatedItemSize=64；ListEmpty/ListFooter 复用基础组件；"回到当前播放"角标 44×44 圆形、图标 normal(24)。

### 3.8 MusicBar 底部播放栏

- **容器**（`musicBar/index.tsx:87-149`）：高 72、圆角 12、marginHorizontal=6；背景 colors.musicBar、文字 colors.musicBarText；播放列表图标 size=40（硬编码，恰等于 large=40）；CircularPlayBtn radius=24、activeStrokeWidth=3；**平板模式隐藏底部 MusicBar**（:84）。
- **MusicInfo 信息区**（`musicInfo.tsx`）：
  - 歌曲标题（:63-65）：content(16)+regular(400)+musicBarText、numberOfLines=1 tail；封面 56×56 圆形、marginRight=12。
  - 歌手名（:67-74）：description(12)+regular(400)、Color(musicBarText).alpha(0.6)，与标题同行内联（" -artist"）。

### 3.9 MusicSheetPage 歌单详情页

- **页面骨架**（`musicSheetPage/index.tsx:30-54`）：VerticalSafeAreaView → StatusBar → NavBar(=AppBar) → SheetMusicList → MusicBar。
- **Header**（`components/header.tsx`）：
  - 歌单标题（:46-48）：title(18)+regular(400)+colors.text、numberOfLines=3；封面 176×176、圆角 20；详情区 paddingHorizontal=32、头部 padding=20。
  - 歌曲数/来源（:50-63）：description(12)+regular(400)+textSecondary，"共 X 首"与"来源：xxx"并列。
  - 歌单描述（:76-81）：description(12)+regular(400)+textSecondary、marginTop=24，可展开/收起（maxLines=6 ↔ undefined）。
- **NavBar**（`components/navBar.tsx:22-59`）：走 AppBar（title 18/bold）、colors.text；actions 默认 2 个（magnifying-glass、ellipsis-vertical）。
- **SheetMusicList**（`components/sheetMusicList.tsx:30-64`）：无列表时走 Loading（title 18/semibold）；有列表走 MusicList+Header；HorizontalSafeAreaView 包裹、showIndex 显示序号。

---

## 第 4 章 对话框体系（components/dialogs/）

### 4.1 机制与三级浮窗基座

- **useDialog 单槽位**（`useDialog.ts:10-30`）：GlobalState 单槽，showDialog(name, payload) 覆盖当前、hideDialog 置 null；同一时刻仅一个对话框；`index.tsx` 按 name 查表渲染。
- **Dialog 外壳**（`components/base/index.tsx:36-143`）：平板 left 30%/width 70%/top 56/bottom 0；手机 width 86%、平板另有 width 60% 档；圆角 20dp、borderWidth 0.5、边框 rgba(0,0,0,0.16)、elevation 8；zIndex：backContainer 16299 / mask 16300 / dialogContainer 16310；动画 scale 0.9→1.0 + 淡入。
- **Dialog.Title 渐变标题行**（:152-204）：title(18)+bold(700)；渐变底 primary α0.10 → (primaryContainer ?? primary) α0.07 → rgba(0,0,0,0.016)，水平 start(0,0)→end(1,0)；行高 52dp、paddingHorizontal 24；左侧蓝色胶囊竖条 4×20dp、圆角 2、marginRight 12；withDivider 时下方 0.6dp 分割线 primary α0.12。
- **Dialog.Content 内容区**（:212-251）：字符串 children 名义传 content(16)，但 defaultFontStyle 后覆盖为 **fontSize:13 / lineHeight:21**（:217-220 + 399-402），即对话框正文实际为 13px/21（对齐 APlayer Level3BodyText）；fontColor=textSecondary；maxHeight=vh(70)、paddingHorizontal 24、paddingTop/Bottom 16。实际 13 与档位 normal 同值但非 content——C12 已按多数派统一（文档修正）："对话框正文=normal(13)/行高21"为独立档位，不从 content 派生。
- **Dialog.Actions 底部按钮行**（:264-325）：渐变底与标题行同、上方 0.6dp 分割线 primary α0.12；行高 52dp、paddingHorizontal 24、按钮间 marginLeft 24、nowrap。
- **BottomButton 按钮单元**（:327-351）：subTitle(14)+medium(500)；type=normal→colors.textSecondary、type=primary→colors.primary；flex:1、height 52、activeOpacity 0.6。**基座仅实现 normal/primary，未实现 danger 类型**——C13 已按多数派统一（维持现状+文档注明）：危险操作确认一律用 SimpleDialog(okText="删除" type=primary)，不引入 danger type；内容区红底按钮仅用于"取消定时"这类即时执行型操作。

### 4.2 各对话框实况（标题/内容/按钮构成）

| 对话框（文件） | 标题 | 内容要点 | 底部按钮构成 |
|---|---|---|---|
| SimpleDialog（simpleDialog.tsx:13-51） | title 18/bold | Content 实际 13/textSecondary | 有 onOk：取消(normal)+确定(primary)；无 onOk：单按钮"知道了"(primary) |
| MenuDialog（menuDialog.tsx:46-141） | title 18/bold（withDivider） | 菜单项 ListItem small(48)、图标 light(20)、Content content(16)/medium；开关项实时订阅配置 | 取消(normal)+确定(primary，仅关闭) |
| AddToMusicSheetDialog（addToMusicSheetDialog.tsx:18-109） | title 18/bold withDivider | 歌单行 ListItem small(48) | 仅 取消(normal)；点行即加入并关闭 |
| CheckStorage（checkStorage.tsx:13-73） | stringContent title 18/bold（无 divider） | 正文手写 13/21 textSecondary、复选标签 content(16)；ScrollView maxHeight vh(40) | 取消(normal)+不再询问(primary) |
| CreateMusicSheetDialog（createMusicSheetDialog.tsx:17-72） | title 18/bold withDivider | Input content(16)/lineHeight 24、背景 rgba(128,128,128,0.08)、圆角 12 | 取消(normal)+确定(primary) |
| DownloadDialog（downloadDialog.tsx:20-114） | stringContent title 18/bold（无 divider） | 正文手写 13/21 textSecondary、复选标签 subTitle(14) | 自布局 buttonGroup：取消(normal)+应用内下载(primary)+备用URL(primary，条件)，贴右不等分 |
| DownloadSettingsDialog（downloadSettingsDialog.tsx:35-254） | title 18/bold withDivider | 分组标题 OptionGroup subTitle(14)/bold(700)/primary；行 small(48) Content content(16)；路径说明 description(12)/textSecondary；内容 padding 全置 0 | **取消(normal)+确认(primary)（文案 t("common.confirm")="确认"，非"保存"）** |
| EditSheetDetailDialog（editSheetDetail.tsx:23-147） | **有 Dialog.Title**（"编辑歌单信息" withDivider，C11 已按多数派统一） | 行标签 content(16)/regular（"封面"/"歌单名"）、Input 高 content×2.5=40、封面 56×56 圆角 8、行高 60 | 取消(normal)+确定(primary) |
| FileSelectorDialog（fileSelectorDialog.tsx:48-435） | actionLabel title 18/bold withDivider | 面包屑 description(12)（当前段 primary）、行名 normal(13)/medium、行副标 caption(11)/textSecondary、行高 48、返回箭头 small(16) | 取消(normal)+确认(primary，show=canConfirm) |
| ImmersiveSettingDialog（immersiveSettingDialog.tsx:19-89） | title 18/bold withDivider | 行 small(48) Content content(16)；说明 description(12)/textSecondary、行高 44 居中；padding 全置 0 | **无 Dialog.Actions**（即改即生效） |
| ImportMusicSheetDialog（importMusicSheetDialog.tsx:84-403） | title 18/bold withDivider | Input 默认、提示 description(12)/textSecondary、返回按钮 normal(13)/textSecondary、插件行 small(48) | choose 模式：取消(normal)+返回输入(primary)；其他：取消(normal)+确定(primary) |
| LoadingDialog（loadingDialog.tsx:18-58） | title 18/bold（无 divider） | 内容区高 rpx(280) 包 Loading | 仅 取消（未指定 type，默认 normal） |
| LyricColorDialog（lyricColorDialog.tsx:25-333） | title 18/bold（无 divider） | hex 输入框手写 14px（#fff 底/#333 字/#ccc 边）、色板 200×200；padding 全置 0 | 取消(normal)+确定(primary) |
| LyricSettingDialog（lyricSettingDialog.tsx:31-181） | title 18/bold withDivider | 偏移行主标 content(16)/medium、状态 description(12)；步进按钮 description(12)/medium（选中 primary 字+primary α0.1 底，否则 textSecondary+surfaceVariant 底）、高 28 圆角 14；padding 全置 0 | **无 Dialog.Actions**（行内即改即生效） |
| MarkdownDialog（markdownDialog.tsx:21-296） | title 18/bold withDivider | WebView 内 html 基础 16px、h1 28/h2 24/h3 20/h4 18/h5 16/h6 14；内容高 vh(60) | 仅 "知道了"(primary) |
| MusicListEditorDialog（musicListEditorDialog.tsx:27-140） | title 18/bold withDivider | 顶部"全选/取消全选"用 base/textButton；行走 MusicList | 下一首播放(normal)+加入歌单(normal)+下载(primary) |
| PermissionSettingDialog（permissionSettingDialog.tsx:21-159） | title 18/bold withDivider | 说明 description(12)/textSecondary；行 small(48) Content content(16)+副标 description(12)、右侧 ThemeSwitch | 仅 "完成"(primary) |
| PlayRateDialog（playRateDialog.tsx:25-70） | title 18/bold（无 divider） | 行 small(48) Content content(16)、选中 check light(20)/primary；padding 全置 0 | 仅 取消(normal)；点行即应用并关闭 |
| RadioDialog（radioDialog.tsx:32-126） | title 18/bold（手动再包 ThemeText） | 行 small(48) Content content(16)、选中 check light(20)/primary；FlatList maxHeight vmin/vmax(60) | **无 Dialog.Actions**；点行即触发 onOk 关闭 |
| RecommendSourceDialog（recommendSourceDialog.tsx:33-160） | title 18/bold（无 divider） | 行 content(16)（选中 bold(700) primary、未选中 medium(500) text）、可用率 caption(11)/textSecondary | 取消(normal)+确认(primary)+恢复默认(normal) |
| SetFontSizeDialog（setFontSizeDialog.tsx:22-71） | title 18/bold（无 divider） | 4 档位标签 content(16)/opacity 0.5；Slider primary | 仅 取消(normal) |
| SetScheduleCloseTimeDialog（setScheduleCloseTimeDialog.tsx:17-117） | title 18/bold（无 divider） | Input content(16)/lineHeight 24（card 底/divider 边/text 字）、单位 subTitle(14)/medium、提示 subTitle(14)/textSecondary；数字键盘 1~1440 | 取消(normal)+确定(primary) |
| SortDialog（sortDialog.tsx:34-158） | title 18/bold（手动包 ThemeText） | 行 small(48) Content content(16)；底部方向按钮自布局 subTitle(14)（选中 bold(700)/primary、未选中 regular(400)/textSecondary）、flex:1 height:52 | 自布局两个方向 dirButton |
| SubscriptionSettingDialog（subscriptionSettingDialog.tsx:72-205） | "订阅设置" title 18/bold withDivider | 行 small(48) Content content(16)、空态 description(12)/textSecondary、删除图标 light(20)/textSecondary、添加加号 normal(24)/primary | 取消(normal)+恢复默认(normal)+更新订阅(primary) |
| ThemeSettingDialog（themeSettingDialog.tsx:13-37） | title 18/bold（无 divider） | 内容为 Mode/Background/BackgroundCustom 子组件；padding 全置 0 | 仅 取消(normal) |
| TimingCloseDialog（timingCloseDialog.tsx:23-109） | title 18/bold withDivider | 快捷时长 content(16)、"播完关闭" content(16)、"取消定时" normal(13)/medium 白字（#ff666699 底）；时长胶囊 #99999999 圆角 12 | 仅 取消(normal) |
| UpdateDownloadDialog（updateDownloadDialog.tsx:43-261） | title 18/bold withDivider（文案随状态） | 百分比 subTitle(14)/bold(700)、元信息 description(12)/textSecondary；进度条高 8 圆角 4、填充 primary、轨道 #99999933 | 取消(normal)+（下载完成/失败时追加 立即安装/重试 primary，条件渲染） |
| VolumeSettingDialog（volumeSettingDialog.tsx:18-82） | "音量" title 18/bold withDivider | 百分比 content(16)、"读取中…" content(16)/opacity 0.6；Slider primary、图标 normal(24)/textSecondary | **无 Dialog.Actions**（滑块实时生效） |
| ImageViewerDialog（imageViewerDialog.tsx，2026-10-14 新增） | "图片预览" title 18/bold withDivider | 图片 Image 宽 100%/高 vh(55)/resizeMode contain/圆角 12；源为 musicDetail 专辑封面长按传入 url | 取消(normal)+保存图片(primary，保存成功/失败均 Toast 提示) |

### 4.3 对话框体系内分歧（详见第 8 章）

- 底部 Actions 行从"完全没有"到"3 按钮"并存；**即改即生效型对话框（开关/滑块/单选）不渲染 Dialog.Actions 整块**——C09（✅ 用户已拍板：候选A 不渲染空条，内容区贴底）。
- DownloadDialog / SortDialog 自定义按钮布局，与基座 BottomButton 不等分——C10（✅ 用户已拍板：候选B 保留自布局为既有特例，自布局必须行高 52 + 字号 subTitle(14) 起步）。
- EditSheetDetailDialog 已补 Dialog.Title——C11（✅ 已按多数派统一）。
- 基座 BottomButton 未实现 danger 类型，危险操作均借用 primary 按钮或内容区红底按钮——C13（✅ 已按多数派统一：维持现状+文档注明）。

---

## 第 5 章 面板体系（components/panels/）

### 5.1 机制与基座

- **usePanel 单槽位**（`usePanel.ts:14-49`）：GlobalState 单槽；showPanel 时若已有面板先 emit("hidePanel") 排队 callback；hidePanel 支持 immediate（跳过动画）+ callback（如"关面板弹三级浮窗"）；`index.tsx` 用 React.memo(() => true) 包裹。
- **PanelBase 浮出层基座**（`base/panelBase.tsx:48-241`）：浮出层（非居中对话框）体系的统一基座，弹出位置与滑入方向随设备/方向分三种（代码注释明确"平板：遮罩与面板限制在右内容区——左 30% 播放区 + 顶部 tab 栏不被遮挡"）：
  - **手机竖屏**：底部上滑（translateY、默认高 vh(60)、bottom:0、顶部圆角 14）。
  - **平板横屏（项目主场景，且非全屏播放）**：**右侧浮出层**——left 30%/width 70%/top 56(TAB_BAR_HEIGHT)/bottom 0，translateX 从右滑入（基距 rpx(750)）；不遮左 30% 播放区、不遮顶 tab 行。
  - **positionMethod='top'**：自顶部下滑（如 SetUserVariables、SearchLrc）。
  - 全屏播放层激活时为例外（全屏覆盖、点面板外任意处关闭）。遮罩 #000 opacity 0.5；zIndex mask 15000 / panel 15010；动画 250ms Easing.out(exp)。
- **PanelFullscreen 全屏基座**（`base/panelFullscreen.tsx:44-177`）：width/height 100%；动画 SlideToTop（默认）或 Scale（0.3→1.0）；有遮罩 #000 opacity 0.5，无遮罩时面板底 colors.background。
- **PanelHeader 面板标题栏**（`base/panelHeader.tsx:21-71`）：标题 title(18)+bold(700)；取消/确定 subTitle(14)+medium(500)；渐变底 primary α0.14→α0.04 对角 start(0,0)→end(1,1)；取消按钮默认 text 色、确定按钮 primary；行高 56、paddingHorizontal 16、左右按钮宽 72、标题 flex:1 居中、下方 Divider（可关）。
- PanelHeader 与 Dialog.Title 同为 title 18/bold，但渐变 stops/方向、行高（56 vs 52）、是否带胶囊竖条、取消按钮颜色（text vs textSecondary）均不同——C14（⏳ 待用户决策：对话框 29 处内部统一、PanelHeader 8 处内部统一，另有 3 个无标题条面板头部为各自设计（2 个歌曲信息卡头为特例、SearchLrc 无头）；倾向候选B：两套标题规格为有意区分）。

### 5.2 各类型面板实况

> 概览：当前活跃面板 **11 个**，其中 **8 个用统一 PanelHeader**（appBarMore、associateLrc、musicQuality、simpleSelect、simpleInput、setUserVariables、sheetTags、**playList（2026-10-14 起）**）；**3 个无标题条**（MusicItemOptions/MusicItemLyricOptions 歌曲信息卡头——用户拍板保留为特例；SearchLrc 搜索头——落位已与其他面板一致）。ImageViewer 已于 2026-10-14 由全屏面板迁至三级弹窗（imageViewerDialog）。逐条如下。

- **AppBarMore 顶栏三点面板**（`types/appBarMore.tsx:39-113`）：PanelHeader title 18/bold 但 hideButtons；行 ListItem small(48)、图标 light(20) 宽 28、Content content(16)/medium、右侧 ThemeSwitch；body paddingTop rpx(12)、footer 高 rpx(30)。
- **AssociateLrc 关联歌词输入**（`types/associateLrc.tsx:23-98`）：PanelHeader 带 取消/确定；Input content(16)/lineHeight 24（placeholder 背景、text 字、textSecondary 占位）；高 vmax(30)、圆角 6、margin/padding 12。
- **ImageViewer 图片查看**：**已于 2026-10-14 由全屏面板迁至三级弹窗**（用户拍板：图片查看改为三级弹窗页面）。面板文件 `types/imageViewer.tsx` 已删除（备份 E:\Temp\Deepseek\jiyuejie-panels-backup-20261014\），新载体见第 4 章 **ImageViewerDialog**（`dialogs/components/imageViewerDialog.tsx`：Dialog.Title "图片预览" + 图片 Content（宽 100%、高 vh(55)、contain）+ 取消/保存图片 Actions）。调用处：musicDetail 专辑封面长按 → showDialog("ImageViewerDialog")。
- **MusicItemOptions 歌曲行三点面板**（`types/musicItemOptions.tsx:52-283`）：无 PanelHeader（自定义头部）；头部歌曲名 content(16)/numberOfLines 2、副行 description(12)/textSecondary、artwork 72×72 圆角 8、头部区高 100；行 ListItem small(48) Content content(16)/medium。
- **MusicItemLyricOptions 全屏页歌词三点面板**（`types/musicItemLyricOptions.tsx:40-256`）：与 MusicItemOptions 头部/列表结构镜像一致。
- **MusicQuality 音质选择**（`types/musicQuality.tsx:27-84`）：PanelHeader title 18/bold hideButtons；行 content(16)/regular(400)；高 vh(65)、行高 48；点行即选中关闭。
- **SetFontSize 字体大小-面板版**（`types/setFontSize.tsx`）：**已于 2026-10-14 下线**（用户拍板 C16 候选A：保留浮窗版 SetFontSizeDialog；面板版无任何调用方，属死代码，注册与文件已移除，备份于 E:\Temp\Deepseek\jiyuejie-ui-conflict-backup-20261014\）。浮窗版见第 4 章 SetFontSizeDialog（Slider 0~3 四档、标签 content(16)/opacity 0.5、底部仅"取消"）。
- **SetUserVariables 插件用户变量**（`types/setUserVariables.tsx:23-87`）：PanelHeader 带 取消/确定；变量名 content(16)、Input（placeholder 背景）；positionMethod='top'、高 vmax(80)、变量名 maxWidth 35%/Input 宽 50%。
- **SheetTags 歌单分组标签**（`types/sheetTags.tsx:19-82`）：PanelHeader title 18/bold hideButtons；分组标题 content(16)/medium；高 vh(70)、TypeTag flexWrap。
- **SimpleInput 通用输入面板**（`types/simpleInput.tsx:24-95`）：PanelHeader 带 取消/确定；Input content(16)/lineHeight 24、hints 行 subTitle(14)/textSecondary；高 vmax(30)、autoFocus 默认 true。
- **SimpleSelect 通用选择面板**（`types/simpleSelect.tsx:22-66`）：PanelHeader title 18/bold hideButtons；行 small(48) Content content(16)/medium；高 vh(65)；点行即选关闭。
- **TimingClose 定时关闭-面板版**（`types/timingClose.tsx`）：**已于 2026-10-14 下线**（用户拍板 C15：保留居中浮窗版 TimingCloseDialog；原 musicItemOptions"定时关闭"入口已改为 showDialog("TimingCloseDialog")，注册与文件已移除，备份于 E:\Temp\Deepseek\jiyuejie-ui-conflict-backup-20261014\）。浮窗版见第 4 章 TimingCloseDialog（快捷时长 content(16)、"播完关闭" content(16)、"取消定时" normal(13)/medium 白字 #ff666699 底、底部仅"取消"）。
- **PlayList 当前播放队列**（`types/playList/`）：
  - header（header.tsx）：**2026-10-14 起统一为 PanelHeader 规格**（用户拍板"播放队列要和其他右侧弹出的统一"）：title(18)/bold 居中、含内嵌计数、行高 56、对角渐变底；循环模式/清空按钮移到底部工具条。
  - body（body.tsx）：序号 subTitle(14)（当前 primary bold、否则 textSecondary regular）；歌名 body(15)（当前 primary bold、否则 text medium）；歌手 description(12)/textSecondary；"播放中" caption(11)/primary；底部工具条 56dp（Divider 分隔 + 循环模式/清空 IconTextButton，justifyContent space-between）。
  - 行高 64、paddingH 16/paddingV 8、序号宽 28、删除 IconButton small；高 vh(80)。
- **SearchLrc 搜索歌词面板**（`types/searchLrc/`）：无 PanelHeader；Input content(16)/lineHeight 24；TabBar label 原生 Text（focused bolder(800)/未 focused medium(500)、宽 120 居中、activeColor=primary/inactiveColor=text、指示条 primary 高 3）；**2026-10-14 起落位与其他右侧浮出层一致**（移除 positionMethod='top'，改默认底部上滑；平板横屏仍占右内容区全高）、高 vmax(80)。

---

## 第 6 章 设置页（pages/setting/ 与 pages/scanSettings/）

### 6.1 设置页壳

- **AppBar 标题**（`pages/setting/index.tsx:21`、`pluginList.tsx:389-419`、`scanSettings/index.tsx:171`）：AppBar 内部默认 appbar(18)、**bold(700)**（字重修正：早期记录"medium(500)"与实际不符，实为 bold(700)）；颜色 appBarText=#FFFFFF；高 56dp。
- **路由注册表**（`settingTypes/index.ts:14-25`）：仅注册 basic=基本设置、about=关于；backup 已迁出为独立二级页（ROUTE_PATH.BACKUP），theme 改为三级浮窗 ThemeSettingDialog。

### 6.2 aboutSetting 关于页

`pages/setting/settingTypes/aboutSetting.tsx`：

- **品牌卡应用名**（:70-75）：title(18)+bold(700)、colors.text、numberOfLines=1；Logo 88×88 圆角 20、卡片渐变 primary α0.18→α0.05、padding 20。
- **版本号副文本**（:76-82）：description(12)+regular(400)+textSecondary、marginTop=6。
- **检查更新按钮**（:94-99）：normal(13)+medium(500)+primary；高 34、paddingH 20、圆角 17 胶囊、背景 primary α0.1。
- **分组卡片标题**（:106-175 四处）：content(16)+bold(700)+text；卡片圆角 14、padding 16、marginBottom 16、标题 marginBottom=4。
- **卡片正文段落**（:112-182）：content(16)+regular(400)+text，内部强调词 bold(700)、marginTop=6、lineHeight=22；外链用 LinkText。
- **底部署名**（:185-190）：description(12)+regular(400)+textSecondary、居中。

### 6.3 backupSetting 备份与恢复页

`pages/setting/settingTypes/backupSetting.tsx`：

- **分组标题行**（:212-301 三处）：subTitle(14)+bold(700)+primary；行高 36、paddingHorizontal 16。
- **列表行标题**（:248-354）：ListItem.Content 默认 content(16)+medium(500)+text、heightType="small"(48)；右侧当前值同 content(16)；行间 ListDivider marginLeft=16。

### 6.4 basicSetting 基本设置

`pages/setting/settingTypes/basicSetting.tsx`：

- **分组标题行**（:486-491）：subTitle(14)+bold(700)+primary；行高 36、paddingHorizontal 16、卡片圆角 14。
- **开关行标题**（createSwitch，:26-44、渲染 :501-507）：content(16)+medium(500)+text、heightType="small"(48)、右侧 ThemeSwitch。
- **单选行标题+右侧值**（createRadio，:46-78）：标题 content(16)+medium(500)+text；右侧值 content(16)+regular(400)+text。
- **入口行**（:425-447）：标题 content(16)+medium(500)+text；右箭头 Icon size=20、textSecondary。
- **悬浮歌词滑块标签行**（:641-704）：标签 content(16)+medium(500)+text + 右侧实时数值 content(16)/textSecondary 同行右对齐（labelRow）、滑块在下 marginTop rpx(28)（C17 已按多数派统一为 backgroundCustom 写法：原 basicSetting 为标签+滑块同行、行高 48、无数值）。
- **对齐/颜色选择行**（:727-784）：标题 content(16)+medium(500)+text、heightType="small"(48)、右侧 ColorBlock。

### 6.5 pluginSetting 音源管理

- **插件卡片名**（`settingTypes/pluginSetting/components/pluginItem.tsx:140-144`）：title(18)+regular(400)+text、numberOfLines=1；右侧 ThemeSwitch。
- **插件可用率标签**（:160-164）：ThemeText 原生实现保留，字号引用 description 档（fontSizeConst.description，原硬编码 12，C22 已按多数派统一）、includeFontPadding=false；白字、底色动态（≥80% #4CAF50 / ≥50% primary / <50% #E53935 / 无数据 textSecondary）、圆角 rpx(8)。
- **版本/作者副文本**（:176-198）：subTitle(14)+regular(400)+textSecondary。
- **操作按钮**（:203-210）：3 个 IconTextButton flex=1 等分（arrow-path/share/trash-outline）。
- **插件排序页**（`settingTypes/pluginSetting/views/pluginSort.tsx`）：标题 appbar(18)、完成按钮 content(16)+bold(700)；排序 chips normal(13)（选中 bold/白字 primary 底）；行名 content(16)+regular、行高 48；左侧平台徽章 caption(11) 档（原硬编码 11，C22 已按多数派统一）/bold/白字；右侧可用率 description(12)/textSecondary。

### 6.6 themeSetting 主题设置浮窗内组件

- **分组标题**（`background.tsx:17-22`、`mode.tsx:18-23`、`backgroundCustom.tsx:82-87`）：subTitle(14)+bold(700)+primary、paddingLeft rpx(24)、marginTop rpx(36)。
- **主题卡片标题**（`themeCard.tsx:54-60`）：subTitle(14)+regular(400)（选中 primary、否则 text）；预览 rpx(112) 圆角 rpx(18)、选中 borderWidth=2 primary。
- **跟随系统开关行**（`mode.tsx:31-52`）：标题 content(16)+regular(400)+text、heightType="small"(48)、右侧 ThemeSwitch。
- **自定义背景操作行**（`backgroundCustom.tsx:71-77`）：content(16)+medium(500)+text（danger 行 #E5484D 硬编码）；行圆角 rpx(12)、paddingV/H rpx(20)。
- **自定义背景滑块标签**（`backgroundCustom.tsx:120-154`）：标签 content(16)+medium(500)+text、数值 content(16)+regular(400)+textSecondary、labelRow 左右对齐——C17 已按多数派统一：basicSetting 悬浮歌词滑块行已改与该写法一致。

### 6.7 scanSettings 扫描设置页

`pages/scanSettings/index.tsx`：

- **AppBar 标题**（:171/179）：appbar(18)、appBarText，文案"媒体来源"。
- **开始扫描大卡**（:199-209）：标题 content(16)+bold(700)+text（渐变 primary α0.14→α0.04 底、圆角 14、左侧图标 size=22 primary）；副标题 description(12)+regular(400)+textSecondary。
- **分组标题 SectionTitle**（:320-331）：subTitle(14)+bold(700)+primary、marginTop 20/marginBottom 8。
- **开关行标题 SettingSwitchRow**（:347）：content(16)+medium(500)+text（原 body(15)，C18 已按多数派统一）；左侧图标 size=20 primary、右侧 ThemeSwitch、paddingH 16/paddingV 6；副标题 description(12)+textSecondary。
- **权限行标题**（:264-268）：content(16)+medium(500)+text（原 body(15)，C18 已统一）；左侧 shield-keyhole-outline size=20 primary、右侧返回箭头 size=16 textSecondary α0.5；paddingV 10。
- **AddRow 添加行**（:380-385）：content(16)+medium(500)+primary（原 body(15)，C18 已统一）；左侧 plus size=16 primary、marginLeft=8、paddingV 10（compact 8）。已核实与同级权限行/开关行同档同字重。
- **文件夹路径行 FolderRow**（:401-407）：normal(13)+regular(400)+textSecondary、numberOfLines=1、右侧 x-mark size=16 textSecondary。
- **底部说明**（:305-313）：caption(11)+regular(400)+textSecondary（opacity 0.7）、marginTop 16、lineHeight 18。
- basicSetting 设置行标题 content(16)+medium 与 scanSettings 行标题已统一为 content(16)+medium（C18 已按多数派统一）。

---

## 第 7 章 业务页（pages/home/ 与 pages/musicDetail/）

### 7.1 首页 TabBar

- **手机版底部 Tab 文字**（`tabBar.tsx:91-103`）：subTitle(14)（选中 semibold(600)/未选中 regular(400)）、选中 primary/未选中 textSecondary；图标 size=24；栏背景 colors.tabBar。
- **平板版顶部 Tab 文字**（`tabBar.tsx:166-179`）：fontSize="xlarge"(32，C20 新增档位)；字重同上（选中 semibold(600)/未选中 regular(400)）；图标 size=32；选中底 primary α0.12；顶栏高 56dp。原写法 fontSize="title"+inline style 32（prop 失效）已统一为 xlarge 档位。
- **平板顶栏设置齿轮**（:184-208）：IconButton cog-8-tooth size=32、inSetting primary/否则 textSecondary。
- **手机导航栏搜索框**（`navBar.tsx:46-51`）：subTitle(14)+regular(400)、白字 opacity 0.9；搜索框圆角 20、maxHeight 40。

### 7.2 homeBody 首页内容

- **统计三卡（平板）**（`statsRow.tsx:151-162`）：数值 large(22)+bold(700)+text；标签 subTitle(14)+regular(400)+textSecondary。
- **统计三卡（手机）**（:181-193）：数值 title(18)+bold(700)+text；标签 caption(11)+regular(400)+textSecondary。
- **金刚区入口卡标题**（`operations.tsx:183-189`）：body(15)+bold(700)+text；图标块 42×42 圆角 14。
- **推荐歌单区分组标题**（`recommendSection.tsx:204-209`）：subTitle(14)+bold(700)+primary、marginBottom 10（原 content(16)+text 色，C19 已按多数派统一）。
- **推荐分类胶囊**（:241-252）：description(12)（选中 bold/白字 primary 底、未选中 regular/textSecondary）。
- **我的歌单 Tab 标题**（`sheets.tsx:100-131`）：content(16)（选中 bold(700)/未选中 regular(400)）、选中下划线 6dp primary；计数 subTitle(14)+regular(400)+textSecondary。

### 7.3 libraryTab 音乐库

- **入口卡标题（手机）**（`libraryTab.tsx:361-367`）：title(18)+bold(700)+text；副标 caption(11)+regular(400)+textSecondary。
- **入口卡标题（平板）**（:326-340）：large(22)+bold(700)+text；副标 subTitle(14)+regular(400)+textSecondary。
- **"本地歌曲"排序行标题**（:382-386）：subTitle(14)+bold(700)+primary（原 content(16)+text 色，C19 已按多数派统一）；右端排序图标 size=20 primary、当前排序文字 normal(13)/textSecondary。
- **歌曲行 LocalSongItem**（:585-608）：标题 content(16)+medium(500)+text（原 body(15)，C08 已按多数派统一；封面 48×48 圆角 8）；副标 description(12)+regular(400)+textSecondary；时长 normal(13)+regular(400)+textSecondary。
- **空列表提示**（:418-423）：subTitle(14)+regular(400)+textSecondary、居中 paddingV 40。

### 7.4 mineTab 我的页

- **用户卡标题**（`mineTab.tsx:205-207`）：large(22)+bold(700)+text；副标题 normal(13)+regular(400)+textSecondary。
- **头像"极"字**（:196-199）：ThemeText large(22)+bold(700)+白字（原硬编码 fontSize=24，C22 已按多数派统一为最接近档位）；头像 56×56 圆形 primary 底。
- **统计数字/标签**（:235-256）：数字 large(22)+bold(700)+primary；标签 caption(11)+regular(400)+textSecondary。
- **版本号**（:296-363）：large(22)+bold(700)+primary。
- **检查更新按钮**（:312-318 / :392-397）：手机 chip normal(13)+medium(500)+primary（primary α0.1 底）；平板大按钮 normal(13)+bold(700)+白字（primary 底）。
- **分组标题**（:577-604）：subTitle(14)+bold(700)+primary（原 content(16)+text 色，C19 已按多数派统一）、marginBottom 10。
- **平板入口卡 MineEntryCard**（:459-471）：标题 large(22)+bold(700)+text；副值 subTitle(14)+medium(500)+primary。
- **手机统计卡 MineStatCard**（:517-530）：标题 normal(13)+bold(700)+text；副值 caption(11)+medium(500)+primary。
- **手机竖排入口列表项**（:557-562）：body(15)+medium(500)+text；左侧图标 size=20 primary、paddingH 16/paddingV 14。

### 7.5 tabletPanel 平板左播放面板

- **顶部问候**（`tabletPanel.tsx:157-162`）：fontSize="xlarge"(32，C20 新增档位)、regular(400)+textSecondary（原 fontSize="title"+inline 32，prop 失效已统一）。
- **歌名**（:204-212）：硬编码 fontSize=20、bold(700)+text、lineHeight=28、居中 numberOfLines=1。
- **歌手**（:214-220）：body(15)+regular(400)+textSecondary、lineHeight=22。
- **当前歌词行**（:271-287，KaraokeText）：硬编码 fontSize=20、sungColor=primary/unsungColor=textSecondary、行高 40、uniform 模式。
- **上下歌词行**（:289-298）：body(15)+regular(400)+textSecondary（opacity 0.7）、行高 40。
- **歌词加载/暂无**（:228-309）：subTitle(14)+regular(400)+textSecondary、居中。
- **进度时间**（:333-338）：caption(11)+regular(400)+textSecondary。
- **控制栏图标**（:350-397）：循环 size=20 primary / 上下首 size=24 text / 播放钮 44×44 圆 primary（图标 size=26 白）/ 队列 size=20 textSecondary。

### 7.6 subPageOverlay 平板二级覆盖层

`pages/home/components/subPageOverlay.tsx:76-104`：纯容器无文字；从右滑入（slideDistance=vw×0.7）、自绘不透明 PageBackground 渐变、zIndex=1000、不盖 tab 栏与左播放区。

### 7.7 musicDetail 播放页/全屏页

- **歌名**（`pages/musicDetail/index.tsx`）：平板横屏硬编码 32/bold、lineHeight 44（:62-74）；手机竖屏硬编码 19/bold、lineHeight 27（:163-166）；矮屏(winH<600)硬编码 24/bold、lineHeight 34（:168-171）；均 colors.text、居中 numberOfLines=2。
- **歌手**（:177-191）：平板硬编码 18/regular textSecondary（=title 档）；手机硬编码 13/regular（=normal 档）；矮屏硬编码 15/regular（=body 档）。
- **顶栏 navBar**（`components/navBar.tsx:19-53`）：纯图标，高 56dp、sizeType=normal(24)；返回 text、衣服+三点 textSecondary。
- **封面**（`content/albumCover/`）：手机 240×240 圆角 20；平板右侧大封面 min(区宽×88%, 区高×92%)、圆角 28，长按弹 ImageViewer。
- **歌词**（`content/lyric/`）：
  - 当前行（index.tsx:316-339）：fontSizeMap={0:20,1:25,2:30,3:36}，当前行=档位+9（34/29/39/45）；sungColor=primary/unsungColor=text(opacity 0.6)。
  - 非当前行（lyricItem.tsx:34-51）：fontSize || content(16)+regular(400)、text(opacity 0.6)。
  - 关联元信息/无歌词/搜索链接（:263-374）：字号跟随歌词档位；"取消关联"链接 #66ccff 下划线、"搜索歌词"链接 #66eeff 下划线。
  - 拖拽时间标签（draggingTime.tsx:14-20）：description(12)+regular+textSecondary、背景 rgba(255,255,255,0.1)。
  - 倍速 RateButton（lyricOperations.tsx:34-43）：content(16)（rate≠1.0x semibold(600)+primary，否则 regular+textSecondary）。
- **底部控制**：进度时间标签（bottom/seekBar.tsx:13-20）caption(11)+regular+textSecondary；控制图标（playControl.tsx）平板模式 32/上下首 44/播放钮 80 圆(图标 40)/队列 32，手机档相应缩小（播放钮 56 圆/图标 30）。
- **沉浸歌词层 immersiveLayer.tsx**（大量硬编码字号，C22(b) 已按多数派判定保留硬编码，见下方"播放页专用字号表"）：
  - 顶部歌名（:442-449）：平板 24/手机 18、medium(500)、rgba(255,255,255,0.95)。
  - 顶部歌手（:450-457）：平板 16/手机 14、regular、rgba(255,255,255,0.6)。
  - 右上角时间（:671-695）：平板 50/手机 14、medium(500)、rgba(255,255,255,0.85)。
  - 当前歌词行（:518-531）：平板 34/手机 26、sungColor=primary/unsungColor=rgba(255,255,255,0.5)。
  - 上下歌词行/无歌词（:533-555）：平板 25/手机 15、regular、rgba(255,255,255,0.5)。
  - 另有 :801 一处 fontSize:56（C22 清单漏列，同属本体系，一并保留）。

#### 播放页专用字号表（C22(b) 已按多数派统一判定：保留硬编码，独立于 fontSizeConst 档位体系）

> 播放页（musicDetail / immersiveLayer / tabletPanel 播放区）为全屏沉浸式 hero 字号，按 isTablet/紧凑屏条件自适应并与 lineHeight 预算紧耦合，项目内该体系内部一致全部硬编码、无同语义混档，故 C22 判定候选B（保留硬编码，不新增档位）。此表为登记备案，修改时保持体系内部一致。

| 元素 | 位置 | 平板 | 手机 | 矮屏(<600) | 字重/颜色 |
|---|---|---|---|---|---|
| musicDetail 歌名 | index.tsx:160/164/169 | 32/bold、lh44 | 19/bold、lh27 | 24/bold、lh34 | colors.text 居中 |
| musicDetail 歌手 | index.tsx:178/182/188 | 18/regular（=title 档） | 13/regular（=normal 档） | 15/regular（=body 档） | textSecondary |
| tabletPanel 歌名 | tabletPanel.tsx:449 | 20/bold | — | — | text、lh28 |
| immersiveLayer 顶部歌名 | :442-449 | 24 | 18 | — | medium、rgba(255,255,255,0.95) |
| immersiveLayer 顶部歌手 | :450-457 | 16 | 14 | — | regular、rgba(255,255,255,0.6) |
| immersiveLayer 右上时间 | :671-695 | 50 | 14 | — | medium、rgba(255,255,255,0.85) |
| immersiveLayer 当前歌词 | :518-531 | 34 | 26 | — | sung=primary / unsung=rgba(255,255,255,0.5) |
| immersiveLayer 上下歌词 | :533-555 | 25 | 15 | — | regular、rgba(255,255,255,0.5) |
| immersiveLayer 其他 | :801 | 56 | — | — | — |

---

## 第 8 章 冲突清单（全局汇总）

> 说明：以下编号为全局唯一编号（C01~C22），按本文章节出现顺序排列；每条标注来源采集文件与该组内原编号。候选方案保留备查。处理状态标记：✅ = 已按多数派统一（已回写第 2~7 章）；⏳ = 待用户决策（无明显多数派 / 多数派与同级语义冲突，不擅自选）。

### C01-AppBar 标题用 title 而非 appbar 语义档
- 类型：同义标题字号不同
- 位置：src/components/base/appBar.tsx:76 vs src/constants/uiConst.ts:26
- 现状：AppBar 标题使用 fontSize="title"(18px)；fontSizeConst 专门定义了 appbar=18。两者像素相同但 key 不同。
- 候选方案：
  1. 候选A：统一为 fontSize="appbar"（语义明确，与 uiConst 注释"AppBar 标题"对应）。
  2. 候选B：统一为 fontSize="title"（现状，减少改动）。
- 标记：✅ 已按多数派统一：AppBar 顶栏标题字样 title → appbar 语义档（像素同 18；第 2 章已同步）
- 来源：采集-字体与基础组件.md 原编号 C01

### C02-Checkbox 勾内图标 size=18 硬编码
- 类型：图标尺寸未走档位
- 位置：src/components/base/checkbox.tsx:35
- 现状：勾内图标 size=18（硬编码），不在 iconSizeConst 五档（16/20/24/32/40）内。
- 候选方案：
  1. 候选A：改用 iconSizeConst.light(20)，与档位对齐。
  2. 候选B：保留 18（22dp 框体内 18dp 图标视觉更协调）。
- 标记：✅ 已按多数派统一：Checkbox 勾内"✓"图标 18 → iconSizeConst.light(20)，与对话框/面板选中勾图标统一（第 2 章已同步）
- 来源：采集-字体与基础组件.md 原编号 C02

### C03-Input 组件未内置默认字号
- 类型：层级结构不一致
- 位置：src/components/base/input.tsx:22-33
- 现状：Input 是唯一不指定 fontSize 的基础文字组件，字号完全依赖外部 style；其他文字组件（ThemeText/Button/TextButton 等）均有默认值。
- 候选方案：
  1. 候选A：Input 增加默认 fontSize=content(16)，与 Button/TextButton 对齐。
  2. 候选B：保持现状（字号由各场景自行决定，更灵活）。
- 标记：✅ 已按多数派统一：Input 输入文字增加默认 fontSize=content(16)，与 Button/TextButton 内置默认对齐（第 2 章已同步）
- 来源：采集-字体与基础组件.md 原编号 C04

### C04-LinkText 链接色硬编码 #66ccff 不走主题
- 类型：同类内容颜色不一致
- 位置：src/components/base/linkText.tsx:42、46
- 现状：LinkText 颜色固定 "#66ccff"，不随主题变化；项目已有 primary 主题色（light #2F6FED / dark #5A8FFF）。
- 候选方案：
  1. 候选A：改用 colors.primary，跟随主题明暗自动适配。
  2. 候选B：保留 #66ccff（链接蓝色辨识度高）。
- 标记：✅ 已按多数派统一：LinkText 链接字样 #66ccff → colors.primary（随明暗主题自适应；第 2 章已同步）
- 来源：采集-字体与基础组件.md 原编号 C05

### C05-Tip / Toast 使用原生 Text 而非 ThemeText
- 类型：同类组件字体基元不一致
- 位置：src/components/base/tip.tsx:183、208、303-306 vs src/components/base/toast.tsx:133-137、145-147、184-193
- 现状：Tip 和 Toast 内部使用原生 Text 手动设字号（description/content），未走 ThemeText，缺少 allowFontScaling=false 与 includeFontPadding=false 的统一约束。
- 候选方案：
  1. 候选A：迁移到 ThemeText，统一字体缩放约束与默认值契约。
  2. 候选B：保留原生 Text（Tip/Toast 对样式控制力要求高，ThemeText 样式合并可能引入问题）。
- 标记：✅ 已按多数派统一：Tip 气泡文字 / Toast 消息与 action 按钮文字 原生 Text → ThemeText（统一 allowFontScaling/includeFontPadding 约束；第 2 章已同步）
- 来源：采集-字体与基础组件.md 原编号 C06

### C06-ErrorBoundary 多处 rpx 硬编码字号不走档位
- 类型：同类内容字号不一致
- 位置：src/components/errorBoundary/index.tsx:288-296（rpx(28)）、306-309（系统默认）、316-320（rpx(24)）
- 现状：设备信息 label/value 用 rpx(28)、堆栈用 rpx(24)、错误详情用系统默认字号，均不走 fontSizeConst；同页其他标题走 ThemeText 档位。
- 候选方案：
  1. 候选A：全部迁移到 ThemeText + 档位（label=description 12、value=body 15、stack=caption 11 monospace）。
  2. 候选B：保留 rpx 硬编码（错误页为调试页，不在主 UI 体系内）。
- 标记：✅ 已按多数派统一：ErrorBoundary 设备信息 label/value、错误详情、堆栈 rpx 硬编码 → 档位（description 12 / body 15 / caption 11+monospace；第 2 章已同步）
- 来源：采集-字体与基础组件.md 原编号 C08

### C07-歌单卡片标题档位不一致（ImageBtn subTitle 14 vs PlaylistCard normal 13）
- 类型：同类内容字号不一致
- 位置：src/components/base/imageBtn.tsx:27 vs src/components/mediaItem/playlistCard.tsx:98
- 现状：ImageBtn（SheetItem 使用）标题 subTitle(14)；PlaylistCard 标题 normal(13)。两者都是"封面+标题"的歌单/专辑卡片。
- 候选方案：
  1. 候选A：统一为 normal(13)（PlaylistCard 现状，对齐 uiConst 注释"列表项标题/歌单名"）。
  2. 候选B：统一为 subTitle(14)（ImageBtn 现状，视觉更大更突出）。
- 标记：✅ 已按多数派统一：搜索结果歌单卡（SheetItem→ImageBtn）标题 subTitle(14)+regular → normal(13)+medium(500)，与 PlaylistCard 统一（第 3 章已同步）
- 来源：采集-字体与基础组件.md 原编号 C03

### C08-列表行标题 TitleAndTag body(15) vs ListItem.Content 默认 content(16)
- 类型：同级行字体不同
- 位置：src/components/mediaItem/titleAndTag.tsx:16 vs src/components/base/listItem.tsx:254
- 现状：ListItem.Content 字符串标题走 content(16)+medium(500)；音乐/专辑/歌词行标题经 TitleAndTag 渲染为 body(15)+medium(500)。同为列表行标题，差 1px。
- 候选方案：
  1. 候选A：统一为 content(16)（ListItem.Content 默认值）。
  2. 候选B：统一为 body(15)（TitleAndTag 现状，音乐列表行密度更高）。
- 标记：✅ 已按多数派统一：音乐/专辑/歌词/榜单/本地歌曲/播放队列行标题 body(15) → content(16)，与 ListItem.Content 统一（7 处全部；第 3、7 章已同步）
- 来源：采集-字体与基础组件.md 原编号 C07

### C09-三级浮窗底部按钮行有无与构成不一致
- 类型：同类对话框按钮不齐
- 位置：基座 components/dialogs/components/base/index.tsx:264-325 vs 各对话框：
  - 无 Actions：radioDialog.tsx:57-124、lyricSettingDialog.tsx:73-179、immersiveSettingDialog.tsx:50-87、volumeSettingDialog.tsx:42-80
  - 单按钮：loadingDialog.tsx:46-55、markdownDialog.tsx:260-268、permissionSettingDialog.tsx:148-156、addToMusicSheetDialog.tsx:98-106、playRateDialog.tsx:59-67、setFontSizeDialog.tsx:60-68、timingCloseDialog.tsx:98-106、themeSettingDialog.tsx:26-34
  - 双按钮：simpleDialog.tsx:18-42、menuDialog.tsx:120-138、createMusicSheetDialog.tsx:47-68、downloadSettingsDialog.tsx:238-251、editSheetDetail.tsx:131-144、fileSelectorDialog.tsx:414-432、importMusicSheetDialog.tsx:242-286、lyricColorDialog.tsx:317-330、setScheduleCloseTimeDialog.tsx:99-114、updateDownloadDialog.tsx:235-258
  - 三按钮：downloadDialog.tsx:56-111、musicListEditorDialog.tsx:100-136、recommendSourceDialog.tsx:139-156、subscriptionSettingDialog.tsx:181-202
- 现状：基座 Actions 行高 52、渐变底统一；但调用方从"无行"到"3 按钮"都有，单按钮时仍渲染整条 52dp 渐变行（视觉上一条空渐变条）。"即改即生效"型对话框确实不需要按钮，但保留渐变空条与否在项目内无统一规则。
- 候选方案：
  1. 候选A：无操作型对话框（开关/滑块/单选）不渲染 Dialog.Actions 整块（含渐变条与分割线），内容区贴底。
  2. 候选B：统一保留 Actions 行，单按钮时按钮居中或占满整行。
- 标记：✅ 用户已拍板（2026-10-14）：候选A——即改即生效型（开关/滑块/单选）对话框不渲染 Dialog.Actions 整块（含渐变条与分割线），内容区贴底；已同步第 4.3 节规则。（同类调查：24 个对话框渲染 Actions vs 4 个即改即生效型无 Actions；多数派为渲染，但 4 个即改即生效型（单选/开关/滑块）语义上无需按钮行，强行加行与同级语义冲突，故用户选候选A）
- 来源：采集-对话框与面板.md 原编号 C01

### C10-对话框底部按钮自布局 vs 基座 BottomButton 两种写法
- 类型：同类对话框按钮不齐
- 位置：downloadDialog.tsx:56-111（自定义 buttonGroup） vs base/index.tsx:327-351（BottomButton） vs sortDialog.tsx:122-155（自定义 dirButton）
- 现状：基座 BottomButton 为 flex:1、height 52、subTitle(14)/medium、normal→textSecondary/primary→primary；DownloadDialog 自定义按钮不等分、贴右（paddingLeft:14、paddingVertical:8、marginLeft rpx(16)）但字号同 subTitle medium；SortDialog 自定义 dirButton flex:1 height:52，字重随选中态 bold/regular、颜色随选中态 primary/textSecondary。
- 候选方案：
  1. 候选A：扩展基座 BottomButton 支持自定义子节点（align right / variable weight），消灭自布局。
  2. 候选B：保留自布局，但在规范中明确"自布局必须行高 52 + 字号 subTitle(14) 起步"。
- 标记：✅ 用户已拍板（2026-10-14）：候选B——保留自布局（DownloadDialog/SortDialog 为既有特例），规范明确"自布局必须行高 52 + 字号 subTitle(14) 起步"（第 4.3 节已同步）
- 来源：采集-对话框与面板.md 原编号 C02

### C11-EditSheetDetailDialog 缺 Dialog.Title 标题行
- 类型：层级结构不一致
- 位置：editSheetDetail.tsx:96-145（无 Dialog.Title） vs 其他所有对话框均有 Dialog.Title（radioDialog.tsx:59-72 等）
- 现状：EditSheetDetail 直接从 Dialog.Content 开始（封面/歌单名两行），没有 52dp 渐变标题行与蓝色胶囊竖条；其他对话框（含仅 1 个按钮的）都有标题行。
- 候选方案：
  1. 候选A：补 Dialog.Title（如"编辑歌单"），与全项目三级浮窗结构对齐。
  2. 候选B：保留无标题设计，在规范中显式列出"允许无标题的对话框"白名单。
- 标记：✅ 已按多数派统一：editSheetDetail 补 Dialog.Title（"编辑歌单信息" withDivider），与其他 27 个对话框统一（第 4 章已同步）
- 来源：采集-对话框与面板.md 原编号 C03

### C12-Dialog.Content 字符串正文实际 13px 而非 content 档位 16
- 类型：同义标题字号不同
- 位置：base/index.tsx:217-220 + 399-402（defaultFontStyle fontSize:13 覆盖 content(16)）
- 现状：Dialog.Content 字符串 children 名义传 content(16)，但被 defaultFontStyle 覆盖为 13px/21（与 normal(13) 同档）；CheckStorage/DownloadDialog 在 Content 外手写 item fontSize:13 与之一致。即"对话框正文"实际是 normal(13)/行高21，不是 content(16)。
- 候选方案：
  1. 候选A：把 defaultFontStyle 改为 fontSize:16，对话框正文统一为 16px。
  2. 候选B：在规范中明确"对话框正文=normal(13)/行高21"为独立档位，不从 content 派生。
- 标记：✅ 已按多数派统一（文档修正，无需改代码）：对话框正文全项目统一为 13px/21，规范明确"对话框正文=normal(13)/行高21"独立档位（第 4 章已同步）
- 来源：采集-对话框与面板.md 原编号 C04

### C13-基座 BottomButton 未实现 danger 类型
- 类型：其他
- 位置：dialogs/components/base/index.tsx:257、328（type?: "normal" | "primary"）
- 现状：基座仅 normal/primary 两种 type；项目内"危险"操作（永久删除、取消定时）均绕道实现：① SimpleDialog okText="删除"但 type 仍为 primary；② TimingClose 内容区自定义红底按钮 #ff666699 白字；③ 无统一 danger 按钮组件。
- 候选方案：
  1. 候选A：在基座 BottomButton 扩展 type="danger"（danger 主题色），统一"删除/不可恢复"操作底部按钮。
  2. 候选B：维持现状，危险操作一律用 SimpleDialog(okText="删除" primary) + 内容区红字说明，不引入 danger type。
- 标记：✅ 已按多数派统一（维持现状+文档注明）：危险操作确认一律 SimpleDialog(okText="删除" type=primary)（约 7 处占多数），不引入 danger type；内容区红底按钮仅用于"取消定时"即时执行型操作（第 4 章已同步）
- 来源：采集-对话框与面板.md 原编号 C08

### C14-PanelHeader 与 Dialog.Title 视觉规格差异
- 类型：同类标题字号不同 / 层级结构不一致
- 位置：panels/base/panelHeader.tsx:36-67 vs dialogs/components/base/index.tsx:158-190
- 现状：标题字号/字重一致（均 title 18/bold）；但渐变底不同（面板 primary α0.14→α0.04 对角 vs 对话框 α0.10/α0.07/α0.016 水平三段）；对话框有 4×20dp 胶囊竖条而面板无；行高面板 56dp vs 对话框 52dp；取消按钮颜色面板 text vs 对话框 normal 按钮 textSecondary。**载体不同：面板在平板主场景是右侧浮出层（顶部标题条），对话框是居中弹窗（顶部标题条）——两套规格分属两种浮层载体。**
- 计数（2026-10-14 更新）：PanelHeader **8 处**（appBarMore/associateLrc/musicQuality/simpleSelect/simpleInput/setUserVariables/sheetTags/**playList**）；Dialog.Title **29 处**（28 处 + **imageViewerDialog**）；无标题条面板 **3 个**（MusicItemOptions/MusicItemLyricOptions 特例、SearchLrc）。
- 候选方案：
  1. 候选A：统一为对话框规格（52dp 行高 + 水平三段渐变 + 胶囊竖条 + normal 按钮 textSecondary）。
  2. 候选B：保留两套规格，在规范中明确"面板=56 对角渐变无胶囊；对话框=52 水平渐变带胶囊"为有意区分。
- 标记：⏳ 待用户决策（2026-10-14 用户四项载体决定已隐含"两套规格共存"：①歌曲选项/全屏歌词头部保留为特例；②播放队列头部并入 PanelHeader 规格；③搜索歌词落位与面板一致；④图片查看迁入 Dialog 规格——即面板/对话框两套规格各自继续使用；倾向候选B，待用户明确确认后改 ✅）
- 来源：采集-对话框与面板.md 原编号 C05

### C15-TimingClose 面板版与浮窗版双载体并存
- 类型：同类内容字号不一致 / 层级结构不一致
- 位置：panels/types/timingClose.tsx（**已删除**，备份 E:\Temp\Deepseek\jiyuejie-ui-conflict-backup-20261014\） vs dialogs/components/timingCloseDialog.tsx:23-109
- 现状（下线前）：两版 UI 元素几乎相同（5 个快捷时长 + 自定义 + 播完关闭 + 取消定时红按钮），字号层级一致（时长 content(16)、取消定时 normal(13)/medium 白字）；但载体不同：面板版 positionMethod='top' 高 vh(56) 无底部 Actions，浮窗版居中卡片 + 底部 52dp 渐变行仅"取消"。
- 候选方案：
  1. 候选A：下线其中一个载体（保留浮窗版，面板版仅作兼容壳）。
  2. 候选B：保留双载体，在规范中明确两者入口场景不同。
- 标记：✅ 用户已拍板（2026-10-14）：候选A——**保留居中浮窗版 TimingCloseDialog，下线面板版**。执行：musicItemOptions"定时关闭"入口（musicItemOptions.tsx:207-211）由 showPanel("TimingClose") 改为 showDialog("TimingCloseDialog")；面板注册与文件已移除；tsc 通过。
- 来源：采集-对话框与面板.md 原编号 C06

### C16-SetFontSize 面板版与浮窗版双载体并存
- 类型：同类内容字号不一致 / 层级结构不一致
- 位置：panels/types/setFontSize.tsx（**已删除**，备份 E:\Temp\Deepseek\jiyuejie-ui-conflict-backup-20261014\） vs dialogs/components/setFontSizeDialog.tsx:22-71
- 现状（下线前）：两版均为 Slider 0~3 四档、标签同为 content(16)/opacity 0.5；但面板版高 vh(65)+PanelHeader hideButtons，浮窗版居中卡片 + 底部仅"取消"按钮。
- 候选方案：
  1. 候选A：下线面板版（全屏页字体大小入口已切到 MusicItemLyricOptions→SetFontSizeDialog）。
  2. 候选B：保留双载体，规范中注明各自入口。
- 标记：✅ 用户已拍板（2026-10-14）：候选A——**下线面板版**。入口核实：字体大小入口确定在浮窗版（musicItemLyricOptions.tsx:131 showDialog("SetFontSizeDialog")）；面板版 SetFontSize 无任何调用方（死代码），注册与文件已移除；tsc 通过。
- 来源：采集-对话框与面板.md 原编号 C07

### C17-设置页滑块标签行写法不一致
- 类型：同级行字体不同
- 位置：basicSetting.tsx:641（悬浮歌词滑块标签） vs backgroundCustom.tsx:120-127（背景模糊/透明度滑块标签）
- 现状：两处都是"设置页内带滑块的标签行"。basicSetting 标签 content(16)/默认 regular、行高 48、paddingH 16；backgroundCustom 标签 content(16)/medium(500)、数值另起一行 content(16)/textSecondary 同行右对齐。行高/间距也不同（48dp 固定 vs marginTop rpx(28)）。
- 候选方案：
  1. 候选A：统一为 basicSetting 写法（行高 48、标签 regular、紧凑 padding）。
  2. 候选B：统一为 backgroundCustom 写法（标签 medium、labelRow 左右对齐数值）。
- 标记：✅ 已按多数派统一：basicSetting 悬浮歌词滑块行 → backgroundCustom 写法（标签 medium+右侧实时数值+滑块在下；第 6 章已同步）。注：统计口径为"滑块组"（backgroundCustom 2 组 vs basicSetting 1 组）；若按"渲染行"计为 4:2 反向，用户可指示回退
- 来源：采集-设置与业务页.md 原编号 C02

### C18-设置行标题字号不一致（basicSetting content 16 vs scanSettings body 15）
- 类型：同类内容字号不一致
- 位置：basicSetting.tsx:505（ListItem.Content title） vs scanSettings/index.tsx:347（SettingSwitchRow title） vs scanSettings/index.tsx:265（权限行 title）
- 现状：basicSetting 设置行标题走 ListItem.Content 默认 content(16)+medium；scanSettings 自绘行标题 body(15)。两者都是"设置页开关/入口行标题"，差 1px。
- 候选方案：
  1. 候选A：统一为 content(16)+medium（ListItem 体系，与项目其他列表行一致）。
  2. 候选B：统一为 body(15)（更紧凑，适合设置页高密度行）。
- 标记：✅ 已按多数派统一：scanSettings 权限行/开关行/AddRow 标题 body(15)+regular → content(16)+medium(500)，与 basicSetting 设置行标题统一（第 6 章已同步）
- 来源：采集-设置与业务页.md 原编号 C03

### C19-页面分组/区块标题字号与颜色不一致
- 类型：同类标题字号不同
- 位置：
  - subTitle(14)+primary+bold：basicSetting.tsx:487、backupSetting.tsx:213/263/297、background.tsx:18、mode.tsx:19、backgroundCustom.tsx:83、scanSettings/index.tsx:324
  - content(16)+bold（text 色，无 primary）：mineTab.tsx:577/586/602、recommendSection.tsx:205、libraryTab.tsx:383
- 现状：设置页/扫描设置分组标题统一 subTitle(14)+primary+bold；首页/我的页/音乐库区块标题统一 content(16)+bold+默认 text 色。两组都是"页面分组标题"，字号差 2px、颜色差 primary vs text。
- 候选方案：
  1. 候选A：全部统一为 subTitle(14)+primary+bold（设置页风格，紧凑、品牌色强）。
  2. 候选B：全部统一为 content(16)+bold+text（首页风格，醒目但无品牌色）。
  3. 候选C：按场景区分——"设置类分组"用 subTitle+primary，"内容浏览类区块"用 content+bold text，成文为两级规范。
- 标记：✅ 已按多数派统一：首页推荐歌单/我的页分组/本地歌曲区块标题 content(16)+bold+text → subTitle(14)+bold(700)+primary，与设置页分组标题统一（5 处；第 7 章已同步）
- 来源：采集-设置与业务页.md 原编号 C01

### C20-ThemeText fontSize prop 被 inline style 覆盖（平板顶栏/问候语）
- 类型：其他（代码写法不一致，prop 与实际渲染值不符）
- 位置：tabBar.tsx:167-170（`<ThemeText fontSize="title" style={{fontSize:32}}>`） vs tabletPanel.tsx:158-160（同写法）
- 现状：两处都传 fontSize="title"(18) 但 inline style 强制 32px，prop 完全失效且误导读者；32px 无对应档位 key（最大 large=22）。
- 候选方案：
  1. 候选A：移除 prop 中的 fontSize="title"，只保留 inline style fontSize:32，并在 fontSizeConst 新增 xlarge=32 档位。
  2. 候选B：改用档位 key（新增 xlarge=32），删除 inline style，让 ThemeText 体系统一。
- 标记：✅ 已按多数派统一：平板 Tab 文字/平板问候语 fontSize="title"+inline32 → 新增 xlarge=32 档位，删 inline 覆盖（渲染仍 32px，prop 成为真实来源；第 1、7 章已同步）
- 来源：采集-设置与业务页.md 原编号 C04

### C21-首页入口卡片标题字号不统一（手机版）
- 类型：同类内容字号不一致
- 位置：operations.tsx:184（金刚区卡 body(15)+bold） vs libraryTab.tsx:362（音乐库四入口卡 title(18)+bold） vs mineTab.tsx:518（手机统计卡 normal(13)+bold）
- 现状：首页/音乐库/我的三页都有"渐变底入口卡片"，手机版标题分别用 body(15)/title(18)/normal(13) 三档；平板版相对统一（large=22）。
- 候选方案：
  1. 候选A：手机入口卡标题统一 title(18)+bold（与 libraryTab 一致，最醒目）。
  2. 候选B：统一 body(15)+bold（与 operations 金刚区一致，最紧凑）。
  3. 候选C：按卡大小分级——大卡 title(18)、小统计卡 normal(13)，成文规范。
- 标记：✅ 用户已拍板（2026-10-14）：候选C——**按卡型分级成文**：横排入口卡（金刚区/音乐库四入口）统一 title(18)+bold；紧凑竖排统计卡（MineStatCard）保持 normal(13)+bold。执行：operations.tsx 金刚区卡标题 body(15) → title(18)（与 libraryTab 音乐库入口卡一致）；mineTab 统计卡 13 保持不动；tsc 通过。
- 来源：采集-设置与业务页.md 原编号 C05

### C22-播放页/沉浸层等多处硬编码 fontSize 无档位 key
- 类型：其他（字面量字号未入 fontSizeConst 档位表）
- 位置：
  - mineTab.tsx:694 头像"极"字 fontSize=24
  - tabletPanel.tsx:449 歌名 fontSize=20
  - musicDetail/index.tsx:160/164/169 歌名 32/19/24；:178/182/188 歌手 18/13/15
  - immersiveLayer.tsx:446/454 标题 24/18、歌手 16/14；:529/538 歌词 34/26、25/15；:766/820 时间 50/14
  - pluginItem.tsx:288 可用率标签 fontSize=12、pluginSort.tsx:269 平台徽章 fontSize=11
- 现状：播放页/沉浸层大量硬编码字号（32/24/19/20/26/34/50 等）未走 fontSizeConst；pluginItem/pluginSort 小标签硬编码 12/11（恰等于 description/caption 档但未引用 key）。
- 候选方案：
  1. 候选A：在 fontSizeConst 新增播放页专用档位（如 display=32/playingTitle=20/immersiveTitle=24 等），全部替换硬编码。
  2. 候选B：保留硬编码（播放页为全屏沉浸式，字号体系独立，不强求对齐列表档位），仅在文档中列出"播放页专用字号表"。
- 标记：✅ 已按多数派统一（部分）：mineTab 头像"极"字 24 → large(22)；pluginItem 可用率标签 12 → description 档；pluginSort 平台徽章 11 → caption 档；播放页 hero 大字号保留硬编码（候选B，见 7.7 播放页专用字号表；第 7 章已同步）
- 来源：采集-设置与业务页.md 原编号 C06

---

## 附录：相关文档索引

- **docs/启动页白屏问题与实现路径.md** —— 启动页三段体系（系统 splash / 窗口背景 / RN BrandSplash）白屏治理的专题文档，涉及启动闪屏、白屏问题直接参阅。
- **UI_ALIGNMENT_CHECK.md**（项目根目录）—— UI 对齐核查报告，记录跨组件对齐与档位检查的历史结论。
- **src/constants/uiConst.ts** —— fontSizeConst / fontWeightConst / iconSizeConst / colorMap 档位定义源头。
- **src/core/theme.ts** —— 明/暗两套完整主题色表。
