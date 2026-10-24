# UI 与适配规范（精简版）

> 本文档由 `docs/UI与适配核查记录.md`（2026-10-15 由 7 份核查记录合并，约 104KB）精简而来，**仅保留现行生效的 UI 规范**。历史核查流水（逐页 9 要素核查、P0/P1/P2 明细、HD/F 修复、C 冲突逐条处理、尺寸/横屏核查过程等）已归档至 `docs/archive/功能与代码核查记录.md`。精简时间：2026-10-25。**内容以代码为准。**

---

## 第1章 字号与图标档位

### 1.1 字号档位 `src/constants/uiConst.ts`

| 档位 | 值 | 用途 |
|---|---|---|
| tag | 10 | 角标 10sp |
| caption | 11 | 小标签/统计手机标签 |
| description | 12 | 描述/辅助 |
| normal | 13 | 列表项标题/歌单名；对话框正文独立档（见 3.4 C12） |
| subTitle | 14 | 次要文字/按钮 |
| body | 15 | 卡片文字 |
| content | 16 | 正文/区块标题；列表行标题事实标准（见 3.4 C08） |
| title | 18 | 标题 |
| large | 22 | 大数字 |
| xlarge | 32 | 平板顶栏 Tab/问候语大字号（C20） |
| appbar | 18 | AppBar 标题专用档（C01，像素与 title 同 18） |

> 全项目 0 处 fontFamily 散落，统一系统默认。

### 1.2 图标档位 `iconSizeConst`

`small 16 / light 20 / normal 24 / big 32 / large 40`——标准图标 24dp。

---

## 第2章 全局组件规范

| 组件 | 规范 |
|---|---|
| AppBar | 高度 56dp；标题 appbar(18) Bold；背景 background 色；菜单宽 280 圆角 12 |
| ListItem | 行高 big64/normal56/small48/smallest36；默认 padding 16；封面 48dp 圆角 8；副行间距 2 |
| MusicItem | 序号宽 40；本地图标 20；更多按钮宽 40；描述 12sp |
| MusicList | ITEM_HEIGHT 64；滚动角标 36dp |
| panelBase | 圆角 16；平板左 30%/右 70% 右滑入不盖 tab |
| panelHeader | 高度 56；按钮宽 72；padding 16；渐变 primary α0.14→0.04 |
| Button | 高 48 圆角 12 |
| Input | padding 16；默认字号 content(16)（C03） |
| typeTag | 12sp；选中 primary 底白字；未选中 surfaceVariant 底 |

---

## 第3章 列表行规范

### 3.1 全局基准（比对零点）

| 项 | 值 |
|---|---|
| heightType 档 | big64 / normal56(默认) / small48 / smallest36 / none |
| 左右 padding | 16（默认 left/rightPadding=16） |
| Content 字符串标题 | ThemeText 未传 fontSize→content=16（字重 medium，见 C08） |
| Content 字符串副标题 | description12 / textSecondary，marginTop 2 |
| ListItemImage 封面 | 48×48，borderRadius 8 |
| ListItemIcon 默认 | iconSize=normal24，left 时 marginRight=16 |
| 按压态 | TouchableHighlight underlayColor=colors.listActive；行无圆角/背景 |
| 分隔线 | ListItem 无内建；Divider 全宽 1dp/colors.divider |
| ListItemHeader | smallest36、subTitle14/bold/textSecondary、marginTop12 |
| fontSizeConst | tag10/caption11/description12/normal13/subTitle14/body15/content16/title18/large22（+xlarge32/appbar18） |
| iconSizeConst | small16/light20/normal24/big32/large40 |
| 三级浮窗基座 | Content paddingH24（行内 ListItem 再叠 16→文字距窗 40）；标题行 52/title18 bold；按钮行 52/subTitle14 medium |

### 3.2 各页面行规格

**共享媒体行**：歌曲行 musicItem=big64/封面48·8带 LocalSongCover/标题 body15·medium/副 description12·textSecondary(高亮 primary)/序号槽40·subTitle14 italic/三点 normal24·槽宽40；LyricItem/albumItem 同款；playlistCard=宽130/封面130·12/标题 normal13·medium/副 caption11/角标 tag10；topListItem=paddingH16·V10/图标块40·10 渐变 fire20/标题 body15·medium/副 description12/分隔线 marginLeft70 textSecondaryα0.15/按压 primaryα0.06；本地歌曲行 libraryTab=自绘封面 LocalSongCover size44·8/标题 content16·medium/副 normal13/三点20/分隔线 marginLeft56。

**一级页面**：抽屉入口行 normal56/content16·regular/图标24；歌手结果行 big64+封面48·8+body15·medium；入口卡=自绘 Pressable+渐变（minHeight84~140、标题多档、圆角16~20、多数原无按压态）；我的竖排入口行 paddingV14/body15·medium/Icon20 primary。

**二级页面**：播放队列行 playList/body=序号 subTitle14(当前 bold)/歌名 body15(当前 bold 否则 medium)/副 description12/删除 small16/radius10；最近播放 history=paddingV10·H8/首字符块44·8·title18 primary/歌名 body15·medium/副 description12/无封面无三点；本地歌单详情 sheetDetail=序号块44²·8 surfaceVariant/subTitle14 primary/歌名 body15·medium/副 description12/estimatedItemSize64；排行歌曲行 topListDetail=paddingH16·V8/封面44·8/歌名 subTitle14·medium/序号 width32·normal13/分隔线 marginLeft92；歌单管理行卡 sheetManager=padding12/标题 content16·medium/副 normal13/图标块48·10/删除20/radius14 surfaceVariant；本地分组行 localGroup=paddingV6·H16/body15·medium/副 description12/图标块48·10/Icon26/分隔线 marginLeft68；下载任务卡 downloadingList=padding12/body15·medium/副 description12/状态图标24/radius14/separator height8；接口歌单网格卡 apiSheets=封面1:1·radius12/标题 normal13·medium/副 caption11/角标22·11；统计页=总览卡 minHeight110·radius18·value large22 bold/排行行 subTitle14·medium/rankBox32·圆16。

**设置族**：basicSetting=small48/content16/组卡 radius rpx14/行间 hairline marginLeft rpx16；备份/主题/订阅源行原默认 normal56；pluginItem=paddingV rpx18/名称 title18/版本 subTitle14/容器圆角 rpx28≈14dp；scanSettings=自绘开关行 paddingH4·V6/标题 body15/Icon20/无分隔线；fileSelector fileItem=height rpx96≈48/路径 normal13/图标 light20；permissions=big64/content16。

**三级浮窗**：addToMusicSheetDialog=small48/Image48·8/content16；menuDialog=small48/图标 light20/content16；radioDialog=small48/图标 light20；importMusicSheetDialog 选源行=normal56；downloadSettingsDialog=自定义 Pressable paddingV6·paddingH4/标签 normal13/选中 check-circle light20 primary。

**面板**：musicItemOptions/musicItemLyricOptions/appBarMore=small48/light20/content16/头部封面 rpx140；simpleSelect=small48/无图标；setUserVariables/importMusicSheet=normal56；musicQuality/playRate=自定义 height rpx96≈48/paddingH rpx24≈12。

**全屏歌词**：lyricItem=居中 Text/字号 rpx24·30·36·42≈12·15·18·21/paddingH rpx64≈32/paddingV rpx14≈7/普通 opacity0.6/高亮 primary；lyricOperations=栏高 rpx56≈28/图标 normal24·textSecondary。

### 3.3 二级页面风格规范

背景色=FullOverlay=`colors.background`；顶栏 AppBar 高 56dp/标题 18 Bold/返回 arrow-left/paddingH 8（14 页直接使用）；列表行=全局 MusicList/ListItem；容器=VerticalSafeAreaView edges top/bottom。**特例**：①sheetDetail 两行顶栏；②fileSelector 顶栏 56、背景 appBar→background、路径文本 title(18) Bold。

### 3.4 已统一规则汇总（C01~C22 结果）

> 冲突处理原则（2026-10-14 用户拍板）：矛盾冲突先看同类组件多数派，少数服从多数。以下为**当前生效结果**；C17/C19 已按用户要求恢复原状。

| # | 规则 | 状态 |
|---|---|---|
| C01 | AppBar 标题用 appbar(18) 档，不用 title | ✅ 生效 |
| C02 | Checkbox 勾内图标 size=light(20) | ✅ |
| C03 | Input 内置默认字号 content(16) | ✅ |
| C04 | LinkText 链接色用 colors.primary（明 #2F6FED / 暗 #5A8FFF） | ✅ |
| C05 | Tip/Toast 用 ThemeText（Tip description12 / Toast content16） | ✅ |
| C06 | ErrorBoundary 9 处原生 Text→ThemeText | ✅ |
| C07 | 歌单卡标题 normal(13)+medium | ✅ |
| C08 | 列表行标题 content(16)+medium（TitleAndTag/topListItem/libraryTab/playList 系） | ✅ |
| C09 | 即改即生效型对话框（开关/滑块/单选）不渲染 Actions 块，内容贴底 | ✅ 规则成文 |
| C10 | 对话框底部按钮用基座 BottomButton；自布局须行高 52+subTitle(14) 起步 | ✅ 规则成文 |
| C11 | EditSheetDetailDialog 补 Dialog.Title 渐变标题条 | ✅ |
| C12 | 对话框正文=normal(13)/行高 21 独立档，不从 content(16) 派生 | ✅ 规则成文 |
| C13 | 危险操作=SimpleDialog(okText="删除" type=primary)；红底按钮仅"取消定时"即时执行型 | ✅ 规则成文 |
| C14 | PanelHeader（56dp 对角渐变无胶囊）与 Dialog.Title（52dp 水平三段渐变带胶囊）为两套规格 | ⏳ 待用户确认（倾向承认） |
| C15 | 定时关闭用居中浮窗 TimingCloseDialog，面板版下线 | ✅ |
| C16 | 字体大小设置下线面板版，用浮窗版（musicItemLyricOptions 入口） | ✅ |
| C17 | 悬浮歌词滑块：标签+滑块同行、无数值 | ✅ 恢复原状 |
| C18 | 扫描设置行标题 content(16)+medium | ✅ |
| C19 | 页面分组标题 content(16)+bold+text 黑色，与设置页不统一 | ✅ 恢复原状 |
| C20 | 平板顶栏 Tab/问候语 xlarge(32) 档 | ✅ |
| C21 | 首页入口卡标题 title(18)+bold；紧凑竖排统计卡 normal(13)+bold | ✅ |
| C22 | 头像"极"字 large(22)、插件可用率 description12、插件排序徽章 caption11；播放页 hero 大字号硬编码登记《播放页专用字号表》 | ✅ 部分统一 |

---

## 第4章 弹窗与面板视觉规范

### 4.1 三级弹窗（Level3Dialog）规范

容器圆角 20、细边框 outlineVariant α0.35/shadow；平板宽 60%/手机 86%；标题行 52dp+水平品牌渐变（primary 0.10→primaryContainer 0.07→透明）+4×20 胶囊条+淡蓝线 α0.12；正文 13sp/行高 21/onSurfaceVariant/padding 24/16；按钮行同 52dp 渐变+上分割线；BottomButton 透明文字按钮（confirm primary 14sp Medium / dismiss textSecondary）。ThirdLevelModal（subPageOverlay）圆角 20、宽 60%/86%、最大高 70%、中心定位=内容区中心不盖 tab。

### 4.2 面板（Panel）规范

PanelHeader：高度 56dp、按钮宽 72、padding 16、渐变 primary α0.14→0.04、对角渐变无胶囊。面板本体平板左 30%/右 70% 右滑入不盖 tab（top=TAB_BAR_HEIGHT 56）。panelBase 圆角 16。

> C14：PanelHeader（56dp 对角渐变无胶囊）与 Dialog.Title（52dp 水平三段渐变带胶囊）是两套**有意区分**的规格，各自内部一致，勿强行统一。

---

## 第5章 布局与尺寸原则

### 5.1 平板/横屏判断（短边法）

统一 `src/utils/tablet.ts`（非组件场景 isTabletScreen）+`src/hooks/useIsTablet.ts`（组件场景响应式），**短边法**：`min(width,height) >= 600`，另加 720p 大屏兜底（minPx≥720 且 density≤1.75 算平板）。**不要**用"宽度≥600"判断（会致手机横屏误判平板）；双端布局判断统一 `WindowSize.isTablet()`。

### 5.2 触控与文字底线

- 触控目标 ≥ **48dp**（不足补 hitSlop：switch 高 32 补上下 12、checkbox slop 14、chip 高 40 或 36+hitSlop6、musicBar 列表 Icon 40 补上下 8、tabBar 平板顶栏固定 56dp）。
- 正文 ≥ 14sp、标题 ≥ 18dp。
- 组件尺寸一律固定 dp（fontSizeConst/iconSizeConst 档位、卡片圆角 14、列表行 big64/normal56/small48/smallest36）。

### 5.3 应保留 rpx 的布局层

**保留 rpx（勿误改）**：页面/卡片外边距与间距、网格/封面比例（imageBtn 210×290、musicSheetPage/header 封面210）、弹窗宽手机 86%/平板 60%、操作按钮 flex 行/金刚区/gap/圆角/阴影、toast/errorBoundary/listEmpty/loading 等展示空态内边距、网格 gap、沉浸层光带等背景特效。

> 换算：rpx(n)=(n/750)×minWindowEdge（短边）。rpx 在车机短边 360~800dp 漂移 2.2 倍，故交互/文字尺寸固定 dp，仅按屏比例元素留 rpx。

---

## 第6章 音源安装进度弹窗与卡片标识（2026-10-23）

### 6.1 安装进度 → 三级弹窗

新增 `src/components/dialogs/components/pluginInstallProgressDialog.tsx`：标准 Dialog（Title"安装音源"/Content 三行进度/Actions"后台运行"），三行布局=行1 状态+计数、行2 进度条+百分比、行3 当前插件名；无进度数据时 Content 内转圈+"正在安装…"。`pluginList.tsx` 移除整页替换分支，FlatList 常驻，loading 时声明式渲染进度弹窗（不走命令式 showDialog 快照）。各入口进度补齐（订阅批量/手动安装/本地导入/网络安装/更新全部）。「后台运行」=收起弹窗、任务继续后台。弹窗规格自动继承 Dialog base（平板右 70% 内容区 60% 宽、全屏播放页 42%、从 tab 行 56dp 下起、手机 86%、圆角 20、elevation 909）。

### 6.2 音源卡片名字可点击

`pluginItem.tsx`：有 `userVariables`（可进设置表单）的插件名字颜色改 `colors.primary`（主题色）；无 userVariables 不可点时保持默认 text 色；与按下 opacity 0.6 反馈并存。

### 6.3 可用率标签口径

- 无统计数据的普通音源：标签**常显 "50%"**（底 textSecondary）。
- 纯歌词源（`supportedMethods` 含 `getLyric` 且不含 `search`/`getMediaSource`）：标签显示 **"歌词"**（底主题色），不显示百分比。
- 有统计数据的普通源：≥80% 绿 / 50~80% 主色 / <50% 红。

---

## 第7章 全屏播放页与沉浸层布局

- 平板左 6 右 4 分栏：左区=顶栏+标题+歌词+进度+控制，手机=顶栏+标题+封面/歌词+底部。
- 背景纯 `colors.background` 色（不用黑底+模糊封面）。
- 顶栏"正在播放"16sp Bold；平板歌名 32sp/歌手 18sp，手机歌名 19sp/13sp；进度时间 11sp。
- 手机封面 240dp 圆角 20，平板封面圆角 28。
- 平板全屏播放：`fullPlayingAtom` + FullPlayingLayer（渲染 MusicDetail，盖住左播放区+内容区+tab）；Android 返回键先关全屏层。手机端原生栈本已全屏。
- 沉浸播放区（隐藏按钮/信息的沉浸 UI）为全屏播放页内部状态，编码 0506（见第8章），非独立外部层级。

---

## 第8章 浮窗层级编码规范（2026-10-20 定稿并迁移）

### 8.1 编码规则

- **4 位数字编码**：`前两位 = 主层级`，`后两位 = 同层近似区分`。
- **主层级用间隔 4**：`01 / 05 / 09 / 13 / 17 / 21`——每段之间留 3 个空位，未来插层无需重排既有值。
- **近似区分用间隔 4**：`01 / 05 / 09 / 13`——同层内成员按数值从小到大排（低在下、高在上）。
- **数值越大越靠上**；**zIndex 与 elevation 统一使用同一编码**。
- **主层语义**：01=页面内容（最底层）→ 05=次级界面层 → 09=弹窗层 → 13=Toast（最高层）→ 17/21=预留。
- **页面内元素**（播放条 MusicBar elevation=6、FAB、页面内 zIndex 等）属 01 层内部细节，不纳入编码。
- **代码中数值写法**：JS 数字字面量不支持前导零（`0501` 会解析为八进制报 TS1121），实际 zIndex/elevation 用**去前导零的十进制**（0501→`501`、0901→`901`）；概念编码（四位写法）仅用于文档与注释可读性。
- **全屏播放页语义**：与播放区/内容区互斥替换（同档内容），但渲染上作为浮层**必须高于二级页面**（编码 0505），否则平板右 70% 二级页面会压在全屏播放页上。
- **沉浸播放区**：指全屏播放页内的沉浸 UI（隐藏按钮/信息的沉浸状态），编码 0506（0505 沉浸播放层内部高一档）。

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
| 设置页 | 主题/权限/歌词颜色/WebDAV/文件选择/插件/下载设置等 Dialog | 09 弹窗层 |
| 播放列表（队列） | Panel | 05 面板层（0509/0513） |
| 二级页面（平板） | SubPageOverlay 容器 | 05 次级界面（0501） |
| 沉浸播放（平板） | FullPlayingLayer 容器 | 05 次级界面（0505） |

### 8.4 备注

- Toast 内层卡片阴影 elevation=2 为卡片自身阴影，非层级编码，不动。
- `components/base/portal.tsx` PortalHost 为备用宿主（当前无 portal 内容），zIndex 20000 未纳入编码；启用时按宿主语义定值。
- Panel/Dialog/Toast elevation 由 1.5 万级降至 513~1301：Android 阴影在高值区饱和，观感差异预计很小（装机确认）。
