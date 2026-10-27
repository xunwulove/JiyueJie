package `fun`.upup.sourceprobe.utils; // replace your-apps-package-name with your app’s package name
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.WindowInsets
import android.view.WindowManager
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.io.File
import kotlin.system.exitProcess

class UtilsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

    private val reactContext: ReactApplicationContext = context;

    override fun getName() = "NativeUtils"

    /** 桌面快捷方式冷启动兜底：读取并清空 pending action（无则返回 null） */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun consumePendingShortcutAction(): String? {
        return `fun`.upup.sourceprobe.ShortcutBridge.consumePendingAction()
    }

    /** 开机自启开关：写入 SharedPreferences（BootReceiver 开机时读取同文件同键） */
    @ReactMethod
    fun setAutoBootEnabled(enabled: Boolean) {
        reactContext
            .getSharedPreferences("autoBootPrefs", Context.MODE_PRIVATE)
            .edit()
            .putBoolean("enabled", enabled)
            .apply()
    }

    /** 开机自启开关当前状态（同步读，供 RN 设置页初始化） */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun isAutoBootEnabled(): Boolean {
        return reactContext
            .getSharedPreferences("autoBootPrefs", Context.MODE_PRIVATE)
            .getBoolean("enabled", false)
    }

    @ReactMethod
    fun exitApp() {
        val activity = reactContext.currentActivity
        activity?.finishAndRemoveTask()
        android.os.Process.killProcess(android.os.Process.myPid())
        exitProcess(0)
    }

    @ReactMethod
    fun checkStoragePermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            promise.resolve(Environment.isExternalStorageManager())
        } else {
            val readPermission = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
            val writePermission = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
            promise.resolve(readPermission && writePermission)
        }
    }

    @ReactMethod
    fun requestStoragePermission() {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:${reactContext.packageName}")
            }
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${reactContext.packageName}")
            }
        }
        reactContext.currentActivity?.startActivity(intent)
    }

    /** 软件内更新：拉起系统安装器安装已下载的 APK（FileProvider content URI） */
    @ReactMethod
    fun installApk(apkPath: String, promise: Promise) {
        try {
            val file = File(apkPath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "安装包不存在: $apkPath")
                return
            }
            // Android 8+：未允许"安装未知应用"时直接拉起安装器会失败（点击无反应/被拦截）
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !reactContext.packageManager.canRequestPackageInstalls()
            ) {
                // 拉起系统"允许安装未知应用"设置页，提示用户开启后重试
                val intent = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${reactContext.packageName}"),
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(intent)
                promise.reject(
                    "NEED_INSTALL_PERMISSION",
                    "需要允许安装未知应用",
                )
                return
            }
            val uri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.fileprovider",
                file,
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or
                        Intent.FLAG_ACTIVITY_NEW_TASK,
                )
            }
            val activity = reactContext.currentActivity
            if (activity != null) {
                activity.startActivity(intent)
            } else {
                reactContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("INSTALL_FAIL", e.message ?: "安装失败")
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getWindowDimensions(): WritableMap {
        val windowManager = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val displayMetrics: DisplayMetrics = reactApplicationContext.resources.displayMetrics
        val density = displayMetrics.density

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11 (API 30) 及以上使用新 API
            val windowMetrics = windowManager.currentWindowMetrics
            val insets = windowMetrics.windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars())
            val bounds = windowMetrics.bounds

            val totalWidthPx = bounds.width()
            val totalHeightPx = bounds.height()

            val leftInsetPx = insets.left
            val rightInsetPx = insets.right
            val topInsetPx = insets.top
            val bottomInsetPx = insets.bottom

            val usableWidthPx = totalWidthPx - leftInsetPx - rightInsetPx
            val usableHeightPx = totalHeightPx - topInsetPx - bottomInsetPx

            val usableWidthDp = usableWidthPx / density
            val usableHeightDp = usableHeightPx / density

            Arguments.createMap().apply {
                putDouble("width", usableWidthDp.toDouble())
                putDouble("height", usableHeightDp.toDouble())
            }
        } else {
            // Android 10 及以下使用旧 API
            val display = windowManager.defaultDisplay
            val realSize = android.graphics.Point()
            display.getRealSize(realSize)

            // 获取状态栏和导航栏高度
            val resources = reactApplicationContext.resources
            var statusBarHeight = 0
            var navigationBarHeight = 0

            // 状态栏高度
            val statusBarResourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
            if (statusBarResourceId > 0) {
                statusBarHeight = resources.getDimensionPixelSize(statusBarResourceId)
            }

            // 导航栏高度
            val navigationBarResourceId = resources.getIdentifier("navigation_bar_height", "dimen", "android")
            if (navigationBarResourceId > 0) {
                navigationBarHeight = resources.getDimensionPixelSize(navigationBarResourceId)
            }

            val usableWidthPx = realSize.x
            val usableHeightPx = realSize.y - statusBarHeight - navigationBarHeight

            val usableWidthDp = usableWidthPx / density
            val usableHeightDp = usableHeightPx / density

            Arguments.createMap().apply {
                putDouble("width", usableWidthDp.toDouble())
                putDouble("height", usableHeightDp.toDouble())
            }
        }
    }
}
