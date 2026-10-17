package com.doublesymmetry.kotlinaudio.jamesdsp

import java.nio.ByteBuffer

/**
 * JamesDSP 核心库 Kotlin 桥接层（P2 完整效果器映射）
 *
 * 通过 JNI 调用 libjamesdsp 核心库。所有效果器参数设置方法线程安全（核心库内部有 mutex）。
 *
 * 效果器映射：
 * - Equalizer      → MultimodalEQ 15段 (FIR/IIR)
 * - BassBoost      → DBB 动态低音
 * - Virtualizer    → StereoEnhancement + Crossfeed
 * - Reverb         → Progenitor2 (20预设)
 * - Compressor     → FFT 频域压缩器
 * - Limiter        → JLimiter
 * - VacuumTube     → 电子管模拟
 * - Convolver      → 1D 卷积器 (IR 后续)
 * - PostGain       → 输出增益
 */
object JamesDSPBridge {

    init {
        System.loadLibrary("jiyuejie_dsp")
    }

    // ==================== 生命周期 ====================

    external fun nativeInit(blockSize: Int, sampleRate: Float): Boolean
    external fun nativeFree()
    external fun nativeProcess(input: ByteBuffer, output: ByteBuffer, frames: Int)
    external fun nativeSetSampleRate(sampleRate: Float)

    fun process(input: ByteBuffer, output: ByteBuffer, frames: Int) {
        nativeProcess(input, output, frames)
    }

    // ==================== PostGain 输出增益 ====================

    /** @param pGaindB 输出增益 dB，范围 -12..+12，0=直通 */
    external fun nativeSetPostGain(pGaindB: Float)

    // ==================== Limiter 限幅器 ====================

    /**
     * @param thresholddB 阈值 dB，建议 -3..0，0=不限制
     * @param msRelease   释放时间 ms，建议 50..300
     */
    external fun nativeSetLimiter(thresholddB: Float, msRelease: Float)

    // ==================== Equalizer 15段 ====================

    /**
     * @param enabled 是否启用
     * @param gains   15个频段增益 dB，顺序：25,40,63,100,160,250,400,630,1k,1.6k,2.5k,4k,6.3k,10k,16k
     */
    external fun nativeSetEqualizer(enabled: Boolean, gains: FloatArray)

    // ==================== BassBoost DBB 动态低音 ====================

    /**
     * @param enabled 是否启用
     * @param maxGain 最大低音增益 dB，范围 0..15
     */
    external fun nativeSetBassBoost(enabled: Boolean, maxGain: Float)

    // ==================== StereoEnhancement 立体声增强 ====================

    /**
     * @param enabled 是否启用
     * @param mix     混合比例 0..1，0=原音，1=最大增强
     */
    external fun nativeSetStereoEnhancement(enabled: Boolean, mix: Float)

    // ==================== Reverb 混响 ====================

    /**
     * @param enabled 是否启用
     * @param preset  预设编号 0..19（Progenitor2 20个预设）
     */
    external fun nativeSetReverb(enabled: Boolean, preset: Int)

    // ==================== Compressor FFT 压缩器 ====================

    /**
     * @param enabled      是否启用
     * @param fgtFacT      前向增益跟踪系数，建议 0.01..0.5
     * @param granularity  频域粒度，建议 4..8
     * @param tfResolution 时频分辨率，建议 2..6
     */
    external fun nativeSetCompressor(enabled: Boolean, fgtFacT: Float, granularity: Int, tfResolution: Int)

    // ==================== VacuumTube 电子管模拟 ====================

    /**
     * @param enabled 是否启用
     * @param dbGain  驱动增益 dB，范围 0..24，越大越暖
     */
    external fun nativeSetVacuumTube(enabled: Boolean, dbGain: Float)

    // ==================== Crossfeed 交叉馈送 ====================

    /**
     * @param enabled 是否启用
     * @param mode    模式 0..5：0=BS2B Lv1, 1=BS2B Lv2, 2=HRTF crossfeed, 3-5=HRTF surround
     */
    external fun nativeSetCrossfeed(enabled: Boolean, mode: Int)

    // ==================== Convolver 卷积器 ====================

    /** @param enabled 是否启用 */
    external fun nativeSetConvolver(enabled: Boolean)

    /**
     * 加载 IR（脉冲响应）到卷积器
     * @param irFloat      归一化 float 数组（-1..1，交错 L/R）
     * @param channels     声道数（1=mono, 2=stereo）
     * @param length       采样点数（每声道）
     * @param irSampleRate IR 自带采样率（Hz）；<=0 表示未知，native 侧不重采样
     */
    external fun nativeLoadIR(irFloat: FloatArray, channels: Int, length: Int, irSampleRate: Int)

    /**
     * 从 WAV 文件加载 IR（便捷封装，自动解码）
     * @param wavData WAV 文件字节数组
     * @return true=加载成功
     */
    fun loadIRFromWav(wavData: ByteArray): Boolean {
        return try {
            val decoded = decodeWav16Bit(wavData)
            if (decoded.sampleCount <= 0) return false
            nativeLoadIR(decoded.samples, decoded.channels, decoded.sampleCount, decoded.sampleRate)
            true
        } catch (e: Exception) {
            false
        }
    }

    /** WAV 解码结果：samples 为交错归一化 float；sampleRate 为 0 表示未解析到 */
    private data class WavDecoded(
        val samples: FloatArray,
        val channels: Int,
        val sampleCount: Int,
        val sampleRate: Int
    )

    /**
     * 解码 16-bit PCM WAV → 归一化 float 数组
     * 采样率随数据一并解析并回传，由 native 侧按需重采样到引擎采样率
     */
    private fun decodeWav16Bit(data: ByteArray): WavDecoded {
        if (data.size < 44) return WavDecoded(FloatArray(0), 0, 0, 0)
        // RIFF header（检查完整 "RIFF"）
        if (data[0].toInt() != 0x52 || data[1].toInt() != 0x49 ||
            data[2].toInt() != 0x46 || data[3].toInt() != 0x46) return WavDecoded(FloatArray(0), 0, 0, 0)
        // 解析 fmt chunk
        var offset = 12
        var channels = 2
        var bitsPerSample = 16
        var sampleRate = 0
        var dataOffset = 44
        while (offset < data.size - 8) {
            val chunkId = String(data, offset, 4)
            val chunkSize = (data[offset + 4].toInt() and 0xFF) or
                ((data[offset + 5].toInt() and 0xFF) shl 8) or
                ((data[offset + 6].toInt() and 0xFF) shl 16) or
                ((data[offset + 7].toInt() and 0xFF) shl 24)
            if (chunkId == "fmt ") {
                channels = (data[offset + 10].toInt() and 0xFF) or
                    ((data[offset + 11].toInt() and 0xFF) shl 8)
                // fmt chunk 内偏移 +12 起 4 字节小端为采样率
                sampleRate = (data[offset + 12].toInt() and 0xFF) or
                    ((data[offset + 13].toInt() and 0xFF) shl 8) or
                    ((data[offset + 14].toInt() and 0xFF) shl 16) or
                    ((data[offset + 15].toInt() and 0xFF) shl 24)
                bitsPerSample = (data[offset + 22].toInt() and 0xFF) or
                    ((data[offset + 23].toInt() and 0xFF) shl 8)
            } else if (chunkId == "data") {
                dataOffset = offset + 8
                val totalSamples = chunkSize / (bitsPerSample / 8)
                val sampleCount = totalSamples / channels
                val samples = FloatArray(totalSamples)
                var idx = 0
                var p = dataOffset
                val bytesPerSample = bitsPerSample / 8
                while (idx < totalSamples && p + bytesPerSample <= data.size) {
                    val s = if (bitsPerSample == 16) {
                        ((data[p].toInt() and 0xFF) or ((data[p + 1].toInt() and 0xFF) shl 8)).toShort() / 32768.0f
                    } else {
                        (data[p].toInt() and 0xFF) / 128.0f
                    }
                    samples[idx] = s
                    idx++
                    p += bytesPerSample
                }
                return WavDecoded(samples, channels, sampleCount, sampleRate)
            }
            offset += 8 + chunkSize + (chunkSize % 2)
        }
        return WavDecoded(FloatArray(0), 0, 0, 0)
    }
}
