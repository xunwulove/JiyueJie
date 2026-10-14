# 极悦界 UI 冲突统一处理报告

> 处理日期：2026-10-14
> 处理原则（用户拍板）：**每一个矛盾冲突都先看看同类的组件是什么，自己应该少数服从多数**——逐条收集同类组件/同级内容的全部出现点 → 统计每种写法次数 → 出现最多者 = 多数派 = 统一标准 → 修改少数派与多数派完全一致；若势均力敌（无明显多数派）或多数派本身明显不合理（与档位表/同级语义冲突），不擅自选，保留"⏳ 待用户决策"。
> 验证：改前基线 `npx tsc --noEmit` 通过（exit 0）；四组并行修改各自验证通过；**合并后全量复验通过（exit 0）**。
> 备份：`E:\Temp\Deepseek\jiyuejie-ui-conflict-backup-20261014\`（22 个被修改文件，保留原相对路径，见第五节）。

## 一、结果总览

| 状态 | 数量 | 冲突编号 |
|---|---|---|
| ✅ 已按多数派统一 | 16 | C01 C02 C03 C04 C05 C06 C07 C08 C11 C12 C13 C17 C18 C19 C20 C22 |
| ✅ 用户已拍板 | 5 | C09 C10 C15 C16 C21 |
| ⏳ 待用户决策 | 1 | C14 |

> **更新（2026-10-14 晚）：C17 已按用户要求恢复原状**（悬浮歌词 4 个滑块改回"标签+滑块同行、无数值"原写法），故当前**有效统一为 15 条**（C01~C08、C11、C12、C13、C18、C19、C20、C22）；C17 条目标记见第二节。

> C12/C13 为"维持现状+文档注明"型统一（无代码改动）；C22 为部分统一（3 处小标签入档+1 处头像入档，播放页 hero 大字号判定保留硬编码并登记专表）。

---

## 二、逐条处理明细

### C01 — AppBar 标题用 title 而非 appbar 语义档　✅ 已统一

- **同类调查**：全项目 `fontSize="appbar"` 作 prop = **0 次**；`fontSize="title"` = **31 次**（均为页面/对话框/面板/空态等内容标题）。`appbar` 档在 uiConst.ts:26 注释明确为"AppBar 标题"，是全项目唯一拥有专属语义档却错用 title 的离群点。
- **多数派判定**：内容标题用 `title`（31 处）为多数；AppBar 顶栏为拥有专属语义档的离群者，按语义统一。
- **统一动作**：**AppBar 顶栏标题字样** 从 `fontSize="title"` 改为 `fontSize="appbar"`，与 uiConst 预留语义档统一（像素同为 18，**零视觉变化**）。
- **修改**：`src/components/base/appBar.tsx:76`。
- **tsc**：通过。

### C02 — Checkbox 勾内图标 size=18 硬编码　✅ 已统一

- **同类调查**：base 组件库图标尺寸全部走 `iconSizeConst`；对话框/面板选中/勾选图标全部 `iconSizeConst.light`(20)（playRateDialog:52、radioDialog:105/116、sortDialog:106/113、recommendSourceDialog:131、menuDialog:74/111、appBarMore:69/101、musicItemOptions:271 等）。项目级裸数字 size 多为 64/52/46/44 等装饰大图标（无档位对应），**勾选小图标无一裸数字**。
- **多数派**：勾选小图标 = `iconSizeConst.light`(20)。
- **统一动作**：**Checkbox 框内"✓"图标** 从 `size={18}` 改为 `size={iconSizeConst.light}`(20)，与全项目对话框/面板选中勾图标统一（框体 22×22 内区 20×20，视觉饱满）。
- **修改**：`src/components/base/checkbox.tsx:35`（新增 iconSizeConst import）。
- **tsc**：通过。

### C03 — Input 组件未内置默认字号　✅ 已统一

- **同类调查**：基础文字组件 ThemeText/Button/TextButton/IconTextButton/Paragraph/LinkText/Tag/Chip/Empty **全部内置默认 fontSize，Input 是唯一例外**。12 个 Input 调用方中仅 3 个显式设 content(16)（createMusicSheetDialog:77、setScheduleCloseTimeDialog:150、searchMusicList:70），9 个靠 RN 系统默认（≈14）。
- **多数派**：基础文字组件内置默认 content(16)。
- **统一动作**：**Input 输入文字** 增加默认 `fontSize: fontSizeConst.content`(16)，与 Button/TextButton 内置默认对齐。3 个已设 16 的调用方渲染不变；9 个未设的从系统默认归一为 16（与 searchMusicList 搜索栏一致，属预期统一）。
- **修改**：`src/components/base/input.tsx`（defaultStyle 增加 fontSize: fontSizeConst.content）。
- **tsc**：通过。

### C04 — LinkText 链接色硬编码 #66ccff　✅ 已统一

- **同类调查**：硬编码链接蓝 #66ccff/#66eeff 仅 4 处（linkText 组件本体 2 处 + musicDetail lyric:446/481 + lyricColorDialog:26 取色器默认值）；交互强调色全项目走 `colors.primary`（选中/按钮/开关/进度等数十处）。
- **多数派**：主题色 `colors.primary`。
- **统一动作**：**LinkText 链接字样颜色** 从硬编码 `#66ccff` 改为 `colors.primary`（明 #2F6FED / 暗 #5A8FFF 自适应），下划线保留；按下态 alpha 0.4 由 primary 派生。
- **修改**：`src/components/base/linkText.tsx`（新增 useColors；color={colors.primary}；移除 StyleSheet 中 #66ccff 与 pressed 定义）。
- **tsc**：通过。

### C05 — Tip / Toast 使用原生 Text 而非 ThemeText　✅ 已统一

- **同类调查**：`<ThemeText` 全项目 **346 处 / 94 文件**；原生 Text 手动设字号的基元例外仅 Tip（tip.tsx:183/208）与 Toast（toast.tsx:133/145）。
- **多数派**：ThemeText。
- **统一动作**：**Tip 气泡文字**（2 处）→ `ThemeText fontSize="description"`(12)；**Toast 消息文字**（toast.tsx:133）→ `ThemeText fontSize="content"`+color=colors.text；**Toast action 按钮文字**（toast.tsx:145）→ `ThemeText fontSize="content"`+color="white"。与全项目 ThemeText 基元统一，统一启用 allowFontScaling=false/includeFontPadding=false；三角箭头、action 按钮容器、lineHeight 全部保留。
- **修改**：`src/components/base/tip.tsx`、`src/components/base/toast.tsx`。
- **tsc**：通过。

### C06 — ErrorBoundary 多处 rpx 硬编码字号　✅ 已统一

- **同类调查**：同页其他文字已全走 ThemeText 档位（主标题 title18/bold、区块小标题 subTitle14/bold、反馈标签 content16/medium、提示 description12/italic）；仅设备信息 label/value（rpx28）、错误详情（系统默认）、堆栈（rpx24）用原生 Text。
- **多数派**：ThemeText 档位。
- **统一动作**（9 处原生 Text 迁移）：
  - **设备信息 label**（"应用版本:/系统版本:/设备型号:"，:67/71/75）rpx(28) → `ThemeText fontSize="description"`(12)；
  - **设备信息 value**（:68/72/76）rpx(28)+500 → `ThemeText fontSize="body"`(15)+medium(500)；
  - **错误详情正文**（:167）系统默认 → `ThemeText fontSize="description"`(12)，lineHeight rpx36 保留；
  - **错误堆栈/组件堆栈**（:176/:198）rpx(24) → `ThemeText fontSize="caption"`(11)+monospace，lineHeight rpx32 保留。
- **修改**：`src/components/errorBoundary/index.tsx`（删 Text import，9 处 Text→ThemeText，清理冗余样式）。
- **tsc**：通过。

### C07 — 歌单卡片标题档位不一致（ImageBtn subTitle 14 vs PlaylistCard normal 13）　✅ 已统一

- **同类调查**："封面+标题"歌单卡出现点：subTitle(14)+regular：imageBtn.tsx:27→SheetItem→musicSheetResultItem（搜索结果歌单卡）**1 处**；normal(13)+medium(500)：playlistCard.tsx:98→recommendSheets:306、homeBody/sheets:74、recommendSection:262 **3 处**。
- **多数派**：normal(13)+medium(500)，3 处（PlaylistCard 体系）。
- **统一动作**：**搜索结果歌单卡标题**（SheetItem→ImageBtn）从 `subTitle(14)+regular` 改为 `normal(13)+medium(500)`，与首页推荐歌单区/我的歌单 Tab/推荐歌单页的 **PlaylistCard（playlistCard.tsx:98）** 完全统一。
- **修改**：`src/components/base/imageBtn.tsx:27-28`。
- **tsc**：通过。

### C08 — 列表行标题 TitleAndTag body(15) vs ListItem.Content content(16)　✅ 已统一（7 处全部）

- **同类调查**：列表行标题出现点：content(16)+medium(500)：ListItem.Content 字符串标题基座（listItem.tsx:254 默认）覆盖对话框/面板/设置页约 **38 处**；body(15)+medium(500)：TitleAndTag 系（titleAndTag.tsx:16，musicItem/albumItem/LyricItem/artistResultItem **4 处**）+ topListItem.tsx:57（榜单行）+ libraryTab.tsx:586（本地歌曲行）+ panels/types/playList/body.tsx:56（播放队列行）**共 7 处**。
- **多数派**：content(16)+medium(500)，约 38 处（ListItem.Content 体系）。
- **统一动作**：**音乐/专辑/歌词/歌手行标题**（TitleAndTag，4 个调用方一改生效）+ **榜单行标题**（topListItem）+ **本地歌曲行歌名**（libraryTab LocalSongItem）+ **播放队列行歌名**（playList/body）共 **7 处全部**从 `body(15)` 改为 `content(16)`，与全项目 **ListItem.Content 字符串标题（listItem.tsx:254）** 统一；字重 medium、颜色/布局逻辑（选中态等）保持不动。
- **修改**：`src/components/mediaItem/titleAndTag.tsx:16`、`src/components/mediaItem/topListItem.tsx:57-59`、`src/pages/home/components/libraryTab.tsx:586-590`、`src/components/panels/types/playList/body.tsx:56`。
- **tsc**：通过。

### C09 — 三级浮窗底部按钮行有无与构成不一致　✅ 用户已拍板（候选A）

- **同类调查**：28 个对话框中 **24 个渲染 Dialog.Actions**（单按钮 8 + 双按钮 11 + 三按钮 4 + 自布局 2）、**4 个无 Actions**（radioDialog、lyricSettingDialog、immersiveSettingDialog、volumeSettingDialog——均为"即改即生效"型：单选/开关/滑块）。
- **多数派**：渲染 Actions 行（24/28 ≈ 86%）。
- **用户拍板（2026-10-14）**：**候选A**——即改即生效型（开关/滑块/单选）对话框**不渲染 Dialog.Actions 整块**（含渐变条与分割线），内容区贴底。理由：操作已实时生效，强行加按钮行会渲染 52dp 渐变空条（仅一个"取消"），与同级语义冲突、误导用户。
- **执行**：代码现状已符合候选A（4 个对话框本就无 Actions），**无代码改动**；规则已成文写入 `docs/UI规范-字体与层级.md` 第 4.3 节与第 8 章 C09（标记 ✅）。
- **tsc**：通过（无代码改动）。

### C10 — 对话框底部按钮自布局 vs 基座 BottomButton　✅ 用户已拍板（候选B）

- **同类调查**：22 个对话框用基座 BottomButton（通过 actions prop）；2 个自布局：downloadDialog.tsx:56-111（自定义 buttonGroup 贴右不等分）、sortDialog.tsx:122-155（自定义 dirButton 字重随选中态）。
- **多数派**：基座 BottomButton（22/24 ≈ 92%）。
- **用户拍板（2026-10-14）**：**候选B**——保留自布局（DownloadDialog/SortDialog 为既有特例），规范明确"自布局必须行高 52 + 字号 subTitle(14) 起步"。理由：扩展基座需新增 align="right"/flexShrink/选中态字重支持、影响全部 24 个 Actions 调用方、风险中等偏大；保留特例符合最小改动原则。
- **执行**：无代码改动；规则已成文（docs/UI规范-字体与层级.md 第 4.3 节、第 8 章 C10 标记 ✅）。

### C11 — EditSheetDetailDialog 缺 Dialog.Title　✅ 已统一

- **同类调查**：27 个对话框有 Dialog.Title，仅 editSheetDetail.tsx:96-145 无（直接 Dialog.Content 开始）。
- **多数派**：有标题（27/28 ≈ 96%）。
- **统一动作**：**EditSheetDetail 对话框补 Dialog.Title**（`<Dialog.Title withDivider>`，文案复用 i18n key `panel.editMusicSheetInfo.title`="编辑歌单信息"），与其他对话框（如 createMusicSheetDialog:36）的 withDivider 写法统一。
- **修改**：`src/components/dialogs/components/editSheetDetail.tsx:97-100`。
- **tsc**：通过。

### C12 — Dialog.Content 字符串正文实际 13px 而非 content(16)　✅ 已统一（文档修正，无需改代码）

- **同类调查**：基座 base/index.tsx:217-220+399-402 defaultFontStyle 覆盖为 fontSize:13/lineHeight:21；checkStorage.tsx:76-80、downloadDialog.tsx:117-121 手写 item fontSize:13/lineHeight:21 与之一致。**全部对话框正文实际渲染均为 13px**。
- **多数派**：13px（全项目统一）。
- **统一动作**：无需改代码。规范明确"**对话框正文 = normal(13)/行高21 独立档位**，不从 content(16) 派生"（文档第 4 章、第 8 章 C12 已同步）。
- **tsc**：通过（无代码改动）。

### C13 — 基座 BottomButton 未实现 danger 类型　✅ 已统一（维持现状+文档注明）

- **同类调查**：危险操作按钮现写法：① SimpleDialog okText="删除" type=primary：3 处（musicItemLyricOptions:175、subscriptionSettingDialog:108、libraryTab:549）；② SimpleDialog 默认确认 primary（删除/取消收藏场景）：至少 4 处（musicItemOptions:160、sheetManager:107/120、libraryTab:518）；③ 内容区自定义红底按钮 #ff666699 白字：2 处（timingCloseDialog:85-94、panels/types/timingClose:81-87）。
- **多数派**：①+② 式（SimpleDialog + primary 按钮），合计约 7 处。
- **统一动作**：**危险操作确认按钮**维持 SimpleDialog(okText="删除" type=primary) 现状（候选B），不引入基座 danger type；文档注明"内容区红底按钮仅用于'取消定时'这类即时执行型操作"（文档第 4 章、第 8 章 C13 已同步）。
- **tsc**：通过（无代码改动）。

### C14 — PanelHeader 与 Dialog.Title 视觉规格差异　⏳ 待用户决策

- **同类调查**：panels 内 PanelHeader 使用处 **8 个**（appBarMore、associateLrc、musicQuality、simpleSelect、setUserVariables、sheetTags、simpleInput、**playList——2026-10-14 起并入**），全部走同一组件、内部规格一致；另有 **3 个面板无 PanelHeader**，头部为各自设计（MusicItemOptions/MusicItemLyricOptions 歌曲信息卡头——**用户拍板保留为特例**；SearchLrc 搜索头——落位已与其他面板一致）。dialogs 内 Dialog.Title 使用处 **29 个**（C11 已为 editSheetDetail 补齐；**2026-10-14 新增 imageViewerDialog**），全部走同一组件、内部规格一致。
- **载体澄清（2026-10-14 用户质疑"没有底部面板"后核实代码）**：panelBase.tsx 平板横屏（项目主场景）为 **left 30%/width 70%/top 56/bottom 0 + translateX 右侧滑入**——即用户实际看到的**右侧浮出层**，手机竖屏才是底部上滑；"底部面板"仅是对通用组件默认值（positionMethod='bottom'）的沿用叫法，**项目主场景无底部上滑**。9 处 PanelHeader 属于右侧浮出层标题条。
- **多数派判定**：两体系**内部各自一致，无跨体系多数派**（9 vs 27 是两组体系而非两种写法）。
- **待决策理由**：面板（右侧浮出层标题条：56dp 对角渐变无胶囊、取消 text 色）与对话框（居中弹窗标题条：52dp 水平三段渐变带胶囊、normal 按钮 textSecondary）是两套**有意区分的规格**而非写法分歧 → **需用户确认**是否承认两套规格（倾向候选B：各自成文）。
- **2026-10-14 用户四项载体决定（隐含"两套规格共存"前提）**：
  1. **歌曲选项/全屏歌词头部保留为特例**（MusicItemOptions/MusicItemLyricOptions 歌曲信息卡头，不入 PanelHeader 体系）；
  2. **播放队列头部并入 PanelHeader 规格**（playList/header.tsx 改为 PanelHeader，循环/清空按钮移至列表底部工具条 body.tsx）；
  3. **搜索歌词落位与其他面板一致**（searchLrc 移除 positionMethod='top'，平板横屏仍占右内容区全高）；
  4. **图片查看由全屏面板迁入三级弹窗**（新建 imageViewerDialog.tsx 并注册，albumCover 长按改 showDialog，面板文件已删除）。
  → 面板/对话框两套规格各自继续使用，C14 倾向候选B 已被上述决定印证；待用户明确确认后标记 ✅。
- **建议**：候选B。

### C15 — TimingClose 面板版与浮窗版双载体并存　✅ 用户已拍板（保留居中版）

- **同类调查**：面板版 panels/types/timingClose.tsx:38-94（positionMethod='top'、高 vh56、无底部 Actions）；浮窗版 dialogs/components/timingCloseDialog.tsx:23-109（居中卡片+底部 52dp 渐变行仅"取消"）。两版字号层级核实完全一致（快捷时长 content16、"播完关闭" content16、"取消定时" normal13/medium 白字 #ff666699 底）。
- **多数派**：1:1 平手。
- **用户拍板（2026-10-14）**：**保留居中浮窗版 TimingCloseDialog，下线面板版**。入口核实：面板版入口 = musicItemOptions.tsx:207-211（音乐条目更多菜单"定时关闭"，from MUSIC_DETAIL 时显示）；浮窗版入口 = lyricOperations.tsx:77（歌词页操作）。
- **执行**：musicItemOptions"定时关闭"由 `showPanel("TimingClose")` 改为 `showDialog("TimingCloseDialog")`；面板注册（panels/types/index.ts）与文件（panels/types/timingClose.tsx）已移除；备份于 E:\Temp\Deepseek\jiyuejie-ui-conflict-backup-20261014\。
- **tsc**：通过。

### C16 — SetFontSize 面板版与浮窗版双载体并存　✅ 用户已拍板（下线面板版）

- **同类调查**：面板版 panels/types/setFontSize.tsx:18-60（PanelHeader hideButtons、高 vh65）；浮窗版 dialogs/components/setFontSizeDialog.tsx:22-71（居中卡片+底部仅"取消"）。两版内容核实完全一致（Slider 0~3 四档、标签 content16/opacity 0.5）。
- **多数派**：1:1 平手。
- **用户拍板（2026-10-14）**：**下线面板版**。入口核实：**字体大小入口确定在浮窗版**——musicItemLyricOptions.tsx:131 `showDialog("SetFontSizeDialog")`（全屏页歌词条目更多菜单）；面板版 SetFontSize 在 src 全库**无任何调用方**（死代码）。
- **执行**：面板注册（panels/types/index.ts）与文件（panels/types/setFontSize.tsx）已移除；备份于 E:\Temp\Deepseek\jiyuejie-ui-conflict-backup-20261014\。
- **tsc**：通过。

### C17 — 设置页滑块标签行写法不一致　⚠️ 已统一后按用户要求恢复原状（2026-10-14 晚）

- **同类调查**："设置页/主题设置内标签+滑块行"出现点：写法A（basicSetting.tsx:641-704 悬浮歌词 4 个滑块：标签 content16/regular、行高 48、无数值）；写法B（backgroundCustom.tsx:118-169 背景模糊/透明度 2 个滑块：标签 content16/medium + 右数值 textSecondary 两端对齐 + 滑块在下 marginTop rpx28）。
- **多数派**：按"滑块组"口径写法B（backgroundCustom 2 组 vs basicSetting 1 组）；且写法B 的 medium 字重与全项目设置行标题 content(16)/medium 主流一致，写法A 的 regular 是离群值。
- **统一动作（已执行，后回退）**：**basicSetting 悬浮歌词 4 个滑块（"左右边距/上下边距/宽度/字体大小"）标签行** 从"标签+滑块同行、无数值"改为与 **backgroundCustom（backgroundCustom.tsx:118-169）** 完全一致的"标签行在上（左标签 medium + 右实时数值 textSecondary）+ 滑块在下"写法（右值：左右边距/上下边距/宽度=Math.round(x×100)%、字体大小=Math.round(fontSize)）。
- **回退（2026-10-14 晚，用户指示 "C17 恢复原状"）**：basicSetting.tsx 悬浮歌词 4 个滑块行恢复为原 `lyricStyles.sliderContainer` 写法（标签+滑块同行、无数值、行高 48），lyricStyles 样式同步还原；tsc 通过。
- **注**：若按"渲染行"口径计为 4:2 反向（basicSetting 写法反而是多数），则候选A 方向应改 backgroundCustom；本次按滑块组口径+字重主流性选候选B，用户选择恢复原状（保留写法A）。

### C18 — 设置行标题字号不一致（basicSetting content 16 vs scanSettings body 15）　✅ 已统一

- **同类调查**：设置类页面行标题：content(16)+medium：basicSetting（createSwitch/createRadio/入口行/对齐颜色行多处）、backupSetting 列表行、backgroundCustom actionRow、全项目 ListItem.Content title= 调用（listItem.tsx:253-257）**绝对多数**；content(16)+regular：仅 mode.tsx:34（1 处）；body(15)+regular：scanSettings/index.tsx:265 权限行、:347 SettingSwitchRow、:381 AddRow（3 处）。
- **多数派**：content(16)+medium（ListItem 体系）。
- **统一动作**：**scanSettings 三个同级行标题——"管理外部存储权限"（权限行）、SettingSwitchRow 标题（如"不扫描 60 秒以下音频"）、"添加被屏蔽的文件夹"（AddRow）** 从 `body(15)+regular` 改为 `content(16)+medium(500)`，与 **basicSetting 开关行标题（ListItem.Content）** 同档同字重；三行彼此保持一致（AddRow 原保留 primary 颜色，已按用户要求于 2026-10-14 晚改为与权限行**完全一致**：正文色文字 + 20 图标 primary + 右箭头 + 行距对齐），并同步行内注释。
- **修改**：`src/pages/scanSettings/index.tsx:265、:347、:381`。
- **tsc**：通过。

### C19 — 页面分组/区块标题字号与颜色不一致　✅ 已统一

- **同类调查**：页面分组标题出现点：subTitle(14)+bold(700)+primary：basicSetting:487、backupSetting:213/263/297、background:18、mode:19、backgroundCustom:83、scanSettings:324 **7 处**；content(16)+bold+text：mineTab:577/586/602、recommendSection:205、libraryTab:383 **5 处**。
- **多数派**：subTitle(14)+bold(700)+primary（7 vs 5）。
- **统一动作**：**首页"推荐歌单"区块标题（recommendSection）、我的页平板/手机三处分组标题（mineTab 577/586/602）、音乐库"本地歌曲"排序行标题（libraryTab）** 共 5 处从 `content(16)+bold+text色` 改为 `subTitle(14)+bold(700)+primary`，与 **设置页/扫描设置分组标题（basicSetting:487 等）** 统一。
- **修改**：`src/pages/home/components/mineTab.tsx`（3 处）、`src/pages/home/components/homeBody/recommendSection.tsx:204`、`src/pages/home/components/libraryTab.tsx:382`。
- **tsc**：通过。

### C20 — ThemeText fontSize prop 被 inline style 覆盖　✅ 已统一

- **同类调查**：全项目 ThemeText 传 fontSize prop 后被 inline style 覆盖 fontSize 的仅 2 处：tabBar.tsx:166-179（平板顶栏 Tab 文字）、tabletPanel.tsx:157-162（问候语）。全项目 fontSize:32 共 3 处（第三处 musicDetail:160 属播放页 hero，非 prop 覆盖）。档位表最大 large=22，无 32 档。项目内其余 ThemeText 均 prop 生效（绝对多数）。
- **多数派**：ThemeText prop 生效（prop 为唯一字号来源）。
- **统一动作**：**平板顶栏 Tab 文字**与**平板顶部问候语**两处死 prop `fontSize="title"`（实际被 inline 32 覆盖）改为新增档位 `fontSize="xlarge"` 并删除 inline fontSize:32——渲染仍为 32px 不变，prop 变为真实来源（候选B：入档而非继续 inline 硬编码）。
- **修改**：`src/constants/uiConst.ts:24-26`（新增 `xlarge:32` 档位）；`src/pages/home/components/tabBar.tsx:166-179`；`src/pages/home/components/tabletPanel.tsx:157-162`。
- **tsc**：通过（xlarge 自动纳入 fontSizeConst 类型，无副作用）。

### C21 — 首页入口卡片标题字号不统一（手机版）　✅ 用户已拍板（候选C 分级）

- **同类调查**（手机版渐变底入口卡/统计卡）：body(15)+bold+text：operations.tsx:184（金刚区 4 入口）**1 处**；title(18)+bold+text：libraryTab.tsx:362（音乐库 4 入口卡）**1 处**；normal(13)+bold+text：mineTab.tsx:518（MineStatCard 手机统计卡）**1 处**。平板版参照：libraryTab:326、mineTab:459 均 large(22)（2/3 一致），operations 金刚区 body(15) 为例外。
- **多数派**：手机版三写法各 1 处，**平手**。
- **用户拍板（2026-10-14）**：**候选C——按卡型分级成文**：横排入口卡（金刚区/音乐库四入口）统一 title(18)+bold；紧凑竖排统计卡（MineStatCard）保持 normal(13)+bold。
- **执行**：`operations.tsx:184` 金刚区卡标题 body(15) → title(18)（与 libraryTab 音乐库入口卡统一）；mineTab 统计卡 13 保持不动；文档第 8 章 C21 标记 ✅。
- **tsc**：通过。

### C22 — 播放页/沉浸层等多处硬编码 fontSize　✅ 已统一（部分）+ 判定保留（部分）

- **同类调查**分三块：
  1. **mineTab 头像"极"字**（:196-199）：硬编码 fontSize=24 仅 1 处，项目内无"圆形头像内首字"同类先例；按"禁新硬编码、优先档位"原则 → **统一动作**：24 → `large(22)`（与 56px 圆内单字视觉最接近，差 2px），迁移为 ThemeText props。修改：`mineTab.tsx:196-198、691-695`。
  2. **小标签 12/11**：全项目小标签均引用档位 key（PlaylistCard 播放量 tag(10)、副行 caption(11)、TypeTag description(12)），仅 2 处裸数字 → **统一动作**：**插件可用率百分比标签**（pluginItem）字号 12 → `fontSizeConst.description`；**插件排序平台徽章**（pluginSort）字号 11 → `fontSizeConst.caption`。修改：`settingTypes/pluginSetting/components/pluginItem.tsx:288`、`settingTypes/pluginSetting/views/pluginSort.tsx:269`。
  3. **播放页 hero 大字号**（musicDetail 歌名 32/19/24、歌手 18/13/15；immersiveLayer 标题 24/18、歌手 16/14、当前歌词 34/26、上下歌词 25/15、时间 50/14、另有 :801 的 56；tabletPanel 歌名 20）：调查确认该体系**内部一致全部硬编码**、按 isTablet/紧凑屏条件自适应并与 lineHeight 预算紧耦合，辅助小字（lyricItem content16、RateButton content16、seekBar caption11、draggingTime description12）早已入档——hero 部分属独立沉浸式字号体系，无同语义混档 → **判定候选B：保留硬编码、不改代码**，在文档 7.7 节登记《播放页专用字号表》。
- **tsc**：通过。

---

## 三、文档同步记录（docs/UI规范-字体与层级.md）

### 3.1 第 8 章冲突清单
22 条全部更新：16 条标注"✅ 已按多数派统一：xx → yy（第 N 章已同步）"，6 条标注"⏳ 待用户决策"并附调查统计与理由；章首说明同步更新。

### 3.2 第 1 章档位表
新增 `xlarge: 32` 档位（C20 引入，注释"平板顶栏 Tab / 问候语大字号"）。

### 3.3 第 2~7 章漂移修正（统一过程中发现并一并修正）

| 位置 | 原文 | 修正 |
|---|---|---|
| 2.2 AppBar | fontSize="title"（见冲突 C01） | fontSize="appbar"（C01 已统一） |
| 2.4 LinkText | 颜色硬编码 #66ccff（见冲突 C04） | colors.primary（C04 已统一） |
| 2.4 Tip/Toast | 均用原生 Text 非 ThemeText（见冲突 C05） | 已迁移 ThemeText（C05 已统一） |
| 2.5 Checkbox | 勾内图标 size=18 硬编码（见冲突 C02） | iconSizeConst.light(20)（C02 已统一） |
| 2.5 Input | 组件本身不设 fontSize（见冲突 C03） | 默认 content(16)（C03 已统一） |
| 2.8 ErrorBoundary | 多处 rpx 硬编码（见冲突 C06） | 已入档（label description/value body/堆栈 caption+monospace） |
| 3.1/3.2/3.3/3.5/3.7 | TitleAndTag 系 body(15) | content(16)（C08 已统一） |
| 3.4 | ImageBtn subTitle(14) 与 PlaylistCard normal(13) 不同（见冲突 C07） | 统一 normal(13)+medium(500) |
| 4.1 Content | 实际 13 与 normal 同值但非 content（见冲突 C12） | "对话框正文=normal(13)/行高21"独立档位 |
| 4.1 BottomButton | 未实现 danger（见冲突 C13） | 危险操作=SimpleDialog primary，文档注明 |
| 4.2 editSheetDetail | 无 Dialog.Title | 有 Dialog.Title（C11 已统一） |
| 4.3 | C09/C10/C11/C13 未标状态 | 已标注（C11 已解决，C09/C10 待决策） |
| 5.1/5.2 | C14/C15/C16 未标状态 | 已标注待决策 |
| 6.1 AppBar | 默认 appbar(18)、**medium(500)**（**与实际不符**） | **bold(700)**（实际字重修正） |
| 6.4 悬浮歌词滑块 | content16/regular、行高48 | ~~标签 medium+右数值+滑块在下（C17 已统一）~~ **已回退原状（2026-10-14 晚）** |
| 6.5 pluginItem/pluginSort | 路径缺 pluginSetting/ 层级；12/11 硬编码 | 路径修正；description/caption 档（C22 已统一） |
| 6.6 backgroundCustom | 与 basicSetting 写法不同（见冲突 C17） | ~~已统一为该写法~~ **C17 已回退，两种写法并存（各自成文）** |
| 6.7 scanSettings | 三行标题 body(15)（见冲突 C18） | content(16)+medium(500)；AddRow 已与权限行格式完全对齐（2026-10-14 晚） |
| 7.1 tabBar 平板 | fontSize="title"+inline32（见冲突 C20） | xlarge(32) 档位 |
| 7.2/7.3/7.4 | 分组标题 content(16)+text | subTitle(14)+primary（C19 已统一） |
| 7.3 LocalSongItem | 标题 body(15) | content(16)（C08 已统一） |
| 7.4 头像"极"字 | 硬编码 24 | large(22)（C22 已统一） |
| 7.5 tabletPanel 问候 | fontSize="title"+inline32（见冲突 C20） | xlarge(32) 档位 |
| 7.7 | 无播放页专表 | 新增《播放页专用字号表》（C22(b) 登记） |

---

## 四、待用户决策清单（6 条 + 2 项附注）

| 编号 | 冲突 | 现状 | 决策 |
|---|---|---|---|
| C09 | 三级浮窗底部按钮行有无 | 24 渲染 vs 4 即改即生效型无 | ✅ 已拍板：候选A——即改即生效型不渲染 Actions 空条 |
| C10 | 对话框底部按钮自布局 vs 基座 | 22 基座 vs 2 自布局 | ✅ 已拍板：候选B——保留自布局+文档约束 |
| C14 | PanelHeader 与 Dialog.Title 两套规格 | 对话框 29 处统一 / 面板 8 处统一（另有 3 面板无标题条：2 特例+1 无头） | ⏳ 待用户决策（倾向候选B：承认两套规格为有意区分；2026-10-14 四项载体决定已隐含印证） |
| C15 | TimingClose 面板版/浮窗版双载体 | 1:1 | ✅ 已拍板：保留居中浮窗版，下线面板版（入口已切） |
| C16 | SetFontSize 面板版/浮窗版双载体 | 1:1 | ✅ 已拍板：下线面板版（死代码，入口确定在浮窗版） |
| C21 | 手机版入口卡标题三档 | body15/title18/normal13 各 1 处 | ✅ 已拍板：候选C 按卡型分级（横排 title18、统计卡 13） |

**附注 1（C17 统计口径）**：C17 按"滑块组"口径（backgroundCustom 2 组 vs basicSetting 1 组）统一为 backgroundCustom 写法；若按"渲染行"口径计为 4:2 反向。**2026-10-14 晚用户指示恢复原状**，已回退 basicSetting 悬浮歌词 4 滑块为"标签+滑块同行、无数值"原写法（备份完整）。
**附注 2（C01 语义判定）**：C01 按"AppBar 拥有专属语义档 appbar 却错用 title"判定为离群点而统一到 appbar（像素同 18、零视觉变化）；若倾向全局统一为 title 可一键回退。

---

## 五、备份清单（E:\Temp\Deepseek\jiyuejie-ui-conflict-backup-20261014\，22 个文件，保留相对路径）

```
src\components\base\appBar.tsx
src\components\base\checkbox.tsx
src\components\base\imageBtn.tsx
src\components\base\input.tsx
src\components\base\linkText.tsx
src\components\base\tip.tsx
src\components\base\toast.tsx
src\components\dialogs\components\editSheetDetail.tsx
src\components\errorBoundary\index.tsx
src\components\mediaItem\titleAndTag.tsx
src\components\mediaItem\topListItem.tsx
src\components\panels\types\playList\body.tsx
src\constants\uiConst.ts
src\pages\home\components\libraryTab.tsx
src\pages\home\components\mineTab.tsx
src\pages\home\components\tabBar.tsx
src\pages\home\components\tabletPanel.tsx
src\pages\home\components\homeBody\recommendSection.tsx
src\pages\scanSettings\index.tsx
src\pages\setting\settingTypes\basicSetting.tsx
src\pages\setting\settingTypes\pluginSetting\components\pluginItem.tsx
src\pages\setting\settingTypes\pluginSetting\views\pluginSort.tsx
```

> 说明：全部 21 个被修改源文件均有备份；libraryTab.tsx / mineTab.tsx 各含多处修改（C08/C19/C21 调查 + C22 头像），按文件备份一次。

---

## 六、验证与合规声明

- `npx tsc --noEmit`：改前基线通过 → 四组各自改后通过 → **合并后全量复验通过（exit 0）**。
- 未打包、未升版本号、未修改 package.json/version.json/app.json 等配置 JSON、未改原生 res。
- 未引入新的硬编码字号/颜色（仅 uiConst 新增 xlarge=32 档位 key 与播放页 hero 既有硬编码登记保留，无新增裸数字）。
- 文档保持中文、UTF-8 无 BOM（已核验）。
- 最小改动：仅统一少数派写法，未做无关重构；改组件基座（titleAndTag/listItem/Input/基座 BottomButton 评估）均已检查调用方渲染。
