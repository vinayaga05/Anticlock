package com.anticlock.clipeditor

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.ChannelMixingAudioProcessor
import androidx.media3.common.audio.ChannelMixingMatrix
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import org.json.JSONObject

@UnstableApi
class ClipEditorModule(reactContext: ReactApplicationContext) : NativeClipEditorSpec(reactContext) {

  companion object {
    const val NAME = "ClipEditor"
    private const val MAX_SHORT_SIDE = 1080
    private const val VIDEO_BITRATE = 6_000_000
  }

  private val executor = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())

  // Only touched on the main thread.
  private var transformer: Transformer? = null
  private var pendingPromise: Promise? = null
  private val progressHolder = ProgressHolder()

  @Volatile private var progress = 0.0

  override fun getName(): String = NAME

  override fun invalidate() {
    mainHandler.post { transformer?.cancel() }
    executor.shutdown()
    super.invalidate()
  }

  // ---------------------------------------------------------------------------
  // Helpers

  private data class VideoMeta(
    val durationMs: Double,
    val width: Int,
    val height: Int,
    val hasAudio: Boolean,
  )

  private fun parseUri(uri: String): Uri =
    if (uri.startsWith("/")) Uri.fromFile(File(uri)) else Uri.parse(uri)

  private fun <T> withRetriever(uri: String, block: (MediaMetadataRetriever) -> T): T {
    val retriever = MediaMetadataRetriever()
    try {
      val parsed = parseUri(uri)
      if (parsed.scheme == "file") {
        retriever.setDataSource(parsed.path)
      } else {
        retriever.setDataSource(reactApplicationContext, parsed)
      }
      return block(retriever)
    } finally {
      try {
        retriever.release()
      } catch (_: Exception) {}
    }
  }

  private fun readMeta(uri: String): VideoMeta = withRetriever(uri) { r ->
    val duration =
      r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0
    val w = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
    val h = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
    val rotation =
      r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
    val hasVideo = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO) == "yes"
    val hasAudio = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO) == "yes"
    if (!hasVideo) throw IllegalStateException("This file has no readable video track")
    val swap = rotation == 90 || rotation == 270
    VideoMeta(duration, if (swap) h else w, if (swap) w else h, hasAudio)
  }

  private fun cacheDir(name: String): File =
    File(reactApplicationContext.cacheDir, name).apply { mkdirs() }

  private fun writeJpeg(bitmap: Bitmap, dirName: String): String {
    val file = File(cacheDir(dirName), "${UUID.randomUUID()}.jpg")
    FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 75, it) }
    return Uri.fromFile(file).toString()
  }

  private fun frameAt(r: MediaMetadataRetriever, timeMs: Double, maxWidth: Int): Bitmap? {
    val us = (timeMs * 1000).toLong().coerceAtLeast(0)
    val option = MediaMetadataRetriever.OPTION_CLOSEST_SYNC
    val frame =
      if (Build.VERSION.SDK_INT >= 27) {
        val srcW = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: maxWidth
        val srcH = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: maxWidth
        // Bound the longest side so portrait and landscape both stay small.
        val longest = max(srcW, srcH).coerceAtLeast(1)
        val target = (maxWidth * 2).coerceAtMost(longest)
        val scale = target.toFloat() / longest
        val dstW = (srcW * scale).roundToInt().coerceAtLeast(1)
        val dstH = (srcH * scale).roundToInt().coerceAtLeast(1)
        r.getScaledFrameAtTime(us, option, dstW, dstH)
      } else {
        r.getFrameAtTime(us, option)
      }
    return frame
  }

  /** Remote tracks and Metro-served dev assets are downloaded before composing. */
  private fun localAudioUri(uri: String): Uri {
    val parsed = parseUri(uri)
    return when (parsed.scheme?.lowercase()) {
      "http", "https" -> {
        val ext = parsed.lastPathSegment?.substringAfterLast('.', "m4a")?.take(5) ?: "m4a"
        val file = File(cacheDir("clip-music"), "${uri.hashCode()}.$ext")
        if (!file.exists() || file.length() == 0L) {
          val tmp = File(file.parentFile, "${file.name}.part")
          URL(uri).openStream().use { input -> FileOutputStream(tmp).use { input.copyTo(it) } }
          tmp.renameTo(file)
        }
        Uri.fromFile(file)
      }
      null, "" -> {
        // Release builds resolve bundled audio to a raw resource name.
        val ctx = reactApplicationContext
        val resId = ctx.resources.getIdentifier(uri, "raw", ctx.packageName)
        if (resId == 0) throw IllegalArgumentException("Unknown bundled audio: $uri")
        Uri.parse("android.resource://${ctx.packageName}/$resId")
      }
      else -> parsed
    }
  }

  private fun volumeProcessor(volume: Float): AudioProcessor? {
    if (volume >= 0.999f) return null
    val processor = ChannelMixingAudioProcessor()
    for (channels in 1..8) {
      processor.putChannelMixingMatrix(
        ChannelMixingMatrix.createForConstantGain(channels, channels).scaleBy(volume),
      )
    }
    return processor
  }

  private fun even(value: Double): Int {
    val rounded = value.roundToInt()
    return max(2, rounded - rounded % 2)
  }

  // ---------------------------------------------------------------------------
  // Spec

  override fun getInfo(uri: String, promise: Promise) {
    executor.execute {
      try {
        val meta = readMeta(uri)
        val map = Arguments.createMap()
        map.putDouble("durationMs", meta.durationMs)
        map.putInt("width", meta.width)
        map.putInt("height", meta.height)
        map.putBoolean("hasAudio", meta.hasAudio)
        promise.resolve(map)
      } catch (e: Exception) {
        promise.reject("E_NO_VIDEO", e.message ?: "Could not read the video", e)
      }
    }
  }

  override fun generateThumbnails(uris: ReadableArray, count: Double, widthPx: Double, promise: Promise) {
    val list = (0 until uris.size()).mapNotNull { uris.getString(it) }
    executor.execute {
      try {
        val durations = list.map { u -> runCatching { readMeta(u).durationMs }.getOrDefault(0.0) }
        val total = durations.sum()
        if (total <= 0) throw IllegalStateException("No readable video to create thumbnails from")
        val n = count.roundToInt().coerceIn(1, 30)
        val width = widthPx.roundToInt().coerceAtLeast(16)
        // Group requested times per source so each file is opened once.
        val perSource = HashMap<Int, MutableList<Pair<Int, Double>>>()
        for (i in 0 until n) {
          var t = total * (i + 0.5) / n
          var index = 0
          while (index < durations.size - 1 && t >= durations[index]) {
            t -= durations[index]
            index++
          }
          perSource.getOrPut(index) { mutableListOf() }.add(i to t)
        }
        val out = arrayOfNulls<String>(n)
        for ((index, times) in perSource) {
          if (durations[index] <= 0) continue
          withRetriever(list[index]) { r ->
            for ((slot, t) in times) {
              val bitmap = frameAt(r, t, width) ?: continue
              out[slot] = writeJpeg(bitmap, "clip-thumbs")
              bitmap.recycle()
            }
          }
        }
        val result = Arguments.createMap()
        val array = Arguments.createArray()
        out.filterNotNull().forEach { array.pushString(it) }
        result.putArray("uris", array)
        result.putDouble("durationMs", total)
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("E_THUMBS", e.message ?: "Could not create thumbnails", e)
      }
    }
  }

  override fun exportClip(optionsJson: String, promise: Promise) {
    executor.execute {
      try {
        val composition = buildComposition(JSONObject(optionsJson))
        mainHandler.post { startTransformer(composition, promise) }
      } catch (e: Exception) {
        promise.reject("E_COMPOSE", e.message ?: "Could not prepare the export", e)
      }
    }
  }

  override fun cancelExport() {
    mainHandler.post {
      val current = transformer ?: return@post
      current.cancel()
      transformer = null
      progress = 0.0
      pendingPromise?.reject("E_CANCELLED", "Export cancelled")
      pendingPromise = null
    }
  }

  override fun getExportProgress(): Double = progress

  // ---------------------------------------------------------------------------
  // Export

  private class Prepared(
    val composition: Composition,
    val outFile: File,
    val coverAtMs: Double?,
    val maxLong: Int,
  )

  private fun buildComposition(opts: JSONObject): Prepared {
    val sources = opts.optJSONArray("sources") ?: throw IllegalArgumentException("No clips to export")
    val trimStart = max(0.0, opts.optDouble("trimStartMs", 0.0))
    var trimEnd = opts.optDouble("trimEndMs", Double.MAX_VALUE)
    if (trimEnd.isNaN() || trimEnd <= trimStart) trimEnd = Double.MAX_VALUE
    val originalVolume = opts.optDouble("originalVolume", 1.0).coerceIn(0.0, 1.0).toFloat()
    val maxLong = opts.optInt("maxLongSide", 1920).takeIf { it > 0 } ?: 1920
    val music = opts.optJSONObject("music")
    val coverAtMs = if (opts.has("coverAtMs") && !opts.isNull("coverAtMs")) opts.optDouble("coverAtMs") else null

    data class Segment(val uri: String, val fromMs: Long, val toMs: Long, val meta: VideoMeta)

    val segments = mutableListOf<Segment>()
    var offset = 0.0
    for (i in 0 until sources.length()) {
      val uri = sources.optString(i)
      if (uri.isNullOrEmpty()) continue
      val meta = readMeta(uri)
      val segStart = offset
      val segEnd = offset + meta.durationMs
      offset = segEnd
      val from = max(trimStart, segStart)
      val to = min(trimEnd, segEnd)
      if (to - from < 1) continue
      segments += Segment(uri, (from - segStart).toLong(), (to - segStart).toLong(), meta)
    }
    if (segments.isEmpty()) throw IllegalStateException("Nothing left to export after trimming")

    val first = segments.first().meta
    val longSide = max(first.width, first.height).coerceAtLeast(1)
    val shortSide = min(first.width, first.height).coerceAtLeast(1)
    val scale = min(1.0, min(maxLong.toDouble() / longSide, MAX_SHORT_SIDE.toDouble() / shortSide))
    val outW = if (first.width > 0) even(first.width * scale) else 1080
    val outH = if (first.height > 0) even(first.height * scale) else 1920
    val presentation = Presentation.createForWidthAndHeight(outW, outH, Presentation.LAYOUT_SCALE_TO_FIT)

    // Keep original audio only if requested and every segment has an audio
    // track (Media3 cannot mix "audio, then no audio" inside one sequence
    // without forcing silence, which we enable as a fallback below).
    val keepAudio = originalVolume > 0.001f && segments.any { it.meta.hasAudio }
    val audioEffects = listOfNotNull(volumeProcessor(originalVolume))
    val items = segments.map { seg ->
      val mediaItem =
        MediaItem.Builder()
          .setUri(parseUri(seg.uri))
          .setClippingConfiguration(
            MediaItem.ClippingConfiguration.Builder()
              .setStartPositionMs(seg.fromMs)
              .setEndPositionMs(seg.toMs)
              .build(),
          )
          .build()
      EditedMediaItem.Builder(mediaItem)
        .setRemoveAudio(!keepAudio || !seg.meta.hasAudio)
        .setEffects(Effects(if (keepAudio) audioEffects else emptyList(), listOf(presentation)))
        .build()
    }
    val videoSequence =
      EditedMediaItemSequence.Builder(items)
        .experimentalSetForceAudioTrack(keepAudio && segments.any { !it.meta.hasAudio })
        .build()

    val sequences = mutableListOf(videoSequence)
    if (music != null) {
      val musicUri = localAudioUri(music.optString("uri"))
      val musicVolume = music.optDouble("volume", 1.0).coerceIn(0.0, 1.0).toFloat()
      val startMs = max(0.0, music.optDouble("startMs", 0.0)).toLong()
      val musicItem =
        MediaItem.Builder()
          .setUri(musicUri)
          .setClippingConfiguration(
            MediaItem.ClippingConfiguration.Builder().setStartPositionMs(startMs).build(),
          )
          .build()
      val edited =
        EditedMediaItem.Builder(musicItem)
          .setRemoveVideo(true)
          .setEffects(Effects(listOfNotNull(volumeProcessor(musicVolume)), emptyList()))
          .build()
      // A looping sequence repeats until the (non-looping) video sequence ends.
      sequences += EditedMediaItemSequence.Builder(edited).setIsLooping(true).build()
    }

    val composition =
      Composition.Builder(sequences)
        .setHdrMode(Composition.HDR_MODE_TONE_MAP_HDR_TO_SDR_USING_OPEN_GL)
        .build()
    val outFile = File(cacheDir("clip-export"), "clip-${UUID.randomUUID()}.mp4")
    return Prepared(composition, outFile, coverAtMs, maxLong)
  }

  private fun startTransformer(prepared: Prepared, promise: Promise) {
    if (transformer != null) {
      promise.reject("E_BUSY", "Another export is already running")
      return
    }
    val context = reactApplicationContext
    val encoderFactory =
      DefaultEncoderFactory.Builder(context)
        .setRequestedVideoEncoderSettings(VideoEncoderSettings.Builder().setBitrate(VIDEO_BITRATE).build())
        .setEnableFallback(true)
        .build()
    val instance =
      Transformer.Builder(context)
        .setVideoMimeType(MimeTypes.VIDEO_H264)
        .setAudioMimeType(MimeTypes.AUDIO_AAC)
        .setEncoderFactory(encoderFactory)
        .setLooper(Looper.getMainLooper())
        .addListener(
          object : Transformer.Listener {
            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
              if (pendingPromise !== promise) return
              finish()
              executor.execute { resolveExport(prepared, promise) }
            }

            override fun onError(
              composition: Composition,
              exportResult: ExportResult,
              exportException: ExportException,
            ) {
              if (pendingPromise !== promise) return
              finish()
              prepared.outFile.delete()
              promise.reject("E_EXPORT", exportException.message ?: "Export failed", exportException)
            }
          },
        )
        .build()
    transformer = instance
    pendingPromise = promise
    progress = 0.0
    instance.start(prepared.composition, prepared.outFile.absolutePath)
    pollProgress(instance)
  }

  private fun finish() {
    transformer = null
    pendingPromise = null
    progress = 0.0
  }

  private fun pollProgress(instance: Transformer) {
    mainHandler.postDelayed(
      {
        if (transformer !== instance) return@postDelayed
        if (instance.getProgress(progressHolder) == Transformer.PROGRESS_STATE_AVAILABLE) {
          progress = progressHolder.progress / 100.0
        }
        pollProgress(instance)
      },
      150,
    )
  }

  private fun resolveExport(prepared: Prepared, promise: Promise) {
    try {
      val outUri = Uri.fromFile(prepared.outFile).toString()
      val meta = readMeta(outUri)
      var coverUri: String? = null
      if (prepared.coverAtMs != null) {
        withRetriever(outUri) { r ->
          val at = prepared.coverAtMs.coerceIn(0.0, max(0.0, meta.durationMs - 50))
          val frame = frameAt(r, at, prepared.maxLong / 2)
          if (frame != null) {
            coverUri = writeJpeg(frame, "clip-covers")
            frame.recycle()
          }
        }
      }
      val map: WritableMap = Arguments.createMap()
      map.putString("uri", outUri)
      map.putDouble("durationMs", meta.durationMs)
      map.putInt("width", meta.width)
      map.putInt("height", meta.height)
      map.putDouble("byteSize", prepared.outFile.length().toDouble())
      if (coverUri != null) map.putString("coverUri", coverUri) else map.putNull("coverUri")
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("E_EXPORT", e.message ?: "Could not read the exported clip", e)
    }
  }
}
