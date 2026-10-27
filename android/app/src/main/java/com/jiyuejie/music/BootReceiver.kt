package com.jiyuejie.music

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * 开机自启动接收器（车机/平板常电场景）。
 * 收到 BOOT_COMPLETED 后，读取设置页写入的 SharedPreferences 开关标记（autoBootPrefs/enabled），
 * 仅当标记为 true 时拉起 MainActivity，避免无条件自启打扰用户。
 * 注意：部分厂商 ROM 会拦截应用开机自启，实际效果取决于车机系统。
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) {
            return
        }
        val prefs = context.getSharedPreferences(AUTO_BOOT_PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(AUTO_BOOT_ENABLED_KEY, false)) {
            Log.d(TAG, "开机自启开关未开启，跳过")
            return
        }
        try {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: Intent(context, MainActivity::class.java)
            launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
            )
            context.startActivity(launchIntent)
            Log.d(TAG, "开机自启：已拉起 MainActivity")
        } catch (e: Exception) {
            Log.e(TAG, "开机自启失败: ${e.message}")
        }
    }

    companion object {
        const val AUTO_BOOT_PREFS = "autoBootPrefs"
        const val AUTO_BOOT_ENABLED_KEY = "enabled"
        private const val TAG = "BootReceiver"
    }
}
