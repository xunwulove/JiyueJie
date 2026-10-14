package `fun`.upup.musicfree.soundEffect

import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.Virtualizer
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.doublesymmetry.trackplayer.module.MusicModule
import java.util.concurrent.CountDownLatch

/**
 * 音效模块（均衡器/低音增强/环绕声）——2026-10-14 新增。
 *
 * 实现方式（对齐 MexMp3 方案：ExoPlayer + android.media.audiofx 绑定 audioSessionId）：
 * - audioSessionId 不修改 RNTP/node_modules，通过反射读取 RNTP MusicModule → MusicService →
 *   kotlinaudio QueuedAudioPlayer → BaseAudioPlayer.getExoPlayer() → ExoPlayer.audioSessionId；
 *   ExoPlayer 实例在播放器生命周期内固定，session id 首次播放后分配并保持不变。
 * - Equalizer/BassBoost/Virtualizer 用 priority=0 绑定该 session，attach 一次即生效；
 *   换歌不重建 player，无需重新 attach（本模块按 session 幂等）。
 * - 设备不支持某效果器时降级（try/catch，不崩溃）。
 * - 音频路由变化（插拔耳机等）会改变系统 Equalizer 频段数（如扬声器 5 段 / 耳机 10 段），
 *   注册 AudioDeviceCallback，路由变化时强制重建效果器并通知 RN 刷新频段 UI。
 */
class SoundEffectModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var equalizer: Equalizer? = null
    private var bassBoost: BassBoost? = null
    private var virtualizer: Virtualizer? = null
    private var sessionId = -1
    private var lastError: String? = null

    /** 音频输出路由变化（插拔耳机/切换蓝牙等）→ 重建效果器（频段数等能力随路由变化） */
    private val audioDeviceCallback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(devices: Array<AudioDeviceInfo>) {
            rebuildOnRoutingChange()
        }

        override fun onAudioDevicesRemoved(devices: Array<AudioDeviceInfo>) {
            rebuildOnRoutingChange()
        }
    }

    init {
        try {
            val audioManager =
                reactContext.getSystemService(AudioManager::class.java)
            audioManager?.registerAudioDeviceCallback(
                audioDeviceCallback,
                Handler(Looper.getMainLooper()),
            )
        } catch (_: Exception) {
        }
    }

    override fun getName(): String = "SoundEffectModule"

    override fun onCatalystInstanceDestroy() {
        try {
            val audioManager =
                reactContext.getSystemService(AudioManager::class.java)
            audioManager?.unregisterAudioDeviceCallback(audioDeviceCallback)
        } catch (_: Exception) {
        }
        super.onCatalystInstanceDestroy()
    }

    /** 路由变化：重建效果器（保持同一 session），并通知 RN 刷新能力信息 */
    private fun rebuildOnRoutingChange() {
        try {
            if (sessionId <= 0) return
            attachEffects(sessionId)
            // 频段数/支持情况可能已变（耳机 10 段 vs 扬声器 5 段），RN 侧清缓存并重查
            reactContext.emitDeviceEvent(
                "SoundEffectReattached",
                Arguments.createMap(),
            )
        } catch (_: Exception) {
        }
    }

    /** 读取当前播放器 audioSessionId（须播放过一次后有效；-1 表示未分配） */
    @ReactMethod
    fun getAudioSessionId(promise: Promise) {
        try {
            val id = resolveAudioSessionId()
            if (id > 0) {
                promise.resolve(id)
            } else {
                promise.reject("player_not_ready", "audio session not ready, play once first")
            }
        } catch (e: Exception) {
            // 透传完整失败链：反射调用抛 InvocationTargetException 时 message 常为 null，
            // 必须带上 cause 与异常类名，否则 RN 侧只能看到 "unknown." 无法定位
            promise.reject("resolve_session_error", buildFailureDetail(e))
        }
    }

    /** 组装可定位的失败描述：异常自身 message/类名 + 最内层 cause 的 message/类名 */
    private fun buildFailureDetail(e: Exception): String {
        val top = e.message ?: e.javaClass.simpleName
        var cause = e.cause
        var inner: String? = null
        var depth = 0
        while (cause != null && depth < 5) {
            val m = cause.message ?: cause.javaClass.simpleName
            inner = inner?.let { "$it → $m" } ?: m
            cause = cause.cause
            depth++
        }
        return inner?.let { "$top → $it" } ?: top
    }

    private fun resolveAudioSessionId(): Int {
        // ExoPlayer 非线程安全，必须在创建它的主线程上访问；
        // RN 模块方法跑在 mqt_native_modules 线程，直接调 getAudioSessionId 会抛
        // "Player is accessed on the wrong thread"（被反射包成 InvocationTargetException）。
        // 方案 A：post 到主线程执行 + CountDownLatch 同步等待，方法仍同步返回。
        if (Looper.myLooper() == Looper.getMainLooper()) {
            // 兜底：若将来被主线程直接调用，避免 await 自锁
            return resolveAudioSessionIdOnMain()
        }
        val latch = CountDownLatch(1)
        var result = -1
        var failure: Exception? = null
        Handler(Looper.getMainLooper()).post {
            try {
                result = resolveAudioSessionIdOnMain()
            } catch (e: Exception) {
                failure = e
            } finally {
                latch.countDown()
            }
        }
        try {
            latch.await()
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            throw IllegalStateException("interrupted while waiting main thread", e)
        }
        failure?.let { throw it }
        return result
    }

    /** 实际反射读取 audioSessionId（必须在主线程执行） */
    private fun resolveAudioSessionIdOnMain(): Int {
        // 不能使用 reactContext.getNativeModule(MusicModule::class.java)：
        // RN 新版要求模块类带 @ReactModule 注解，RNTP 老库没有 → 抛
        // "Could not find @ReactModule annotation"，改按注册名获取
        val module = reactContext.getNativeModule("TrackPlayerModule") as? MusicModule
            ?: throw IllegalStateException("TrackPlayerModule not registered")
        val musicServiceField = MusicModule::class.java.getDeclaredField("musicService")
        musicServiceField.isAccessible = true
        val musicService = musicServiceField.get(module)
            ?: throw IllegalStateException("player service not bound")
        val playerField = musicService.javaClass.getDeclaredField("player")
        playerField.isAccessible = true
        val queuedPlayer = playerField.get(musicService)
            ?: throw IllegalStateException("player not created")
        // kotlinaudio 为 JitPack aar 依赖，类层级随版本可能变化：
        // 沿继承链向上查找 getExoPlayer（BaseAudioPlayer 链上任意层），消除 superclass 硬编码
        val exoMethod = findMethod(queuedPlayer.javaClass, "getExoPlayer")
            ?: throw IllegalStateException("getExoPlayer not found on " + queuedPlayer.javaClass.name)
        val exo = exoMethod.invoke(queuedPlayer)
        // ExoPlayer 不在 app 模块编译 classpath，反射读取 audioSessionId（同样沿继承链查找）
        val sessionIdMethod = findMethod(exo.javaClass, "getAudioSessionId")
            ?: throw IllegalStateException("getAudioSessionId not found on " + exo.javaClass.name)
        return sessionIdMethod.invoke(exo) as Int
    }

    /** 沿继承链查找方法（含私有），避免 superclass 硬编码在 aar 版本变化时崩溃 */
    private fun findMethod(cls: Class<*>?, name: String): java.lang.reflect.Method? {
        var c: Class<*>? = cls
        while (c != null) {
            try {
                return c.getDeclaredMethod(name).also { it.isAccessible = true }
            } catch (_: NoSuchMethodException) {
                c = c.superclass
            }
        }
        return null
    }

    /** 绑定三个效果器到指定 session（幂等：同一 session 已绑定则跳过） */
    @ReactMethod
    fun attach(sessionId: Int) {
        if (sessionId <= 0) return
        if (this.sessionId == sessionId && equalizer != null) return
        attachEffects(sessionId)
    }

    /** 实际创建并绑定三个效果器（attach 与路由变化重建共用） */
    private fun attachEffects(sessionId: Int) {
        releaseEffects()
        // 逐个效果器独立 try：Equalizer 在个别 ROM（车机/华为）构造可能失败，
        // 不能因一个失败连坐其余；失败原因记入 lastError 供 getInfo 诊断返回
        var eqOk = false
        try {
            equalizer = Equalizer(0, sessionId)
            eqOk = true
        } catch (e: Exception) {
            lastError = "Equalizer create failed: ${e.message}"
        }
        try {
            bassBoost = BassBoost(0, sessionId)
        } catch (e: Exception) {
            lastError = (lastError ?: "") + " | BassBoost failed: ${e.message}"
        }
        try {
            virtualizer = Virtualizer(0, sessionId)
        } catch (e: Exception) {
            lastError = (lastError ?: "") + " | Virtualizer failed: ${e.message}"
        }
        if (eqOk) {
            this.sessionId = sessionId
            lastError = null
        } else {
            releaseEffects()
        }
    }

    /** 效果器能力信息：频段数/中心频率(Hz)/电平范围/预设名列表 */
    @ReactMethod
    fun getInfo(promise: Promise) {
        val eq = equalizer
        if (eq == null) {
            // 带诊断信息：区分"未 attach"与"attach 时设备报错"
            promise.reject(
                "not_attached",
                lastError ?: "call attach first",
            )
            return
        }
        try {
            val map = Arguments.createMap()
            val bands = eq.numberOfBands.toInt()
            map.putInt("bands", bands)
            val freqs = Arguments.createArray()
            for (i in 0 until bands) {
                // getCenterFreq 返回 mHz，转 Hz
                freqs.pushInt(eq.getCenterFreq(i.toShort()).toInt() / 1000)
            }
            map.putArray("centerFreqs", freqs)
            val range = eq.bandLevelRange // ShortArray [min, max]，单位 millibel
            map.putInt("levelMin", range[0].toInt())
            map.putInt("levelMax", range[1].toInt())
            val presets = eq.numberOfPresets.toInt()
            val names = Arguments.createArray()
            for (i in 0 until presets) {
                names.pushString(eq.getPresetName(i.toShort()))
            }
            map.putArray("presets", names)
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("info_error", e.message ?: "unknown")
        }
    }

    @ReactMethod
    fun setEqEnabled(enabled: Boolean) {
        try {
            equalizer?.enabled = enabled
        } catch (_: Exception) {
        }
    }

    /** 应用预设（index 需 < numberOfPresets；"手动"由 RN 侧传 -1 并逐段 setBandLevel） */
    @ReactMethod
    fun setPreset(index: Int) {
        val eq = equalizer ?: return
        try {
            if (index in 0 until eq.numberOfPresets.toInt()) {
                eq.usePreset(index.toShort())
                eq.enabled = true
            }
        } catch (_: Exception) {
        }
    }

    /** 设置某频段增益，level 单位 millibel（-1500..1500 或设备 bandLevelRange） */
    @ReactMethod
    fun setBandLevel(band: Int, level: Int) {
        val eq = equalizer ?: return
        try {
            if (band in 0 until eq.numberOfBands.toInt()) {
                eq.setBandLevel(band.toShort(), level.toShort())
            }
        } catch (_: Exception) {
        }
    }

    /** 低音增强强度 0..1000（0 = 关闭） */
    @ReactMethod
    fun setBassBoost(strength: Int) {
        val bb = bassBoost ?: return
        try {
            val s = strength.coerceIn(0, 1000).toShort()
            bb.setStrength(s)
            bb.enabled = s > 0
        } catch (_: Exception) {
        }
    }

    /** 环绕声（虚拟器）强度 0..1000（0 = 关闭） */
    @ReactMethod
    fun setVirtualizer(strength: Int) {
        val vz = virtualizer ?: return
        try {
            val s = strength.coerceIn(0, 1000).toShort()
            vz.setStrength(s)
            vz.enabled = s > 0
        } catch (_: Exception) {
        }
    }

    /**
     * 查询设备对低音增强/环绕声的支持情况（供 UI 禁用与置灰）。
     * audiofx 无跨版本可靠的强度范围查询 API（BassBoost 无、Virtualizer 各 SDK 不一），
     * 因此用"attach 时构造是否成功"判定：构造成功 = 设备支持；构造失败 = 不支持（对象为 null）。
     */
    @ReactMethod
    fun getEffectRanges(promise: Promise) {
        try {
            val map = Arguments.createMap()
            map.putBoolean("bassSupported", bassBoost != null)
            map.putBoolean("virtualizerSupported", virtualizer != null)
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("get_ranges_error", e.message ?: "unknown")
        }
    }

    @ReactMethod
    fun release() {
        releaseEffects()
    }

    private fun releaseEffects() {
        try {
            equalizer?.release()
        } catch (_: Exception) {
        }
        try {
            bassBoost?.release()
        } catch (_: Exception) {
        }
        try {
            virtualizer?.release()
        } catch (_: Exception) {
        }
        equalizer = null
        bassBoost = null
        virtualizer = null
        sessionId = -1
    }
}
