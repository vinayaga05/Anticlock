import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Video, { type OnProgressData, type VideoRef } from 'react-native-video';
import { AppIcon } from '@/shared/components/AppIcon';
import { musicPlaybackSource } from '@/features/reels/music/musicTracks';
import {
  locateInSources,
  segmentOffsets,
  type ClipSource,
  type SelectedMusic,
} from './clipEditModel';

type Props = {
  sources: ClipSource[];
  trimStartMs: number;
  trimEndMs: number;
  originalVolume: number;
  music: SelectedMusic | null;
  /** Pauses playback (e.g. while scrubbing or exporting). */
  paused: boolean;
  /** Time on the full concatenated timeline. */
  onTimeUpdate?: (timelineMs: number) => void;
};


/**
 * Looping preview of the edit: plays the trimmed range across segments in
 * order, with the selected music (from its start offset) mixed on top at the
 * chosen volumes. The exported file is rendered natively, so this is only an
 * approximation (segment switches can show a brief black frame).
 */
export function ClipPreview({
  sources,
  trimStartMs,
  trimEndMs,
  originalVolume,
  music,
  paused,
  onTimeUpdate,
}: Props) {
  const videoRef = useRef<VideoRef>(null);
  const musicRef = useRef<VideoRef>(null);
  const offsets = useMemo(() => segmentOffsets(sources), [sources]);
  const start = useMemo(
    () => locateInSources(sources, trimStartMs),
    [sources, trimStartMs],
  );
  const [segmentIndex, setSegmentIndex] = useState(start.index);
  const pendingSeekMs = useRef<number | null>(start.localMs);
  const [userPaused, setUserPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const restart = useCallback(() => {
    pendingSeekMs.current = start.localMs;
    if (segmentIndex === start.index) {
      videoRef.current?.seek(start.localMs / 1000);
      pendingSeekMs.current = null;
    } else {
      setSegmentIndex(start.index);
    }
    if (music) musicRef.current?.seek(music.startMs / 1000);
  }, [music, segmentIndex, start.index, start.localMs]);

  // Jump back to the trim start whenever the window or sources change.
  useEffect(() => {
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart on edit changes only
  }, [sources, trimStartMs, trimEndMs]);

  useEffect(() => {
    if (music) musicRef.current?.seek(music.startMs / 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync when the offset changes
  }, [music?.track.id, music?.startMs]);

  const lastAdvanceAt = useRef(0);
  const advance = useCallback(() => {
    const now = Date.now();
    if (now - lastAdvanceAt.current < 300) return;
    lastAdvanceAt.current = now;
    const next = segmentIndex + 1;
    if (next < sources.length && offsets[next] < trimEndMs - 1) {
      pendingSeekMs.current = 0;
      setSegmentIndex(next);
    } else {
      restart();
    }
  }, [offsets, restart, segmentIndex, sources.length, trimEndMs]);

  const onProgress = (data: OnProgressData) => {
    const timeline = (offsets[segmentIndex] ?? 0) + data.currentTime * 1000;
    onTimeUpdate?.(timeline);
    if (timeline >= trimEndMs - 30) advance();
  };

  const source = sources[segmentIndex];
  const isPaused = paused || userPaused;

  if (!source) return <View style={styles.root} />;

  return (
    <Pressable
      style={styles.root}
      onPress={() => setUserPaused(value => !value)}
      accessibilityRole="button"
      accessibilityLabel={isPaused ? 'Play preview' : 'Pause preview'}
    >
      <Video
        key={`${segmentIndex}-${source.uri}`}
        ref={videoRef}
        source={{ uri: source.uri }}
        style={styles.video}
        resizeMode="contain"
        paused={isPaused}
        repeat={false}
        volume={originalVolume}
        muted={originalVolume <= 0.001}
        progressUpdateInterval={100}
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
        mixWithOthers="mix"
        shutterColor="transparent"
        onLoad={() => {
          setLoading(false);
          setFailed(null);
          if (pendingSeekMs.current !== null) {
            videoRef.current?.seek(pendingSeekMs.current / 1000);
            pendingSeekMs.current = null;
          }
        }}
        onProgress={onProgress}
        onEnd={advance}
        onError={event => {
          setLoading(false);
          setFailed(
            event?.error?.errorString ||
              event?.error?.localizedDescription ||
              'Preview unavailable',
          );
        }}
      />
      {music ? (
        <Video
          key={`music-${music.track.source}-${music.track.id}`}
          ref={musicRef}
          source={musicPlaybackSource(music.track.playback)}
          style={styles.hidden}
          paused={isPaused}
          repeat
          volume={music.volume}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          mixWithOthers="mix"
          onLoad={() => musicRef.current?.seek(music.startMs / 1000)}
        />
      ) : null}
      {loading && !failed ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      {failed ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.failText}>{failed}</Text>
        </View>
      ) : null}
      {userPaused && !failed ? (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.playButton}>
            <AppIcon name="play" size={34} color="#fff" fill="#fff" strokeWidth={0} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  video: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  hidden: { width: 0, height: 0, position: 'absolute' },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  failText: { color: 'rgba(255,255,255,0.8)', fontWeight: '600', paddingHorizontal: 24, textAlign: 'center' },
});
