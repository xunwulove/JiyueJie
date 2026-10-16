package `fun`.upup.musicfree.jamesdsp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.doublesymmetry.kotlinaudio.jamesdsp.JamesDSPBridge

/**
 * JamesDSP RN Native Module —— 暴露 libjamesdsp 效果器给 JS 层
 *
 * JS 侧通过 NativeModules.JamesDSPModule 调用。
 * 所有方法幂等，未初始化时调用无副作用（JamesDSPBridge 内部判空）。
 */
class JamesDSPModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "JamesDSPModule"

    // ==================== PostGain 输出增益 ====================

    @ReactMethod
    fun setPostGain(gainDb: Double) {
        JamesDSPBridge.nativeSetPostGain(gainDb.toFloat())
    }

    // ==================== Limiter 限幅器 ====================

    @ReactMethod
    fun setLimiter(thresholdDb: Double, releaseMs: Double) {
        JamesDSPBridge.nativeSetLimiter(thresholdDb.toFloat(), releaseMs.toFloat())
    }

    // ==================== Equalizer 15段 ====================

    @ReactMethod
    fun setEqualizer(enabled: Boolean, gains: ReadableArray) {
        val floatGains = FloatArray(15) { i ->
            if (i < gains.size()) gains.getDouble(i).toFloat() else 0f
        }
        JamesDSPBridge.nativeSetEqualizer(enabled, floatGains)
    }

    // ==================== BassBoost 动态低音 ====================

    @ReactMethod
    fun setBassBoost(enabled: Boolean, maxGainDb: Double) {
        JamesDSPBridge.nativeSetBassBoost(enabled, maxGainDb.toFloat())
    }

    // ==================== StereoEnhancement 立体声增强 ====================

    @ReactMethod
    fun setStereoEnhancement(enabled: Boolean, mix: Double) {
        JamesDSPBridge.nativeSetStereoEnhancement(enabled, mix.toFloat())
    }

    // ==================== Reverb 混响 ====================

    @ReactMethod
    fun setReverb(enabled: Boolean, preset: Int) {
        JamesDSPBridge.nativeSetReverb(enabled, preset)
    }

    // ==================== Compressor 压缩器 ====================

    @ReactMethod
    fun setCompressor(enabled: Boolean, fgtFacT: Double, granularity: Int, tfResolution: Int) {
        JamesDSPBridge.nativeSetCompressor(enabled, fgtFacT.toFloat(), granularity, tfResolution)
    }

    // ==================== VacuumTube 电子管 ====================

    @ReactMethod
    fun setVacuumTube(enabled: Boolean, dbGain: Double) {
        JamesDSPBridge.nativeSetVacuumTube(enabled, dbGain.toFloat())
    }

    // ==================== Crossfeed 交叉馈送 ====================

    @ReactMethod
    fun setCrossfeed(enabled: Boolean, mode: Int) {
        JamesDSPBridge.nativeSetCrossfeed(enabled, mode)
    }

    // ==================== Convolver 卷积器 ====================

    @ReactMethod
    fun setConvolver(enabled: Boolean) {
        JamesDSPBridge.nativeSetConvolver(enabled)
    }

    /**
     * 从 WAV 文件加载 IR（脉冲响应）到卷积器
     * @param wavData WAV 文件字节数组（Base64 解码后）
     */
    @ReactMethod
    fun loadIR(wavData: String) {
        try {
            val data = android.util.Base64.decode(wavData, android.util.Base64.DEFAULT)
            JamesDSPBridge.loadIRFromWav(data)
        } catch (_: Exception) {
        }
    }

    /**
     * 从 assets 目录加载内置 IR 预设
     * @param assetName assets/ir/ 下的文件名，如 "ir_church.wav"
     */
    @ReactMethod
    fun loadBuiltinIR(assetName: String) {
        try {
            val inputStream = reactApplicationContext.assets.open("ir/$assetName")
            val data = inputStream.readBytes()
            inputStream.close()
            JamesDSPBridge.loadIRFromWav(data)
        } catch (e: Exception) {
            android.util.Log.e("JamesDSPModule", "loadBuiltinIR failed: $assetName", e)
        }
    }
}
