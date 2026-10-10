# 尺寸类型（rpx vs 固定 dp）误用核查报告

- 项目：`E:\xunwu\MusicFreeApp\MusicFree`（React Native + TS）
- 方式：只读精读源码，未改任何 `.ts/.tsx`。行号均逐条打开实际文件核对。
- 换算口径：`rpx(x)=x/750×短边`。按手机短边 375dp 折算 ≈ x/2 dp；平板/车机短边 600~800dp 折算 ≈ 0.8~1.07×x dp。
- 参照体系（已确立，见 `src/constants/uiConst.ts`）：fontSizeConst = 10/11/12/13/14/15/16/18/22；iconSizeConst = small16/light20/normal24/big32/large40；listItem 行高 big64/normal56/small48/smallest36 + padding16。
- 优先级：P0 = 触控目标 <48dp 或文字 <14dp 直接不达标；P1 = 明显偏大/偏小但不破坏可用性；P2 = 建议性优化。

---

## 结论

1. 交互组件/触控目标/文字体系中，**共 14 个文件、43 条**"应固定 dp"却写成 `rpx()` 的改动点（P0=10 条、P1=23 条、P2=10 条），导致同一组件在手机与平板/车机间尺寸漂移近 2 倍。
2. **P0 两处**：`switch.tsx` 开关触控高度仅 ≈20dp；`checkbox.tsx` 勾选框视觉 ≈18dp、含 hitSlop 有效触控 ≈42dp。
3. **TAB_BAR_HEIGHT 重复定义且取值自相矛盾**：`dialogs/base/index.tsx:27` 与 `panels/base/panelBase.tsx:38` 各写一份 `rpx(56)`，代码注释自称"对齐 APlayer 56dp"，但 `rpx(56)` 在手机上仅 ≈28dp；平板顶栏本体 `tabBar.tsx:323` 也是 `rpx(56)`。三者应统一为同一固定常量。
4. **线索更正**：任务背景称"`musicBar/` 播放条为手机底部+平板左侧播放区共用"。实际 `musicBar/index.tsx:85` 对平板 `!isTablet` 直接隐藏 MusicBar；平板左侧播放区是独立组件 `pages/home/components/tabletPanel.tsx`，**已全部使用固定 dp**（封面200/头部56/播放钮44/滑条28），不存在 rpx 漂移。故 musicBar 问题仅影响手机（含折叠屏展开），但 rpx 取值仍应改固定 dp 以稳定。
5. **反方向（布局层该用 rpx/百分比却写死固定 dp）**：本轮扫过 `src/components` 全部交互/共享组件，未发现实质性反例；页面边距/卡片间距/网格 gap/封面 aspectRatio/弹窗 60%~86% 宽度等布局视觉层已普遍使用 rpx 或百分比，属"应保留 rpx"，不逐条枚举。

---

## 一、P0（触控/文字直接不达标）

| # | 文件 | 行号 | 现值（代码原文） | 建议值（固定 dp） | 说明 |
|---|---|---|---|---|---|
| P0-1 | src/components/base/switch.tsx | 68 | `height: rpx(40),`（container） | `height: 32,` | 开关本体高手机仅 ≈20dp，触控高度严重不足 |
| P0-1 | src/components/base/switch.tsx | 67 | `width: rpx(80),`（container） | `width: 52,` | 开关本体宽手机 ≈40dp |
| P0-1 | src/components/base/switch.tsx | 69 | `borderRadius: rpx(40),` | `borderRadius: 16,` | 随本体改胶囊 |
| P0-1 | src/components/base/switch.tsx | 73-74 | `width/height: rpx(34),`（thumb） | `width/height: 22,` | 滑块手机 ≈17dp |
| P0-1 | src/components/base/switch.tsx | 75 | `borderRadius: rpx(17),` | `borderRadius: 11,` | |
| P0-1 | src/components/base/switch.tsx | 77 | `left: rpx(3),`（thumb） | `left: 5,` | |
| P0-1 | src/components/base/switch.tsx | 19 | `const fixedWidth = rpx(40);` | `const fixedWidth = 20;` | 平移行程 = 52-22-5×2，必须与上面同步重算，否则滑块偏移错位 |
| P0-2 | src/components/base/checkbox.tsx | 58-59 | `width/height: rpx(36),`（box） | `width/height: 22,` | 勾选框手机 ≈18dp，过小 |
| P0-2 | src/components/base/checkbox.tsx | 35 | `size={rpx(34)}`（对勾 Icon） | `size={18}` | 对勾图标随屏幕放大 |
| P0-2 | src/components/base/checkbox.tsx | 14 | `const slop = rpx(24);`（hitSlop） | `const slop = 12;` | hitSlop 手机 ≈12dp，box18+slop12×2≈42dp 仍 <48dp；改 box22+slop12≈46dp（可再 slop14≈50） |

---

## 二、P1（明显偏大/偏小，应改固定 dp）

| # | 文件 | 行号 | 现值（代码原文） | 建议值（固定 dp） | 说明 |
|---|---|---|---|---|---|
| P1-1 | src/components/dialogs/components/base/index.tsx | 27 | `const TAB_BAR_HEIGHT = rpx(56);` | `const TAB_BAR_HEIGHT = 56;` | 注释自称对齐 APlayer 56dp，手机却 ≈28dp；用于平板 `top:` 偏移（L117）。与 panelBase 同名常量应合并为单一共享常量 |
| P1-1 | src/components/panels/base/panelBase.tsx | 38 | `const TAB_BAR_HEIGHT = rpx(56);` | `const TAB_BAR_HEIGHT = 56;` | 同上，L137/L259 用作 `top:` 偏移；两处重复定义，应抽公共常量 |
| P1-2 | src/pages/home/components/tabBar.tsx | 323 | `height: rpx(56),`（hContainer 平板顶栏） | `height: 56,` | 平板顶栏本体高，与 TAB_BAR_HEIGHT 同源 |
| P1-2 | src/pages/home/components/tabBar.tsx | 374-375 | `height: rpx(56), maxHeight: rpx(56),`（searchBar 输入框） | `height: 40, maxHeight: 40,` | 平板搜索输入框高手机 ≈28dp，触控偏低；改固定 40dp |
| P1-2 | src/pages/home/components/tabBar.tsx | 88 | `size={rpx(44)}`（手机底部 Tab 图标） | `size={24}`（=iconSizeConst.normal） | 底栏图标手机 ≈22dp，平板放大到 ≈35~47dp 漂移 |
| P1-3 | src/components/musicBar/index.tsx | 130 | `height: rpx(132),`（wrapper） | `height: 72,` | 播放条高度，手机 ≈66dp，折叠屏/大屏漂移 |
| P1-3 | src/components/musicBar/musicInfo.tsx | 98-99 | `width/height: rpx(96),`（封面） | `width/height: 56,` | 条内封面手机 ≈48dp |
| P1-3 | src/components/musicBar/musicInfo.tsx | 100 | `borderRadius: rpx(48),` | `borderRadius: 28,` | 圆角随封面 |
| P1-3 | src/components/musicBar/index.tsx | 111 | `size={rpx(56)}`（播放列表 Icon） | `size={40}`（=iconSizeConst.large） | 列表按钮图标手机 ≈28dp 偏小 |
| P1-3 | src/components/musicBar/index.tsx | 25-26 | `activeStrokeWidth={rpx(4)} / inActiveStrokeWidth={rpx(2)}` | `3 / 2` | 环形进度描边 |
| P1-3 | src/components/musicBar/index.tsx | 34 | `radius={rpx(36)}` | `radius: 24` | 环形半径 |
| P1-4 | src/pages/musicDetail/components/content/lyric/lyricOperations.tsx | 128 | `height: rpx(56),`（container） | `height: 48,` | 全屏歌词底部操作行（倍速/定时/音量/下载图标触控行），手机 ≈28dp 偏矮 |
| P1-5 | src/pages/musicDetail/components/content/lyric/index.tsx | 36-39 | `fontSizeMap = {0: rpx(24), 1: rpx(30), 2: rpx(36), 3: rpx(42)}` | 固定 `{0:20, 1:25, 2:30, 3:36}` | 全屏歌词字号随短边放大；对齐沉浸页"歌词25/当前行34"体系。默认 key=1 → 25dp |
| P1-5 | src/pages/musicDetail/components/content/lyric/index.tsx | 316 | `fontSizeStyle.fontSize + 10`（当前行） | 保持偏移但基数改固定后 ≈34 | 当前行 = 歌词行 +9~10，随基数改固定后对齐 34dp |
| P1-6 | src/pages/musicDetail/components/content/lyric/lyricItem.tsx | 75 | `paddingHorizontal: rpx(64),` | `paddingHorizontal: 32,` | 歌词行左右内边距手机 ≈32dp 正常，平板短边 600~800dp 时 ≈51~68dp 过大；同文件 L77 `paddingVertical: 8` 已是固定 dp（注释说明原 rpx(14) 平板过大），此行应对齐 |
| P1-7 | src/components/base/fab.tsx | 40-41 | `width/height: rpx(88),` | `width/height: 56,` | FAB 手机 ≈44dp（标准 56dp） |
| P1-7 | src/components/base/fab.tsx | 42 | `borderRadius: rpx(44),` | `borderRadius: 28,` | |
| P1-7 | src/components/base/fab.tsx | 45 | `right: rpx(36),` | `right: 24,` | 边距 |
| P1-7 | src/components/base/fab.tsx | 46 | `bottom: rpx(72),` | `bottom: 16,` | 边距（应含 safe-area，但基值固定） |
| P1-8 | src/components/base/chip.tsx | 47 | `height: rpx(56),` | `height: 36,` | 标签/筛选胶囊触控高手机 ≈28dp |
| P1-8 | src/components/base/chip.tsx | 48 | `paddingHorizontal: rpx(18),` | `paddingHorizontal: 14,` | |
| P1-8 | src/components/base/chip.tsx | 49 | `borderRadius: rpx(28),` | `borderRadius: 18,` | |
| P1-9 | src/components/base/playAllBar.tsx | 113 | `height: rpx(84),`（topWrapper） | `height: 56,` | "全部播放"行高手机 ≈42dp，对齐 listItem normal56 |

---

## 三、P2（建议性优化）

| # | 文件 | 行号 | 现值（代码原文） | 建议值（固定 dp） | 说明 |
|---|---|---|---|---|---|
| P2-1 | src/components/base/iconTextButton.tsx | 37 | `paddingHorizontal: rpx(16),` | `paddingHorizontal: 16,` | 图标+文字按钮内边距 |
| P2-1 | src/components/base/iconTextButton.tsx | 38 | `paddingVertical: rpx(8),` | `paddingVertical: 8,` | |
| P2-1 | src/components/base/iconTextButton.tsx | 41 | `marginLeft: rpx(8),`（text） | `marginLeft: 8,` | |
| P2-2 | src/pages/musicDetail/components/content/lyric/draggingTime.tsx | 25 | `paddingHorizontal: rpx(8),` | `paddingHorizontal: 8,` | 拖拽时间气泡内边距 |
| P2-2 | src/pages/musicDetail/components/content/lyric/draggingTime.tsx | 26 | `paddingVertical: rpx(6),` | `paddingVertical: 6,` | |
| P2-2 | src/pages/musicDetail/components/content/lyric/draggingTime.tsx | 27 | `borderRadius: rpx(12),` | `borderRadius: 8,` | |
| P2-3 | src/components/base/textButton.tsx | 24 | `paddingHorizontal: rpx(24),` | `paddingHorizontal: 16,` | 文字按钮（确定/取消）内边距 |
| P2-3 | src/components/base/textButton.tsx | 29 | `hitSlop = ... rpx(28)` | `hitSlop = ... 14` | 默认 hitSlop 手机 ≈14dp |
| P2-4 | src/components/panels/types/simpleInput.tsx | 114 | `padding: rpx(12),`（input） | `padding: 12,` | 输入框内边距；同类见 setUserVariables.tsx:109-110、associateLrc.tsx:114、searchLrc/index.tsx:105 |
| P2-5 | src/pages/musicDetail/components/content/lyric/index.tsx | 24 | `const ITEM_HEIGHT = rpx(92);` | `const ITEM_HEIGHT = 46;` | 拖拽指示行高/垂直居中用（L358 `(layout.height - ITEM_HEIGHT)/2`、L419 `height`）。**注意**：歌词行实际高度由 `onLayout`（handleLyricItemLayout）测量，非此常量；改固定仅影响拖拽覆盖层定位，需同步确认与歌词行视觉对齐 |

---

## 四、应保留 rpx 的布局/视觉层（不要误改）

以下经核对属"布局视觉层"，随屏幕等比放大是预期行为，**保持 rpx/百分比不动**：

- 页面/卡片外边距与间距：`musicBar/index.tsx` 的 paddingRight/marginHorizontal/marginBottom、`marginHorizontal: rpx(12)`、`borderRadius: rpx(24)`、`shadowRadius`；`musicInfo.tsx:47` paddingLeft、`:101` marginRight。
- 网格/封面比例：`imageBtn.tsx` 网格项尺寸（宽210/高290/210）、`musicSheetPage/header.tsx` 封面 210。
- 弹窗宽度：`dialogs/base/index.tsx` 手机 86% / 平板 60%（百分比，正确）。
- 操作按钮 flex 行、首页金刚区、间距 gap、圆角等视觉尺寸。
- `toast.tsx`、`errorBoundary/index.tsx`、`listEmpty.tsx`、`loading.tsx` 等展示/空态/异常页的内边距与尺寸（非触控目标）。

---

## 五、反方向（固定 dp 应改 rpx/百分比）

本轮扫过 `src/components` 全部交互与共享组件，**未发现实质性反方向问题**：布局层（页面边距、卡片间距、网格 gap、弹窗宽度比例）已普遍使用 rpx 或百分比；被团队主动改固定 dp 的地方（如 `lyricItem.tsx:77` paddingVertical:8、`tabletPanel.tsx` 全量固定 dp）均有注释说明是"原 rpx 平板过大"的刻意收敛，方向正确。

---

## 六、改动联动注意

1. **switch.tsx**：`fixedWidth`（L19）是滑块平移行程，= 容器宽 − 滑块宽 − left×2。改固定 dp 后必须重算为 `52-22-5×2=20`，否则滑块停位错位。
2. **TAB_BAR_HEIGHT**：两处重复定义（dialogs/base L27、panels/base L38）+ 平板顶栏本体（tabBar.tsx L323）应抽成同一共享常量并取固定 56dp，避免日后三处再漂移。
3. **全屏歌词**：`fontSizeMap` 改固定 dp 后，L316 当前行 `+10` 偏移、`ITEM_HEIGHT`（L24）与拖拽覆盖层 `top` 居中（L358）需一并回归验证滚动/拖拽定位。
4. **musicBar**：仅手机渲染（平板隐藏），改固定 dp 主要收益是折叠屏展开与大屏手机尺寸稳定；勿误改其布局类 rpx（见第四节）。
