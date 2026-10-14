# 真实克隆核验：Retro Music 启动图实现

> 核验日期：2026-10-14
> 核验方式：`git clone --depth 1` 到本地后逐文件阅读源码，所有结论以本地文件为准。
> 上一轮网页调研见 `docs/research/01-开源音乐App启动图源码.md`，本轮为其纠错与深化。

---

## 1. 项目信息

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/RetroMusicPlayer/RetroMusicPlayer |
| 本地路径 | `E:\Temp\Deepseek\opensource-splash\RetroMusicPlayer` |
| Commit | `a7d4d05b548ac1eec4ec8f28cecb45621cf4bf2c` |
| Commit 日期 | 2026-09-29 07:26:13 +0200 |
| Commit 说明 | "Fix .opus files being excluded from folder browsing and media scan (#2039)" |
| versionName | 7.0.3（versionCode 10703） |
| compileSdk | **36**（`app/build.gradle.kts:12`） |
| minSdk | 24（`app/build.gradle.kts:16`） |
| targetSdk | **36**（`app/build.gradle.kts:17`） |
| 关键依赖 | `androidx.core:core-splashscreen:1.0.1`（`gradle/libs.versions.toml:8,120`；`app/build.gradle.kts:132`） |

> **与上一轮网页调研的根本分歧**：上一轮记录 `compileSdk/targetSdk = 29`、"没有 values-v31"、"没有 windowSplashScreen*"。本地 HEAD（2026-09-29）显示该项目早已升级到 targetSdk 36 并接入了 AndroidX `core-splashscreen`。上一轮网页抓取的是更早的快照或缓存旧版文件，**本地结论推翻旧结论**。

---

## 2. 关键证据清单（路径 + 摘录 + 行号）

### 2.1 AndroidManifest.xml —— 启动 Activity 挂的主题

路径：`E:\Temp\Deepseek\opensource-splash\RetroMusicPlayer\app\src\main\AndroidManifest.xml`

应用级主题（第 49 行）：
```xml
<application
    ...
    android:theme="@style/Theme.RetroMusic.FollowSystem"
    ...>
```

启动 Activity（第 65–77 行）：
```xml
<activity
    android:name=".activities.MainActivity"
    android:exported="true"
    android:launchMode="singleTop"
    android:theme="@style/Theme.RetroMusic.SplashScreen">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
        ...
    </intent-filter>
</activity>
```

要点：启动 Activity 单独挂 `Theme.RetroMusic.SplashScreen`（不是上一轮记的 `SplashTheme`，名字已改）；应用默认主题是 `Theme.RetroMusic.FollowSystem`。

### 2.2 values/styles.xml —— API < 31 走的旧启动主题

路径：`app\src\main\res\values\styles.xml`，第 122–125 行：
```xml
<style name="Theme.RetroMusic.SplashScreen" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:windowBackground">@drawable/splash</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
</style>
```

正式主题 `Theme.RetroMusic.FollowSystem`（同文件第 9–11 行）：
```xml
<style name="Theme.RetroMusic.FollowSystem" parent="Theme.RetroMusic.Base.Adaptive">
    <item name="android:windowBackground">?colorSurface</item>
</style>
```

基础主题 `styles_parents.xml`（`app\src\main\res\values\styles_parents.xml`）第 4、19、35、51 行可见：所有正式主题（Base / Base.Black / Base.Light / Base.Adaptive）的 `windowBackground` 都是 `?colorSurface`，不是纯色字面量，也不是 layer-list。

### 2.3 values-v31/styles.xml —— API 31+ 走的系统 Splash 主题（本轮新发现）

路径：`app\src\main\res\values-v31\styles.xml`，第 21–24 行：
```xml
<style name="Theme.RetroMusic.SplashScreen" parent="Theme.SplashScreen">
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/avd_splash</item>
    <item name="android:windowSplashScreenAnimationDuration">1000</item>
</style>
```

逐项核对 `windowSplashScreen*`：

| 属性 | 是否设置 | 值 |
|---|---|---|
| `windowSplashScreenBackground` | **未设置**（继承 `Theme.SplashScreen` 默认） | — |
| `windowSplashScreenAnimatedIcon` | 已设置 | `@drawable/avd_splash` |
| `windowSplashScreenAnimationDuration` | 已设置 | `1000` |
| `windowSplashScreenIconBackgroundColor` | 未设置 | — |
| `windowSplashScreenBrandingImage` | 未设置 | — |
| `postSplashScreenTheme` | 未设置 | — |
| `windowSplashScreenShortTimeout` | 未设置 | — |

`values-v31/colors.xml` 仅定义 `widget_md3_button_bg_color`，没有任何 splash 专用颜色；`values-night-v31/styles.xml` 也**没有**覆盖 `Theme.RetroMusic.SplashScreen`（只覆盖了 MD3.Black 与 AppWidget）。`values-night/styles.xml` 同样未覆盖启动主题。

全仓 grep `installSplashScreen` / `windowSplashScreenBackground` / `postSplashScreenTheme`：**0 处命中**（见第 4 节机制分析）。

### 2.4 drawable/splash.xml —— 旧版 windowBackground 图层

路径：`app\src\main\res\drawable\splash.xml`，第 15–25 行：
```xml
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="?attr/colorPrimary" />
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/ic_splash" />
    </item>
</layer-list>
```

两层：
- 第 1 层：`?attr/colorPrimary` 纯色满屏（随亮/暗主题与 MaterialYou 取色变化）。
- 第 2 层：`<bitmap android:gravity="center" android:src="@drawable/ic_splash"/>`，Logo 按原始尺寸居中，不拉伸。

### 2.5 ic_splash 位图资源

全仓搜索 `ic_splash*` 只命中一个文件：
```
app\src\main\res\drawable-xxxhdpi\ic_splash.png   12202 字节
```
用 System.Drawing 读取尺寸：**512 × 512 px**。

要点：
- 是 PNG 位图，不是 vector（与上一轮判断一致）。
- **只出现在 `drawable-xxxhdpi/` 一个密度桶里**，其它 dpi 桶没有图，也没有 `drawable-nodpi/`。系统在更低密度设备上会自动按比例缩小它。
- 512×512 的正方形 Logo，配合 `gravity="center"`，在 1080×2340 的全屏上只占中间一小块（约 22% 宽度），四周全是 `?attr/colorPrimary` 纯色——**不是全屏整图**。

### 2.6 drawable/avd_splash.xml —— Android 12+ 系统 Splash 动画图标

路径：`app\src\main\res\drawable\avd_splash.xml`，169 行。结构：
- 根节点 `<animated-vector>`，内嵌一个 411dp × 411dp 的 `<vector>`（viewport 411×411）。
- 矢量内容：一个深色三角背景（`fillColor="#0d0754"`）+ 薄荷绿半圆块（`#00f8bc`）+ 白色波纹 path（`path_1/2/3`，`fillAlpha` 0.045–0.07）。
- 动画：`group_1` 做 `translateX` 从 -130 → 0（400ms，decelerate）；`path_5` / `path_7` 做 `pathData` 变形 + `fillAlpha` 渐显；`path_1/2/3` 做 path morph。总时长由主题里的 `windowSplashScreenAnimationDuration = 1000` 控制。

这是一个**纯矢量、可动画的品牌 Logo**，被系统塞进 240dp 图标框里播放——不是全屏图。

### 2.7 运行时主题切换（setTheme 路径）

`MainActivity.kt:41`：`class MainActivity : AbsCastActivity()`。
继承链（本地 grep 确认）：
```
MainActivity
  → AbsCastActivity (未在 base 目录列出，向上同包)
  → AbsSlidingMusicPanelActivity : AbsMusicServiceActivity
  → AbsMusicServiceActivity : AbsBaseActivity
  → AbsBaseActivity : AbsThemeActivity
```

`AbsThemeActivity.kt` 第 46–69 行：
```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    updateLocale()
    updateTheme()          // ← 关键：在 super.onCreate() 之前
    hideStatusBar()
    super.onCreate(savedInstanceState)
    ...
}

private fun updateTheme() {
    setTheme(getThemeResValue())   // 第 62 行
    if (PreferenceUtil.materialYou) { setDefaultNightMode(getNightMode()) }
    if (PreferenceUtil.isCustomFont) { setTheme(R.style.FontThemeOverlay) }
}
```

`util/theme/ThemeManager.kt` 第 12–23 行 `getThemeResValue()`：
```kotlin
fun Context.getThemeResValue(): Int =
    if (PreferenceUtil.materialYou) {
        if (generalThemeValue == BLACK) R.style.Theme_RetroMusic_MD3_Black
        else R.style.Theme_RetroMusic_MD3
    } else {
        when (generalThemeValue) {
            LIGHT -> R.style.Theme_RetroMusic_Light
            DARK  -> R.style.Theme_RetroMusic_Base
            BLACK -> R.style.Theme_RetroMusic_Black
            AUTO  -> R.style.Theme_RetroMusic_FollowSystem
        }
    }
```

要点：MainActivity 一进 `onCreate` 立刻 `setTheme(真主题)`，**没有**调用 `installSplashScreen()`，**没有**在代码里主动控制 Splash 隐藏时机。

---

## 3. 系统 Splash ↔ windowBackground 衔接机制

### 3.1 API < 31（旧设备）

1. 系统没有"应用启动窗口"概念。用户点击 Launcher 图标后，看到的第一帧就是 Activity 的 `windowBackground`。
2. Manifest 给 MainActivity 挂的是 `Theme.RetroMusic.SplashScreen`（`values/styles.xml` 版），其 `windowBackground = @drawable/splash` = layer-list：`?attr/colorPrimary` 满屏 + 居中 512×512 PNG Logo。
3. 这一帧在 `onCreate` 执行前就由系统画出来了——所以**不存在"系统白底/灰底"的中间帧**。
4. `onCreate` 里 `updateTheme()` 立刻 `setTheme(getThemeResValue())`，把窗口主题切到 `FollowSystem` / `MD3` / `Light` / `Black` / `Base` 之一；这些主题的 `windowBackground = ?colorSurface`。
5. 用户感知：品牌色满屏 + 居中 Logo → 瞬间切成 surface 色背景 + App 内容。Logo 消失，但**从未出现过系统默认的白色/灰色**。

### 3.2 API ≥ 31（新设备，Android 12+）

1. 因为 `targetSdk = 36 ≥ 31`，系统强制启用系统 Splash。系统读 Manifest 主题 `Theme.RetroMusic.SplashScreen`，在 API 31+ 它解析为 `values-v31/styles.xml` 里那个 `parent="Theme.SplashScreen"` 的版本。
2. 系统画 Splash：
   - 图标 = `windowSplashScreenAnimatedIcon = @drawable/avd_splash`（品牌矢量 Logo，播 1000ms 入场动画）。
   - 背景 = **代码里没显式设**，继承自 AndroidX `Theme.SplashScreen`（core-splashscreen 1.0.1）的默认值，即主题的 `colorBackground` 系；`values-v31/colors.xml` 也没有 splash 专用色覆盖。
   - 没有圆形图标底色（`windowSplashScreenIconBackgroundColor` 未设），没有底部 branding 图。
3. `MainActivity.onCreate` 立即 `setTheme(真主题)`，`windowBackground = ?colorSurface`。
4. 系统 Splash 检测到窗口第一帧已绘制，自动退场（没有 `installSplashScreen()`，也没有 `setKeepOnScreenCondition`，不存在"卡 Splash 等数据"的逻辑）。
5. 用户感知：系统 Splash（近白/近 surface 的背景 + 品牌 Logo 动画）→ App 内容（`?colorSurface` 背景）。两段背景都在 Material3 的"表面色系"里，色差极小；图标始终是品牌 Logo，**没有"系统默认灰底 + 系统 launcher 图标"的那种陌生感**。

---

## 4. "为何看不出系统纯色 Splash" —— 逐条代码依据

1. **旧版（<31）根本没有系统 Splash 这一帧**。第一帧就是 `windowBackground = splash.xml`（`values/styles.xml:123`），而 splash.xml 第 1 层直接用 `?attr/colorPrimary`（`drawable/splash.xml:17`）满屏铺品牌色。所以用户第一眼看到的不是系统默认窗口背景色，而是品牌色。
2. **新版（≥31）系统 Splash 的图标是自制品牌动画矢量**（`values-v31/styles.xml:22` → `avd_splash.xml`），不是系统拿 launcher 图标自动裁出来的那张；动画也是品牌专属的 path morph（`avd_splash.xml` 多个 `<target>`）。
3. **新版系统 Splash 背景没有被设成突兀的纯色**：`windowSplashScreenBackground` 未显式赋值，沿用主题 `colorBackground`；而真主题落地后 `windowBackground = ?colorSurface`（`values/styles.xml:10`、`styles_parents.xml:27/41/55`）。`colorBackground` 与 `colorSurface` 在 Material3 同色系，肉眼几乎无跳变。
4. **启动 Activity 在 `onCreate` 第一行就 `setTheme(真主题)`**（`AbsThemeActivity.kt:62`，发生在 `super.onCreate()` 之前），把"启动主题"的停留时间压到最短，用户几乎感受不到主题切换。
5. **状态栏全程透明**（`values/styles.xml:124`：`android:statusBarColor=@android:color/transparent`），启动期间不会出现一条突兀的系统色条。
6. **没有使用** `windowSplashScreenBrandingImage` / `windowSplashScreenIconBackgroundColor` / `postSplashScreenTheme` / `installSplashScreen()` / `setKeepOnScreenCondition` —— 项目刻意保持最简配置，不引入额外的"系统 Splash 装饰层"。

> 注意：Retro Music 并没有把"整图"塞进 `windowBackground`，也没有让 `windowSplashScreenBackground` 等于品牌色。它的"无缝"来自：**旧版直接用 windowBackground 画品牌色满屏 + 居中 Logo**；**新版让系统 Splash 背景走 Material3 表面色系 + 品牌矢量图标**。两条路径都避开了"系统默认白底/灰底 + 系统图标"这一最容易露馅的组合。

---

## 5. 评级

**Retro Music 属「纯色底 + 居中 Logo」型，不是「全图自制」，也不是「纯系统默认」。**

细分（双轨）：

| 轨 | 适用 API | 背景 | Logo | 载体 |
|---|---|---|---|---|
| 旧轨 | < 31 | `?attr/colorPrimary` 纯色满屏 | 512×512 PNG，居中不拉伸 | `windowBackground` layer-list |
| 新轨 | ≥ 31 | 系统 Splash 默认（继承 colorBackground 系） | `avd_splash` 矢量动画，1000ms | AndroidX `Theme.SplashScreen` |

不是"全图自制"的硬证据：
- `ic_splash.png` 只有 512×512，且 `bitmap` 用 `gravity="center"`（`splash.xml:21`），不铺满屏幕。
- `windowSplashScreenBackground` 未设品牌色，`windowSplashScreenBrandingImage` 未使用。
- 没有任何全屏背景图 drawable。

不是"纯系统默认"的硬证据：
- 显式定义了 `Theme.RetroMusic.SplashScreen`（两套）。
- 显式指定了 `windowBackground=@drawable/splash` 与 `windowSplashScreenAnimatedIcon=@drawable/avd_splash`。
- 显式设置了透明状态栏。

---

## 6. 与上一轮网页结论（01-开源音乐App启动图源码.md）的差异

| 项 | 上一轮网页结论 | 本地核验（commit a7d4d05b, 2026-09-29） | 差异 |
|---|---|---|---|
| compileSdk / targetSdk | 29 | **36 / 36** | 旧结论过时，项目已大幅升级 |
| values-v31/styles.xml | "不存在" | **存在**，且覆盖 `Theme.RetroMusic.SplashScreen` | 旧结论错误 |
| `windowSplashScreen*` 属性 | "无" | 有 `AnimatedIcon=avd_splash`、`AnimationDuration=1000`；`Background`/`BrandingImage`/`IconBackgroundColor`/`postSplashScreenTheme` 均未设 | 旧结论错误 |
| 启动主题名 | `SplashTheme` | `Theme.RetroMusic.SplashScreen` | 重命名 |
| core-splashscreen 依赖 | 未提及 | `androidx.core:core-splashscreen:1.0.1` | 旧结论遗漏 |
| splash.xml 结构 | 两层 layer-list | 仍是两层（`?attr/colorPrimary` + 居中 bitmap） | **一致** |
| ic_splash | PNG，未给尺寸 | PNG，**512×512**，仅 `drawable-xxxhdpi/` | 旧结论方向对，本轮补全尺寸与密度桶 |
| setTheme 切主题 | "MainActivity 自己 setTheme" | `AbsThemeActivity.onCreate()→updateTheme()→setTheme(getThemeResValue())`，在 `super.onCreate()` 前 | 机制一致，位置更精确 |
| 启动后正式主题 windowBackground | 未展开 | 全部为 `?colorSurface`（FollowSystem / Base / Black / Light / MD3 统一） | 本轮补全 |
| 整体评级 | "纯色底 + 居中 Logo" | "纯色底 + 居中 Logo"（双轨） | 评级一致，但机制描述需更新为"旧 layer-list + 新系统 Splash 双轨" |

**结论**：上一轮的"评级"方向（不是全图自制）仍然成立，但"targetSdk 29、没有 values-v31、没有 windowSplashScreen*、跑不到 Android 12 Splash API"这一关键判断已被本地源码推翻——Retro Music 现在是**标准的 AndroidX core-splashscreen 接入范例**（虽然配置极简：只给了动画图标，没给底色、没给 postSplashScreenTheme、没调 installSplashScreen）。

---

## 7. 对极悦界（MusicFree RN fork）的可借鉴点（基于本轮本地事实）

1. Retro Music 的"无缝"不是靠全屏整图，而是靠**"背景与 App 第一帧同色系"**：旧版直接用 windowBackground 画品牌色满屏，新版让系统 Splash 背景落进 Material3 表面色系。极悦界若要"看不出系统纯色 splash"，核心不是塞一张大图，而是**让系统 Splash 背景色 ≈ App 落地后的 windowBackground 色**。
2. Retro Music 新版**没有显式设 `windowSplashScreenBackground`**——它赌的是 `Theme.SplashScreen` 默认色与 `colorSurface` 接近。极悦界若品牌色与 surface 差异大，应**显式**把 `windowSplashScreenBackground` 设成与 `postSplashScreenTheme` 的 `windowBackground` 同一个 color resource（Signal / Nextcloud 做法），而不是赌默认值。
3. Retro Music 用矢量动画图标（`avd_splash.xml`，411dp），不是 576×576 PNG。极悦界 `windowSplashScreenAnimatedIcon` 也应优先 vector/animated-vector。
4. Retro Music **没有用** `windowSplashScreenBrandingImage`，与 Google 官方"不推荐"一致；MusicFree 上游模板自带的 branding PNG 可以删。
5. Retro Music **没有调用** `installSplashScreen()` / `setKeepOnScreenCondition()`，意味着它没有"等数据加载完再隐藏 Splash"的需求。极悦界如果 RN 侧首屏数据加载慢，反而需要这个 API 来避免"Splash 一闪就进空白页"。
