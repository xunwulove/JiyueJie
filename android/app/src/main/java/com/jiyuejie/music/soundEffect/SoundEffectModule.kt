package com.jiyuejie.music.soundEffect

import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
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
 * 音效模块（已废弃系统 AudioEffect，改用 JamesDSP）
 *
 * 2026-10-16：系统 Equalizer/BassBoost/Virtualizer/LoudnessEnhancer/Reverb/DynamicsProcessing
 * 全部废弃，由 JamesDSP 核心库（libjamesdsp）通过 ExoPlayer AudioProcessor 管线替代。
 *
 * 本模块保留：
 * - audioSessionId 反射获取（调试用，JamesDSP 不需要 sessionId）
 * - 输出设备查询（音效页诊断用）
 * - 能力查询（返回空，UI 层应迁移到 JamesDSP）
 */
class SoundEffectModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var lastError: String? = null

    override fun getName(): String = "SoundEffectModule"

    // ==================== audioSessionId 获取（保留，调试用） ====================

    @ReactMethod
    fun getAudioSessionId(promise: Promise) {
        try {
            val id = resolveAudioSessionId()
            if (id > 0) {
                promise.resolve(id)
            } else {
                promise.reject("NO_SESSION", "audioSessionId not available (player not started)")
            }
        } catch (e: Exception) {
            promise.reject("REFLECT_ERROR", e.message ?: "unknown", e)
        }
    }

    private fun resolveAudioSessionId(): Int {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return resolveAudioSessionIdOnMain()
        }
        var result = -1
        val latch = CountDownLatch(1)
        Handler(Looper.getMainLooper()).post {
            result = resolveAudioSessionIdOnMain()
            latch.countDown()
        }
        latch.await()
        return result
    }

    private fun resolveAudioSessionIdOnMain(): Int {
        try {
            val reactCtx = reactContext
            val catalystInstance = reactCtx.catalystInstance ?: return -1
            val nativeModule = catalystInstance.getNativeModule(MusicModule::class.java)
                ?: return -1
            val musicServiceField = findField(nativeModule.javaClass, "musicService")
                ?: return -1
            musicServiceField.isAccessible = true
            val musicService = musicServiceField.get(nativeModule) ?: return -1
            val playerField = findField(musicService.javaClass, "player")
                ?: musicService.javaClass.superclass?.let { findField(it, "player") }
                ?: return -1
            playerField.isAccessible = true
            val player = playerField.get(musicService) ?: return -1
            val exoPlayerMethod = findMethod(player.javaClass, "getExoPlayer")
                ?: player.javaClass.superclass?.let { findMethod(it, "getExoPlayer") }
                ?: return -1
            exoPlayerMethod.isAccessible = true
            val exoPlayer = exoPlayerMethod.invoke(player) ?: return -1
            val audioSessionIdMethod = exoPlayer.javaClass.getMethod("getAudioSessionId")
            return audioSessionIdMethod.invoke(exoPlayer) as Int
        } catch (_: Exception) {
            return -1
        }
    }

    private fun findField(cls: Class<*>?, name: String): java.lang.reflect.Field? {
        var c = cls
        while (c != null) {
            try {
                return c.getDeclaredField(name)
            } catch (_: NoSuchFieldException) {
                c = c.superclass
            }
        }
        return null
    }

    private fun findMethod(cls: Class<*>?, name: String): java.lang.reflect.Method? {
        var c = cls
        while (c != null) {
            try {
                return c.getDeclaredMethod(name)
            } catch (_: NoSuchMethodException) {
                c = c.superclass
            }
        }
        return null
    }

    // ==================== 能力查询（返回空，已废弃） ====================

    @ReactMethod
    fun getInfo(promise: Promise) {
        val map = Arguments.createMap()
        map.putInt("bands", 0)
        map.putArray("centerFreqs", Arguments.createArray())
        map.putArray("presets", Arguments.createArray())
        map.putInt("levelMin", -1500)
        map.putInt("levelMax", 1500)
        map.putBoolean("bassSupported", false)
        map.putBoolean("virtualizerSupported", false)
        map.putBoolean("loudnessSupported", false)
        map.putBoolean("presetReverbSupported", false)
        map.putBoolean("envReverbSupported", false)
        map.putBoolean("dynamicsSupported", false)
        promise.resolve(map)
    }

    @ReactMethod
    fun getEffectRanges(promise: Promise) {
        val map = Arguments.createMap()
        map.putInt("bassMin", 0)
        map.putInt("bassMax", 1000)
        map.putInt("virtualizerMin", 0)
        map.putInt("virtualizerMax", 1000)
        map.putInt("loudnessMin", -1000)
        map.putInt("loudnessMax", 1000)
        promise.resolve(map)
    }

    // ==================== 输出设备查询（保留，诊断用） ====================

    @ReactMethod
    fun getOutputDevice(promise: Promise) {
        try {
            val audioManager = reactContext.getSystemService(AudioManager::class.java)
            val devices = audioManager?.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            val device = devices?.firstOrNull {
                it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                    it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                    it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                    it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
            } ?: devices?.firstOrNull()
            if (device != null) {
                val map = Arguments.createMap()
                map.putString("type", deviceTypeToString(device.type))
                map.putString("name", device.productName?.toString() ?: "")
                promise.resolve(map)
            } else {
                promise.reject("NO_DEVICE", "no output device found")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message ?: "unknown", e)
        }
    }

    private fun deviceTypeToString(type: Int): String = when (type) {
        AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "headset"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetooth"
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
        AudioDeviceInfo.TYPE_USB_DEVICE, AudioDeviceInfo.TYPE_USB_HEADSET -> "usb"
        else -> "unknown"
    }

    // ==================== 废弃的系统效果器方法（空实现，JS 层应迁移到 JamesDSP） ====================

    @ReactMethod
    @Deprecated("Use JamesDSPModule.setEqualizer instead")
    fun attach(sessionId: Int) {
        // 已废弃，JamesDSP 通过 ExoPlayer AudioProcessor 自动接入
    }

    @ReactMethod
    @Deprecated("Use JamesDSPModule.setEqualizer instead")
    fun setEqEnabled(enabled: Boolean) {
    }

    @ReactMethod
    @Deprecated("Use JamesDSPModule.setEqualizer instead")
    fun setPreset(index: Int) {
    }

    @ReactMethod
    @Deprecated("Use JamesDSPModule.setEqualizer instead")
    fun setBandLevel(band: Int, level: Int) {
    }

    @ReactMethod
    @Deprecated("Use JamesDSPModule.setBassBoost instead")
    fun setBassBoost(strength: Int) {
    }

    @ReactMethod
    @Deprecated("Use JamesDSPModule.setStereoEnhancement instead")
    fun setVirtualizer(strength: Int) {
    }

    @ReactMethod
    @Deprecated("Use JamesDSPModule.setPostGain instead")
    fun setLoudnessEnhancer(strength: Int) {
    }

    @ReactMethod
    @Deprecated("Use JamesDSPModule.setReverb instead")
    fun setReverbPreset(preset: Int) {
    }

    @ReactMethod
    @Deprecated("Use JamesDSPModule.setReverb instead")
    fun setEnvironmentalReverbPreset(preset: Int) {
    }

    @ReactMethod
    @Deprecated("Use JamesDSPModule.setCompressor instead")
    fun setDynamicsProcessing(strength: Int) {
    }

    @ReactMethod
    fun release() {
        // 已废弃，无效果器需要释放
    }
}
