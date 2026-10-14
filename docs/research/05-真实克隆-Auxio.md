# 真实克隆核验：Auxio（OxygenCobalt/Auxio）启动图实现

> 核验日期：2026-10-14
> 核验方式：`git clone --depth 1` 到本地，逐文件阅读，只读分析（不构建、不改源码）。
> 对照文档：`docs/research/01-开源音乐App启动图源码.md` 第 4 节（网页级结论）。

---

## 1. 项目信息

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/OxygenCobalt/Auxio |
| 本地路径 | `E:\Temp\Deepseek\opensource-splash\Auxio` |
| Commit | `c05cebc52fe2393bf3a988068e4060fd6dba408f` |
| Commit 时间 | 2026-09-07 19:52:39 -0600 |
| Commit message | `all: fix unscoped coroutines` |
| versionName / versionCode | 4.1.5 / 75 |
| minSdk | **24**（根 `build.gradle` 第 12 行） |
| compileSdk / targetSdk | **37**（根 `build.gradle` 第 13 行 `target_sdk = 37`，app/build.gradle 第 25–26 行引用） |

targetSdk 37 远高于 31，意味着 Android 12（API 31）系统 Splash API 在 Auxio 上**完全生效**，不是被旧 targetSdk 屏蔽掉的。

---

## 2. 关键证据清单（路径 + 行号 + 摘录）

### 2.1 AndroidManifest.xml —— 启动入口与主题

文件：`E:\Temp\Deepseek\opensource-splash\Auxio\app\src\main\AndroidManifest.xml`

- **第 35 行**：Application 级主题直接挂 `Theme.Auxio.App`：
  ```xml
  android:theme="@style/Theme.Auxio.App"
  ```
- **第 46–53 行**：唯一 LAUNCHER Activity 是 `.MainActivity`，**没有单独的 `android:theme`**，也没有独立 SplashActivity：
  ```xml
  <activity
      android:name=".MainActivity"
      android:exported="true"
      android:icon="@mipmap/ic_launcher"
      android:launchMode="singleTask"
      ...>
      <intent-filter>
          <action android:name="android.intent.action.MAIN" />
          ...
          <category android:name="android.intent.category.LAUNCHER" />
  ```
- 全文件 grep `splash` / `Splash`：**零命中**。Manifest 里没有任何 Splash 相关 Activity / meta-data。

### 2.2 values/styles_core.xml —— 主题继承链

文件：`E:\Temp\Deepseek\opensource-splash\Auxio\app\src\main\res\values\styles_core.xml`

- **第 4 行**：Master parent 就是 Material3 动态取色主题：
  ```xml
  <style name="Theme.Auxio" parent="Theme.Material3Expressive.DynamicColors.DayNight" />
  ```
- **第 8–11 行** V27：
  ```xml
  <style name="Theme.Auxio.V27" parent="Theme.Auxio.V23">
      <item name="android:statusBarColor">@color/chrome_translucent</item>
      <item name="android:navigationBarColor">@color/chrome_translucent</item>
  </style>
  ```
- **第 13 行** V29（无 item）：
  ```xml
  <style name="Theme.Auxio.V29" parent="Theme.Auxio.V27" />
  ```
- **第 14–15 行** V31（base values 下，无 item，只有注释）：
  ```xml
  <!-- Adds an animated splash screen. -->
  <style name="Theme.Auxio.V31" parent="Theme.Auxio.V29" />
  ```
- **第 18–129 行** `Theme.Auxio.Base`：共 60+ item，全部是 motion / widget style / typography / preference 样式。
  - **无 `android:windowBackground`**
  - **无任何 `windowSplashScreen*` item**
- **第 132 行**：`Theme.Auxio.App` 默认指向 Blue 配色：
  ```xml
  <style name="Theme.Auxio.App" parent="@style/Theme.Auxio.Blue" />
  ```

### 2.3 values/v27 与 values-night-v27 —— 系统栏亮色/暗色反色

- `values-v27/styles_core.xml` 第 4–9 行：`windowLightStatusBar=true`、`windowLightNavigationBar=true`
- `values-night-v27/styles_core.xml` 第 4–9 行：同上但设为 `false`

仅控制状态栏图标明暗，与启动图无关。

### 2.4 values-v29/styles_core.xml —— Android 10+ 透明系统栏

文件：`E:\Temp\Deepseek\opensource-splash\Auxio\app\src\main\res\values-v29\styles_core.xml`（第 4–14 行）

```xml
<style name="Theme.Auxio.V29" parent="Theme.Auxio.V27">
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@android:color/transparent</item>
    <item name="android:enforceNavigationBarContrast">false</item>
    <item name="android:enforceStatusBarContrast">false</item>
</style>
```

无 splash 相关 item。

### 2.5 values-v31/styles_core.xml —— **本轮核验的核心差异点**

文件：`E:\Temp\Deepseek\opensource-splash\Auxio\app\src\main\res\values-v31\styles_core.xml`

完整内容（第 1–22 行）：

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>

    <style name="Theme.Auxio.V31" parent="Theme.Auxio.V29">
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/ic_splash_anim</item>
        <item name="android:windowSplashScreenAnimationDuration">1000</item>
    </style>

    <!-- Use dynamic colors since that's assumed to be the setting used. -->
    <style name="Theme.Auxio.App" parent="Theme.Auxio.Base" />

    <style name="Theme.Auxio.Widget" parent="@android:style/Theme.DeviceDefault.DayNight">
        ...
    </style>
</resources>
```

逐项核对系统 Splash API 五个关键属性：

| 属性 | 是否设置 | 值 |
|---|---|---|
| `android:windowSplashScreenBackground` | **无** | — |
| `android:windowSplashScreenAnimatedIcon` | **有**（第 5 行） | `@drawable/ic_splash_anim` |
| `android:windowSplashScreenAnimationDuration` | **有**（第 6 行） | `1000`（毫秒） |
| `android:windowSplashScreenIconBackgroundColor` | **无** | — |
| `android:windowSplashScreenBrandingImage` | **无** | — |
| `postSplashScreenTheme`（AndroidX core-splashscreen 库属性） | **无** | — |

### 2.6 drawable/ic_splash_anim.xml —— 自制动画图标

文件：`E:\Temp\Deepseek\opensource-splash\Auxio\app\src\main\res\drawable\ic_splash_anim.xml`

- 根元素是 `<animated-vector>`，底层 `<vector>` 尺寸 **432×432 dp**（第 6–9 行）。
- 主体画的是 Auxio 品牌 logo——一个由 4 条笔画组成的"A"形：
  - `base`（蓝色 `#004894`，第 42–49 行）
  - `lower_stem`（`#1a61ae`，第 57–64 行）
  - `upper_stem`（`#357ac9`，第 73–80 行）
  - `tail`（`#5093e4`，第 89–96 行）
- 动画：每条笔画对应一个 `<objectAnimator>`（第 105–165 行），把 `strokeWidth` 从 `0` 动画到 `2`，时长 **850ms**，`startOffset=150ms`，interpolator 为 `@interpolator/m3_sys_motion_easing_emphasized_decelerate`——效果是"四条线先后描出来拼成 A"。
- `bg` group（第 10–20 行）画了一个半径 192dp 的圆，但 `fillColor="#00000000"`、`strokeColor="#00000000"`，**全透明占位**——系统会自己把图标裁进 240dp 圆框，Auxio 没自己画圆形底。
- `drawable-v31/` 目录下只有 `ui_widget_bg_round.xml` 和 `ui_widget_rectangle_button_bg.xml`，**没有 splash 相关限定符版本**。

### 2.7 全局 grep 兜底

在 `app/src/main/` 全目录检索 `windowSplashScreen|windowBackground|postSplashScreenTheme|splashscreen|SplashScreen`：

```
app/src/main/res/values-v31/styles_core.xml:5: <item name="android:windowSplashScreenAnimatedIcon">@drawable/ic_splash_anim</item>
app/src/main/res/values-v31/styles_core.xml:6: <item name="android:windowSplashScreenAnimationDuration">1000</item>
```

**只有这两处命中**。整个项目里：
- 没有任何 `android:windowBackground` 定制（所有主题都继承 Material3 默认）。
- 没有任何独立 splash drawable（layer-list / bitmap）。
- 没有任何 SplashActivity 透明跳转。
- 没有 `windowSplashScreenBackground` / `IconBackgroundColor` / `BrandingImage`。

---

## 3. 启动画面实际构成

### 3.1 Android 12+（API 31+，即 values-v31 生效路径）

冷启动时，系统先按 `Theme.Auxio.App → Theme.Auxio.Base → Theme.Auxio.V31(覆盖)` 的解析结果绘制系统 Splash：

1. **背景色**：Auxio **没有设** `windowSplashScreenBackground`。系统默认行为是取主题里的 `?attr/colorBackground` / `?android:colorBackground`。由于 master parent 是 `Theme.Material3Expressive.DynamicColors.DayNight`，这个颜色来自 **Material You 动态取色色板**（或用户在设置里选的 Red/Pink/Blue 等配色对应的 `*_background` 色，见 `values/themes.xml` 第 20、69、118…行的 `android:colorBackground` item）。
2. **中心图标**：系统把 `@drawable/ic_splash_anim`（432dp animated-vector）自动缩放、裁剪进 240dp 图标框，并播放它的 850ms "描 A" 动画（总窗口时长由 `windowSplashScreenAnimationDuration=1000` 约束）。
3. **图标圆形底色**：Auxio 没设 `windowSplashScreenIconBackgroundColor`，`ic_splash_anim` 自身的 `bg` group 也是全透明——所以系统用默认的图标底（通常是把自适应图标前景直接放上去，无额外圆底）。
4. **BrandingImage**：无。
5. **Splash 结束后**：因为没有 `postSplashScreenTheme`，系统直接切到 `Theme.Auxio.App` 本身的窗口；这个主题没设 `windowBackground`，Material3 默认窗口背景同样是 `colorSurface` / `colorBackground` 这套动态色。

### 3.2 Android 7.0–11（API 24–30，values-v31 不生效）

没有系统 Splash API。窗口背景完全由 Material3 默认 `windowBackground` 决定（还是 `colorSurface` 那一套），没有任何自制 drawable，也没有透明跳转的 SplashActivity。用户冷启动看到的是：**一块纯色（动态色或所选配色的 surface 色）+ 应用窗口直接上来**。

---

## 4. "为何看不出系统纯色" / "为何仍有系统纯色" 的机制

### 4.1 它"看不出"的一面

- **背景色来源统一**：系统 Splash 背景（未显式设置时取的 `?attr/colorBackground`）与 App 第一帧窗口背景（Material3 默认 `windowBackground = colorSurface`）**来自同一个 Material3 色板**。当用户开启 Material You 动态取色时，两者都由系统取色结果派生，天然一致，肉眼看不到跳变。
- **状态栏从 V29 起就是透明的**（`values-v29/styles_core.xml` 第 9–12 行），不会出现启动期一条突兀的状态栏色块。

### 4.2 它"仍然是系统纯色"的一面

- **Auxio 完全没有画任何全屏图**：没有 layer-list、没有 bitmap、没有 gradient drawable、没有 `postSplashScreenTheme` 切到自制主题。整屏除了中央一个被系统裁进 240dp 框的 A 形动画图标，其他区域就是一块纯色。
- **背景色是系统自动派生的**，不是 Auxio 显式指定的品牌色。如果用户在设置里换了 Red/Blue/Green 配色，或关闭动态取色走默认 Blue，Splash 背景与 App 第一帧之间仍可能出现微妙的 surface/background 色差（Material3 色板里 `colorBackground` 与 `colorSurface` 本来就不是同一个色值）。
- **图标不是"全屏品牌图"**，只是一个 432dp 的 vector，被系统缩放后塞在中央 240dp 圆框里。

---

## 5. 评级

**Auxio 属于「系统 Splash + 自制动画图标」**，介于上一轮三档分类之间：

- ❌ 不是「纯色 + logo 整图自制」（没有 layer-list / bitmap / `windowBackground` 定制）。
- ❌ 不是「全图自制」（没有整图、没有 BrandingImage、没有 postSplashScreenTheme）。
- ⚠️ 也**不完全等于**「纯系统默认」——它在 `values-v31/styles_core.xml` 第 5–6 行**显式设了** `windowSplashScreenAnimatedIcon = @drawable/ic_splash_anim` 和 `AnimationDuration = 1000`，图标是自己画的 animated-vector，还带"描 A"动画。

最准确的描述：**背景 100% 交给系统/Material3 动态色，图标是一个 432dp 自绘 animated-vector（A 字描边动画）；除此之外没有任何全屏品牌内容。**

对极悦界的参考价值：Auxio 示范了"系统 Splash + 只换图标动画，不碰背景色"的极简路线；但它**没有**解决"Splash 背景与 App 第一帧显式同色"的问题——那部分无缝感完全靠 Material3 DynamicColors 隐式统一，不是显式对齐。极悦界若要做"看不出系统纯色"，仍需像 Signal/Nextcloud 那样显式把 `windowSplashScreenBackground` 指到与 `windowBackground` 同一个 color resource。

---

## 6. 与上一轮网页调研结论（01 号文档第 4 节）的差异

| 维度 | 上一轮网页结论（01 文档 §4） | 本轮本地核验（commit c05cebc5） | 是否推翻 |
|---|---|---|---|
| `Theme.Auxio.V31` 是否为空 | "注释写 Adds an animated splash screen，但一个 item 都没加" | **有 2 个 item**：`windowSplashScreenAnimatedIcon=@drawable/ic_splash_anim`（v31/styles_core.xml 第 5 行）、`windowSplashScreenAnimationDuration=1000`（第 6 行） | **推翻** |
| 是否依赖父主题 Material3 默认 | "完全交给系统/框架" | 背景/图标底色确实交给系统与 Material3 DynamicColors；但**图标是自制的 animated-vector**，不是系统默认 launcher icon 直接复用 | 部分推翻 |
| 是否有 `windowSplashScreenBackground` | 未提（隐含无） | **无**（已逐项核对） | 成立 |
| 是否有 `windowSplashScreenIconBackgroundColor` | 未提 | **无** | 成立 |
| 是否有 `windowSplashScreenBrandingImage` | 无 | **无** | 成立 |
| 是否有 `postSplashScreenTheme` | 无 | **无** | 成立 |
| 是否有 `windowBackground` 定制 / 自制 splash drawable | 无 | **无**（全局 grep 兜底） | 成立 |
| 是否有独立 SplashActivity | 未提 | **无**，MainActivity 直接挂 `Theme.Auxio.App` | 成立 |

**差异根因推测**：上一轮通过 raw.githubusercontent.com 拉取时，master 分支上 `values-v31/styles_core.xml` 可能仍是更早的版本（V31 空壳）；本轮 clone 到的最新 master（2026-09-07 commit）已经合入了"动画 splash 图标"这一改动。以本地文件为准。

**最终结论修正**：Auxio 不是"完全空壳、100% 纯系统默认"，而是"**背景 100% 系统/Material3 默认，图标用了一个自绘的 animated-vector 并配 850ms 描边动画**"。它仍然没有做任何全屏品牌图，也没有显式对齐 Splash 背景色与窗口背景色——无缝感来自 Material3 DynamicColors 的隐式统一，而非显式工程。
