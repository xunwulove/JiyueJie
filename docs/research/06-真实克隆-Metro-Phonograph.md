# 真实克隆核验：Metro 与 Phonograph 启动图实现

> 核验日期：2026-10-14
> 核验方式：本地浅克隆源码，逐文件阅读（不跑构建、不改代码）。
> 克隆位置：
> - `E:\Temp\Deepseek\opensource-splash\Metro`
> - `E:\Temp\Deepseek\opensource-splash\Phonograph`
> 对照基线：`docs/research/01-开源音乐App启动图源码.md`（上一轮网页级调研，仅作对照，不作证据）。

---

## 一、Metro（MuntashirAkon/Metro）

### 1.1 项目信息

- 仓库：https://github.com/MuntashirAkon/Metro
- Commit：`32e0a24358b8f92bf1da748e7fcd08499346478c`
- 提交时间 / 说明：2023-04-04 13:52 +0600，"Prepare for v6.1.0"
- 包名：`code.name.monkey.retromusic`（Retro Music 的 fork，包名未改）

### 1.2 关键证据清单（绝对路径 + 摘录 + 行号）

**(1) `E:\Temp\Deepseek\opensource-splash\Metro\app\src\main\AndroidManifest.xml`**

- L34–49：application 默认主题 `android:theme="@style/Theme.RetroMusic.FollowSystem"`。
- L50–54：启动 Activity 单独挂启动主题：

```xml
<activity
    android:name=".activities.MainActivity"
    android:exported="true"
    android:launchMode="singleTop"
    android:theme="@style/Theme.RetroMusic.SplashScreen">
```

（L55–59 是 MAIN / LAUNCHER intent-filter，无独立 SplashActivity。）

**(2) `E:\Temp\Deepseek\opensource-splash\Metro\app\build.gradle`**

```
L8:  compileSdk 33
L12: minSdk 21
L13: targetSdk 33
L91: implementation "androidx.core:core-splashscreen:1.0.0"
```

**(3) 旧版兜底主题 `E:\Temp\Deepseek\opensource-splash\Metro\app\src\main\res\values\styles.xml`**，L122–125：

```xml
<style name="Theme.RetroMusic.SplashScreen" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:windowBackground">@drawable/splash</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
</style>
```

注意主题名已从旧版的 `SplashTheme` 改名为 `Theme.RetroMusic.SplashScreen`。

**(4) 启动 drawable `E:\Temp\Deepseek\opensource-splash\Metro\app\src\main\res\drawable\splash.xml`**，L15–25：

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

- 第 1 层：`?attr/colorPrimary` 主题色纯色满铺。
- 第 2 层：`android:gravity="center"` 的位图 logo，按原图尺寸居中，不拉伸、不满屏。

**(5) logo 位图资源**

- 唯一文件：`E:\Temp\Deepseek\opensource-splash\Metro\app\src\main\res\drawable-xxxhdpi\ic_splash.png`
- 实测尺寸：**512×512 PNG**，文件大小 12202 字节；只出了 xxxhdpi 一档，无 vector 替代。

**(6) values-v31 系统 Splash 配置（上一轮网页调研称"无"，本地实际存在）**

- 目录存在：`E:\Temp\Deepseek\opensource-splash\Metro\app\src\main\res\values-v31\`（另有 `values-night-v31\`）。
- `values-v31\styles.xml`，L21–24：

```xml
<style name="Theme.RetroMusic.SplashScreen" parent="Theme.SplashScreen">
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/avd_splash</item>
    <item name="android:windowSplashScreenAnimationDuration">1000</item>
</style>
```

逐项核查 `windowSplashScreen*`：

| 属性 | 是否设置 |
|---|---|
| `windowSplashScreenAnimatedIcon` | 有 → `@drawable/avd_splash` |
| `windowSplashScreenAnimationDuration` | 有 → 1000ms |
| `windowSplashScreenBackground` | **无**（未显式设置，沿用 core-splashscreen / 父主题默认） |
| `windowSplashScreenIconBackgroundColor` | 无 |
| `windowSplashScreenBrandingImage` | 无 |
| `postSplashScreenTheme` | **无**（未设置） |

- `values-night-v31\styles.xml`：只覆盖 `Theme.RetroMusic.MD3.Black` 的 `colorSurface`，**没有任何 splash 相关项**。

**(7) 系统 Splash 图标本体 `E:\Temp\Deepseek\opensource-splash\Metro\app\src\main\res\drawable\avd_splash.xml`**

- 是一个 `<animated-vector>`，内嵌 vector `android:width="411dp" android:height="411dp"`（L7–10）。
- 内容是 Metro 三角播放 logo 的描边/填色动画：`group_1` 做 translateX 入场（L67–77），`path_1/2/3/5/7` 做 pathData 形变 + fillAlpha 渐显（L78–168），整体时长约 1 秒。

**(8) 代码层切主题**

- `E:\Temp\Deepseek\opensource-splash\Metro\app\src\main\java\code\name\monkey\retromusic\activities\base\AbsThemeActivity.kt`，L37–60：

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    updateLocale()
    updateTheme()          // L39
    ...
    super.onCreate(savedInstanceState)
    ...
}

private fun updateTheme() {
    setTheme(getThemeResValue())   // L52：在 super.onCreate 之前切到正式主题
    ...
}
```

- 全仓 grep：**没有任何 `installSplashScreen()` 调用**。core-splashscreen 依赖只为 `Theme.SplashScreen` 父主题服务，没有用它的"保留 splash 到首帧"API。

### 1.3 启动画面构成（分代）

- **Android 12 以前（设备 SDK < 31）**：资源限定符选中 `values\styles.xml` 版本的 `Theme.RetroMusic.SplashScreen`。进程创建期间窗口背景 = `@drawable/splash` = layer-list（`?attr/colorPrimary` 纯色满铺 + 居中 512×512 PNG logo）。随后 `MainActivity.onCreate` 里 `setTheme()` 切到 MD3 正式主题。
- **Android 12 及以上（设备 SDK ≥ 31）**：资源限定符选中 `values-v31\styles.xml` 版本，父主题换成 androidx `Theme.SplashScreen`，由系统画 Splash：背景未显式设置（沿用库默认），中心图标是 `avd_splash`（411dp 动画矢量，播放入场动画约 1 秒）。

### 1.4 "为何看不出系统纯色 splash"——无缝机制

1. **旧设备**：`android:windowBackground` 直接被替换成 layer-list，第 1 层就是 `?attr/colorPrimary`——系统在 App 进程起来之前画的就是品牌主色满屏，根本没有机会出现"系统默认灰白底"；`statusBarColor` 透明，不出现突兀状态栏色块。
2. **Android 12+**：走系统 Splash API，但 `windowSplashScreenAnimatedIcon` 指向品牌动画矢量（Metro logo 自绘动画），用户感知到的是"品牌图标动画开场"，而非系统默认图标；又因 `targetSdk 33`、包内带 `values-v31`，系统 Splash 与 App 主题体系同源。
3. **注意一个未做的点**：它**没有**像 Signal/Nextcloud 那样把 `windowSplashScreenBackground` 显式对齐到正式主题底色，也没有设 `postSplashScreenTheme`——严格说 Android 12+ 上"系统 Splash 底 → MD3 首帧"之间仍可能存在一次底色跳变，只是被居中的品牌图标动画遮挡，肉眼不易察觉。

### 1.5 评级

**双轨制：旧设备 = "纯色 + logo"（layer-list 主题色底 + 居中 PNG logo）；Android 12+ = 系统 Splash API + 动画矢量图标（非全图自制）。**

不属于"全图自制"，也不属于"纯系统默认"。

### 1.6 与上一轮网页结论的差异

| 项 | 上一轮网页结论 | 本地实测（commit 32e0a24，2023-04） | 判定 |
|---|---|---|---|
| 主题名 | `SplashTheme` | `Theme.RetroMusic.SplashScreen`（values 与 values-v31 同名双份） | **有出入**：改名了 |
| windowBackground layer-list | `?attr/colorPrimary` + 居中 `ic_splash` bitmap | 逐字一致（`drawable\splash.xml` L15–25） | 一致 |
| targetSdk | 29 | **33**（build.gradle L13） | **有出入**：已升级 |
| values-v31 / 系统 Splash | "无 values-v31，无 windowSplashScreen*" | **存在** `values-v31\styles.xml`，且接入 `androidx.core:core-splashscreen:1.0.0`，设了 animated icon + 1000ms 时长 | **有出入**：上一轮结论已过时 |
| ic_splash | PNG，未核实尺寸 | 512×512，仅 drawable-xxxhdpi 一档 | 补充事实 |

结论：上一轮拉取时 master 尚未合并 core-splashscreen 改造（或读到了旧快照）；**以本地文件为准，Metro 当前版本已经是"旧式 layer-list 兜底 + 新式系统 Splash 动画图标"双轨实现**，不再是单纯的 Retro Music 逐字复制。

---

## 二、Phonograph（kabouzeid/Phonograph）

### 2.1 项目信息

- 仓库：https://github.com/kabouzeid/Phonograph（原作者已归档，只读）
- Commit：`d156872cc5ac7f5f295b5fad361974c5fea45631`
- 提交时间 / 说明：2020-09-25 00:51 +0200，"Bump build version"
- 包名：`com.kabouzeid.gramophone`

### 2.2 关键证据清单（绝对路径 + 摘录 + 行号）

**(1) `E:\Temp\Deepseek\opensource-splash\Phonograph\app\src\main\AndroidManifest.xml`**

- L20–26：application 主题直接定为浅色正式主题：

```xml
android:icon="@mipmap/ic_launcher"
android:label="@string/app_name"
android:roundIcon="@mipmap/ic_launcher_round"
android:supportsRtl="true"
android:theme="@style/Theme.Phonograph.Light"
```

- L27–36：启动 Activity **没有任何 `android:theme` 覆盖**：

```xml
<activity android:name=".ui.activities.MainActivity">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        ...
        <category android:name="android.intent.category.LAUNCHER" />
```

即启动入口直接复用 application 的 `Theme.Phonograph.Light`，没有独立 Splash 主题。

**(2) `E:\Temp\Deepseek\opensource-splash\Phonograph\app\build.gradle`**

```
L37: compileSdkVersion 29
L40: minSdkVersion 16
L41: targetSdkVersion 29
```

**(3) 主题链 `values\styles.xml` 与 `values\styles_parents.xml`**

- `values\styles.xml` L3–7：

```xml
<style name="Theme.Phonograph" parent="Theme.Phonograph.Base" />
<style name="Theme.Phonograph.Light" parent="Theme.Phonograph.Base.Light" />
<style name="Theme.Phonograph.Black" parent="Theme.Phonograph.Base.Black" />
```

- `values\styles_parents.xml` L33–60：`Theme.Phonograph.Base.Light` parent 是 `Theme.AppCompat.Light.NoActionBar`，里面列了一堆 selector / 背景色 attr，**唯独没有 `android:windowBackground`**。
- 全 res 唯一一处 `windowBackground` 出现在 `values\styles_parents.xml` L62–68（纯黑主题用）：

```xml
<style name="Theme.Phonograph.Base.Black" parent="@style/Theme.Phonograph.Base">
    <item name="android:windowBackground">@android:color/black</item>
    ...
</style>
```

也就是说：浅色/深色（Base）主题的 `windowBackground` 全部继承 AppCompat 默认值——浅色即默认白底。

**(4) values-v21 覆盖（Android 5.0+）**

- `values-v21\styles.xml`：对三个主题只加了 `android:statusBarColor="@android:color/transparent"` 与 `windowSharedElementsUseOverlay=false`，**仍然没有 `windowBackground`**。
- `values-v23\` 与 `values-v19\` 里只有 dimens。

**(5) splash 资源 / values-v31 / windowSplashScreen* 全面核查**

- 全仓 res 目录扫描：**不存在** `splash.xml`、`ic_splash`、`avd_splash` 任何同名/相似文件；grep `splash|SplashScreen|windowBackground` 只命中上面两处布局里对 `?android:attr/windowBackground` 的普通引用。
- **不存在 `values-v31\` 目录**（全仓 values 限定符最新只到 v23）。
- **不存在任何 `windowSplashScreen*` 属性**（targetSdk 29 时代也还没有这套 API）。
- 依赖里没有 `androidx.core:core-splashscreen`。

**(6) 代码层切主题**

- `E:\Temp\Deepseek\opensource-splash\Phonograph\app\src\main\java\com\kabouzeid\gramophone\ui\activities\base\AbsThemeActivity.java`，L24–29：

```java
@Override
protected void onCreate(Bundle savedInstanceState) {
    setTheme(PreferenceUtil.getInstance(this).getGeneralTheme()); // L26：super.onCreate 之前切到用户主题
    super.onCreate(savedInstanceState);
    MaterialDialogsUtil.updateMaterialDialogsThemeSingleton(this);
}
```

- `PreferenceUtil.java` L131/L141：主题来自用户设置（light / dark / black 三选一）。

### 2.3 启动画面构成

- 没有独立 Splash 主题、没有 splash drawable、没有 layer-list、没有 logo 位图。
- 冷启动时，系统按 manifest 声明的 `Theme.Phonograph.Light` 画窗口背景 = **AppCompat 浅色主题默认白底**。
- 紧接着 `MainActivity.onCreate`（继承自 `AbsThemeActivity`）在 `super.onCreate` 之前 `setTheme(用户主题)` 切换；若用户选了纯黑主题，就会经历一次"白 → 黑"的跳变。

### 2.4 "为何看不出系统纯色 splash"——无缝机制

**结论恰恰相反：Phonograph 根本没有做任何"看不出系统 splash"的努力。**

1. 它的"启动画面"就是系统默认窗口背景——浅色用户看到的是一帧白底；纯黑主题用户会先闪一下白再变黑。
2. 它的"无缝"只来自两点：一是 `values-v21` 把状态栏设成透明（`statusBarColor=transparent`），避免顶部一条突兀色块；二是 `setTheme()` 在 `super.onCreate` 之前执行，理论上窗口第一帧已经是用户主题，不会有二次绘制。
3. `targetSdk 29`：在 Android 12+ 设备上系统会套用兼容 splash（白底 + 系统抽取的 launcher 图标），但 App 自身没有任何 `windowSplashScreen*` 配置去对齐底色或换图标。

### 2.5 评级

**"纯系统默认"——三个候选里最"裸"的一种**：无自制启动图 drawable、无 Splash 主题、无 logo 资源，启动期间画的就是 AppCompat 主题默认窗口底色（浅色白 / 黑色才显式设黑）。连"纯色 + logo"都算不上。

### 2.6 与上一轮网页结论 / 任务预期的差异

- 上一轮网页报告未覆盖 Phonograph，本次为首轮本地核验。
- 任务预期是"Phonograph 作为经典老牌播放器，应该也是旧式（layer-list 纯色 + logo）实现"——**本地核验否定该预期**：Phonograph 连 `splash.xml` 都不存在，比 Retro Music/Metro 还旧一个时代，直接把启动交给系统默认窗口背景 + 运行时 `setTheme()` 换肤。

---

## 三、一句话对照（供极悦界参考）

- **Metro（2023 master）**：旧式 layer-list（主题色满铺 + 居中 512px PNG logo）做 <Android 12 兜底，Android 12+ 换成 core-splashscreen + 411dp 动画矢量图标；**没设 splash 背景对齐，没设 postSplashScreenTheme**——是"主题色窗口背景 + 品牌图标动画"，不是全屏整图。
- **Phonograph（2020 归档）**：零自制启动图，manifest 主题即浅色正式主题，冷启动画的是系统默认白底，靠 `values-v21` 透明状态栏 + `onCreate` 里提前 `setTheme()` 尽量减少跳变；纯黑主题用户会经历白→黑。
