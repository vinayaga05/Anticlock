import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Video, { OnLoadData, OnProgressData, VideoRef } from 'react-native-video';
import { AppIcon } from '@/shared/components/AppIcon';

export type VideoSource = string | number;

interface VideoPlayerProps {
  uri: VideoSource;
  paused?: boolean;
  /** When true, playback has no audio. Clips/Reels should pass false. */
  muted?: boolean;
  poster?: string;
  /** Optional, non-blocking playback signal for product analytics. */
  onPlaybackProgress?: (currentTime: number, duration: number) => void;
  /** Fired once each time native playback reaches the end. */
  onPlaybackComplete?: (duration: number) => void;
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

function toSource(playbackUri: string) {
  if (!playbackUri) return undefined;
  if (
    /\.m3u8(\?|$)/i.test(playbackUri) ||
    playbackUri.includes('/manifest/video.m3u8')
  ) {
    return { uri: playbackUri, type: 'm3u8' as const };
  }
  if (/\.mp4(\?|$)/i.test(playbackUri) || playbackUri.startsWith('file://')) {
    return { uri: playbackUri, type: 'mp4' as const };
  }
  // Metro asset URIs: http://localhost:8081/assets/...
  return { uri: playbackUri };
}

export function VideoPlayer({
  uri,
  paused = false,
  muted = true,
  poster,
  onPlaybackProgress,
  onPlaybackComplete,
}: VideoPlayerProps) {
  const ref = useRef<VideoRef>(null);
  const durationRef = useRef(0);
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === 'active',
  );
  const [localPaused, setLocalPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const playbackUri = useMemo(() => resolvePlaybackUri(uri), [uri]);
  const source = useMemo(() => toSource(playbackUri), [playbackUri]);
  // Pause on tab blur / navigation away / app background so audio does not
  // keep playing under other screens.
  const isPaused = localPaused || paused || !isFocused || !appActive;

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
    setIsMuted(muted);
    durationRef.current = 0;
    // Reset mute to the caller's default only when the clip source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- muted is an initial value per uri
  }, [playbackUri]);

  const handleLoad = (data: OnLoadData) => {
    durationRef.current = Number.isFinite(data.duration) ? data.duration : 0;
    setReady(true);
    setFailed(false);
    setErrorMsg(null);
  };

  const handleProgress = (data: OnProgressData) => {
    if (isPaused) return;
    onPlaybackProgress?.(
      Math.max(0, data.currentTime),
      Math.max(0, durationRef.current),
    );
  };

  return (
    <Pressable
      style={styles.container}
      onPress={() => {
        if (failed) return;
        setLocalPaused(p => !p);
      }}
      accessibilityRole="button"
      accessibilityLabel={isPaused ? 'Play video' : 'Pause video'}>
      {source ? (
        <Video
          key={playbackUri}
          ref={ref}
          source={source}
          style={styles.video}
          resizeMode="cover"
          repeat
          paused={isPaused}
          muted={isMuted}
          poster={poster && !ready ? poster : undefined}
          posterResizeMode="cover"
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          mixWithOthers="mix"
          shutterColor="transparent"
          onLoad={handleLoad}
          onProgress={handleProgress}
          onEnd={() => onPlaybackComplete?.(Math.max(0, durationRef.current))}
          onError={e => {
            const msg =
              e?.error?.errorString ||
              e?.error?.localizedDescription ||
              'Playback failed';
            if (__DEV__) {
              console.warn('[VideoPlayer]', msg, playbackUri, e?.error);
            }
            setFailed(true);
            setReady(false);
            setErrorMsg(msg);
          }}
          onReadyForDisplay={() => setReady(true)}
        />
      ) : null}
      {!ready && !failed ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      {failed ? (
        <View style={styles.loading} pointerEvents="none">
          <Text style={styles.failText}>Video unavailable</Text>
          {__DEV__ && errorMsg ? (
            <Text style={styles.failHint} numberOfLines={2}>
              {errorMsg}
            </Text>
          ) : null}
        </View>
      ) : null}
      {localPaused && ready ? (
        <View style={styles.pauseOverlay} pointerEvents="box-none">
          <View style={styles.pauseControls} pointerEvents="box-none">
            <View style={styles.pauseButton} pointerEvents="none">
              <AppIcon
                name="play"
                size={36}
                color="#fff"
                fill="#fff"
                strokeWidth={0}
              />
            </View>
            <Pressable
              style={styles.muteButton}
              onPress={event => {
                event.stopPropagation?.();
                setIsMuted(m => !m);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={isMuted ? 'Unmute audio' : 'Mute audio'}>
              <AppIcon
                name={isMuted ? 'mute' : 'volume'}
                size={18}
                color="#fff"
                strokeWidth={2.1}
              />
            </Pressable>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { ...StyleSheet.absoluteFill },
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 24,
    gap: 8,
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
