# Anticlock release R8 / ProGuard rules
# Obfuscation is ON (do not add -dontobfuscate).
# Archive mapping.txt after each release for crash de-obfuscation:
#   android/app/build/outputs/mapping/release/mapping.txt

# ---------------------------------------------------------------------------
# Attributes (needed for reflection / crash stacks)
# ---------------------------------------------------------------------------
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ---------------------------------------------------------------------------
# App entry points
# ---------------------------------------------------------------------------
-keep class com.anticlocktemp.MainActivity { *; }
-keep class com.anticlocktemp.MainApplication { *; }

# ---------------------------------------------------------------------------
# React Native / Hermes / JNI (bridge + New Architecture)
# Consumer rules from RN are merged too; these reinforce critical keeps.
# ---------------------------------------------------------------------------
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStripAny
-keep,allowobfuscation @interface com.facebook.jni.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.jni.annotations.DoNotStripAny

-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}
-keep @com.facebook.proguard.annotations.DoNotStripAny class * {
    *;
}
-keep @com.facebook.jni.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.jni.annotations.DoNotStrip *;
}
-keep @com.facebook.jni.annotations.DoNotStripAny class * {
    *;
}

-keep class * implements com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * implements com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers,includedescriptorclasses class * { native <methods>; }
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

-keep,includedescriptorclasses class com.facebook.react.bridge.** { *; }
-keep,includedescriptorclasses class com.facebook.react.turbomodule.core.** { *; }
-keep,includedescriptorclasses class com.facebook.react.internal.turbomodule.core.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**

# Yoga
-keep,allowobfuscation @interface com.facebook.yoga.annotations.DoNotStrip
-keep @com.facebook.yoga.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.yoga.annotations.DoNotStrip *;
}

# ---------------------------------------------------------------------------
# Native modules used by this app
# ---------------------------------------------------------------------------

# react-native-reanimated (worklets, shared values, animations)
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }

# react-native-worklets (worklet runtime for Reanimated, VisionCamera, etc.)
-keep class com.swmansion.worklets.** { *; }

# react-native-screens (native stack navigator, screen optimization)
-keep class com.swmansion.rnscreens.** { *; }

# react-native-gesture-handler (touch gestures, swipe, pan, etc.)
-keep class com.swmansion.gesturehandler.** { *; }

# react-native-safe-area-context (notch, insets, safe area)
-keep class com.th3rdwave.safeareacontext.** { *; }

# react-native-svg (vector graphics rendering)
-keep public class com.horcrux.svg.** { *; }

# react-native-mmkv (fast key-value storage via C++ JSI)
# Also includes nitro-modules for Nitro Modules architecture
-keep class com.mrousavy.mmkv.** { *; }
-keep class com.margelo.nitro.** { *; }

# react-native-video (video playback via ExoPlayer)
-keep class com.brentvatne.react.** { *; }

# @react-native-community/blur (native blur views)
-keep class com.reactnativecommunity.blurview.** { *; }

# react-native-image-picker (camera & gallery access)
-keep class com.imagepicker.** { *; }
-keep class com.imagepicker.permissions.** { *; }

# @react-native-voice/voice (speech recognition)
-keep class com.wenkesj.voice.** { *; }
-keepclassmembers class com.wenkesj.voice.** {
    <methods>;
}

# ---------------------------------------------------------------------------
# Okio / common Android
# ---------------------------------------------------------------------------
-keep class sun.misc.Unsafe { *; }
-dontwarn java.nio.file.**
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn kotlin.reflect.jvm.internal.**

# ---------------------------------------------------------------------------
# Strip verbose logging from release bytecode (size + less leakage)
# ---------------------------------------------------------------------------
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
    public static *** i(...);
    public static *** w(...);
    public static *** println(...);
}

# ---------------------------------------------------------------------------
# R8: ignore optional missing classes from transitive deps
# (add lines from outputs/mapping/release/missing_rules.txt if the build fails)
# ---------------------------------------------------------------------------
-dontwarn java.beans.ConstructorProperties
-dontwarn java.beans.Transient
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
