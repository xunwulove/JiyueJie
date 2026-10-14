# flutter_native_splash 源码机制 × Android 12+ SplashScreen API 官方实证

> 调研日期：2026-10-14
> 调研方式：拉取 `jonbhanson/flutter_native_splash`（branch=`master`，version=`2.4.8`）raw 源码直读；Android 官方文档 developer.android.com / developer.android.google.cn 直读（多语种镜像交叉验证）。未 clone 仓库，未跑构建，未改任何业务代码。
> 报告目的：为本项目（RN/原生混合的极悦界）对标"国产软件式全图启动"提供系统层规格与限制依据。

---

## 0. 一句话结论先行

- **flutter_native_splash 并不"画"启动图**，它做两件事：①把你的 PNG 按 5 个 dpi 桶切图落到 `drawable-*`；②用 XML 模板拼 `launch_background.xml`（layer-list）并往 `styles.xml` / `values-v31/styles.xml` 的 `LaunchTheme` 里塞 `windowSplashScreen*` 属性。
- **Android 12+ 系统启动层根本不支持全屏背景图**：`windowSplashScreenBackground` 只接受"单一不透明颜色"；中间图标被圆形蒙版裁切；底部只能放一个 200×80 dp 的小 branding 图。想要"国产软件式整页插画启动"，**系统 splash 层给不了，只能靠 API<31 的 `windowBackground` layer-list，或系统 splash 结束后你自己首帧的 View/RN 页补**。
- **`windowSplashScreenShortTimeout` 在官方文档里不存在**（详见 §3.5），官方可配置的属性清单里没有它；启动画面的"自动结束"语义是"应用画出第一帧即关闭 + 系统内部兜底超时"，且不可由开发者通过主题属性调。

---

## 1. Q1：flutter_native_splash 完整生成机制

### 1.1 源码文件清单（2.4.8 已扁平化，无 lib/src/）

通过 GitHub Trees API 列出（ref=master）：

```
bin/create.dart                 # 入口：dart run flutter_native_splash:create
bin/remove.dart                 # 入口：恢复默认白屏
lib/cli_commands.dart          # 主库：配置解析、_createAndroidSplash 调度、createBackgroundImage、parseColor、_Parameter 枚举
lib/android.dart                # Android 生成核心（_createAndroidSplash / _applyImageAndroid / _applyLaunchBackgroundXml / _applyStylesXml / _updateStylesFile）
lib/templates.dart              # 所有 XML 模板字符串（_androidLaunchBackgroundXml / _androidStylesXml / _androidV31StylesXml 等）
lib/flavor_helper.dart          # 所有 Android 资源路径常量（drawable*/values*/values-v31* 在哪）
lib/constants.dart              # 仅 web 相关常量
lib/flutter_native_splash.dart  # 给业务侧用的 preserve()/remove()（deferFirstFrame/allowFirstFrame）
```

入口链路：`bin/create.dart` → `createSplash()`（cli_commands.dart）→ `getConfig()` 读 `pubspec.yaml`/`flutter_native_splash.yaml` → `_createSplashByConfig()` → 调 `_createAndroidSplash(...)`。

> 来源：https://github.com/jonbhanson/flutter_native_splash/blob/master/lib/cli_commands.dart

### 1.2 路径常量（flavor_helper.dart，无 flavor 时基础目录 = `android/app/src/main/res/`）

```dart
// lib/flavor_helper.dart（节选）
String get androidDrawableFolder        => '${_androidResFolder}drawable/';
String get androidNightDrawableFolder   => '${_androidResFolder}drawable-night/';
String get androidLaunchBackgroundFile => '${androidDrawableFolder}launch_background.xml';
String get androidStylesFile            => '${_androidResFolder}values/styles.xml';
String get androidNightStylesFile      => '${_androidResFolder}values-night/styles.xml';
String get androidV31StylesFile         => '${_androidResFolder}values-v31/styles.xml';
String get androidV31StylesNightFile    => '${_androidResFolder}values-night-v31/styles.xml';
String get androidV21DrawableFolder     => '${_androidResFolder}drawable-v21/';
```

minSdk 分流逻辑（`getAndroidV31StylesFile`）：minSdk<31 时才写 `values/styles.xml`；写 `values-v31/styles.xml` 的条件是 `minSdk < 31 ? values-v31 : values/styles.xml`——即低 minSdk 项目额外生成 `values-v31/` 覆盖给 API31+，高 minSdk 项目直接改 `values/styles.xml`。

### 1.3 API < 31 生成什么（旧轨）

**（a）切图**：把 `image`（主 logo）切成 5 个 dpi 桶，文件名固定 `splash.png`：

```dart
// lib/android.dart
_AndroidDrawableTemplate(directoryName: 'drawable-mdpi',    pixelDensity: 1),
_AndroidDrawableTemplate(directoryName: 'drawable-hdpi',     pixelDensity: 1.5),
_AndroidDrawableTemplate(directoryName: 'drawable-xhdpi',   pixelDensity: 2),
_AndroidDrawableTemplate(directoryName: 'drawable-xxhdpi',  pixelDensity: 3),
_AndroidDrawableTemplate(directoryName: 'drawable-xxxhdpi',   pixelDensity: 4),
```

缩放算法（把源图当作 @4x xxxhdpi 基准）：

```dart
// lib/android.dart _saveImageAndroid
final newFile = copyResize(image,
  width:  image.width  * template.pixelDensity ~/ 4,
  height: image.height * template.pixelDensity ~/ 4,
  interpolation: Interpolation.average);
```

- `branding` → `drawable*/branding.png`
- `background_image`（整页背景图）→ 经 `createBackgroundImage()` 复制/转 PNG 到 `drawable*/background.png`（非 PNG 会解码重编码为 PNG）
- dark 模式对应 `drawable-night*` 全套

**（b）拼 `launch_background.xml`（layer-list）**，模板（lib/templates.dart）：

```xml
<!-- _androidLaunchBackgroundXml：底层 = 背景图/纯色位图，gravity=fill 拉伸铺满 -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <bitmap android:gravity="fill" android:src="@drawable/background" />
    </item>
</layer-list>
```

再按配置动态 append 两个 `<item>`：

```xml
<!-- _androidLaunchItemXml：中间 logo，gravity 由 android_gravity 决定（默认 center，可 fill） -->
<item>
    <bitmap android:gravity="center" android:src="@drawable/splash" />
</item>

<!-- _androidBrandingItemXml：底部品牌条，可加 bottom padding -->
<item android:bottom="{bottom_padding}dp">
    <bitmap android:gravity="center" android:src="@drawable/branding" />
</item>
```

> 代码证据（lib/android.dart `_applyLaunchBackgroundXml`）：`splashItem` 从模板复制后 `setAttribute('android:gravity', gravity)`；branding 仅当 `gravity != brandingGravityValue` 才追加（避免和主 logo 重叠）。

**（c）改 `values/styles.xml` 的 `LaunchTheme`**，把 `windowBackground` 指过去：

```xml
<!-- _androidStylesXml（templates.dart） -->
<style name="LaunchTheme" parent="@android:style/Theme.Light.NoTitleBar">
    <item name="android:windowBackground">@drawable/launch_background</item>
</style>
<style name="NormalTheme" parent="@android:style/Theme.Light.NoTitleBar">
    <item name="android:windowBackground">?android:colorBackground</item>
</style>
```

`_updateStylesFile` 还会顺带写：`android:windowFullscreen`、`android:windowDrawsSystemBarBackgrounds`、`android:windowLayoutInDisplayCutoutMode=shortEdges`、`android:forceDarkAllowed=false`。

> ⚠️ 注意：README 说"Background color will be added in colors.xml"，但 **2.4.8 实际模板是把纯色/整页图落到 `drawable/background.png` 再由 layer-list 的 `<bitmap gravity="fill">` 拉伸**——README 与代码有出入，以代码为准。这意味着 API<31 是支持整页背景图的（`background_image` 直接 fill 铺满）。

### 1.4 API 31+ 生成什么（新轨）

**（a）额外切图到 `drawable-*-v31/`**：

```dart
// lib/android.dart _generateImageTemplates(android12: true)
// prefix='drawable', suffix='-v31' → drawable-mdpi-v31 ... drawable-xxxhdpi-v31
```

- `android_12.image` → `drawable-*-v31/android12splash.png`
- `android_12.branding` → `drawable-*-v31/android12branding.png`

**（b）写 `values-v31/styles.xml`**，模板（templates.dart）：

```xml
<!-- _androidV31StylesXml 初始模板 -->
<style name="LaunchTheme" parent="@android:style/Theme.Light.NoTitleBar">
    <item name="android:windowSplashScreenBackground">@drawable/launch_background</item>
</style>
```

然后 `_updateStylesFile` 对同一个 `LaunchTheme` 做属性级替换/删除：

```dart
// lib/android.dart _updateStylesFile（节选，关键逻辑）
// 背景色：有值→写成 #RRGGBB；无值→删除该 item
if (android12BackgroundColor == null) {
  _removeElement(launchTheme, name: 'android:windowSplashScreenBackground');
} else {
  _replaceElement(launchTheme,
      name: 'android:windowSplashScreenBackground', value: '#$android12BackgroundColor');
}
// 中间图标：有 android_12.image → @drawable/android12splash；无 → 删除（回退为启动器图标）
_replaceElement(launchTheme,
    name: 'android:windowSplashScreenAnimatedIcon', value: '@drawable/android12splash');
// 图标圆形底色：有 → #颜色；无 → 删除
_replaceElement(launchTheme,
    name: 'android:windowSplashScreenIconBackgroundColor', value: '#$android12IconBackgroundColor');
// 底部 branding：有 → @drawable/android12branding；无 → 删除
_replaceElement(launchTheme,
    name: 'android:windowSplashScreenBrandingImage', value: '@drawable/android12branding');
```

**结论：flutter_native_splash 根本不生成 `postSplashScreenTheme`，也不依赖 `Theme.SplashScreen` / `installSplashScreen()`**。它直接在 Flutter 现成的 `LaunchTheme`（进程启动时由系统套用的主题）上塞 `windowSplashScreen*` 属性，等 Flutter 引擎画首帧后由框架自己切到 `NormalTheme`。

### 1.5 图片模式 / dark / branding 落地方式

| 配置项 | Android 落地 |
|---|---|
| `color` / `color_dark` | 生成纯色 `background.png` 位图（API<31 layer-list 底层）；API31+ 直接写 `windowSplashScreenBackground=#RRGGBB` |
| `background_image` | API<31：整图拉伸 fill 铺满（可做全屏图）；**API31+：完全不生效**（README 明确："Note that a background image is not supported"） |
| `image` + `android_gravity` | API<31：layer-list 里 `<bitmap gravity>`，默认 center，可 `fill`/`bottom`/`clip_vertical` 等任意 Gravity 组合；**API31+：被圆形蒙版强制裁切居中**，gravity 失效 |
| `android_12.image` | API31+：`windowSplashScreenAnimatedIcon`；README 规格——有图标底色 960×960px（圆 640px）、无底色 1152×1152px（圆 768px） |
| `icon_background_color` | API31+：`windowSplashScreenIconBackgroundColor`（圆形底色） |
| `branding` | API<31：layer-list 底部 item；**API31+：`windowSplashScreenBrandingImage`，README 要求源图 800×320px** |
| dark | 整套复制到 `drawable-night*` / `values-night*` / `values-night-v31*` |

> 来源：README（https://github.com/jonbhanson/flutter_native_splash/blob/master/README.md）"How it works → Android" 一节，及上述源码。

---

## 2. Q2：系统 SplashScreen API 各槽位官方规格与限制

官方主文档：https://developer.android.com/develop/ui/views/launch/splash-screen （镜像 https://developer.android.google.cn/develop/ui/views/launch/splash-screen ）

### 2.1 全槽位速查表

| 属性 | 官方规格 | 关键限制 |
|---|---|---|
| `windowSplashScreenBackground` | **单一不透明颜色**（single opaque color）；若不设置且主题 `windowBackground` 是纯色，则默认复用它 | **不支持渐变、不支持图片、不支持透明**。"The window background consists of a single opaque color." |
| `windowSplashScreenAnimatedIcon` | 中间图标，必须是 vector drawable，可静态可 AVD 动画；默认=启动器图标 | **被圆形蒙版裁切**：有底色 240×240dp 内圆 160dp；无底色 288×288dp 内圆 192dp；前景 1/3 被 mask |
| `windowSplashScreenAnimationDuration` | 图标动画时长 ms（例 1000） | **不控制 splash 实际停留时长**，只供退出动画读取；Android 13+ 自动从 AVD 推断 |
| `windowSplashScreenIconBackgroundColor` | 图标后面的圆形底色 | 仅在图标与窗口背景对比度不足时用；设了它图标按 240dp 档裁切 |
| `windowSplashScreenBrandingImage` | 屏幕**底部**展示的品牌图 | **官方尺寸 200×80 dp**；"design guidelines recommend against using a branding image"（设计指南**不推荐**用） |
| `windowSplashScreenBehavior` | Android 13+ 是否强制显示图标（`icon_preferred`） | 默认 0 跟随系统 |
| `postSplashScreenTheme` | **不是平台 API 属性，是 androidx.core:core-splashscreen 兼容库的属性** | 见 §3 |

### 2.2 BrandingImage 实证（重点）

- **官方 dp 规格**：`Branded image: this must be 200×80 dp.`（主文档 Dimensions 节）
- **位置**：屏幕底部居中（"an image to be shown at the bottom of the splash screen"）
- **官方态度**：明确写着 *"However, the design guidelines recommend against using a branding image."* —— Google 设计规范本身**不鼓励**放底部品牌图。
- **flutter_native_splash 的 px 规格**：README 写 "The branding image dimensions must be 800x320 px." —— 与官方 200×80 dp 一致（800px ÷ 4x = 200dp，即按 xxxhdpi 出图）。
- **内容要求**：官方未额外要求透明底，但它就是一张普通 drawable；受系统布局约束只占底部一条，**无法用来铺整屏**。
- 真实使用情况：flutter_native_splash 是少数把它落地成 `android_12.branding` 的生态库；core-splashscreen 示例（Now in Android / Wear OS 文档）默认不用它。

### 2.3 IconBackgroundColor 行为

官方原文：*"Use `windowSplashScreenIconBackgroundColor` to set a background behind the splash screen icon. This is useful if there isn't enough contrast between the window background and the icon."*

- 行为：在圆形图标后面垫一块**圆形纯色底**（不是圆角矩形，不是全图背景）。
- 与不设的区别：设了 → 图标按"有底色"档（240×240dp / 圆 160dp）；不设 → 图标按"无底色"档（288×288dp / 圆 192dp），更大一圈。若你用 adaptive icon 且与窗口背景对比度够，系统会自动显示图标自带背景。

### 2.4 Background 只能纯色的官方依据（重要，直接回答 Q4）

官方原文（Elements and mechanics 第 4 点）：

> "The window background consists of a **single opaque color**. If the window background is set and is a plain color, it is used by default if the attribute isn't set."

动画要求节再次强调：

> "Set a **single window background color with no transparency**."

推论：
- ❌ 系统 splash 的 `windowSplashScreenBackground` **不能塞 layer-list、不能塞 bitmap、不能渐变、不能图片**。
- ❌ 官方文档没有提供"整页启动图"槽位。
- ✅ 想要整页视觉，系统层只给：纯色底 + 中间圆图标 + 底部 200×80dp 小条。

### 2.5 `windowSplashScreenShortTimeout` 考证（重点纠偏）

**结论：官方文档中不存在名为 `windowSplashScreenShortTimeout` 的主题属性。**

- 我在官方主文档（多语种镜像：en/zh-tw/ko/id/tr/es/ar/it）全文检索，可配置属性清单只有：`windowSplashScreenBackground`、`windowSplashScreenAnimatedIcon`、`windowSplashScreenAnimationDuration`、`windowSplashScreenIconBackgroundColor`、`windowSplashScreenBrandingImage`、`windowSplashScreenBehavior`，加上兼容库的 `postSplashScreenTheme`。**没有 ShortTimeout。**
- 官方对"自动结束"的真实语义是（How the splash screen works + Keep on-screen 节）：
  > "The splash screen is dismissed **as soon as your app draws its first frame**."
  > "…the app triggers `onResume()` **or the splash screen times out automatically**…"
  即：①应用首帧绘制完即关；②若应用迟迟不就绪，系统有内部兜底超时（官方只说"times out automatically"，**未公开精确毫秒数，也未开放给开发者配置**）。
- 你若在别处看到"ShortTimeout"说法，可能是对"系统自动超时兜底"的讹传，或与 `windowSplashScreenAnimationDuration`（动画时长，非停留时长）混淆。**不要在 styles.xml 里写 `windowSplashScreenShortTimeout`，AAPT 会报 attribute not found。**

---

## 3. Q3：API 31+ 与 API<31 双轨怎么处理（postSplashScreenTheme）

### 3.1 两条技术路线对比

**路线 A：flutter_native_splash 的做法（平台 API 直连，无兼容库）**
- 不引入 `androidx.core:core-splashscreen`。
- 直接在 `LaunchTheme` 上写 `windowSplashScreen*` 属性。
- 不写 `postSplashScreenTheme`——因为 Flutter 的 `LaunchTheme` 本来就是"进程启动主题"，引擎首帧后框架自动切到 `NormalTheme`（`windowBackground=?android:colorBackground`），完成主题交接。
- API<31 与 API31+ 靠资源限定目录分流：`values/styles.xml`（旧）vs `values-v31/styles.xml`（新）。

**路线 B：官方推荐的 core-splashscreen 兼容库做法（postSplashScreenTheme 的出处）**
- 依赖 `androidx.core:core-splashscreen:1.x`。
- 建一个父主题为 `Theme.SplashScreen` 的专用主题：

```xml
<!-- 官方 migrate 文档原文 -->
<style name="Theme.App.Starting" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/...</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/...</item>
    <item name="windowSplashScreenAnimationDuration">200</item>
    <!-- 必需：splash 结束后 Activity 应切换到的真实主题 -->
    <item name="postSplashScreenTheme">@style/Theme.App</item>
</style>
```

- Manifest 里把启动 Activity 的 `android:theme` 设成 `Theme.App.Starting`。
- Activity `onCreate` 里 `super.onCreate()` 之前调 `installSplashScreen()`：

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    val splashScreen = installSplashScreen()   // 必须在 super.onCreate() 之前
    super.onCreate(savedInstanceState)
    setContentView(R.layout.main_activity)
}
```

- `postSplashScreenTheme` 的语义：**splash 阶段用 `Theme.App.Starting`，一旦 splash 消失，框架自动把 Activity 主题换成 `postSplashScreenTheme` 指向的 `Theme.App`**，避免启动主题泄漏到业务页（状态栏/背景色串色）。这是兼容库在 API 23+ 全版本复刻 Android 12 splash 外观的关键。

> 来源：https://developer.android.com/develop/ui/views/launch/splash-screen/migrate

### 3.2 对本项目的启示

- 你们当前用 `values-v31` 系统 splash（纯色 + 圆品牌底 + 白音符）+ `expo-splash-screen`，属于"路线 A 的变体"：v31 主题管系统那一下，expo/RN 首帧接管。
- `postSplashScreenTheme` **不是必须的**，只有当你用 `Theme.SplashScreen` 父主题 + core-splashscreen 库时才需要；纯平台 API 直写 `windowSplashScreen*` 时不需要。

---

## 4. Q4：可借鉴清单——"国产软件式全图启动"系统层能做/不能做

### 4.1 系统 SplashScreen 层（Android 12+）能做的

| 能做 | 做法 | 规格 |
|---|---|---|
| 整屏纯色底 | `windowSplashScreenBackground` | 不透明单色 |
| 中间品牌图标 | `windowSplashScreenAnimatedIcon` | 自动圆形蒙版，最大 288dp 内圆 192dp |
| 图标圆形底色 | `windowSplashScreenIconBackgroundColor` | 圆形纯色 |
| 底部小品牌条 | `windowSplashScreenBrandingImage` | 200×80 dp，官方不推荐 |
| 图标入场/循环动画 | AVD + `windowSplashScreenAnimationDuration` | 建议 ≤1000ms |
| 延长停留（等首帧） | `OnPreDrawListener` / `setKeepOnScreenCondition` | 业务侧控制 |

### 4.2 系统 SplashScreen 层（Android 12+）**不能**做的

- ❌ **整页背景图 / 插画**：背景槽只收纯色，官方明令"single opaque color"。
- ❌ **渐变背景**：同上，单色不透明。
- ❌ **全屏自定义布局 / 多元素自由排版**：只给"居中圆图标 + 底部小条"两个槽位。
- ❌ **控制 splash 精确停留毫秒数**：没有 ShortTimeout；唯一可控的是"首帧前别 draw"。
- ❌ **非圆形的图标形状**：前景 1/3 强制 mask 成圆。

### 4.3 哪些只能靠 `windowBackground`（即 API<31 旧轨 / 自定义主题）

- **整页启动图（国产软件式）**：只能在 API<31 用 `windowBackground=@drawable/launch_background` 的 layer-list 里 `<bitmap android:gravity="fill" android:src="@drawable/background"/>` 把一张全屏 PNG 拉伸铺满。
- **API 31+ 想要整页图**：系统层无解。两条出路：
  1. **接受系统那一下"纯色 + 圆图标"，等 splash 消失后用业务首帧（RN View / Activity 布局）补一张全屏启动页**——即你们现在 `expo-splash-screen` 在做的"第二帧"。国产 App 常见做法就是：系统 splash（纯色+logo）→ 立刻切到自己画的全屏启动 Activity/Page（可带整图、可点跳、可倒计时）。
  2. **用 core-splashscreen 兼容库 + 自绘退出动画**，把系统 splash 做成长动画过渡到自绘页，但背景仍是纯色。
- **渐变背景**：API<31 可以在 layer-list 里用 `<color>` 或渐变 drawable（`<shape><gradient>`）当 windowBackground；**API31+ 系统 splash 不支持**，渐变只能放到自绘页。

### 4.4 对极悦界现状的直接结论

你们当前 `windowBackground layer-list + values-v31 系统 splash（纯色+圆底+白音符）+ expo-splash-screen` 的架构，已经是 Android 12+ 下"系统层能做到的极限"：
- v31 系统那一下：纯色底 + 圆形白音符 logo（符合官方槽位）。
- 想要"国产软件式全图启动"，**不要再往 `windowSplashScreenBackground` 塞图**（会被系统当纯色 drawable 处理或直接不渲染图）；正确姿势是把整图放到 expo/RN 首帧页面，并让系统 splash 的纯色与该整图主色**无缝衔接**，做到"看起来像一整页"。

---

## 5. 本次未完全实证 / 如实说明

1. **`_createBackground` 函数体**：在 `cli_commands.dart` 中被 `_createAndroidSplash` 调用（负责把 color 或 backgroundImage 落成 `drawable*/background.png`），由于文件经 web 摘要抽取，函数体逐行未完整展开；但其行为可由调用签名 + `createBackgroundImage`（存在：非 PNG 解码重编码为 PNG，否则直接 copy）+ 模板 `<bitmap gravity=fill @drawable/background>` 确认为"纯色→PNG / 图→PNG，再拉伸"。未发现它写 `colors.xml`。
2. **`windowSplashScreenShortTimeout`**：已多语种官方文档检索确认**不存在**，详见 §2.5。
3. **其他 Flutter 启动图库**（flutter_native_splash 之外）：按任务"可选"未展开；生态主流即此包 + `flutter_launch`/原生手写，结论可迁移。
4. **GitHub 开源项目真实使用 BrandingImage 的实证**：未逐一拉取第三方仓库源码；flutter_native_splash 本身即最典型落地者（`android_12.branding` → `@drawable/android12branding`），官方文档亦确认该槽位存在。

---

## 6. 来源清单

**flutter_native_splash（master @ v2.4.8）**
- README：https://github.com/jonbhanson/flutter_native_splash/blob/master/README.md
- 主库 cli_commands.dart：https://github.com/jonbhanson/flutter_native_splash/blob/master/lib/cli_commands.dart
- Android 生成 android.dart：https://github.com/jonbhanson/flutter_native_splash/blob/master/lib/android.dart
- XML 模板 templates.dart：https://github.com/jonbhanson/flutter_native_splash/blob/master/lib/templates.dart
- 路径常量 flavor_helper.dart：https://github.com/jonbhanson/flutter_native_splash/blob/master/lib/flavor_helper.dart
- 业务侧 preserve/remove：https://github.com/jonbhanson/flutter_native_splash/blob/master/lib/flutter_native_splash.dart

**Android 官方**
- Splash screens 主文档：https://developer.android.com/develop/ui/views/launch/splash-screen
- 迁移指南（postSplashScreenTheme / installSplashScreen）：https://developer.android.com/develop/ui/views/launch/splash-screen/migrate
- Wear OS 示例（Theme.SplashScreen.IconBackground 用法）：https://developer.android.com/training/wearables/apps/splash-screen
