import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  useVideoOutput,
  type Recorder,
} from 'react-native-vision-camera';
import { getVideoInfo, toMediaUri } from '@anticlock/react-native-clip-editor';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { GlassFill, GlassIconButton, HIT } from '@/features/reels/ui/GlassIconButton';
import {
  CreationModePicker,
  type CreationMode,
} from '@/features/reels/components/CreationCameraShell';
import {
  MAX_CLIP_SEGMENTS,
  RECORD_LIMITS_S,
  formatSeconds,
  totalDurationMs,
  type ClipSource,
  type RecordLimitSeconds,
} from '@/features/reels/editor/clipEditModel';
import { RecordProgressRing } from './RecordProgressRing';

type Props = {
  mode: CreationMode;
  onModeChange: (mode: CreationMode) => void;
  onClose: () => void;
  onGallery: () => void;
  /** Recorded takes, kept by the parent so "Back" from the editor keeps them. */
  segments: ClipSource[];
  onSegmentsChange: (segments: ClipSource[]) => void;
  onDone: (segments: ClipSource[]) => void;
};

const RING = 96;
const MIN_TAKE_MS = 300;
const HOLD_THRESHOLD_MS = 450;

function makeId() {
  return `take-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reels camera: tap or hold to record multiple takes (segments) up to the
 * selected limit, flip camera, torch, undo the last take, then continue to the
 * editor. Built on VisionCamera v5.
 */
export function ClipCameraScreen({
  mode,
  onModeChange,
  onClose,
  onGallery,
  segments,
  onSegmentsChange,
  onDone,
}: Props) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [position, setPosition] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [limitS, setLimitS] = useState<RecordLimitSeconds>(30);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [liveMs, setLiveMs] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [durationsOpen, setDurationsOpen] = useState(true);

  const cameraPermission = useCameraPermission();
  const micPermission = useMicrophonePermission();
  const device = useCameraDevice(position);
  const videoOutput = useVideoOutput({
    enableAudio: micPermission.hasPermission,
    fileType: 'mp4',
  });

  const recorderRef = useRef<Recorder | null>(null);
  const startedAtRef = useRef(0);
  const pressAtRef = useRef(0);
  const pressStartedRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const recordedMs = useMemo(() => totalDurationMs(segments), [segments]);
  const limitMs = limitS * 1000;
  const remainingMs = Math.max(0, limitMs - recordedMs);
  const full = remainingMs < 500 || segments.length >= MAX_CLIP_SEGMENTS;

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => setAppActive(next === 'active'));
    return () => sub.remove();
  }, []);

  // Live timer for the take in progress.
  useEffect(() => {
    if (!recording) {
      setLiveMs(0);
      return;
    }
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setLiveMs(elapsed);
      // Backup for maxDuration: never exceed the selected limit.
      if (elapsed >= remainingMs + 250) recorderRef.current?.stopRecording().catch(() => {});
    }, 100);
    return () => clearInterval(timer);
  }, [recording, remainingMs]);

  const finishTake = useCallback(
    async (filePath: string) => {
      const elapsed = Date.now() - startedAtRef.current;
      recorderRef.current = null;
      setRecording(false);
      const uri = toMediaUri(filePath);
      let durationMs = elapsed;
      let width: number | undefined;
      let height: number | undefined;
      let hasAudio: boolean | undefined;
      try {
        const info = await getVideoInfo(uri);
        durationMs = info.durationMs;
        width = info.width;
        height = info.height;
        hasAudio = info.hasAudio;
      } catch {
        // Fall back to the wall-clock duration.
      }
      if (durationMs < MIN_TAKE_MS) return;
      onSegmentsChange([
        ...segmentsRef.current,
        { id: makeId(), uri, durationMs, width, height, hasAudio, origin: 'camera' },
      ]);
    },
    [onSegmentsChange],
  );

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      stopRequestedRef.current = true;
      return;
    }
    try {
      await recorder.stopRecording();
    } catch {
      // The finished/error callback reports the outcome.
    }
  }, []);

  const start = useCallback(async () => {
    if (recording || busy || full || !device) return;
    setBusy(true);
    stopRequestedRef.current = false;
    try {
      if (micPermission.canRequestPermission) await micPermission.requestPermission();
      const recorder = await videoOutput.createRecorder({
        maxDuration: Math.max(0.5, remainingMs / 1000),
      });
      recorderRef.current = recorder;
      await recorder.startRecording(
        filePath => {
          finishTake(filePath).catch(() => {});
        },
        error => {
          recorderRef.current = null;
          setRecording(false);
          Alert.alert('Recording stopped', error.message || 'Please try again.');
        },
      );
      startedAtRef.current = Date.now();
      setRecording(true);
      if (stopRequestedRef.current) await stop();
    } catch (error) {
      recorderRef.current = null;
      Alert.alert(
        'Couldn’t start recording',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, device, finishTake, full, micPermission, recording, remainingMs, stop, videoOutput]);

  const onCapturePressIn = () => {
    pressAtRef.current = Date.now();
    if (recording) {
      pressStartedRef.current = false;
      stop();
    } else {
      pressStartedRef.current = true;
      start();
    }
  };
  const onCapturePressOut = () => {
    // Hold-to-record: releasing after a long press ends the take.
    if (pressStartedRef.current && Date.now() - pressAtRef.current > HOLD_THRESHOLD_MS) {
      stop();
    }
    pressStartedRef.current = false;
  };

  // Stop recording when leaving the screen or backgrounding the app.
  useEffect(() => {
    if ((!isFocused || !appActive) && recorderRef.current) {
      recorderRef.current.stopRecording().catch(() => {});
    }
  }, [appActive, isFocused]);

  const undo = () => {
    if (recording || segments.length === 0) return;
    onSegmentsChange(segments.slice(0, -1));
  };

  const requestAccess = async () => {
    if (cameraPermission.canRequestPermission) {
      const granted = await cameraPermission.requestPermission();
      if (granted && micPermission.canRequestPermission) await micPermission.requestPermission();
      return;
    }
    Linking.openSettings().catch(() => {});
  };

  const hasCamera = cameraPermission.hasPermission && device != null;
  const isActive = hasCamera && isFocused && appActive;
  const marks = useMemo(() => {
    const out: number[] = [];
    let at = 0;
    for (const segment of segments) {
      at += segment.durationMs;
      out.push(Math.min(1, at / limitMs));
    }
    return out;
  }, [limitMs, segments]);

  const hasTakes = segments.length > 0;
  const flip = () => setPosition(value => (value === 'back' ? 'front' : 'back'));
  const shutterDisabled = !hasCamera || (full && !recording);

  return (
    <View style={styles.root}>
      {hasCamera ? (
        <Camera
          style={StyleSheet.absoluteFill}
          isActive={isActive}
          device={device}
          outputs={[videoOutput]}
          torchMode={torch && position === 'back' && device?.hasTorch ? 'on' : 'off'}
          enableNativeZoomGesture
          resizeMode="cover"
          onStarted={() => setCameraError(null)}
          onError={error => setCameraError(error.message)}
        />
      ) : (
        <View style={styles.placeholder}>
          <AppIcon name="camera" size={40} color="rgba(255,255,255,0.9)" strokeWidth={1.5} />
          {!cameraPermission.hasPermission ? (
            <>
              <Text style={styles.placeholderLine}>Camera access needed</Text>
              <PressableScale
                onPress={requestAccess}
                accessibilityLabel={cameraPermission.canRequestPermission ? 'Allow camera access' : 'Open Settings'}
                style={styles.allowButton}
              >
                <Text style={styles.allowText}>
                  {cameraPermission.canRequestPermission ? 'Allow' : 'Settings'}
                </Text>
              </PressableScale>
            </>
          ) : (
            <Text style={styles.placeholderLine}>No camera</Text>
          )}
        </View>
      )}

      {cameraError ? (
        <View style={[styles.errorBanner, { top: insets.top + 64 }]} accessibilityRole="alert">
          <AppIcon name="alert" size={14} color="#fff" />
          <Text style={styles.errorText} numberOfLines={1}>
            {cameraError}
          </Text>
        </View>
      ) : null}

      {/* Top: close + timer */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <GlassIconButton icon="close" accessibilityLabel="Close creator" onPress={onClose} disabled={recording} iconSize={24} />
        {recording || recordedMs > 0 ? (
          <View style={[styles.timer, recording && styles.timerRecording]}>
            {recording ? <View style={styles.recDot} /> : null}
            <Text style={styles.timerText}>{formatSeconds(recordedMs + liveMs)}</Text>
          </View>
        ) : null}
        <View style={styles.topSpacer} />
      </View>

      {/* Right rail: flip, flash, duration */}
      {!recording ? (
        <View style={[styles.rail, { top: insets.top + 8 }]}>
          <GlassIconButton
            icon="switch-camera"
            accessibilityLabel="Switch camera"
            onPress={flip}
            disabled={!cameraPermission.hasPermission}
          />
          {device?.hasTorch && position === 'back' ? (
            <GlassIconButton
              icon={torch ? 'zap' : 'zap-off'}
              accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'}
              onPress={() => setTorch(value => !value)}
              active={torch}
            />
          ) : null}
          <GlassIconButton
            icon="timer"
            accessibilityLabel={`Duration ${limitS} seconds. ${durationsOpen ? 'Hide' : 'Show'} durations`}
            onPress={() => setDurationsOpen(value => !value)}
            badge={String(limitS)}
          />
          {!micPermission.hasPermission && cameraPermission.hasPermission ? (
            <View style={styles.micOff} accessible accessibilityLabel="Microphone off. Takes will be silent.">
              <AppIcon name="mic-off" size={18} color="#ffcf70" strokeWidth={2} />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Bottom: duration pills, capture row, mode picker */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
        {!recording && durationsOpen ? (
          <View style={styles.pills}>
            {RECORD_LIMITS_S.map(value => {
              const disabled = value * 1000 < recordedMs;
              const active = value === limitS;
              return (
                <PressableScale
                  key={value}
                  onPress={() => setLimitS(value)}
                  disabled={disabled}
                  accessibilityLabel={`${value} second limit`}
                  style={active ? [styles.pill, styles.pillActive] : disabled ? [styles.pill, styles.pillDisabled] : styles.pill}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{value}</Text>
                </PressableScale>
              );
            })}
          </View>
        ) : null}

        <View style={styles.captureRow}>
          <View style={styles.side}>
            {!recording ? (
              <PressableScale onPress={onGallery} accessibilityLabel="Open gallery" style={styles.gallery}>
                <GlassFill radius={10} />
                <AppIcon name="images" size={22} color="#fff" strokeWidth={2} />
              </PressableScale>
            ) : null}
            {hasTakes && !recording ? (
              <GlassIconButton icon="undo" accessibilityLabel="Delete last take" onPress={undo} />
            ) : null}
          </View>

          <View style={styles.captureWrap}>
            <RecordProgressRing
              size={RING}
              strokeWidth={5}
              recorded={recordedMs / limitMs}
              live={(recordedMs + liveMs) / limitMs}
              marks={marks}
            />
            <Pressable
              onPressIn={onCapturePressIn}
              onPressOut={onCapturePressOut}
              disabled={shutterDisabled}
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Stop recording' : 'Record a take. Tap to start and stop, or hold.'}
              style={[styles.captureOuter, shutterDisabled && styles.captureDisabled]}
            >
              <View style={[styles.captureInner, recording && styles.captureInnerRecording]} />
            </Pressable>
          </View>

          <View style={[styles.side, styles.sideRight]}>
            {hasTakes && !recording ? (
              <GlassIconButton
                icon="check"
                accessibilityLabel="Continue to editor"
                onPress={() => onDone(segments)}
                active
                iconSize={24}
              />
            ) : null}
          </View>
        </View>

        {!recording ? <CreationModePicker mode={mode} onChange={onModeChange} /> : <View style={styles.modeSpacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  placeholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#0c0c0e',
  },
  placeholderLine: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 15 },
  allowButton: {
    minHeight: HIT,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 26,
  },
  allowText: { color: '#111', fontWeight: '800', fontSize: 15 },
  errorBanner: {
    position: 'absolute',
    left: 64,
    right: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(200,40,55,0.85)',
  },
  errorText: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '600' },
  topBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSpacer: { width: HIT },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  timerRecording: { backgroundColor: '#ff3b4e' },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  timerText: { color: '#fff', fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  rail: { position: 'absolute', right: 10, alignItems: 'center', gap: 14 },
  micOff: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  pills: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  pill: {
    minWidth: HIT,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  pillActive: { backgroundColor: '#fff' },
  pillDisabled: { opacity: 0.35 },
  pillText: { color: '#fff', fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },
  pillTextActive: { color: '#111' },
  captureRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  sideRight: { justifyContent: 'flex-end' },
  gallery: {
    width: HIT,
    height: HIT,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  captureWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  captureOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureDisabled: { opacity: 0.4 },
  captureInner: { width: '100%', height: '100%', borderRadius: 34, backgroundColor: '#fff' },
  captureInnerRecording: { width: '52%', height: '52%', borderRadius: 8, backgroundColor: '#ff3b4e' },
  modeSpacer: { height: 78 },
});
