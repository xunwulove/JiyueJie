package `fun`.upup.musicfree.jamesdsp

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.doublesymmetry.kotlinaudio.jamesdsp.JamesDSPBridge
import com.doublesymmetry.kotlinaudio.jamesdsp.JamesDSPState

/**
 * JamesDSP RN Native Module —— 暴露 libjamesdsp 效果器给 JS 层
 *
 * JS 侧通过 NativeModules.JamesDSPModule 调用。
 * 所有方法幂等，未初始化时调用无副作用（JamesDSPBridge 内部判空）。
 */
class JamesDSPModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        /** 原生采样率/编码/旁路态变化时发射给 JS 的事件名 */
        const val EVENT_CONFIG_CHANGED = "JamesDspConfigChanged"
    }

    init {
        // 缺陷9/10：kotlinaudio 检测到采样率/编码/启用态变化时转发为 RN 事件
        JamesDSPState.onConfigChanged = { emitConfigChanged() }
    }

    override fun getName(): String = "JamesDSPModule"

    /** 把当前 JamesDSPState 作为 "JamesDspConfigChanged" 事件 payload 发出 */
    private fun emitConfigChanged() {
        try {
            val map: WritableMap = Arguments.createMap()
            map.putInt("sampleRate", JamesDSPState.inputSampleRate)
            map.putString("inputEncoding", JamesDSPState.inputEncoding)
            map.putBoolean("active", JamesDSPState.active)
            map.putBoolean("bypassed", JamesDSPState.bypassReason != null)
            map.putString("bypassReason", JamesDSPState.bypassReason)
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_CONFIG_CHANGED, map)
        } catch (_: Throwable) {
            // reactContext 尚未就绪（冷启动早期）时静默，不抛崩
        }
    }

    /**
     * 缺陷10：返回当前 DSP 诊断状态，供 UI 展示是否被旁路及原因。
     * 未初始化时给默认值（active=false, sampleRate=0, inputEncoding=""）。
     */
    @ReactMethod
    fun getDspDiagnostics(promise: Promise) {
        val map: WritableMap = Arguments.createMap()
        map.putBoolean("active", JamesDSPState.active)
        map.putString("inputEncoding", JamesDSPState.inputEncoding)
        map.putInt("sampleRate", JamesDSPState.inputSampleRate)
        map.putBoolean("bypassed", JamesDSPState.bypassReason != null)
        map.putString("bypassReason", JamesDSPState.bypassReason)
        promise.resolve(map)
    }

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
     * @param wavData WAV 文件 Base64 编码
     * @param promise 成功 resolve(true)；失败 resolve(false) 并 errorLog（不再空 catch）
     */
    @ReactMethod
    fun loadIR(wavData: String, promise: Promise) {
        try {
            val data = android.util.Base64.decode(wavData, android.util.Base64.DEFAULT)
            JamesDSPBridge.loadIRFromWav(data)
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("JamesDSPModule", "loadIR failed", e)
            promise.resolve(false)
        }
    }

    /**
     * 从 assets 目录加载内置 IR 预设
     * @param assetName assets/ir/ 下的文件名，如 "ir_church.wav"
     * @param promise 成功 resolve(true)；失败 resolve(false) 并 errorLog
     */
    @ReactMethod
    fun loadBuiltinIR(assetName: String, promise: Promise) {
        try {
            val inputStream = reactApplicationContext.assets.open("ir/$assetName")
            val data = inputStream.readBytes()
            inputStream.close()
            JamesDSPBridge.loadIRFromWav(data)
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("JamesDSPModule", "loadBuiltinIR failed: $assetName", e)
            promise.resolve(false)
        }
    }
}
