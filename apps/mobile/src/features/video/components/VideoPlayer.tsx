import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Video, {
  ViewType,
  OnLoadData,
  OnProgressData,
  VideoRef,
} from 'react-native-video';
import { AppIcon } from '@/shared/components/AppIcon';

export type VideoSource = string | number;

interface VideoPlayerProps {
  uri: VideoSource;
  paused?: boolean;
  /** Persist user pause intent outside recycled feed cells. */
  onPausedChange?: (paused: boolean) => void;
  /** Restore the saved position once this source loads after a remount. */
  initialPositionSeconds?: number;
  mediaKind?: 'video' | 'audio';
  /** When true, playback has no audio. Clips/Reels should pass false. */
  muted?: boolean;
  /** When provided, muted is controlled by the caller. */
  onMutedChange?: (muted: boolean) => void;
  muteControlStyle?: StyleProp<ViewStyle>;
  poster?: string;
  /** ID used by an external full-screen Clip playback controller. */
  seekControllerId?: string;
  /** Registers or clears an external seek handler for the current video. */
  onSeekControllerChange?: (
    id: string,
    seekToTime: ((seconds: number) => void) | null,
  ) => void;
  /** Optional, non-blocking playback signal for product analytics. */
  onPlaybackProgress?: (currentTime: number, duration: number) => void;
  /** Fired once each time native playback reaches the end. */
  onPlaybackComplete?: (duration: number) => void;
  /** Reports playback failures so a feed can refresh expiring media URLs. */
  onPlaybackError?: (message: string) => void;
  /** Prepare a nearby feed item without exposing controls or playing audio. */
  preloading?: boolean;
  /** Time from native load start until the first decoded frame. */
  onPlaybackReady?: (startupMs: number) => void;
  onBufferingChange?: (isBuffering: boolean) => void;
}

/** Metro serves assets on the host; emulator localhost ≠ host without adb reverse. */
function rewriteMetroHostForAndroid(url: string): string {
  if (Platform.OS !== 'android' || !url) return url;
  return url.replace(/:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '://10.0.2.2$2');
}

function resolvePlaybackUri(uri: VideoSource): string {
  if (typeof uri === 'number') {
    const resolved = Image.resolveAssetSource(uri);
    return rewriteMetroHostForAndroid(resolved?.uri ?? '');
  }
  return rewriteMetroHostForAndroid(uri);
}

function redactPlaybackUri(uri: string): string {
  return uri.split(/[?#]/, 1)[0];
}

const ANDROID_VIDEO_CACHE_MB = 256;
const ANDROID_CLIP_BUFFER_CONFIG = {
  minBufferMs: 2_500,
  maxBufferMs: 5_000,
  bufferForPlaybackMs: 750,
  bufferForPlaybackAfterRebufferMs: 1_500,
  backBufferDurationMs: 1_000,
  initialBitrate: 800_000,
  cacheSizeMB: ANDROID_VIDEO_CACHE_MB,
} as const;

function toSource(playbackUri: string, mediaKind: 'video' | 'audio') {
  if (!playbackUri) return undefined;
  const bufferConfig =
    Platform.OS === 'android' ? ANDROID_CLIP_BUFFER_CONFIG : undefined;
  if (
    /\.m3u8(\?|$)/i.test(playbackUri) ||
    playbackUri.includes('/manifest/video.m3u8')
  ) {
    return { uri: playbackUri, type: 'm3u8' as const, bufferConfig };
  }
  if (
    mediaKind === 'video' &&
    (/\.mp4(\?|$)/i.test(playbackUri) || playbackUri.startsWith('file://'))
  ) {
    return { uri: playbackUri, type: 'mp4' as const, bufferConfig };
  }
  // Metro asset URIs: http://localhost:8081/assets/...
  return { uri: playbackUri, bufferConfig };
}

export function VideoPlayer({
  uri,
  paused = false,
  muted = true,
  onMutedChange,
  muteControlStyle,
  onPausedChange,
  initialPositionSeconds = 0,
  mediaKind = 'video',
  poster,
  seekControllerId,
  onSeekControllerChange,
  onPlaybackProgress,
  onPlaybackComplete,
  onPlaybackError,
  preloading = false,
  onPlaybackReady,
  onBufferingChange,
}: VideoPlayerProps) {
  const ref = useRef<VideoRef>(null);
  const durationRef = useRef(0);
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === 'active',
  );
  const [localPaused, setLocalPaused] = useState(false);
  const [localMuted, setLocalMuted] = useState(muted);
  const [interrupted, setInterrupted] = useState(false);
  const restoredPosition = useRef(false);
  const isMuted = onMutedChange ? muted : localMuted;
  const userPaused = onPausedChange ? paused : localPaused;
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [showLoading, setShowLoading] = useState(false);
  const posterOpacity = useRef(new Animated.Value(1)).current;
  const loadStartedAtRef = useRef(Date.now());
  const firstFrameReportedRef = useRef(false);

  const playbackUri = useMemo(() => resolvePlaybackUri(uri), [uri]);
  const attemptKey = `${playbackUri}:${attempt}`;
  const currentAttempt = useRef(attemptKey);
  currentAttempt.current = attemptKey;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const isCurrentAttempt = () =>
    mounted.current && currentAttempt.current === attemptKey;
  // Playback state must not recreate the source: the adjacent preloaded
  // player is promoted by toggling `paused`, not by reloading its manifest.
  const source = useMemo(
    () => toSource(playbackUri, mediaKind),
    [playbackUri, mediaKind],
  );
  // Pause on tab blur / navigation away / app background so audio does not
  // keep playing under other screens.
  const isPaused =
    preloading ||
    failed ||
    interrupted ||
    userPaused ||
    paused ||
    !isFocused ||
    !appActive;

  const latestPaused = useRef(isPaused);
  latestPaused.current = isPaused;

  // Native commands close the small update window during a visibility/focus change.
  useEffect(() => {
    if (isPaused) ref.current?.pause?.();
  }, [isPaused]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      setAppActive(next === 'active');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setReady(false);
    setFailed(false);
    setErrorMsg(null);
    setLocalPaused(false);
    setLocalMuted(muted);
    setInterrupted(false);
    restoredPosition.current = false;
    durationRef.current = 0;
    setDuration(0);
    setShowLoading(false);
    posterOpacity.stopAnimation();
    posterOpacity.setValue(1);
    loadStartedAtRef.current = Date.now();
    firstFrameReportedRef.current = false;
    // Reset mute to the caller's default only when the clip source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- muted is an initial value per uri
  }, [playbackUri, posterOpacity, attempt]);

  useEffect(() => {
    if (ready || failed || preloading || userPaused || paused) {
      setShowLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowLoading(true), 700);
    return () => clearTimeout(timer);
  }, [failed, preloading, ready, userPaused, paused]);

  useEffect(() => {
    if (
      ready ||
      failed ||
      preloading ||
      userPaused ||
      paused ||
      !isFocused ||
      !appActive
    )
      return;
    const deadline = setTimeout(() => {
      setFailed(true);
      setShowLoading(false);
      posterOpacity.stopAnimation();
      posterOpacity.setValue(1);
      setErrorMsg('Loading took too long. Try again.');
    }, 20_000);
    return () => clearTimeout(deadline);
  }, [
    ready,
    failed,
    userPaused,
    paused,
    preloading,
    isFocused,
    appActive,
    attempt,
    playbackUri,
    posterOpacity,
  ]);

  const handleReadyForDisplay = useCallback(() => {
    if (failed) return;
    setReady(true);
    setShowLoading(false);
    Animated.timing(posterOpacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
    if (!preloading && !firstFrameReportedRef.current) {
      firstFrameReportedRef.current = true;
      onPlaybackReady?.(Math.max(0, Date.now() - loadStartedAtRef.current));
    }
  }, [onPlaybackReady, posterOpacity, preloading, failed]);

  useEffect(() => {
    if (preloading || !ready || firstFrameReportedRef.current) return;
    // A prepared next player can already have a decoded frame when its cell
    // becomes active. Record that as an effectively warm start.
    firstFrameReportedRef.current = true;
    onPlaybackReady?.(0);
  }, [onPlaybackReady, preloading, ready]);

  const handleLoad = (data: OnLoadData) => {
    const mediaDuration = Number.isFinite(data.duration) ? data.duration : 0;
    durationRef.current = mediaDuration;
    setDuration(mediaDuration);
    setFailed(false);
    setErrorMsg(null);
    if (!restoredPosition.current && mediaDuration > 0) {
      restoredPosition.current = true;
      const position = Number.isFinite(initialPositionSeconds)
        ? Math.min(
            Math.max(0, initialPositionSeconds),
            Math.max(0, mediaDuration - 0.05),
          )
        : 0;
      if (position > 0) ref.current?.seek(position);
    }
    // An audio source has no video frame to emit onReadyForDisplay.
    if (mediaKind === 'audio') handleReadyForDisplay();
  };

  const handleProgress = (data: OnProgressData) => {
    const mediaDuration = Math.max(0, durationRef.current);
    const currentTime = Math.min(Math.max(0, data.currentTime), mediaDuration);
    if (!isCurrentAttempt() || latestPaused.current) return;
    onPlaybackProgress?.(currentTime, mediaDuration);
  };

  const seekToTime = useCallback((seconds: number) => {
    const maxDuration = Math.max(0, durationRef.current);
    if (maxDuration <= 0) return;
    const target = Math.min(maxDuration, Math.max(0, seconds));
    ref.current?.seek(target);
  }, []);

  useEffect(() => {
    if (!seekControllerId || !onSeekControllerChange || duration <= 0) return;
    onSeekControllerChange(seekControllerId, seekToTime);
    return () => onSeekControllerChange(seekControllerId, null);
  }, [duration, onSeekControllerChange, seekControllerId, seekToTime]);

  return (
    <View style={[styles.container, poster ? styles.transparent : null]}>
      {source && !failed ? (
        <Video
          key={`${playbackUri}:${attempt}`}
          ref={ref}
          source={source}
          style={[
            styles.video,
            !ready && poster ? styles.transparentFrame : null,
          ]}
          resizeMode="cover"
          controls={false}
          viewType={Platform.OS === 'android' ? ViewType.TEXTURE : undefined}
          hideShutterView
          repeat
          paused={isPaused}
          muted={preloading || isMuted}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          mixWithOthers="mix"
          shutterColor="transparent"
          preferredForwardBufferDuration={preloading ? 3 : 5}
          reportBandwidth={!preloading && Platform.OS === 'android'}
          onLoadStart={() => {
            loadStartedAtRef.current = Date.now();
            firstFrameReportedRef.current = false;
          }}
          onLoad={data => {
            if (isCurrentAttempt()) handleLoad(data);
          }}
          onAudioFocusChanged={({ hasAudioFocus }) => {
            if (isCurrentAttempt() && !preloading)
              setInterrupted(!hasAudioFocus);
          }}
          onAudioBecomingNoisy={() => {
            if (onPausedChange) onPausedChange(true);
            else setLocalPaused(true);
          }}
          onBuffer={({ isBuffering }) => {
            if (ready) onBufferingChange?.(isBuffering);
          }}
          onProgress={handleProgress}
          onEnd={() => {
            if (!isCurrentAttempt() || latestPaused.current) return;
            onPlaybackComplete?.(Math.max(0, durationRef.current));
          }}
          onError={e => {
            if (!isCurrentAttempt()) return;
            const msg =
              e?.error?.errorString ||
              e?.error?.localizedDescription ||
              'Playback failed';
            if (__DEV__) {
              console.warn(
                '[VideoPlayer]',
                msg,
                redactPlaybackUri(playbackUri),
                e?.error,
              );
            }
            onPlaybackError?.(msg);
            posterOpacity.stopAnimation();
            posterOpacity.setValue(1);
            setFailed(true);
            setReady(false);
            setErrorMsg(msg);
          }}
          onReadyForDisplay={() => {
            if (isCurrentAttempt()) handleReadyForDisplay();
          }}
        />
      ) : null}
      {poster ? (
        <Animated.Image
          testID="video-poster"
          source={{ uri: poster }}
          resizeMode="cover"
          style={[styles.poster, { opacity: posterOpacity }]}
        />
      ) : null}
      {mediaKind === 'audio' ? (
        <View style={styles.audioPresentation} pointerEvents="none">
          <AppIcon name="music" size={48} color="#fff" />
          <Text style={styles.audioLabel}>Audio</Text>
        </View>
      ) : null}
      <Pressable
        testID="video-playback-toggle"
        style={styles.playbackToggle}
        onPress={() => {
          if (failed || preloading) return;
          // Permanent Android focus loss abandons its request, so it may not
          // emit a future gain event. An explicit Play can request focus again.
          if (interrupted) {
            setInterrupted(false);
            if (onPausedChange) onPausedChange(false);
            else setLocalPaused(false);
            return;
          }
          if (onPausedChange) onPausedChange(!userPaused);
          else setLocalPaused(value => !value);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${isPaused ? 'Play' : 'Pause'} ${mediaKind}`}
        accessibilityState={{ disabled: failed || preloading }}
      />
      {showLoading && !ready && !failed ? (
        <View style={styles.loadingBadge} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      {failed ? (
        <View style={styles.recovery}>
          <Text style={styles.failText}>Unable to load this {mediaKind}</Text>
          <Pressable
            testID="media-retry"
            accessibilityRole="button"
            accessibilityLabel="Retry media"
            onPress={() => setAttempt(value => value + 1)}
            style={styles.retryButton}
          >
            <Text style={styles.failText}>Try again</Text>
          </Pressable>
          {__DEV__ && errorMsg ? (
            <Text style={styles.failHint} numberOfLines={2}>
              {errorMsg}
            </Text>
          ) : null}
        </View>
      ) : null}
      {!preloading && userPaused && ready ? (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <View style={styles.pauseButton}>
            <AppIcon
              name="play"
              size={36}
              color="#fff"
              fill="#fff"
              strokeWidth={0}
            />
          </View>
        </View>
      ) : null}
      {!preloading && source && !failed ? (
        <Pressable
          testID="media-mute-toggle"
          style={[styles.muteButton, muteControlStyle]}
          onPress={event => {
            event.stopPropagation?.();
            if (onMutedChange) onMutedChange(!isMuted);
            else setLocalMuted(value => !value);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute audio' : 'Mute audio'}
          accessibilityState={{ selected: isMuted }}
        >
          <AppIcon
            name={isMuted ? 'mute' : 'volume'}
            size={20}
            color="#fff"
            strokeWidth={2.1}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingBadge: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    padding: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  recovery: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    padding: 16,
    gap: 10,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  retryButton: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fff',
  },
  transparent: { backgroundColor: 'transparent' },
  transparentFrame: { opacity: 0 },
  // A video surface is rendered by a native AVPlayer layer on iOS. Give that
  // layer one explicit, clipped viewport so its intrinsic video size can
  // never participate in the Reel cell's layout as playback starts/stops.
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  poster: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  playbackToggle: {
    ...StyleSheet.absoluteFill,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseControls: {
    alignItems: 'center',
    gap: 14,
  },
  pauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    // Slight optical nudge so the play triangle reads centered
    paddingLeft: 4,
  },
  muteButton: {
    position: 'absolute',
    right: 12,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  audioPresentation: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171d37',
    gap: 12,
  },
  audioLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 24,
    gap: 8,
  },
  loadingOverPoster: {
    backgroundColor: 'transparent',
  },
  failText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  failHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    textAlign: 'center',
  },
});
