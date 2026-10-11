# 首次启动引导页（Onboarding）设计方案（已实施）

> 状态：**已实施**（2026-10-12，代码完成 + tsc 通过，待打包装机验证）。
> 依据：Android 场景化权限申请惯例 + 同类软件（MusicFree/洛雪/网易云/QQ 音乐）引导做法核查结论。

## 目标

全新安装后首次启动，主界面出现前展示全屏引导页；完成后持久化标记 `app.onboardingDone`，之后不再出现。跳过则不写完成标记，下次启动仍会提示（引导页全程可跳过）。

## 触发与衔接

- 触发：首次启动，主界面渲染前检查 `app.onboardingDone` 未设置 → 展示引导页。
- 完成：写 `app.onboardingDone = true`，同时兼容处理旧的 `app.skipBootstrapStorageDialog`（引导完成后不再弹现有"存储权限"对话框）。
- 设置页"权限管理"入口保留，可随时补开权限。

## 结构：3 屏，左右滑动，底部进度点 + 主按钮，左上角常驻"跳过"

### 第 1 屏 · 欢迎（品牌页）
- 品牌图 + "极悦界" 大字
- 标语：本地优先 · 多音源聚合 · 数据都在本机
- 一句话价值说明：导入音乐源、搜索全网歌曲、下载到本地
- 按钮：下一步

### 第 2 屏 · 权限（精简为 2 项，符合 Android 场景化申请惯例）

| 权限 | 用途说明 | 交互 |
|---|---|---|
| 文件访问 | 扫描设备上的本地音乐，并把下载的歌曲保存到本地 | 点击 → 跳系统设置开启 → 返回自动检测，状态实时刷新为绿色对勾 |
| 通知（Android 13+） | 下载完成、后台播放时提醒 | 点击 → 系统弹窗授权 |

- **不列入引导页**：安装应用（到"软件内更新"时再引导）、悬浮窗（设置页权限管理里保留，悬浮歌词功能可选用）
- 理由：引导页权限列得越多，用户越可能全拒或整体跳过（同类 App 均为"用到时再申请"）

### 第 3 屏 · 音源就绪 + 快速上手（替代"偏好设置"——新用户无偏好基础，选音质/下载位置无感知价值）
- 说明卡片："已内置常用音源，搜索/听歌/下载即刻可用"，展示当前已启用音源数量
- 一个开关：**"扫描本地音乐"**（默认开，引导结束自动扫描，避免音乐库空态）
- 不引导用户选择默认音质/下载位置（保留默认，可在设置页修改）

### 结束
- "开始使用" → 进入主界面
- 若用户跳过扫描且本地音乐库为空：音乐库空态显示"去扫描"引导按钮

## 复用现有能力
- 权限状态检测/返回自动刷新逻辑：复用 `PermissionSettingDialog`（permissionSettingDialog.tsx）的 `NativeUtils.checkStoragePermission` / `LyricUtil.checkSystemAlertPermission` + AppState 监听机制
- 音源启用数量：`usePlugins()` + `pluginManager.isPluginEnabled`

## 待实施清单（已全部完成，2026-10-12）
1. ✅ 新增引导页组件 `src\entry\onboarding\Onboarding.tsx`（全屏，手机/平板统一规范：渐变底、品牌装饰圆、三屏轮播）
2. ✅ `bootstrap.ts`：首启检查 `app.onboardingDone`，接入引导页；引导页接管权限说明，仅引导完成后权限仍缺才弹 CheckStorage
3. ✅ `persistStatus.ts`：新增 `app.onboardingDone: boolean`
4. ✅ 第 3 屏"扫描本地音乐"开关（默认开）→ 引导结束触发 `importLocal(defaultScanFolders())` 自动扫描
5. ✅ 本地音乐库空态"去扫描"按钮（`localMusicList.tsx`：图标 + 说明 + 去扫描 → 文件选择器选目录扫描）
6. ✅ 入口挂载：`entry/index.tsx` BrandSplash 之后 `<Onboarding />`（bootstrap Done 后 450ms 接管，跳过不写标记下次仍提示）
