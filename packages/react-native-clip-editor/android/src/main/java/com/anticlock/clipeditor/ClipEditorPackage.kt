package com.anticlock.clipeditor

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class ClipEditorPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == ClipEditorModule.NAME) ClipEditorModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      ClipEditorModule.NAME to
        ReactModuleInfo(
          ClipEditorModule.NAME,
          ClipEditorModule::class.java.name,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true, // isTurboModule
        ),
    )
  }
}
