package `fun`.upup.musicfree
import expo.modules.ReactActivityDelegateWrapper
import expo.modules.splashscreen.SplashScreenManager

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.content.Intent
import android.os.Bundle

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MusicFree"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled))

  // https://reactnavigation.org/docs/getting-started/#installing-dependencies-into-a-bare-react-native-project
  override fun onCreate(savedInstanceState: Bundle?) {
      SplashScreenManager.registerOnActivity(this)
      super.onCreate(null);
      handleShortcutIntent(intent);
  }

  /** 热启动：singleTask 下快捷方式点击走 onNewIntent（此时 RN 通常已加载，事件直达 JS） */
  override fun onNewIntent(intent: Intent) {
      super.onNewIntent(intent)
      handleShortcutIntent(intent)
  }

  /**
   * 桌面快捷方式分发：解析 shortcut_action → 写入 pending（冷启动兜底）
   * + RN 已加载时直接 emit 事件。
   */
  private fun handleShortcutIntent(intent: Intent?) {
      val action = intent?.getStringExtra(ShortcutBridge.EXTRA_SHORTCUT_ACTION) ?: return
      if (action.isBlank()) return
      ShortcutBridge.setPendingAction(action)
      // RN 已加载时热启动事件直达；冷启动由 RN 侧 consumePendingShortcutAction() 兜底
      reactNativeHost?.reactInstanceManager?.currentReactContext
          ?.emitDeviceEvent(ShortcutBridge.EVENT_NAME, action)
  }
}
