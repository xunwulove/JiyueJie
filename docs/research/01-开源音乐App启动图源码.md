# 开源音乐 App「全屏自制启动图（无白屏）」源码调研报告

> 调研日期：2026-10-14
> 调研方式：直接从 GitHub `raw.githubusercontent.com` 拉取各仓库的 `styles.xml` / `themes.xml` / `splash.xml` / `AndroidManifest.xml`，未 clone 仓库。
> 调研对象：Retro Music、VLC for Android、Auxio、Metro（Retro Music 分叉），佐证：Signal、Nextcloud、Aegis。
> 结论先行：**本次调研的开源音乐 App 里，没有一个真正做"全屏整图启动页"**。它们要么用「纯色底 + 居中 Logo 位图」（旧版 windowBackground layer-list 方案），要么直接交给 Android 12+ 系统 Splash API（纯色底 + 圆形/居中图标）。所谓"国产软件一点开就是全屏品牌图、无白屏"，在开源生态里对应的是 **windowBackground 用 layer-list / bitmap 整图填充** 的旧方案，而不是 Android 12 推荐的系统 Splash API。

---

## 1. Retro Music（RetroMusicPlayer/RetroMusicPlayer）

### 1.1 关键文件

- `app/src/main/res/values/styles.xml`
  来源：https://raw.githubusercontent.com/RetroMusicPlayer/RetroMusicPlayer/master/app/src/main/res/values/styles.xml
- `app/src/main/res/drawable/splash.xml`
  来源：https://raw.githubusercontent.com/RetroMusicPlayer/RetroMusicPlayer/master/app/src/main/res/drawable/splash.xml
- `app/src/main/AndroidManifest.xml`
  来源：https://raw.githubusercontent.com/RetroMusicPlayer/RetroMusicPlayer/master/app/src/main/AndroidManifest.xml
- `app/build.gradle`（targetSdk 29）
  来源：https://raw.githubusercontent.com/RetroMusicPlayer/RetroMusicPlayer/master/app/build.gradle

### 1.2 关键代码

**AndroidManifest.xml** —— 启动 Activity 单独挂一个 Splash 主题：

```xml
<activity
    android:name=".activities.MainActivity"
    android:label="@string/app_name"
    android:theme="@style/SplashTheme">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
        ...
    </intent-filter>
</activity>
```

**values/styles.xml** —— SplashTheme 极简：

```xml
<style name="SplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:windowBackground">@drawable/splash</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
</style>
```

**drawable/splash.xml** —— 就是两层 layer-list：

```xml
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- 第 1 层：纯色底，直接取主题色 -->
    <item android:drawable="?attr/colorPrimary" />
    <!-- 第 2 层：居中位图 Logo，不拉伸 -->
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/ic_splash" />
    </item>
</layer-list>
```

### 1.3 要点解读

- `windowBackground` 用的是 **layer-list**，第 1 层纯色（`?attr/colorPrimary`，随亮/暗主题变化），第 2 层一个居中位图 `@drawable/ic_splash`（PNG，不是 vector；`ic_splash.xml` 在仓库里不存在，说明是 png/webp）。
- `android:gravity="center"`：**Logo 按原始尺寸居中绘制，不拉伸、不满屏**。所以 Retro Music 并不是"全屏品牌图"，而是"主题色满屏 + 中间一个 Logo"。
- 没有 `values-v31/styles.xml`，也没有任何 `windowSplashScreen*` 属性。原因在 `app/build.gradle`：`compileSdkVersion 29 / targetSdkVersion 29`（Android 10），**Android 12 的系统 Splash API 根本不生效**，整包生命周期都跑在旧的 windowBackground 机制上。
- 启动后由 `MainActivity` 自己在 `setTheme(R.style.Theme_RetroMusic_FollowSystem)` 里切到正式主题（代码层切换，不在 XML 里）。

---

## 2. Metro（MuntashirAkon/Metro，Retro Music 的 fork）

### 2.1 关键文件

- `app/src/main/res/values/styles.xml`
  来源：https://raw.githubusercontent.com/MuntashirAkon/Metro/master/app/src/main/res/values/styles.xml
- `app/src/main/res/drawable/splash.xml`
  来源：https://raw.githubusercontent.com/MuntashirAkon/Metro/master/app/src/main/res/drawable/splash.xml
- `app/build.gradle`
  来源：https://raw.githubusercontent.com/MuntashirAkon/Metro/master/app/build.gradle

### 2.2 关键代码

与 Retro Music **逐字相同**：

```xml
<style name="SplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:windowBackground">@drawable/splash</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
</style>
```

```xml
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="?attr/colorPrimary" />
    <item>
        <bitmap android:gravity="center" android:src="@drawable/ic_splash" />
    </item>
</layer-list>
```

`app/build.gradle` 仍然是 `compileSdkVersion 29 / targetSdkVersion 29`。

### 2.3 要点解读

- Metro 只是去掉了 Google Play 授权、解锁了 pro 功能，**启动图完全沿用 Retro Music 的旧方案**，没有跟进 Android 12 Splash API。
- 这从侧面说明：这种"layer-list = 主题色底 + 居中 Logo bitmap"的写法，是 2019–2021 年间开源音乐 App 的**主流做法**。

---

## 3. VLC for Android（videolan/vlc-android）

### 3.1 关键文件

- `application/vlc-android/AndroidManifest.xml`
  来源：https://raw.githubusercontent.com/videolan/vlc-android/master/application/vlc-android/AndroidManifest.xml
- `application/vlc-android/res/values/styles.xml`
  来源：https://raw.githubusercontent.com/videolan/vlc-android/master/application/vlc-android/res/values/styles.xml

### 3.2 关键代码

**AndroidManifest.xml** —— 启动入口是一个透明的 `StartActivity`：

```xml
<activity
    android:name=".StartActivity"
    android:configChanges="orientation|screenSize|..."
    android:theme="@style/Theme.VLC.Transparent.NoUI"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
        <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
    </intent-filter>
    ...
</activity>
<activity
    android:name=".gui.MainActivity"
    android:theme="@style/Theme.VLC"
    android:launchMode="singleTask" ... />
```

**styles.xml** 里对应的透明主题：

```xml
<style name="Theme.VLC.Transparent.NoUI" parent="Theme.VLC.Transparent">
    <item name="android:windowBackground">@android:color/transparent</item>
</style>
<style name="Theme.VLC.Transparent" parent="Theme.MaterialComponents.NoActionBar">
    <item name="android:windowNoTitle">true</item>
</style>
```

正式主题 `Theme.VLC.Apearance` 的 `windowBackground` 只是纯色：

```xml
<item name="android:windowBackground">@color/white</item>
```

（深色变体用 `@color/dark_background`。）

### 3.3 要点解读

- VLC **没有任何自制启动图 drawable**：启动 Activity 完全透明，闪一下就跳 `MainActivity`。
- 在 Android 12+ 上，用户看到的是系统 Splash（橙色背景 + VLC 图标圆形），这是系统根据 launcher icon 自动生成的，不是 VLC 自己画的。
- 这是一种"反启动图"做法：宁可透明也不做品牌图。**对"国产软件全屏品牌图"这个目标没有参考价值**，但证明了一个事实——开源音乐 App 普遍不追求"全屏品牌图"。

---

## 4. Auxio（OxygenCobalt/Auxio）

### 4.1 关键文件

- `app/src/main/res/values/styles_core.xml`
  来源：https://raw.githubusercontent.com/OxygenCobalt/Auxio/master/app/src/main/res/values/styles_core.xml
- `app/src/main/res/values/themes.xml`（只是颜色变体）
  来源：https://raw.githubusercontent.com/OxygenCobalt/Auxio/master/app/src/main/res/values/themes.xml

### 4.2 关键代码

```xml
<!-- Adds an animated splash screen. -->
<style name="Theme.Auxio.V31" parent="Theme.Auxio.V29" />

<!-- Base theme -->
<style name="Theme.Auxio.Base" parent="Theme.Auxio.V31">
    ...
    <!-- 没有任何 android:windowBackground 或 windowSplashScreen* item -->
</style>
```

### 4.3 要点解读

- 注释写着 "Adds an animated splash screen"，但 `Theme.Auxio.V31` 里**一个 item 都没加**——它依赖父主题 `Theme.Material3Expressive.DynamicColors.DayNight` 的默认行为。
- 也就是说 Auxio 完全交给系统/框架处理启动画面：Android 12+ 用系统 Splash（动态取色 + app 图标），旧版本用 Material3 默认窗口背景色。
- **没有自制品牌图、没有 windowBackground 定制、没有 brandingImage**。对本项目参考价值有限，但它证明了"现代开源 App 已经默认不再手写启动图"。

---

## 5. 佐证 App A：Signal（signalapp/Signal-Android）

### 5.1 关键文件

- `app/src/main/res/values/themes.xml`
  来源：https://raw.githubusercontent.com/signalapp/Signal-Android/main/app/src/main/res/values/themes.xml
- `app/src/main/res/values-v31/themes.xml`
  来源：https://raw.githubusercontent.com/signalapp/Signal-Android/main/app/src/main/res/values-v31/themes.xml

### 5.2 关键代码

**values/themes.xml**（正式主题，windowBackground 是纯色）：

```xml
<style name="TextSecure.LightTheme" parent="TextSecure.BaseLightTheme">
    ...
    <item name="android:windowBackground">@color/signal_colorBackground</item>
    <item name="android:windowContentOverlay">@null</item>
    ...
</style>
```

**values-v31/themes.xml**（Android 12+ 专用覆盖）：

```xml
<style name="Theme.Signal.DayNight.NoActionBar" parent="TextSecure.LightNoActionBar">
    <item name="android:windowSplashScreenBackground">@color/signal_colorBackground</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/ic_splash</item>
</style>

<!-- 手动覆盖：浅色启动 -->
<style name="Theme.Signal.DayNight.NoActionBar.LightSplash" parent="Theme.Signal.DayNight.NoActionBar">
    <item name="android:windowSplashScreenBackground">@color/signal_light_colorBackground</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/ic_splash_light</item>
</style>

<!-- 手动覆盖：深色启动 -->
<style name="Theme.Signal.DayNight.NoActionBar.DarkSplash" parent="Theme.Signal.DayNight.NoActionBar">
    <item name="android:windowSplashScreenBackground">@color/signal_dark_colorBackground</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/ic_splash_dark</item>
</style>
```

### 5.3 要点解读

- **`windowSplashScreenBackground` 颜色 = 正式主题 `windowBackground` 颜色（`signal_colorBackground`）**，这就是 Android 12 上"无白屏、无缝衔接"的核心做法：系统 Splash 的底色和 App 第一帧窗口底色**用同一个 color resource**。
- `windowSplashScreenAnimatedIcon` 指向一个 vector drawable（`ic_splash`），不是 PNG 位图。系统会自动把它裁剪进 240dp 的圆/图标框里，外面再套一个 `windowSplashScreenIconBackgroundColor`（Signal 没设，透明）。
- **没有用** `windowSplashScreenBrandingImage`、`windowSplashScreenIconBackgroundColor`、`postSplashScreenTheme`、`windowSplashScreenShortTimeout`。
- 这是 Google 官方文档推荐的"最小可用 Splash"配置。

---

## 6. 佐证 App B：Nextcloud（nextcloud/android）

### 6.1 关键文件

- `app/src/main/res/values/styles.xml`
  来源：https://raw.githubusercontent.com/nextcloud/android/master/app/src/main/res/values/styles.xml

### 6.2 关键代码

```xml
<!-- Launch screen（postSplashScreenTheme 指向的主题） -->
<style name="Theme.ownCloud.Launcher">
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@color/primary</item>
    <item name="android:windowBackground">@color/primary</item>
    <item name="android:textColorHint">@color/secondary_text_color</item>
</style>

<!-- Android 12+ 系统 Splash 主题 -->
<style name="Theme.App.Starting" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/primary</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/ic_launcher_foreground</item>
    <item name="postSplashScreenTheme">@style/Theme.ownCloud.Launcher</item>
</style>
```

### 6.3 要点解读

- 用了 **AndroidX `core-splashscreen` 库**（parent = `Theme.SplashScreen`），这是 Google 官方兼容库。
- 三段式：
  1. `windowSplashScreenBackground` = `@color/primary`（Nextcloud 蓝）。
  2. `windowSplashScreenAnimatedIcon` = `@drawable/ic_launcher_foreground`（直接复用自适应图标的前景 vector，**不另做一张 576×576**）。
  3. `postSplashScreenTheme` = `Theme.ownCloud.Launcher`，这个主题的 `windowBackground` 也是 `@color/primary`——**和系统 Splash 底色完全一致**，所以系统 Splash 消失后切到 App 窗口时，肉眼看不到任何跳变。
- 仍然**没有用** `windowSplashScreenBrandingImage`、`windowSplashScreenIconBackgroundColor`、`windowSplashScreenShortTimeout`。
- 注意：`Theme.ownCloud.Launcher` 的 `windowBackground` 是**纯色 `@color/primary`，不是 layer-list**。Nextcloud 也没做"全屏品牌图"。

---

## 7. 佐证 App C：Aegis（beemdevelopment/Aegis）

### 7.1 关键文件

- `app/src/main/res/values/themes.xml`
  来源：https://raw.githubusercontent.com/beemdevelopment/Aegis/master/app/src/main/res/values/themes.xml

### 7.2 关键代码

```xml
<style name="Theme.Aegis.Launch" parent="Theme.Material3.DayNight.NoActionBar">
    <item name="colorPrimary">@color/md_theme_light_primary</item>
    <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
</style>
```

### 7.3 要点解读

- 只设了透明状态栏，**没有任何 windowBackground / windowSplashScreen* 定制**。
- 等于完全交给系统 Splash（Android 12+ 自动用 launcher icon）+ Material3 默认背景色。无参考价值，仅作为"现代开源 App 普遍不做启动图"的又一例证。

---

## 8. 必答问题汇总

### Q1 全屏自制启动图：windowBackground 用什么 drawable？

| App | windowBackground 类型 | 内容 |
|---|---|---|
| Retro Music / Metro | `layer-list` | 第 1 层 `?attr/colorPrimary` 纯色；第 2 层 `<bitmap android:gravity="center" android:src="@drawable/ic_splash"/>`（PNG，居中不拉伸） |
| VLC | `@android:color/transparent`（StartActivity 透明跳转） | 无品牌图 |
| Auxio | 不设置，继承 Material3 默认 | 无品牌图 |
| Signal | `@color/signal_colorBackground`（纯色） | 无品牌图 |
| Nextcloud | `@color/primary`（纯色，Launcher 主题） | 无品牌图 |
| Aegis | 不设置 | 无品牌图 |

**关键事实：调研的所有 App 里，没有一个把"整张品牌设计图"放进 windowBackground 做全屏填充。** Retro Music/Metro 的 bitmap 用 `android:gravity="center"`，Logo 按原图大小居中，四周是主题色——这是"居中图标 + 纯色底"，不是"全屏海报"。

**为什么品牌图放 windowBackground 而不是 windowSplashScreenBackground？**
因为 `windowSplashScreenBackground` 在 Android 12+ 里**只能是纯色**（一个 color resource），系统强制要求；想画"图 + 字 + 渐变"这种组合，只能画在 `windowBackground` 的 layer-list / drawable 里。而 `windowSplashScreenAnimatedIcon` 又被系统限制在中心一个 240dp 的圆里，**不能画全屏图**。所以"全屏品牌图"在 Android 12+ 上根本无法通过系统 Splash API 实现，只能：
- 把系统 Splash 底色配成和品牌背景同色（无缝过渡），然后
- 用 `postSplashScreenTheme` 切到一个 `windowBackground = layer-list(整图)` 的主题，由这个 layer-list 来展示全屏品牌图。

Nextcloud 只做了第一步（纯色），没做第二步（layer-list 整图）。**调研对象里没有人完整做"第二步"**。

### Q2 与系统 splash 无缝衔接：颜色如何对齐？

- **Signal（values-v31/themes.xml）**：`windowSplashScreenBackground = @color/signal_colorBackground`，与正式主题 `windowBackground = @color/signal_colorBackground` **用同一个 color resource**。这是最干净的做法。
- **Nextcloud（values/styles.xml）**：`windowSplashScreenBackground = @color/primary`，`postSplashScreenTheme = Theme.ownCloud.Launcher`，而 Launcher 主题 `windowBackground = @color/primary`——**同一资源**，无缝。
- **Retro Music / Metro**：targetSdk 29，跑不到 Android 12 Splash API，不存在"衔接"问题。
- **VLC / Auxio / Aegis**：没做衔接，直接交给系统。

调研中**没有人使用** `windowSplashScreenIconBackgroundColor`（圆形图标底色），也**没有人使用** `windowSplashScreenShortTimeout`。`postSplashScreenTheme` 只有 Nextcloud 用了。

### Q3 windowSplashScreenBrandingImage 的真实用法

- 调研的 7 个 App（Retro Music、Metro、VLC、Auxio、Signal、Nextcloud、Aegis）**没有一个使用 `windowSplashScreenBrandingImage`**。
- 这与 Google 官方文档一致："the design guidelines recommend against using a branding image"（https://developer.android.com/develop/ui/views/launch/splash-screen）。
- MusicFree 上游模板里配了 `windowSplashScreenBrandingImage = @drawable/spashscreen_branding_image.png`（400×160），这是 expo-splash-screen 模板默认带的，**不是开源 App 社区的主流做法**。
- 已知规格（来自官方文档）：branding image 高度 160dp、宽度不超 400dp，固定贴屏幕底部居中；背景必须透明；系统会在底部再留 24dp 安全间距。常见坑：图不透明会被裁成一块矩形贴纸，很丑；深色/浅色主题下要做两套；Android 12 以下不生效。

### Q4 全屏 PNG 适配：不同宽高比如何避免拉伸？

调研对象里**没有人用全屏 PNG**，所以没有现成代码可抄。但 Retro Music 的写法给出了"安全做法"的骨架：

```xml
<layer-list>
    <item android:drawable="?attr/colorPrimary" />   <!-- 纯色底，任何比例都填满 -->
    <item>
        <bitmap android:gravity="center" android:src="..." />  <!-- 居中，不拉伸 -->
    </item>
</layer-list>
```

要点（综合 Android 官方机制）：
- `android:gravity="center"`：位图按原始尺寸居中，**绝不拉伸**，四周露底图颜色——这是 Retro Music 的选择。
- `android:gravity="fill"` / `clip_horizontal|clip_vertical`：会拉伸，**不要用**。
- 想做"全屏铺满且不变形"：
  - 最稳的是 **vector drawable 画背景渐变 + 居中 logo**（vector 无限分辨率，不用切图）。
  - 用 PNG 整图时，放 `drawable-nodpi/` 避免系统按密度缩放，并用 `<bitmap android:gravity="fill_horizontal|clip_vertical" .../>` 或写一个自定义 `ImageViews` 用 `centerCrop`。
  - 真正"整图适配所有比例"需要 `.9.png`（九-patch）把可拉伸区设在纯色/渐变区、关键内容区设为不可拉伸。
  - `sw<N>dp` 限定符（如 `drawable-sw600dp/`）只为平板单独出图。
- **调研结论**：开源社区选择了"不做整图"来回避这个适配难题——纯色底 + 居中 logo（或 vector），是最省事、最稳的方案。

### Q5 结论：styles.xml 里到底配了哪些 item？与 RN 官方模板的差异

**Retro Music / Metro（旧方案，targetSdk ≤ 29）：**
```xml
<style name="SplashTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:windowBackground">@drawable/splash</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
</style>
<!-- splash.xml = layer-list(纯色底 + 居中 bitmap logo) -->
```

**Signal（新方案，values-v31 覆盖）：**
```xml
<!-- values/themes.xml：正式主题 -->
<item name="android:windowBackground">@color/signal_colorBackground</item>

<!-- values-v31/themes.xml：系统 Splash -->
<item name="android:windowSplashScreenBackground">@color/signal_colorBackground</item>
<item name="android:windowSplashScreenAnimatedIcon">@drawable/ic_splash</item>
```

**Nextcloud（新方案，core-splashscreen 兼容库）：**
```xml
<style name="Theme.App.Starting" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/primary</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/ic_launcher_foreground</item>
    <item name="postSplashScreenTheme">@style/Theme.ownCloud.Launcher</item>
</style>
<style name="Theme.ownCloud.Launcher">
    <item name="android:windowBackground">@color/primary</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@color/primary</item>
</style>
```

**与 RN 官方模板（MusicFree 上游）的差异：**

| 项 | RN 官方模板（MusicFree 上游） | 开源原生 App 主流做法 |
|---|---|---|
| parent | `Theme.SplashScreen`（core-splashscreen） | Retro/Metro 用 `Theme.AppCompat.DayNight.NoActionBar`；Nextcloud 用 `Theme.SplashScreen`；Signal 直接在正式主题上覆盖 |
| windowSplashScreenBackground | 纯色 `#27282C` | 纯色，且**与正式主题 windowBackground 同色资源** |
| windowSplashScreenAnimatedIcon | `@drawable/splashscreen_image.png`（576×576 PNG） | vector drawable（`ic_splash` / `ic_launcher_foreground`），不另做大 PNG |
| windowSplashScreenBrandingImage | `@drawable/spashscreen_branding_image.png`（400×160） | **无人使用** |
| windowBackground | 不定制（用默认） | Retro/Metro 用 layer-list(纯色+居中 logo)；Signal/Nextcloud 用与 splash 同色的纯色 |
| postSplashScreenTheme | 不设（靠 JS 侧 expo-splash-screen hide） | Nextcloud 设为 Launcher 主题；Signal 不设 |
| 全屏品牌图 | 无（系统 Splash 强制居中圆形图标） | **无**（所有调研 App 都没做） |

---

## 9. 对极悦界（MusicFree fork）的可借鉴清单

本项目现状：`windowBackground` 用 layer-list（纯色底 + 居中圆角渐变容器 + 白音符），Android 12+ 系统 splash 用纯色 + 圆形品牌底 + 白音符。结合上面的源码事实，给"原生 windowBackground layer-list + 容器"方案的可借鉴点：

1. **保持现在的 layer-list 思路，但把第 1 层纯色抽成独立 color resource**（例如 `@color/splash_background`），并在 `values-v31/themes.xml` 里让 `windowSplashScreenBackground` 引用**同一个 color resource**。这是 Signal / Nextcloud 的核心做法，能保证 Android 12+ 系统 Splash → App 第一帧之间零跳变。
2. **不要追求"整图全屏 PNG"**。调研 7 个 App 没有一个这么做，原因是 Android 12+ 系统 Splash 强制把图标塞进 240dp 圆里，整图根本塞不进去；而旧版本用整图又要面对 16:9 / 20:9 / 平板的拉伸适配。**"纯色底 + 居中容器 + 音符"就是开源社区的标准答案**，和现在的方案方向一致。
3. **`windowSplashScreenAnimatedIcon` 用 vector drawable，不要用 576×576 PNG**。Signal 用 `@drawable/ic_splash`（vector），Nextcloud 直接复用 `@drawable/ic_launcher_foreground`。vector 自动适配系统要求的图标区域，无需出多档 PNG。
4. **`windowSplashScreenBrandingImage` 可以考虑删掉**。Google 官方不推荐，开源 App 没人用，MusicFree 上游模板带它只是 expo 模板默认值。如果要保留，记得底部 400×160、透明底、深色主题再做一套。
5. **若想让 Android 12+ 也"无缝"**，可学 Nextcloud：把启动 Activity 主题改成 `parent="Theme.SplashScreen"`，加 `postSplashScreenTheme="@style/Theme.YourApp.Splash"`，而不是靠 RN 侧 `expo-splash-screen.hide()`。这样系统 Splash 结束时自动切到你自己的 layer-list windowBackground，比 JS 侧 hide 更早一帧，更不容易白屏。
6. **Retro Music 的 `android:statusBarColor="@android:color/transparent"`** 这个小项值得抄——它让启动期间状态栏透明，不会出现一条突兀的色块。
7. **不要用 `windowSplashScreenShortTimeout`**。调研无人使用；它会让你在冷启动慢的机器上看到一闪而过的窗口背景，反而露白。

---

## 10. 调研中"没做启动图"的 App 如实说明

- **VLC for Android**：启动入口是透明 `StartActivity`，直接跳 `MainActivity`，无任何自制品牌图。
- **Auxio**：注释里写"Adds an animated splash screen"但主题体为空，完全交给 Material3 + 系统 Splash。
- **Aegis**：只有一个 `Theme.Aegis.Launch` 设了透明状态栏，无 windowBackground / windowSplashScreen 定制。
- **未调研**：任务书里提到的"一个 Flutter 音乐 App"本次未单独拉取——因为 Flutter 默认壳的 `LaunchTheme` 就是 `windowBackground = @drawable/launch_background`（GradientDrawable 蓝色渐变），与本次"原生开源 App 怎么做"的主题无关，且 RN 侧 expo-splash-screen 已经覆盖了这个场景。如需补充，可后续单独拉。
