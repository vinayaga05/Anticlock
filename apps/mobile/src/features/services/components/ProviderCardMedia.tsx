import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Video, { ViewType } from 'react-native-video';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';

/** A silent list preview: the entire media area belongs to the row's link. */
export function ProviderCardMedia({
  imageUrl,
  fallbackImageUrl,
  videoUrl,
  active,
  name,
  onPreviewReady,
  onPreviewFailed,
}: {
  imageUrl: string;
  fallbackImageUrl?: string;
  videoUrl?: string;
  active: boolean;
  name: string;
  onPreviewReady?: () => void;
  onPreviewFailed?: (url: string) => void;
}) {
  const theme = useTheme();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const [failedVideo, setFailedVideo] = useState(false);
  const [readySession, setReadySession] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const playing = Boolean(
    videoUrl && active && focused && appActive && !failedVideo,
  );
  const sessionRef = useRef({ playing, version: 0 });
  if (sessionRef.current.playing !== playing) {
    sessionRef.current = { playing, version: sessionRef.current.version + 1 };
  }
  const session = sessionRef.current.version;
  const ready = readySession === session;
  const isCurrentSession = useCallback(
    () => sessionRef.current.playing && sessionRef.current.version === session,
    [session],
  );
  const failPreview = useCallback(() => {
    if (!videoUrl || !isCurrentSession()) return;
    setFailedVideo(true);
    onPreviewFailed?.(videoUrl);
  }, [videoUrl, isCurrentSession, onPreviewFailed]);
  const source = useMemo(
    () => ({
      uri: videoUrl ?? '',
      bufferConfig: {
        minBufferMs: 500,
        maxBufferMs: 8000,
        bufferForPlaybackMs: 300,
        bufferForPlaybackAfterRebufferMs: 500,
        backBufferDurationMs: 0,
      },
    }),
    [videoUrl],
  );
  const poster = [imageUrl, fallbackImageUrl].find(
    url => url && !failedImages.includes(url),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setAppActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!playing || ready) return;
    const timeout = setTimeout(failPreview, 10_000);
    return () => clearTimeout(timeout);
  }, [playing, ready, failPreview]);
  return (
    <View
      pointerEvents="none"
      style={[styles.media, { backgroundColor: theme.colors.primarySoft }]}
    >
      <View style={styles.fallback}>
        <Text
          style={{
            color: theme.colors.primary,
            fontSize: 24,
            fontWeight: '700',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
      {playing ? (
        <Video
          source={source}
          style={StyleSheet.absoluteFill}
          muted
          paused={false}
          repeat
          controls={false}
          disableFocus
          mixWithOthers="mix"
          hideShutterView
          shutterColor="transparent"
          playInBackground={false}
          playWhenInactive={false}
          resizeMode="cover"
          viewType={Platform.OS === 'android' ? ViewType.TEXTURE : undefined}
          onReadyForDisplay={() => {
            if (!isCurrentSession()) return;
            setReadySession(session);
            onPreviewReady?.();
          }}
          onError={failPreview}
        />
      ) : null}
      {poster && !(playing && ready) ? (
        <Image
          source={{ uri: poster }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailedImages(previous => [...previous, poster])}
        />
      ) : null}
      {videoUrl && !failedVideo ? (
        <View style={styles.badge}>
          <AppIcon name="video" size={12} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  media: { width: 88, height: 112, borderRadius: 18, overflow: 'hidden' },
  fallback: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#0008',
  },
});
