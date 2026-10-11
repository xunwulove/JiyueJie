# P2 UI 批次修复记录（分片：其余 P2 UI 批次）

修复日期：2026-10-11
基线：`npx tsc --noEmit` 0 错误
tsc 验证：EXIT 0（无错误）

---

## 逐条目修复记录

### P2-27【已证实】useIsTablet() 非响应式
- **状态**：已修复
- **改动文件**：`E:\xunwu\MusicFreeApp\MusicFree\src\hooks\useIsTablet.ts`
- **行范围**：全文件重写（原 6 行 → 28 行）
- **修复方式**：内部 `useState(isTabletScreen())` 初始值 + `Dimensions.addEventListener("change", onChange)` 订阅，effect cleanup 中 `subscription.remove()`。utils/tablet.ts 未改动（isTabletScreen 纯函数签名保持不变）。
- **验证方式**：tsc --noEmit 通过；旋转后 musicBar 显隐应自动重算（待真机验证旋转场景）。

### P2-28【已证实】ColorPicker 面板死代码
- **状态**：已修复（已删除）
- **改动文件**：
  - `E:\xunwu\MusicFreeApp\MusicFree\src\components\panels\types\index.ts`（移除 import + export）
  - `E:\xunwu\MusicFreeApp\MusicFree\src\components\panels\types\colorPicker.tsx`（**已删除文件**）
- **行范围**：index.ts L3（删 import 行）、L38-39（删 ColorPicker 导出行及注释）
- **修复方式**：grep 全项目确认 `showPanel("ColorPicker")` 0 调用、`import ColorPicker` 仅 index.ts 自身。从 index.ts 移除 import 和导出，删除 colorPicker.tsx 文件。（lyricColorDialog.tsx 仅引用 i18n key `panel.colorPicker.title`，不引用组件，不受影响。）
- **验证方式**：tsc --noEmit 通过；grep 确认无残留引用。

### P2-29【已证实】homeBodyHorizontal 死代码目录
- **状态**：已修复（已删除）
- **改动文件**：`E:\xunwu\MusicFreeApp\MusicFree\src\pages\home\components\homeBodyHorizontal\`（整个目录删除，含 index.tsx + operations.tsx）
- **修复方式**：grep `homeBodyHorizontal` 全 src 确认 0 引用，删除整个目录。
- **验证方式**：tsc --noEmit 通过；grep 确认无残留引用。

### P2-31【已证实】musicList FlashList 未传 keyExtractor
- **状态**：已修复
- **改动文件**：`E:\xunwu\MusicFreeApp\MusicFree\src\components\musicList\index.tsx`
- **行范围**：L117 后新增一行（keyExtractor）
- **修复方式**：补 `keyExtractor={(item) => `${item.platform}-${item.id}`}`。IMusic.IMusicItem 必有 platform + id 字段（types/music.d.ts:32-34），无需降级 index。
- **验证方式**：tsc --noEmit 通过；过滤/重排/分组切换时行复用应正确。

### P2-32【已证实】recommendSection 分类 Tab key 可能重复
- **状态**：已修复
- **改动文件**：`E:\xunwu\MusicFreeApp\MusicFree\src\pages\home\components\homeBody\recommendSection.tsx`
- **行范围**：L132
- **修复方式**：`key={`tag-${item.category}`}` → `key={`tag-${index}-${item.category}`}`。
- **验证方式**：tsc --noEmit 通过。

### P2-34【已证实】单顶层 ErrorBoundary + 反馈链接指上游
- **状态**：部分修复（① 已修复；② 保留原链接）
- **改动文件**：`E:\xunwu\MusicFreeApp\MusicFree\src\entry\index.tsx`
- **行范围**：L49-55（Stack.Screen map 段）
- **修复方式**：
  - ① 按屏局部 ErrorBoundary：在 routes.map 中为每个 `route.component` 包一层 `<ErrorBoundary>`，单页崩溃仅影响该页，全局 ErrorBoundary 仍作最外层兜底。
  - ② 反馈链接：查阅 readme.md / PROJECT_DECISIONS.md，本 fork「极悦界」为个人自用不分发，gitee 仓库（jiyuejie-updates / jishijie-release）仅用于更新和插件分发，无公开 issue 反馈渠道。**保留原链接 `https://github.com/maotoumao/MusicFree/issues` 不动**。
- **验证方式**：tsc --noEmit 通过；部分修复原因：无 fork 公开反馈地址。

### P2-35【已证实】useDelayFalsy setTimeout 卸载未 clearTimeout
- **状态**：已修复
- **改动文件**：`E:\xunwu\MusicFreeApp\MusicFree\src\hooks\useDelayFalsy.ts`
- **行范围**：全文件重写（加 useEffect import + cleanup）
- **修复方式**：新增 `useEffect(() => () => { timer.current && clearTimeout(timer.current); }, [])` 卸载清理。
- **验证方式**：tsc --noEmit 通过。

### P2-36（musicBar 部分）【已证实】rpx 残留
- **状态**：已修复
- **改动文件**：`E:\xunwu\MusicFreeApp\MusicFree\src\components\musicBar\index.tsx`
- **行范围**：L3（删 rpx import）、L93-94（inline style）、L134-138（StyleSheet wrapper）、L143（actionGroup width）、L149（actionIcon marginLeft）
- **修复方式**：按 375dp 设计基线 rpx→dp 换算（rpx(x) = x/750×375 = x/2）：
  - `rpx(24)` → `12`（paddingRight，inline + stylesheet 两处）
  - `rpx(12)` → `6`（marginBottom offset + marginHorizontal）
  - `rpx(16)` → `8`（shadowRadius）
  - `rpx(200)` → `100`（actionGroup width）
  - `rpx(36)` → `18`（actionIcon marginLeft）
  - 移除未再使用的 `import rpx`。
  - 注：musicInfo.tsx 的 rpx 残留由导航批次处理，本批次未动。
- **验证方式**：tsc --noEmit 通过；平板/手机尺寸不再随屏幕宽度漂移。

### P2-37【已证实】useSearchLrc.ts 调试残留
- **状态**：已修复
- **改动文件**：`E:\xunwu\MusicFreeApp\MusicFree\src\components\panels\types\searchLrc\useSearchLrc.ts`
- **行范围**：L23（删除 `console.log("SEARCH LRC", ...)`）
- **修复方式**：直接删除该行。
- **验证方式**：tsc --noEmit 通过。

### P2-38【已证实】SortableFlatList itemHeight 用 useRef 捕获
- **状态**：已修复
- **改动文件**：`E:\xunwu\MusicFreeApp\MusicFree\src\components\base\SortableFlatList.tsx`
- **行范围**：_SortableFlatListItem L348-368（useRef→useMemo）+ FakeFlatListItem L413-434（useRef→useMemo）
- **修复方式**：两处 `useRef(StyleSheet.create({...}))` 改为 `useMemo(() => StyleSheet.create({...}), [itemHeight, itemJustifyContent])`，变量名 `styleRef` → `styles`，引用处 `.current.` 去除。useMemo 已在文件顶部 import。
- **验证方式**：tsc --noEmit 通过；itemHeight prop 变化时样式正确重建。

### P2-39【可疑待验证】searchMusicList 搜索框 autoFocus 平板弹键盘
- **状态**：已修复待验证
- **改动文件**：`E:\xunwu\MusicFreeApp\MusicFree\src\pages\searchMusicList\index.tsx`
- **行范围**：L10（加 import）、L33（加 useIsTablet 调用）、L49（autoFocus 改为 `!isTablet`）
- **修复方式**：引入 `useIsTablet()`（本批次已响应式化），`autoFocus` 从恒定 `true` 改为 `autoFocus={!isTablet}`。平板/横屏不自动弹键盘。
- **验证方式**：tsc --noEmit 通过；平板二级覆盖层打开不再自动弹键盘（待真机验证）。

---

## 改动文件清单（绝对路径）

1. `E:\xunwu\MusicFreeApp\MusicFree\src\hooks\useIsTablet.ts`（重写）
2. `E:\xunwu\MusicFreeApp\MusicFree\src\components\panels\types\index.ts`（删 import + export）
3. `E:\xunwu\MusicFreeApp\MusicFree\src\components\panels\types\colorPicker.tsx`（**已删除**）
4. `E:\xunwu\MusicFreeApp\MusicFree\src\pages\home\components\homeBodyHorizontal\`（**整个目录已删除**，含 index.tsx + operations.tsx）
5. `E:\xunwu\MusicFreeApp\MusicFree\src\components\musicList\index.tsx`（加 keyExtractor）
6. `E:\xunwu\MusicFreeApp\MusicFree\src\pages\home\components\homeBody\recommendSection.tsx`（key 加 index）
7. `E:\xunwu\MusicFreeApp\MusicFree\src\entry\index.tsx`（按屏包 ErrorBoundary）
8. `E:\xunwu\MusicFreeApp\MusicFree\src\hooks\useDelayFalsy.ts`（加 cleanup）
9. `E:\xunwu\MusicFreeApp\MusicFree\src\components\musicBar\index.tsx`（rpx→dp，删 rpx import）
10. `E:\xunwu\MusicFreeApp\MusicFree\src\components\panels\types\searchLrc\useSearchLrc.ts`（删 console.log）
11. `E:\xunwu\MusicFreeApp\MusicFree\src\components\base\SortableFlatList.tsx`（useRef→useMemo ×2）
12. `E:\xunwu\MusicFreeApp\MusicFree\src\pages\searchMusicList\index.tsx`（autoFocus 条件化）

**未改动**：`E:\xunwu\MusicFreeApp\MusicFree\src\utils\tablet.ts`（isTabletScreen 纯函数签名保持不变）。

---

## tsc 结果

- 命令：`npx tsc --noEmit`
- EXIT 码：**0**
- 不属于本批次的错误文件：无（全项目 0 错误）

---

## 与报告的偏差 / 待真机验证说明

1. **P2-34 反馈链接**：部分修复。本 fork 为个人自用不分发，无公开 issue 反馈渠道，保留原上游链接不动。
2. **P2-39**：已修复待真机验证——平板/横屏打开 searchMusicList 二级覆盖层时键盘是否不再自动弹出。
3. **P2-27**：旋转/折叠屏后 musicBar 显隐是否自动重算（静态修复完成，真机旋转验证）。
4. **P2-36**：musicBar 各 dp 取值基于 375dp 设计基线换算（rpx(x)=x/2），视觉上与原手机渲染一致；平板上不再放大。真机确认视觉无异常。
5. **未动 musicInfo.tsx**：报告 P2-36 中 musicInfo.tsx 的 rpx 残留（L47/L101）由导航批次处理，本批次严格未触碰。
