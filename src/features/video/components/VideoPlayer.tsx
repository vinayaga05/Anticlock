import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import { useTheme } from '@/shared/hooks/useTheme';

interface VideoPlayerProps {
  uri: string;
  paused?: boolean;
  muted?: boolean;
}

export function VideoPlayer({ uri, paused = false, muted = false }: VideoPlayerProps) {
  const theme = useTheme();
  const ref = useRef<VideoRef>(null);
  const [localPaused, setLocalPaused] = useState(false);

  return (
    <Pressable style={styles.container} onPress={() => setLocalPaused(p => !p)}>
      <Video
        ref={ref}
        source={{ uri }}
        style={styles.video}
        resizeMode="cover"
        repeat
        paused={localPaused || paused}
        muted={muted}
        playInBackground={false}
        ignoreSilentSwitch="ignore"
      />
      {localPaused || paused ? (
        <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { ...StyleSheet.absoluteFill },
  overlay: { ...StyleSheet.absoluteFill },
});
