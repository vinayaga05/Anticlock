package com.anticlock.app

import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.util.UUID

class GenieSpeechPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(GenieSpeechModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}

class GenieSpeechModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val handler = Handler(Looper.getMainLooper())
  private var engine: TextToSpeech? = null
  private var ready = false
  private var active: Pair<String, Promise>? = null
  private var pending: String? = null

  override fun getName() = "GenieSpeech"

  @ReactMethod
  fun speak(text: String, promise: Promise) {
    handler.post {
      stopActive()
      active = UUID.randomUUID().toString() to promise
      pending = text
      if (engine == null) {
        engine = TextToSpeech(reactApplicationContext) { status ->
          handler.post {
            if (status != TextToSpeech.SUCCESS) {
              active?.second?.reject("speech_unavailable", "Speech output is unavailable.")
              active = null
              pending = null
              engine?.shutdown()
              engine = null
            } else {
              ready = true
              engine?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) {}
                override fun onDone(id: String?) = finish(id)
                @Deprecated("Deprecated in Android")
                override fun onError(id: String?) = finish(id, true)
                override fun onError(id: String?, code: Int) = finish(id, true)
              })
              playPending()
            }
          }
        }
      } else if (ready) {
        playPending()
      }
    }
  }

  private fun playPending() {
    val text = pending ?: return
    val id = active?.first ?: return
    pending = null
    if (engine?.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) finish(id, true)
  }

  private fun finish(id: String?, failed: Boolean = false) {
    handler.post {
      val current = active
      if (current == null || current.first != id) return@post
      active = null
      if (failed) current.second.reject("speech_failed", "Could not speak the reply.")
      else current.second.resolve(null)
    }
  }

  private fun stopActive() {
    active?.second?.resolve(null)
    active = null
    pending = null
    engine?.stop()
  }

  @ReactMethod
  fun stop() { handler.post { stopActive() } }

  override fun invalidate() {
    handler.post {
      stopActive()
      engine?.shutdown()
      engine = null
      ready = false
    }
    super.invalidate()
  }
}
