import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video, { OnLoadData, VideoRef } from 'react-native-video';

export type VideoSource = string | number;

interface VideoPlayerProps {
  uri: VideoSource;
  paused?: boolean;
  /** Feed autoplay works best muted on iOS. */
  muted?: boolean;
  poster?: string;
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
}: VideoPlayerProps) {
  const ref = useRef<VideoRef>(null);
  const [localPaused, setLocalPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const playbackUri = useMemo(() => resolvePlaybackUri(uri), [uri]);
  const source = useMemo(() => toSource(playbackUri), [playbackUri]);
  const isPaused = localPaused || paused;

  useEffect(() => {
    setReady(false);
    setFailed(false);
    setErrorMsg(null);
    setLocalPaused(false);
  }, [playbackUri]);

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
          muted={muted}
          poster={poster && !ready ? poster : undefined}
          posterResizeMode="cover"
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          mixWithOthers="mix"
          shutterColor="transparent"
          onLoad={(_data: OnLoadData) => {
            setReady(true);
            setFailed(false);
            setErrorMsg(null);
          }}
          onError={e => {
            const msg =
              e?.error?.errorString ||
              e?.error?.localizedDescription ||
              'Playback failed';
            if (__DEV__) {
              // eslint-disable-next-line no-console
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
      {isPaused && ready ? (
        <View style={styles.overlay} pointerEvents="none" />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { ...StyleSheet.absoluteFill },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.28)',
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
