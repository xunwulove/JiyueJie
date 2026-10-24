package com.doublesymmetry.kotlinaudio.jamesdsp

import android.util.Log
import com.google.android.exoplayer2.C
import com.google.android.exoplayer2.audio.AudioProcessor
import com.google.android.exoplayer2.audio.AudioProcessor.AudioFormat
import com.google.android.exoplayer2.audio.AudioProcessor.EMPTY_BUFFER
import com.google.android.exoplayer2.util.Assertions
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * JamesDSP 跨模块共享状态。
 *
 * kotlinaudio 是纯音频模块（无 React 上下文），由 android/app 的 JamesDSPModule
 * 挂载 [onConfigChanged] 回调，把"采样率/编码/启用态/旁路原因"变化转发为 RN 事件
 * "JamesDspConfigChanged"。
 *
 * 修复：
 * - 缺陷9：切歌换采样率 → configure() 重新 nativeInit 把 DSP 参数重置为 Disable，
 *   JS 无感知 → 状态变化时回调，JS 重放全部 jdsp 配置。
 * - 缺陷10：非 16bit 输入被原生旁路时，把编码与旁路原因暴露给 JS/UI，不再静默。
 */
object JamesDSPState {
    /** 当前输入采样率（Hz），未配置为 0 */
    @Volatile
    var inputSampleRate: Int = 0
        private set

    /** 当前输入编码的可读名，如 "pcm_16bit"，未配置为 "" */
    @Volatile
    var inputEncoding: String = ""
        private set

    /** DSP 是否真正启用（16bit 且 nativeInit 成功路径） */
    @Volatile
    var active: Boolean = false
        private set

    /** 非空 = 处于旁路，值为人读原因；null = 未旁路 */
    @Volatile
    var bypassReason: String? = null
        private set

    /** 配置变化回调（在 ExoPlayer 音频线程触发），由 RN 模块注册 */
    @Volatile
    var onConfigChanged: ((JamesDSPState) -> Unit)? = null

    @Volatile private var lastSampleRate: Int = -1
    @Volatile private var lastEncoding: String? = null
    @Volatile private var lastActive: Boolean = false
    @Volatile private var lastBypassReason: String? = null

    @Synchronized
    fun update(sampleRate: Int, encoding: String, active: Boolean, bypassReason: String?) {
        this.inputSampleRate = sampleRate
        this.inputEncoding = encoding
        this.active = active
        this.bypassReason = bypassReason
        val changed = sampleRate != lastSampleRate ||
                encoding != lastEncoding ||
                active != lastActive ||
                bypassReason != lastBypassReason
        if (changed) {
            lastSampleRate = sampleRate
            lastEncoding = encoding
            lastActive = active
            lastBypassReason = bypassReason
            onConfigChanged?.invoke(this)
        }
    }

    /** 播放器释放/重建后调用：使下次 configure() 必然视为变化，触发 JS 重放。 */
    @Synchronized
    fun invalidate() {
        lastSampleRate = -1
        lastEncoding = null
        lastActive = false
        lastBypassReason = null
    }
}

/**
 * JamesDSP AudioProcessor —— 将 libjamesdsp 核心库接入 ExoPlayer 音频管线
 *
 * 处理 16-bit PCM → 转 float → JamesDSP → 转回 16-bit PCM
 * 性能优化：预分配最大尺寸缓冲区复用，避免每帧 allocateDirect。
 */
class JamesDSPProcessor : AudioProcessor {

    companion object {
        private const val MAX_FRAMES = 8192
    }

    private var active = false
    private var inputSampleRate = 0
    private var inputChannelCount = 0
    private var bytesPerFrame = 2

    // 预分配缓冲区（configure 时分配一次，后续复用）
    private var inputBuffer: ByteBuffer = EMPTY_BUFFER
    private var outputBuffer: ByteBuffer = EMPTY_BUFFER
    private var floatInput: ByteBuffer = EMPTY_BUFFER
    private var floatOutput: ByteBuffer = EMPTY_BUFFER

    private var endOfStream = false

    override fun configure(inputAudioFormat: AudioFormat): AudioFormat {
        val rawEncoding = inputAudioFormat.encoding
        if (rawEncoding != C.ENCODING_PCM_16BIT) {
            active = false
            // 缺陷10：非16bit 保持旁路不破坏音频，但把编码与原因暴露给 JS/UI
            JamesDSPState.update(
                inputAudioFormat.sampleRate,
                encodingName(rawEncoding),
                false,
                "input encoding not 16bit PCM"
            )
            return inputAudioFormat
        }
        inputSampleRate = inputAudioFormat.sampleRate
        inputChannelCount = inputAudioFormat.channelCount
        bytesPerFrame = inputChannelCount * 2
        active = true

        JamesDSPBridge.nativeInit(MAX_FRAMES, inputSampleRate.toFloat())

        // 预分配最大尺寸缓冲区（直接缓冲区，JNI 可直接访问）
        val maxBytes = MAX_FRAMES * bytesPerFrame
        val maxFloats = MAX_FRAMES * inputChannelCount * 4
        inputBuffer = ByteBuffer.allocateDirect(maxBytes).order(ByteOrder.nativeOrder())
        outputBuffer = ByteBuffer.allocateDirect(maxBytes).order(ByteOrder.nativeOrder())
        floatInput = ByteBuffer.allocateDirect(maxFloats).order(ByteOrder.nativeOrder())
        floatOutput = ByteBuffer.allocateDirect(maxFloats).order(ByteOrder.nativeOrder())

        // 缺陷9：记录本次采样率/编码/启用态，与上次不同则通知 JS 重放配置
        JamesDSPState.update(inputSampleRate, "pcm_16bit", true, null)

        return AudioFormat(inputSampleRate, inputChannelCount, C.ENCODING_PCM_16BIT)
    }

    private fun encodingName(encoding: Int): String = when (encoding) {
        C.ENCODING_PCM_16BIT -> "pcm_16bit"
        C.ENCODING_PCM_8BIT -> "pcm_8bit"
        C.ENCODING_PCM_FLOAT -> "pcm_float"
        else -> "pcm_unknown_$encoding"
    }

    override fun isActive(): Boolean = active

    override fun queueInput(buffer: ByteBuffer) {
        if (!active) return
        Assertions.checkState(!endOfStream, "Input after end of stream")

        val remaining = buffer.remaining()
        if (remaining == 0) return

        // 输出缓冲区还有未消费数据时，先不处理新输入（等 getOutput 后再处理）
        if (outputBuffer !== EMPTY_BUFFER && outputBuffer.hasRemaining()) return

        // 复制到预分配缓冲区
        inputBuffer.clear()
        val toCopy = minOf(remaining, inputBuffer.capacity())
        val oldLimit = buffer.limit()
        buffer.limit(buffer.position() + toCopy)
        inputBuffer.put(buffer)
        buffer.limit(oldLimit)
        inputBuffer.flip()

        processBuffer()
    }

    override fun queueEndOfStream() {
        endOfStream = true
        if (inputBuffer.hasRemaining()) {
            processBuffer()
        }
    }

    private fun processBuffer() {
        if (!inputBuffer.hasRemaining()) return

        val frames = inputBuffer.remaining() / bytesPerFrame
        if (frames <= 0) return

        // 16-bit → float
        floatInput.clear()
        val sampleCount = frames * inputChannelCount
        for (i in 0 until sampleCount) {
            floatInput.putFloat(inputBuffer.short / 32768.0f)
        }
        floatInput.flip()

        // JamesDSP 处理（JNI 直接操作内存，不更新 ByteBuffer position，需手动设置）
        floatOutput.clear()
        JamesDSPBridge.process(floatInput, floatOutput, frames)
        floatOutput.position(sampleCount * 4)  // JNI 写入了 sampleCount 个 float
        floatOutput.flip()

        // float → 16-bit，写入预分配输出缓冲区
        outputBuffer.clear()
        for (i in 0 until sampleCount) {
            val f = floatOutput.getFloat()
            val s = (f * 32767.0f).coerceIn(-32768.0f, 32767.0f).toInt().toShort()
            outputBuffer.putShort(s)
        }
        outputBuffer.flip()

        inputBuffer.position(inputBuffer.limit())
    }

    override fun getOutput(): ByteBuffer {
        if (outputBuffer === EMPTY_BUFFER || !outputBuffer.hasRemaining()) {
            return EMPTY_BUFFER
        }
        // 返回 slice，调用方消费后不影响我们的缓冲区
        val result = outputBuffer.slice()
        outputBuffer.position(outputBuffer.limit())
        return result
    }

    override fun isEnded(): Boolean = endOfStream && !outputBuffer.hasRemaining()

    override fun flush() {
        endOfStream = false
        if (inputBuffer !== EMPTY_BUFFER) inputBuffer.clear()
        if (outputBuffer !== EMPTY_BUFFER) outputBuffer.clear()
    }

    override fun reset() {
        flush()
        active = false
        inputSampleRate = 0
        inputChannelCount = 0
        bytesPerFrame = 2
        inputBuffer = EMPTY_BUFFER
        outputBuffer = EMPTY_BUFFER
        floatInput = EMPTY_BUFFER
        floatOutput = EMPTY_BUFFER
        JamesDSPBridge.nativeFree()
        // 播放器释放后 native 已清空；下次即便采样率相同也要通知 JS 重放
        JamesDSPState.invalidate()
    }
}
