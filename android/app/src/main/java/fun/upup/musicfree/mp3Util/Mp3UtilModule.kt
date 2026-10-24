package `fun`.upup.musicfree.mp3Util

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.*
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import org.jaudiotagger.tag.images.ArtworkFactory
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class Mp3UtilModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "Mp3Util"

    private fun isContentUri(uri: Uri?): Boolean {
        return uri?.scheme?.equals("content", ignoreCase = true) == true
    }

    /** null 值不写入 map（WritableNativeMap.putString 传 null 会抛异常，导致整条 meta 丢失） */
    private fun WritableMap.putMeta(key: String, value: String?) {
        if (value != null) {
            putString(key, value)
        }
    }

    /**
     * 解析时长（毫秒字符串）：优先 MMR 元数据；取不到/为 0 时，
     * 用 码率(bps) × 文件大小 估算兜底（业界第③层；播放后由 JS 侧用播放器真实时长校准）。
     * 文件大小未知（content:// 场景）或无码率 → 返回 "0"。
     */
    private fun resolveDurationMs(
        filePath: String,
        mmr: MediaMetadataRetriever,
    ): String {
        val meta = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
        if (!meta.isNullOrEmpty() && (meta.toLongOrNull() ?: 0L) > 0L) {
            return meta
        }
        val bitrate = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)
            ?.toLongOrNull() ?: 0L
        val size = if (isContentUri(Uri.parse(filePath))) 0L else runCatching { File(filePath).length() }.getOrDefault(0L)
        if (bitrate > 0L && size > 0L) {
            return (size * 8L * 1000L / bitrate).toString()
        }
        return "0"
    }

    private fun metaMap(
        filePath: String,
        mmr: MediaMetadataRetriever,
    ): WritableMap = Arguments.createMap().apply {
        putMeta("duration", resolveDurationMs(filePath, mmr))
        putMeta("bitrate", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE))
        putMeta("artist", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST))
        putMeta("author", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_AUTHOR))
        putMeta("album", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM))
        putMeta("title", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE))
        putMeta("date", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE))
        putMeta("year", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR))
    }

    @ReactMethod
    fun getBasicMeta(filePath: String, promise: Promise) {
        try {
            val uri = Uri.parse(filePath)
            val mmr = MediaMetadataRetriever()
            if (isContentUri(uri)) {
                mmr.setDataSource(reactApplicationContext, uri)
            } else {
                mmr.setDataSource(filePath)
            }

            val properties = metaMap(filePath, mmr)
            promise.resolve(properties)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun getMediaMeta(filePaths: ReadableArray, promise: Promise) {
        val metas = Arguments.createArray()
        val mmr = MediaMetadataRetriever()
        for (i in 0 until filePaths.size()) {
            try {
                val filePath = filePaths.getString(i)
                val uri = Uri.parse(filePath)

                if (isContentUri(uri)) {
                    mmr.setDataSource(reactApplicationContext, uri)
                } else {
                    mmr.setDataSource(filePath)
                }

                metas.pushMap(metaMap(filePath, mmr))
            } catch (e: Exception) {
                metas.pushNull()
            }
        }
        try {
            mmr.release()
        } catch (ignored: Exception) {
        }
        promise.resolve(metas)
    }


    @ReactMethod
    fun getMediaCoverImg(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("File not exist", "File not exist")
                return
            }

            val pathHashCode = file.hashCode()
            if (pathHashCode == 0) {
                promise.resolve(null)
                return
            }

            val cacheDir = reactContext.cacheDir
            val coverFile = File(cacheDir, "image_manager_disk_cache/$pathHashCode.jpg")
            if (coverFile.exists()) {
                promise.resolve(coverFile.toURI().toString())
                return
            }

            val mmr = MediaMetadataRetriever()
            mmr.setDataSource(filePath)
            val coverImg = mmr.embeddedPicture
            if (coverImg != null) {
                val bitmap = BitmapFactory.decodeByteArray(coverImg, 0, coverImg.size)
                FileOutputStream(coverFile).use { outputStream ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 100, outputStream)
                    outputStream.flush()
                }
                promise.resolve(coverFile.toURI().toString())
            } else {
                promise.resolve(null)
            }
            mmr.release()
        } catch (ignored: Exception) {
            promise.reject("Error", "Got error")
        }
    }

    @ReactMethod
    fun getLyric(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (file.exists()) {
                val audioFile = AudioFileIO.read(file)
                val tag = audioFile.tag
                val lrc = tag.getFirst(FieldKey.LYRICS)
                promise.resolve(lrc)
            } else {
                throw IOException("File not found")
            }
        } catch (e: Exception) {
            promise.reject("Error", e.message)
        }
    }

    @ReactMethod
    fun setMediaTag(filePath: String, meta: ReadableMap, promise: Promise) {
        try {
            val file = File(filePath)
            if (file.exists()) {
                val audioFile = AudioFileIO.read(file)
                val tag = audioFile.tag
                meta.getString("title")?.let { tag.setField(FieldKey.TITLE, it) }
                meta.getString("artist")?.let { tag.setField(FieldKey.ARTIST, it) }
                meta.getString("album")?.let { tag.setField(FieldKey.ALBUM, it) }
                meta.getString("lyric")?.let { tag.setField(FieldKey.LYRICS, it) }
                meta.getString("comment")?.let { tag.setField(FieldKey.COMMENT, it) }
                audioFile.commit()
                promise.resolve(true)
            } else {
                promise.reject("Error", "File Not Exist")
            }
        } catch (e: Exception) {
            promise.reject("Error", e.message)
        }
    }

    @ReactMethod
    fun getMediaTag(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (file.exists()) {
                val audioFile = AudioFileIO.read(file)
                val tag = audioFile.tag

                val properties = Arguments.createMap().apply {
                    putString("title", tag.getFirst(FieldKey.TITLE))
                    putString("artist", tag.getFirst(FieldKey.ARTIST))
                    putString("album", tag.getFirst(FieldKey.ALBUM))
                    putString("lyric", tag.getFirst(FieldKey.LYRICS))
                    putString("comment", tag.getFirst(FieldKey.COMMENT))
                }
                promise.resolve(properties)
            } else {
                promise.reject("Error", "File Not Found")
            }
        } catch (e: Exception) {
            promise.reject("Error", e.message)
        }
    }

    /**
     * 写入内嵌专辑图（ID3 APIC / 封面 Artwork）：
     * - coverUri 支持网络 URL（下载到缓存后嵌入）与本地 file:// 路径
     * - 下载加 UA；防盗链拒绝时带网易 Referer 重试一次；下载字节统一转 JPEG 后嵌入
     *   （jaudiotagger 对 jpg/png 支持最稳，webp 等格式可被 BitmapFactory 解码）
     * - 下载/嵌入失败会 reject，由 JS 侧 catch（不影响歌曲入库），但 Log.w 留痕便于排查
     */
    @ReactMethod
    fun setMediaCover(filePath: String, coverUri: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("Error", "File Not Exist")
                return
            }
            // 解析封面来源：网络 URL 先下载（统一转 JPEG）；本地 file:// 直接取路径
            val coverFile: File? =
                if (coverUri.startsWith("http://") || coverUri.startsWith("https://")) {
                    downloadCoverToJpeg(coverUri)
                } else {
                    val p = if (coverUri.startsWith("file://")) coverUri.removePrefix("file://") else coverUri
                    File(p)
                }
            if (coverFile == null || !coverFile.exists()) {
                promise.reject("Error", "Cover File Not Found")
                return
            }
            val audioFile = AudioFileIO.read(file)
            val tag = audioFile.tag
            // jaudiotagger 2.2.5：ArtworkFactory.createArtworkFromFile(File)
            val artwork = ArtworkFactory.createArtworkFromFile(coverFile)
            if (artwork != null) {
                tag.deleteArtworkField()
                tag.setField(artwork)
                audioFile.commit()
                promise.resolve(true)
            } else {
                promise.reject("Error", "Cover artwork null")
            }
        } catch (e: Exception) {
            Log.w("Mp3Util", "setMediaCover failed: ${e.message}")
            promise.reject("Error", e.message)
        }
    }

    /**
     * 下载封面并统一转 JPEG：加浏览器 UA；失败（非 2xx）带网易 Referer 重试一次
     * （网易系封面图床防盗链）；BitmapFactory 解码 jpg/png/webp → 压缩 JPEG 落盘，
     * 过大图先采样（长边 >1024 降采样防 OOM）。
     */
    private fun downloadCoverToJpeg(coverUri: String): File? {
        val userAgent =
            "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"
        var tmpRaw: File? = null
        var ok = false
        for (attempt in 0..1) {
            try {
                val conn = URL(coverUri).openConnection() as HttpURLConnection
                conn.connectTimeout = 10000
                conn.readTimeout = 15000
                conn.setRequestProperty("User-Agent", userAgent)
                if (attempt == 1) {
                    conn.setRequestProperty("Referer", "https://music.163.com")
                }
                conn.connect()
                if (conn.responseCode in 200..299) {
                    val tmp = File(reactContext.cacheDir, "cover_${System.currentTimeMillis()}.raw")
                    FileOutputStream(tmp).use { out ->
                        conn.inputStream.use { input ->
                            input.copyTo(out, 1024 * 64)
                        }
                    }
                    tmpRaw = tmp
                    ok = true
                }
                conn.disconnect()
                if (ok) break
            } catch (ignored: Exception) {
                // 重试一次（带 Referer）
            }
        }
        if (!ok || tmpRaw == null || tmpRaw.length() == 0L) {
            tmpRaw?.delete()
            return null
        }
        // 捕获非空引用供 finally 清理（消除 var 智能转换丢失导致的冗余安全调用警告）
        val rawForCleanup = tmpRaw
        return try {
            // 采样解码：长边 >1024 降采样，防大封面 OOM
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(rawForCleanup.absolutePath, bounds)
            var sample = 1
            while (
                (bounds.outWidth / (sample * 2)) >= 1024 ||
                (bounds.outHeight / (sample * 2)) >= 1024
            ) {
                sample *= 2
            }
            val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sample }
            val bmp = BitmapFactory.decodeFile(rawForCleanup.absolutePath, decodeOpts)
            if (bmp == null) {
                // 非可解码图片，直接用原字节（罕见，交给 jaudiotagger 判定）
                rawForCleanup
            } else {
                val tmpJpg = File(reactContext.cacheDir, "cover_${System.currentTimeMillis()}.jpg")
                FileOutputStream(tmpJpg).use { out ->
                    bmp.compress(Bitmap.CompressFormat.JPEG, 92, out)
                }
                tmpJpg
            }
        } catch (e: Exception) {
            Log.w("Mp3Util", "cover decode failed, fallback raw: ${e.message}")
            rawForCleanup
        } finally {
            rawForCleanup.delete()
        }
    }
}