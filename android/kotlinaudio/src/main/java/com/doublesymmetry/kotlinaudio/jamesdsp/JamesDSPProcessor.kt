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
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
            active = false
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

        return AudioFormat(inputSampleRate, inputChannelCount, C.ENCODING_PCM_16BIT)
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
    }
}
