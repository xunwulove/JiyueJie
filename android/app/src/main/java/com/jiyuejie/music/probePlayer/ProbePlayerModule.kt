package com.jiyuejie.music.probePlayer

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.PlaybackException
import com.google.android.exoplayer2.Player
import com.google.android.exoplayer2.audio.AudioAttributes
import com.google.android.exoplayer2.source.DefaultMediaSourceFactory
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 音源探测播放验证模块（方案 B：独立 ExoPlayer 静默验证）
 *
 * 与主播放器（react-native-track-player 单例）完全隔离：
 * - 独立 ExoPlayer 实例，不复用主播放器
 * - volume=0 静音输出，走独立 audio session，无声
 * - setAudioAttributes(..., handleAudioFocus=false) 不请求音频焦点，不打断正在播放的音乐
 * - 无 MediaSession，不进系统通知栏
 * - 验证结束（成功/失败/超时）立即 release，不留常驻播放器
 *
 * 判定口径：拉流+解码成功且播放位置推进 ≥2s 无错误 = 可播。
 * 与主播放器"真实播放 ≥2s"的 play 维度判定一致。
 */
class ProbePlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ProbePlayer"

    @ReactMethod
    fun probeUrl(
        url: String,
        headers: ReadableMap?,
        timeoutMs: Double,
        promise: Promise,
    ) {
        // ExoPlayer 必须在主线程（Looper）创建与操作
        Handler(Looper.getMainLooper()).post {
            runProbe(
                url,
                headers,
                timeoutMs.toLong().coerceIn(3000, 60000),
                promise,
            )
        }
    }

    private fun runProbe(
        url: String,
        headers: ReadableMap?,
        timeoutMs: Long,
        promise: Promise,
    ) {
        val mainHandler = Handler(Looper.getMainLooper())
        val finished = AtomicBoolean(false)
        var player: ExoPlayer? = null

        fun finishReject(code: String, message: String) {
            if (finished.compareAndSet(false, true)) {
                mainHandler.removeCallbacksAndMessages(null)
                player?.release()
                promise.reject(code, message)
            }
        }

        fun finishResolve() {
            if (finished.compareAndSet(false, true)) {
                mainHandler.removeCallbacksAndMessages(null)
                player?.release()
                promise.resolve(true)
            }
        }

        try {
            // 1. 数据源：带音源要求的 headers（防盗链 UA/referer/cookie 等）
            val headerMap = HashMap<String, String>()
            if (headers != null) {
                val it = headers.keySetIterator()
                while (it.hasNextKey()) {
                    val key = it.nextKey()
                    val value = headers.getString(key)
                    if (value != null) {
                        headerMap[key] = value
                    }
                }
            }
            val dataSourceFactory = DefaultHttpDataSource.Factory()
            dataSourceFactory.setUserAgent(
                "Mozilla/5.0 (Linux; Android 13; MusicFree) AppleWebKit/537.36",
            )
            if (headerMap.isNotEmpty()) {
                dataSourceFactory.setDefaultRequestProperties(headerMap)
            }

            // 2. 独立 ExoPlayer：静音 + 不抢音频焦点 + 不响应音频变更
            player = ExoPlayer.Builder(reactApplicationContext)
                .setMediaSourceFactory(
                    DefaultMediaSourceFactory(dataSourceFactory),
                )
                .build()
            player.setAudioAttributes(AudioAttributes.DEFAULT, false)
            player.setHandleAudioBecomingNoisy(false)
            player.volume = 0f

            // 3. 位置轮询：READY 后每 100ms 检查，播放位置 ≥2s 判定可播
            val positionWatcher = object : Runnable {
                override fun run() {
                    if (finished.get()) {
                        return
                    }
                    val p = player
                    if (
                        p != null &&
                        p.playbackState == Player.STATE_READY &&
                        p.currentPosition >= 2000
                    ) {
                        finishResolve()
                    } else {
                        mainHandler.postDelayed(this, 100)
                    }
                }
            }

            player.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    if (state == Player.STATE_READY && !finished.get()) {
                        mainHandler.postDelayed(positionWatcher, 100)
                    }
                }

                override fun onPlayerError(error: PlaybackException) {
                    finishReject(
                        "PROBE_ERROR",
                        "播放出错: ${error.errorCodeName}",
                    )
                }
            })

            // 4. 播放
            player.setMediaItem(MediaItem.fromUri(url))
            player.prepare()
            player.play()

            // 5. 总超时（默认 15s：缓冲 + 2s 播放 + 余量）
            mainHandler.postDelayed(
                {
                    finishReject("PROBE_TIMEOUT", "播放验证超时")
                },
                timeoutMs,
            )
        } catch (e: Exception) {
            finishReject("PROBE_FAIL", e.message ?: "探测失败")
        }
    }
}
