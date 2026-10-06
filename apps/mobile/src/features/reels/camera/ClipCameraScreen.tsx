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

const RING = 92;
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

  return (
    <View style={styles.root}>
      <View style={[styles.preview, { marginTop: insets.top + 8 }]}>
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
            <AppIcon name="camera" size={30} color="#fff" />
            {!cameraPermission.hasPermission ? (
              <>
                <Text style={styles.placeholderTitle}>Allow camera access</Text>
                <Text style={styles.placeholderBody}>
                  Anticlock needs the camera (and microphone for sound) to record Reels.
                </Text>
                <PressableScale onPress={requestAccess} accessibilityLabel="Allow camera access" style={styles.allowButton}>
                  <Text style={styles.allowText}>
                    {cameraPermission.canRequestPermission ? 'Allow access' : 'Open Settings'}
                  </Text>
                </PressableScale>
              </>
            ) : (
              <>
                <Text style={styles.placeholderTitle}>No camera available</Text>
                <Text style={styles.placeholderBody}>
                  This device has no usable camera. Choose a video from your gallery instead.
                </Text>
              </>
            )}
          </View>
        )}

        {cameraError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText} numberOfLines={2}>
              {cameraError}
            </Text>
          </View>
        ) : null}

        <View style={styles.topControls}>
          <PressableScale onPress={onClose} accessibilityLabel="Close creator" style={styles.control} disabled={recording}>
            <AppIcon name="close" size={23} color="#fff" />
          </PressableScale>
          {recording || recordedMs > 0 ? (
            <View style={styles.timer}>
              <Text style={styles.timerText}>
                {formatSeconds(recordedMs + liveMs)} / {limitS}s
              </Text>
            </View>
          ) : null}
          {device?.hasTorch && position === 'back' ? (
            <PressableScale
              onPress={() => setTorch(value => !value)}
              accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'}
              style={torch ? [styles.control, styles.controlActive] : styles.control}
            >
              <AppIcon name="zap" size={22} color={torch ? '#111' : '#fff'} />
            </PressableScale>
          ) : (
            <View style={styles.control} />
          )}
        </View>

        {!recording ? (
          <View style={styles.limits}>
            {RECORD_LIMITS_S.map(value => {
              const disabled = value * 1000 < recordedMs;
              const active = value === limitS;
              return (
                <PressableScale
                  key={value}
                  onPress={() => setLimitS(value)}
                  disabled={disabled}
                  accessibilityLabel={`${value} second limit`}
                  style={active ? [styles.limit, styles.limitActive] : disabled ? [styles.limit, styles.limitDisabled] : styles.limit}
                >
                  <Text style={[styles.limitText, active && styles.limitTextActive]}>{value}s</Text>
                </PressableScale>
              );
            })}
          </View>
        ) : null}

        {!micPermission.hasPermission && cameraPermission.hasPermission ? (
          <Text style={styles.micHint}>Microphone is off. Takes will be silent.</Text>
        ) : null}

        <View style={styles.captureRow}>
          <PressableScale
            accessibilityLabel={segments.length > 0 ? 'Delete last take' : 'Open gallery'}
            onPress={segments.length > 0 ? undo : onGallery}
            disabled={recording}
            style={styles.thumb}
          >
            <AppIcon name={segments.length > 0 ? 'trash' : 'grid'} size={22} color="#fff" />
          </PressableScale>

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
              disabled={!hasCamera || (full && !recording)}
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Stop recording' : 'Record a take. Tap to start and stop, or hold.'}
              style={[styles.captureOuter, (!hasCamera || (full && !recording)) && styles.captureDisabled]}
            >
              <View style={[styles.captureInner, recording && styles.captureInnerRecording]} />
            </Pressable>
          </View>

          {segments.length > 0 && !recording ? (
            <PressableScale
              onPress={() => onDone(segments)}
              accessibilityLabel="Continue to editor"
              style={[styles.thumb, styles.nextButton]}
            >
              <AppIcon name="chevron-right" size={24} color="#111" />
            </PressableScale>
          ) : (
            <PressableScale
              onPress={() => setPosition(value => (value === 'back' ? 'front' : 'back'))}
              accessibilityLabel="Switch camera"
              disabled={recording || !cameraPermission.hasPermission}
              style={styles.thumb}
            >
              <AppIcon name="camera" size={22} color="#fff" />
            </PressableScale>
          )}
        </View>
        {segments.length > 0 && !recording ? (
          <View style={styles.secondaryRow}>
            <PressableScale onPress={onGallery} accessibilityLabel="Add from gallery" style={styles.secondaryChip}>
              <AppIcon name="grid" size={14} color="#fff" />
              <Text style={styles.secondaryText}>Gallery</Text>
            </PressableScale>
            <Text style={styles.secondaryText}>
              {segments.length} take{segments.length === 1 ? '' : 's'}
            </Text>
            <PressableScale
              onPress={() => setPosition(value => (value === 'back' ? 'front' : 'back'))}
              accessibilityLabel="Switch camera"
              style={styles.secondaryChip}
            >
              <AppIcon name="camera" size={14} color="#fff" />
              <Text style={styles.secondaryText}>Flip</Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
      <CreationModePicker mode={mode} onChange={onModeChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505', paddingHorizontal: 8 },
  preview: {
    flex: 1,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: '#151515',
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 36 },
  placeholderTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  placeholderBody: { color: '#bdbdc2', textAlign: 'center', lineHeight: 19 },
  allowButton: { marginTop: 6, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  allowText: { color: '#111', fontWeight: '800' },
  errorBanner: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(160,30,40,0.85)',
  },
  errorText: { color: '#fff', fontSize: 12 },
  topControls: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  control: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: { backgroundColor: '#fff' },
  timer: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(0,0,0,.45)' },
  timerText: { color: '#fff', fontWeight: '800', fontVariant: ['tabular-nums'] },
  limits: {
    position: 'absolute',
    bottom: 150,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,.4)',
  },
  limit: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  limitActive: { backgroundColor: '#fff' },
  limitDisabled: { opacity: 0.35 },
  limitText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  limitTextActive: { color: '#111' },
  micHint: {
    position: 'absolute',
    bottom: 196,
    alignSelf: 'center',
    color: '#ffcf70',
    fontSize: 12,
    fontWeight: '700',
  },
  captureRow: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: { backgroundColor: '#fff', borderRadius: 23 },
  captureWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureDisabled: { opacity: 0.4 },
  captureInner: { width: '100%', height: '100%', borderRadius: 30, backgroundColor: '#fff' },
  captureInnerRecording: { width: '62%', height: '62%', borderRadius: 8, backgroundColor: '#ff4d5e' },
  secondaryRow: {
    position: 'absolute',
    bottom: 8,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,.45)',
  },
  secondaryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
