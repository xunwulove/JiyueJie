package com.doublesymmetry.kotlinaudio.jamesdsp

import android.content.Context
import com.google.android.exoplayer2.DefaultRenderersFactory
import com.google.android.exoplayer2.audio.AudioSink
import com.google.android.exoplayer2.audio.DefaultAudioSink

/**
 * 自定义 RenderersFactory —— 在 DefaultAudioSink 中注入 JamesDSPProcessor
 *
 * 继承 DefaultRenderersFactory，重写 buildAudioSink() 添加我们的 AudioProcessor
 */
class JamesDSPRenderersFactory(context: Context) : DefaultRenderersFactory(context) {

    override fun buildAudioSink(
        context: Context,
        enableFloatOutput: Boolean,
        enableAudioTrackPlaybackParams: Boolean,
        enableOffload: Boolean
    ): AudioSink {
        val jamesDspProcessor = JamesDSPProcessor()

        return DefaultAudioSink.Builder(context)
            .setAudioProcessors(arrayOf(jamesDspProcessor))
            .setEnableFloatOutput(enableFloatOutput)
            .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
            .build()
    }
}
