package `fun`.upup.sourceprobe

/**
 * 桌面快捷方式桥（进程内单例）。
 * MainActivity 收到 SHORTCUT intent 时写入 pendingAction；
 * RN 侧冷启动时通过 NativeUtils.consumePendingShortcutAction() 读取并清空（兜底，
 * 防止 JS 未加载时事件丢失）；热启动由 DeviceEventEmitter 事件直接送达。
 */
object ShortcutBridge {
    const val ACTION_SHORTCUT = "fun.upup.sourceprobe.SHORTCUT"
    const val EXTRA_SHORTCUT_ACTION = "shortcut_action"
    const val EVENT_NAME = "AppShortcut"

    @Volatile
    private var pendingAction: String? = null

    /** 写入待处理 action（重复点击覆盖） */
    fun setPendingAction(action: String?) {
        pendingAction = action
    }

    /** 读取并清空待处理 action；无 pending 返回 null */
    fun consumePendingAction(): String? {
        val action = pendingAction
        pendingAction = null
        return action
    }
}
