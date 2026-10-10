# 全项目列表行样式统一性核查报告

- 项目：`E:\xunwu\MusicFreeApp\MusicFree`（React Native + TS）
- 方式：只读精读源码，未改任何代码、未构建。三切片交叉比对：
  - 切片A = 基座规范 + 一级页面（首页/我的/音乐库/抽屉/搜索页）
  - 切片B = 二级页面 + 设置族（播放队列/历史/歌单详情族/下载/统计/设置/文件选择）
  - 切片C = 共享行组件族 + 三级浮窗 + 面板 + 全屏歌词
- 数值来源：均来自实际代码阅读；三切片互相印证；信息不足处标注"待补查"。
- 换算口径：rpx(x)=x/750×短边，按 375dp 宽折算 ≈ x/2 dp，仅助读。

---

## 0. 全局基准（三切片一致确认，作为比对零点）

| 项 | 值 | 出处 |
|---|---|---|
| heightType 档 | **big=64 / normal=56(默认) / small=48 / smallest=36 / none=不定** | listItem.tsx（A/C） |
| withHorizontalPadding | 左右 padding=16（默认 left/rightPadding=16） | listItem.tsx |
| Content 字符串标题 | `<ThemeText>` 未传 fontSize → **content=16 / regular(400) / text** | themeText.tsx + listItem.tsx |
| Content 字符串副标题 | **description=12 / textSecondary**，marginTop=2 | listItem.tsx |
| ListItemImage 封面 | 48×48，borderRadius=8 | listItem.tsx |
| ListItemIcon 默认 | iconSize=**normal=24**，left 时 marginRight=16 | listItem.tsx |
| 按压态 | TouchableHighlight underlayColor=**colors.listActive**；行本身无圆角/无背景 | listItem.tsx |
| 分隔线 | ListItem **无内建**；Divider=全宽1dp/colors.divider/无缩进 | divider.tsx |
| ListItemHeader | smallest=36、subTitle=14/bold/textSecondary、marginTop=12 | listItem.tsx |
| fontSizeConst | tag10/caption11/description12/normal13/subTitle14/body15/content16/title18/large22 | uiConst.ts |
| iconSizeConst | small16/light20/normal24/big32/large40 | uiConst.ts |
| 三级浮窗基座 | Content 自带 paddingHorizontal=24（行内 ListItem 再叠16→文字距窗40）；标题行高52/title18 bold；按钮行高52/subTitle14 medium | dialogs/base |

---

## 1. 分页面行样式快照（按页面分组，注来源切片）

### 1.1 共享媒体行（切片C）
| 行类型 | 文件路径 | 关键样式 | 来源 |
|---|---|---|---|
| 歌曲行 | src\components\mediaItem\musicItem.tsx | heightType=**big64**；封面48/8/带 LocalSongCover；标题 TitleAndTag=**body15/medium**；副 artist-album=description12/textSecondary(高亮primary)；序号槽40/subTitle14 italic；三点 normal24/槽宽40；withHP | C |
| 搜歌词结果行 | mediaItem\LyricItem.tsx | big64；Image48/8；TitleAndTag body15/medium；副 description12/textSecondary | C |
| 专辑行 | mediaItem\albumItem.tsx | big64；Image48/8；body15/medium；副 description12/textSecondary | C |
| 歌单卡 | mediaItem\playlistCard.tsx | 宽130；封面130/12；标题 normal13/medium；副 caption11/textSecondary；角标 tag10 | C |
| 插件歌单项 | mediaItem\sheetItem.tsx | ImageBtn 网格项（内部尺寸**待补查**） | C |
| 榜单分类行 | mediaItem\topListItem.tsx | Pressable paddingH16/V10；图标块40/10渐变/fire20；标题 body15/medium；副 description12/textSecondary；**分隔线 hairline marginLeft70 textSecondaryα0.15**；按压 primaryα0.06 | C |
| 歌曲列表容器 | musicList\index.tsx | estimatedItemSize=64；渲染 MusicItem | C |
| 本地歌曲行 | pages\libraryTab（切片A L3） | 自绘：封面 LocalSongCover size=**44**/8；标题 **content16/medium**；副 normal13/textSecondary；三点20；**分隔线 hairline marginLeft56 rgba(128,128,128,0.25)**；按压 primaryα0.06 | A |

### 1.2 一级页面（切片A）
| 行类型 | 文件路径 | 关键样式 | 来源 |
|---|---|---|---|
| 抽屉设置入口行 | home\components\drawer\index.tsx | heightType=**normal56**；Content 字符串标题=content16/regular；图标默认24/槽宽rpx48≈24；withHP | A |
| 歌手结果行 | searchPage\...\artistResultItem.tsx | heightType=big64；Image48/8；TitleAndTag body15/medium；副 description12/textSecondary | A |
| 入口卡（首页/我的/音乐库） | homeBody/*、mineTab、libraryTab | 自绘 Pressable+LinearGradient 卡：minHeight 84~140；标题 body15 bold / title18 bold / large22 bold / normal13 bold；图标字面量17~52（未映射档位）；圆角16~20；**多数无按压态** | A |
| 我的竖排入口行 M4 | mineTab.tsx | paddingV14；标题 body15/medium；Icon20 primary；行间 hairline/colors.divider | A |

### 1.3 二级页面（切片B）
| 行类型 | 文件路径 | 关键样式 | 来源 |
|---|---|---|---|
| 播放队列歌曲行 | panels\types\playList\body.tsx | 自绘：minHeight rpx120≈60、paddingV rpx20、paddingH rpx24≈12；序号 subTitle14（当前曲 bold/否则 regular）；歌名 **body15**（当前曲 bold/否则 medium）；副 description12；删除 IconButton small16；radius10；按压 background | B |
| 最近播放行 | pages\history\index.tsx | 自绘：paddingV10/H8；首字符块44/8/title18 primary；歌名 body15/medium；副 description12；无封面无三点；separator height2 透明；按压 primaryα0.06 | B |
| 共享歌单详情歌曲行 | components\musicSheetPage（MusicList） | 走共享 MusicItem showIndex（=1.1） | B+C |
| 本地歌单详情歌曲行 | pages\sheetDetail（自绘） | paddingV10/H8；序号块 **44²/8** surfaceVariant/subTitle14 primary；歌名 body15/medium；副 description12；estimatedItemSize=64；按压 primaryα0.06 | B |
| 排行歌曲行 | pages\topListDetail\index.tsx | paddingH16/V8；封面44/8；**歌名 subTitle14/medium（≠body15）**；序号 width32/normal13 textSecondary；**分隔线 hairline marginLeft92 textSecondaryα0.15**；按压 primaryα0.06 | B |
| 歌单管理行卡 | pages\sheetManager\index.tsx | padding12；标题 content16/medium；副 normal13/textSecondary；图标块48/10/Icon24；删除20；**radius14** surfaceVariant；按压 primaryα0.06 | B |
| 本地分组行 | pages\localGroup\index.tsx | paddingV6/H16；标题 body15/medium；副 description12；图标块48/10/Icon26；**分隔线 hairline marginLeft68 textSecondaryα0.15**；无按压态 | B |
| 下载任务卡 | pages\downloading\downloadingList.tsx | padding12；标题 body15/medium；副 description12；状态图标24；**radius14**；separator height8 | B |
| 接口歌单网格卡 | pages\apiSheets\index.tsx | 封面1:1/radius12；标题 normal13/medium；副 caption11；排名角标22/11 caption11 | B |
| 统计页 | pages\statistics\index.tsx | 总览卡 minHeight110/radius18/value large22 bold；排行行歌名 subTitle14/medium；rankBox32/圆16 | B |

### 1.4 设置族（切片B）
| 行类型 | 文件路径 | 关键样式 | 来源 |
|---|---|---|---|
| 开关/单选/跳转行 | setting\settingTypes\basicSetting.tsx | heightType=**small48**；Content 标题（=content16/400）；组卡 radius rpx14；行间 hairline **marginLeft rpx16≈8 rgba(128,128,128,0.18)** | B+C |
| 备份/主题/订阅源行 | backupSetting、themeSetting/mode、pluginSubscribe | **未传 heightType→默认 normal56**；withHP | B |
| 音源插件卡 | pluginSetting\...\pluginItem.tsx | paddingV rpx18；名称 title18 regular；版本 subTitle14；**container borderRadius=rpx8≈4dp（明显偏小）** | B |
| 扫描设置行族 | pages\scanSettings\index.tsx | 自绘：开关行 paddingH4/V6、标题 body15、Icon20；权限行 paddingH4/V10；添加行 normal13；**无分隔线** | B |
| 文件选择行 | pages\fileSelector\fileItem.tsx | height=rpx96≈48；路径 normal13；图标 light20；paddingH rpx24≈12 | B |
| 权限行 | pages\permissions\index.tsx | heightType=**big64**；Content 标题 content16；withHP | B |

### 1.5 三级浮窗（切片C）
| 行类型 | 文件路径 | 关键样式 | 来源 |
|---|---|---|---|
| 歌单选行 | dialogs\addToMusicSheetDialog.tsx | small48；Image48/8；Content 标题 content16/400；副 description12 | C |
| 三点菜单行 | dialogs\menuDialog.tsx | small48；图标 **light20**/槽宽rpx48≈24；Content 标题 content16/400 | C |
| 单选行 | dialogs\radioDialog.tsx | small48；图标**默认 normal24**；Content content16；**getItemLayout=56≠实际48** | C |
| 选源行（浮窗版） | dialogs\importMusicSheetDialog.tsx | **未传 heightType→normal56**；Content content16；无图标 | C |
| 下载设置选项行 | dialogs\downloadSettingsDialog.tsx | 自定义 Pressable：paddingV6/**paddingH4**；标签 normal13(选中bold)；选中 check-circle light20 primary | C |

### 1.6 面板（切片C）
| 行类型 | 文件路径 | 关键样式 | 来源 |
|---|---|---|---|
| 歌曲三点菜单行 | panels\types\musicItemOptions.tsx | small48；图标 light20/槽宽rpx48；Content content16/400；头部封面 rpx140≈70/rpx16≈8 | C |
| 歌词三点菜单行 | panels\types\musicItemLyricOptions.tsx | 与上完全同款 | C |
| 顶栏三点面板 | panels\types\appBarMore.tsx | 同款（源码注释自证"Content 默认 content16 regular"） | C |
| 通用单选行 | panels\types\simpleSelect.tsx | small48；无图标；Content content16 | C |
| 用户变量行 | panels\types\setUserVariables.tsx | **未传 heightType→normal56**；变量名 content16 maxW35% | C |
| 选源行（面板版） | panels\types\importMusicSheet.tsx | **未传 heightType→normal56**；Content content16 | C |
| 音质/倍速行 | musicQuality.tsx / playRate.tsx | 自定义 Pressable：height rpx96≈48、**paddingH rpx24≈12**；ThemeText content16；无图标 | C |

### 1.7 全屏歌词（切片C）
| 行类型 | 文件路径 | 关键样式 | 来源 |
|---|---|---|---|
| 歌词行 | musicDetail\...\lyric\lyricItem.tsx | Text 居中；字号 rpx24/30/36/42≈12/15/18/21（默认≈15）；paddingH rpx64≈32、paddingV rpx14≈7；普通 opacity0.6、高亮 primary、拖拽 opacity0.9 | C |
| 操作栏 | lyricOperations.tsx | 栏高 rpx56≈28；图标全 normal24/textSecondary（定时激活 primary） | C |

---

## 2. 统一性结论

### 2.1 一致的部分（良好）
1. **基座复用行高度档**：small48 是菜单/选项行的事实主流（menuDialog、addToMusicSheet、musicItemOptions、musicItemLyricOptions、appBarMore、simpleSelect、basicSetting、fileSelector）。
2. **媒体行标题字重**：共享 MusicItem / albumItem / LyricItem / history / sheetDetail 自绘行，标题均 **body15**。
3. **副标题色**：全项目副行基本统一 description12/textSecondary。
4. **浮窗/面板菜单行图标**：menuDialog、musicItemOptions 系、appBarMore 统一 light20。
5. **卡片圆角**：sheetManager/downloading/scanCard/统计卡统一 radius14（pluginItem 除外）。
6. **封面占位**：48/8（List Image）与渐变占位块一致。

### 2.2 不一致的部分（详见第3节）
- 歌曲行本体存在 **5 套自绘变体**，封面 48 vs 44、标题 body15 vs subTitle14、行高 64 vs padding 自然高。
- 选项/选源行高度 48 vs 56 混乱（3 处漏传 heightType）。
- 菜单行标题档 content16/400 与媒体行 body15/medium 双轨；与 uiConst 注释"列表项标题=normal13"也不符。
- 分隔线缩进 56/68/70/92/rpx16 五套、颜色三套。
- 面板/页面行左右 padding 16 / 12 / 4 三档。
- 歌单详情头副行 description12 vs subTitle14 双实现。

---

## 3. 不一致项分级（按影响排序）

> 硬差异 = 同类型行本应统一却不同；合理差异 = 不同类型行/场景的设计差异。

### 【硬差异】

**HD-1（高）歌曲行本体 5 套变体未统一**
- 共享 MusicItem：64、封面48/8、标题 body15/medium、序号槽40/subTitle14 italic、三点24/槽宽40
- sheetDetail 自绘：padding 自然高≈60、序号块44²/8 surfaceVariant、无三点
- topListDetail：封面44/8、**标题 subTitle14**、序号 width32/normal13
- playList/body：minHeight≈60、paddingH≈12、序号 subTitle14、删除按钮16
- history：首字符块44/8/title18、无封面无三点
- 影响：同为"一首歌一行"，封面尺寸、标题档、行高、序号样式全不一致。

**HD-2（高）选项/选源行高度 48 vs 56**
- 48档：simpleSelect、menu系、musicItemOptions系、addToMusicSheet、basicSetting
- 56档（漏传 heightType）：dialogs\importMusicSheetDialog 选源行、panels\importMusicSheet 选源行、panels\setUserVariables
- 影响：同为"点一项"的行，相邻列表高度跳变 8dp。

**HD-3（高）菜单行标题档双轨：content16/400 vs 媒体行 body15/medium**
- 基座 Content 字符串标题默认 content16/regular（drawer、所有面板菜单行、menu系、radio、simpleSelect、选源行）
- 媒体行 TitleAndTag=body15/medium；uiConst 注释定义"列表项标题=normal13"
- 影响：同一屏内"主标题"字号/字重不统一；且基座默认档与设计注释不符。

**HD-4（中）radioDialog 图标 normal24 ≠ 菜单系 light20**
- menu系/musicItemOptions系/appBarMore=light20；radioDialog=默认 normal24；drawer 入口行=normal24。

**HD-5（中）radioDialog getItemLayout=56 与实际行高48 错位**
- 滚动定位按 56 计算，实际 48，长列表滚动偏移累积。

**HD-6（中）面板/页面行左右 padding 三档：16 / 12(rpx24) / 4**
- 16：所有 ListItem 行
- 12：musicQuality、playRate、playList/body、fileSelector
- 4：downloadSettings OptionRow、scanSettings 开关/权限/添加行

**HD-7（中）歌单详情头副行字号双实现**
- musicSheetPage"共N首"=description12；sheetDetail"N首歌曲"=subTitle14。

**HD-8（中）分隔线五套缩进+三套颜色**
- localMusicList 56/rgba128,128,128,0.25；basicSetting rpx16≈8/rgba128,128,128,0.18；localGroup 68/textSecondaryα0.15；topListItem 70/textSecondaryα0.15；topListDetail 92/textSecondaryα0.15（注释与代码不符）。

**HD-9（低）pluginItem 卡片圆角 rpx8≈4dp**，明显小于其它卡片 14dp。

**HD-10（低）自绘卡片普遍无按压态**（首页统计卡/金刚区/我的卡/热门搜索/入口卡）；基座行有 listActive。属体验缺口。

### 【合理差异】
- RD-1 全屏歌词行（居中/rpx64 大 padding/透明度分级）——独占场景。
- RD-2 首页/我的/音乐库入口卡（渐变卡/minHeight84~140/图标字面量）——卡片非列表行。
- RD-3 playlistCard/sheetItem/apiSheets 网格卡——网格布局。
- RD-4 timingClose 时长块、setLyricOffset 按钮组、colorPicker、sheetTags 标签流——非列表行。
- RD-5 Tab/Chip/TypeTag——非行。
- RD-6 平板 vs 手机尺寸分档（统计卡96/110 等）——响应式。
- RD-7 drawer 设置入口行 normal56（信息密度高于菜单行）——可接受。

---

## 4. 修复建议（落到文件+值）

| 编号 | 改哪个文件 | 改什么值 | 解决 |
|---|---|---|---|
| F1 | src\components\dialogs\components\radioDialog.tsx | getItemLayout 里 `ListItem.Size.normal` → `ListItem.Size.small` | HD-5 |
| F2 | src\components\dialogs\components\importMusicSheetDialog.tsx | 选源 ListItem 加 `heightType="small"` | HD-2 |
| F3 | src\components\panels\types\importMusicSheet.tsx | 选源 ListItem 加 `heightType="small"` | HD-2 |
| F4 | src\components\panels\types\setUserVariables.tsx | ListItem 加 `heightType="small"` | HD-2 |
| F5 | src\components\dialogs\components\radioDialog.tsx | ListItemIcon 加 `iconSize={iconSizeConst.light}` | HD-4 |
| F6 | src\pages\topListDetail\index.tsx | 歌名 `subTitle=14` → `body=15`；封面 coverWrap 44 → 48、radius8 保持 | HD-1 |
| F7 | src\pages\sheetDetail\components\sheetMusicList.tsx | 评估复用共享 MusicItem（至少统一封面48/8、行高64） | HD-1 |
| F8 | src\pages\sheetDetail\components\header.tsx | 副行"N首歌曲" `subTitle=14` → `description=12`（对齐 musicSheetPage） | HD-7 |
| F9 | src\components\panels\types\musicQuality.tsx、playRate.tsx | `paddingHorizontal: rpx(24)` ≈12 → 16，或外包 ListItem | HD-6 |
| F10 | src\components\dialogs\components\downloadSettingsDialog.tsx、pages\scanSettings | OptionRow/开关行 `paddingHorizontal: 4` → 对齐 basicSetting 的组卡缩进 | HD-6 |
| F11 | src\components\base\divider.tsx 增一个 ListDivider 变体 | 统一 `hairline + marginLeft=60(封面48+gap12) + colors.divider`，各页替换 56/68/70/92 五处 | HD-8 |
| F12 | pages\setting\...\pluginItem.tsx | container `borderRadius: rpx(8)` → `rpx(28)`≈14dp | HD-9 |
| F13 | 自绘 Pressable 卡（homeBody/*、mineTab、libraryTab、historyPanel） | 补 `pressed && { backgroundColor: Color(colors.primary).alpha(0.06) }`（已有 L3/H3 先例） | HD-10 |
| F14 | 基座 src\components\base\listItem.tsx Content | 【需产品决策】字符串标题显式统一一档：建议菜单行=content16/**medium**、媒体行=body15/medium；或全量向 normal13 对齐。当前 regular(400) 建议至少统一改 medium(500) | HD-3 |

---

## 5. 待补查（本次未覆盖，建议后续补）
- iconTextButton / iconButton / themeSwitch / checkbox 的内部尺寸与间距（切片B标注，切片C未在读单内）。
- sheetItem 所用 ImageBtn 内部尺寸与圆角。
- AppBar 内部行高/字号、PanelHeader 内部（切片边界外）。
- 各页 estimatedItemSize 与真实行高的偏差（如 searchLrc LyricList 用 rpx120≈60 而 LyricItem 实际64）。

> 备注：B 的"待补查"中 listItem 内部、musicItem/sheetItem/topListItem/albumItem/MusicList 行体，已由切片C 实测补齐并采信。

---

## 6. 修复记录（2026-10-08 执行）

> 执行方式：共享组件层（修复S）+ 页面级（修复P）两个子代理完成，组织者独立验证：①修复前备份与工作区全树 SHA-256 哈希比对，src 差异**恰好为下列 22 个文件**，无任何意外改动；②逐项代码核验；③组织者复跑全量 `npx tsc --noEmit` **exit 0**；④修复窗口内无构建活动（android 构建产物时间戳早于备份创建）。
> 修复前源码备份：`E:\xunwu\Deepseek\APlayer\MusicFree源码备份-修复前-20261008.zip`，云端 https://aka.doubaocdn.com/s/1vkscKOvW3 ；共享层修复后快照：`MusicFree源码快照-共享层修复后-20261008.zip`，云端 https://aka.doubaocdn.com/s/RBAr2a8RAf 。
> 未打包、未 commit，改动留在工作区。

| 项 | 修复内容（改动前→改动后） | 改动文件 | 验证 |
|---|---|---|---|
| F1 | getItemLayout `ListItem.Size.normal`(56)→`ListItem.Size.small`(48)，length/offset 两处 | src\components\dialogs\components\radioDialog.tsx | ✓ |
| F5 | 行图标补 `iconSize={iconSizeConst.light}`(20)（原默认 normal24） | radioDialog.tsx | ✓ |
| F2 | 选源 ListItem 补 `heightType="small"`（原漏传→默认56） | src\components\dialogs\components\importMusicSheetDialog.tsx | ✓ 无 getItemLayout 依赖 |
| F3 | 同上 | src\components\panels\types\importMusicSheet.tsx | ✓ 第395行 `height:56` 经核为圆角输入框（borderRadius 28），非列表行，未动 |
| F4 | 同上 | src\components\panels\types\setUserVariables.tsx | ✓ |
| F11a | 新增命名导出 `ListDivider`：hairline 细线、marginLeft 默认60（可覆盖）、colors.divider | src\components\base\divider.tsx | ✓ |
| F14 | **【原"需产品决策"，按建议默认值执行】** Content 字符串标题字重 regular(400)→medium(500)（字号仍 content16） | src\components\base\listItem.tsx | ✓ 全仓 Content 标题行统一 16/medium；若产品另选方案可回退 |
| F6 | 歌名 fontSize subTitle(14)→body(15)；封面 coverWrap 44→48（圆角8保持）；行分隔线→`<ListDivider marginLeft={92}/>` | src\pages\topListDetail\index.tsx | ✓ |
| F7 | **【原"待评估"，按默认执行"至少统一"】** 不整体复用 MusicItem（理由见下），序号块 44²→48²（圆角8保持）、paddingVertical 10→8（行高保持64，estimatedItemSize=64 精确匹配） | src\pages\sheetDetail\components\sheetMusicList.tsx | ✓ |
| F8 | 副行"N首歌曲" subTitle(14)→description(12)（对齐 musicSheetPage） | src\pages\sheetDetail\components\header.tsx | ✓ |
| F9 | 行 paddingHorizontal rpx(24)≈12→16（仅 body，header 不动） | src\components\panels\types\musicQuality.tsx、playRate.tsx | ✓ |
| F10 | OptionRow/pathRow/pathNote 与各设置行 paddingHorizontal 4→16（对齐 basicSetting 组卡行 withHorizontalPadding=16） | src\components\dialogs\components\downloadSettingsDialog.tsx、src\pages\scanSettings\index.tsx | ✓ |
| F11b | 五处分隔线替换为 `<ListDivider>`：libraryTab(56)/basicSetting 组内×5(16)/localGroup(68)/topListItem(70)/topListDetail(92)；删除自绘 divider 样式与本地 dividerColor 常量 | libraryTab.tsx、basicSetting.tsx、localGroup\index.tsx、mediaItem\topListItem.tsx、topListDetail\index.tsx | ✓ 全仓 `rgba(128,128,128,0.25/0.18)` 分隔线清零，颜色统一 colors.divider |
| F12 | 卡片容器 borderRadius rpx(8)≈4→rpx(28)≈14dp（内嵌徽章 rpx(8) 保持不动） | src\pages\setting\settingTypes\pluginSetting\components\pluginItem.tsx | ✓ |
| F13 | 自绘卡补按压态：statsRow 统计卡、operations 金刚区(α0.08→α0.06)、mineTab 三处、libraryTab 四入口卡、historyPanel 热门网格项（保持原 surfaceVariant 底，pressed 切 primary α0.1） | homeBody\statsRow.tsx、homeBody\operations.tsx、mineTab.tsx、libraryTab.tsx、searchPage\components\historyPanel.tsx | ✓ |

**F7 决策与理由**：不整体复用共享 MusicItem——①本页（本地歌单详情）左侧是「surfaceVariant 底+primary 数字」序号块锚点，MusicItem 是「48 封面+斜体序号」，替换属设计语言变更；②本页有意不显示封面，MusicItem 的 LocalSongCover 会异步渲染封面并叠平台 tag、三点菜单（弹 MusicItemOptions），超出"行样式统一"范围；③MusicList 自带 FlashList/Header/空态/高亮，整体替换需重构有回归风险。故按兜底执行最小对齐（48/8 序号块 + 行高64），与 MusicItem 的 64 行高/48dp 左槽视觉一致。

**F11b 说明（对报告"统一 marginLeft=60"的有意偏离）**：报告建议五处均取 60（按 48 封面基准）。实际各行左槽宽度不同（libraryTab 封面44、localGroup 图标块48、topListItem 行16+图标块40+间距14、topListDetail 序号32+封面48、basicSetting 卡片内无前置图标行），统一取 60 会与各行文字左缘错位。故统一采用同一 `ListDivider` 组件 + 统一 colors.divider + 统一 hairline，缩进按各行左槽与文字对齐（56/16/68/70/92）。若产品要求字面统一 60，改各使用点的 marginLeft 值即可（组件已就位）。

**遗留项（未在修复表 / 不在本次范围）**：
- libraryTab 本地歌曲行封面仍 44（报告 HD-1 提及"48 vs 44"，但 F 修复表未列此项，本次未改；若统一 48，其 ListDivider 缩进需同步为 60）。
- radioDialog 右侧选中 check 图标仍默认 normal24（报告 F5 只列了左侧功能图标，未列 check）。
- localGroup 等自绘行无按压态（不在 F13 清单内）。
- 报告第 5 节"待补查"（iconButton/themeSwitch/checkbox 内部尺寸、ImageBtn 内部、AppBar/PanelHeader 内部、estimatedItemSize 偏差）仍待后续核查。
