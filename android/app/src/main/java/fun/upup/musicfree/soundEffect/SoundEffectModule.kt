package `fun`.upup.musicfree.soundEffect

import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.Virtualizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.doublesymmetry.trackplayer.module.MusicModule

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
 */
class SoundEffectModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var equalizer: Equalizer? = null
    private var bassBoost: BassBoost? = null
    private var virtualizer: Virtualizer? = null
    private var sessionId = -1

    override fun getName(): String = "SoundEffectModule"

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
            promise.reject("resolve_session_error", e.message ?: "unknown")
        }
    }

    private fun resolveAudioSessionId(): Int {
        val module = reactContext.getNativeModule(MusicModule::class.java)
            ?: throw IllegalStateException("TrackPlayerModule not registered")
        val musicServiceField = MusicModule::class.java.getDeclaredField("musicService")
        musicServiceField.isAccessible = true
        val musicService = musicServiceField.get(module)
            ?: throw IllegalStateException("player service not bound")
        val playerField = musicService.javaClass.getDeclaredField("player")
        playerField.isAccessible = true
        val queuedPlayer = playerField.get(musicService)
            ?: throw IllegalStateException("player not created")
        val exoMethod = queuedPlayer.javaClass.superclass.getDeclaredMethod("getExoPlayer")
        exoMethod.isAccessible = true
        val exo = exoMethod.invoke(queuedPlayer)
        // ExoPlayer 不在 app 模块编译 classpath，用反射读取 audioSessionId
        val sessionIdMethod = exo.javaClass.getMethod("getAudioSessionId")
        return sessionIdMethod.invoke(exo) as Int
    }

    /** 绑定三个效果器到指定 session（幂等：同一 session 已绑定则跳过） */
    @ReactMethod
    fun attach(sessionId: Int) {
        if (sessionId <= 0) return
        if (this.sessionId == sessionId && equalizer != null) return
        releaseEffects()
        try {
            equalizer = Equalizer(0, sessionId)
            bassBoost = BassBoost(0, sessionId)
            virtualizer = Virtualizer(0, sessionId)
            this.sessionId = sessionId
        } catch (e: Exception) {
            // 设备不支持时降级（release 置空，后续调用全部 no-op）
            releaseEffects()
        }
    }

    /** 效果器能力信息：频段数/中心频率(Hz)/电平范围/预设名列表 */
    @ReactMethod
    fun getInfo(promise: Promise) {
        val eq = equalizer
        if (eq == null) {
            promise.reject("not_attached", "call attach first")
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
