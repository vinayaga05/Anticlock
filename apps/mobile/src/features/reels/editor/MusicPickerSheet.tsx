import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import {
  musicPlaybackSource,
  useMusicLibraryQuery,
} from '@/features/reels/music/musicTracks';
import { formatClock, type MusicTrackOption } from './clipEditModel';

type Props = {
  visible: boolean;
  selectedId: string | null;
  onSelect: (track: MusicTrackOption) => void;
  onRemove: () => void;
  onClose: () => void;
};


export function MusicPickerSheet({ visible, selectedId, onSelect, onRemove, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const library = useMusicLibraryQuery(visible);
  const [previewing, setPreviewing] = useState<MusicTrackOption | null>(null);
  const tracks = library.data?.tracks ?? [];

  const close = () => {
    setPreviewing(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close music" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title}>Music</Text>
          {selectedId ? (
            <PressableScale
              onPress={() => {
                setPreviewing(null);
                onRemove();
              }}
              accessibilityLabel="Remove music"
            >
              <Text style={styles.remove}>Remove music</Text>
            </PressableScale>
          ) : null}
        </View>

        {library.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : tracks.length === 0 ? (
          <View style={styles.empty}>
            <AppIcon name="music" size={30} color="#8d8d93" />
            <Text style={styles.emptyTitle}>No music available yet</Text>
            <Text style={styles.emptyBody}>
              Licensed tracks will appear here once they are added. Your clip
              keeps its original sound for now.
            </Text>
            {library.data?.remoteFailed || library.isError ? (
              <PressableScale onPress={() => library.refetch()} accessibilityLabel="Retry loading music">
                <Text style={styles.retry}>Couldn’t reach the music library. Try again</Text>
              </PressableScale>
            ) : null}
          </View>
        ) : (
          <FlatList
            data={tracks}
            keyExtractor={track => `${track.source}:${track.id}`}
            style={styles.list}
            renderItem={({ item }) => {
              const active = item.id === selectedId;
              const isPreviewing =
                previewing?.id === item.id && previewing.source === item.source;
              return (
                <View style={styles.row}>
                  <PressableScale
                    onPress={() => setPreviewing(isPreviewing ? null : item)}
                    accessibilityLabel={isPreviewing ? `Stop preview of ${item.title}` : `Preview ${item.title}`}
                    style={styles.playButton}
                  >
                    <AppIcon
                      name={isPreviewing ? 'mute' : 'play'}
                      size={18}
                      color="#fff"
                      fill={isPreviewing ? 'none' : '#fff'}
                    />
                  </PressableScale>
                  <View style={styles.rowCopy}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.trackMeta} numberOfLines={1}>
                      {[item.artist, formatClock(item.durationMs)].filter(Boolean).join(' · ')}
                      {item.isDevSample ? ' · dev build only' : ''}
                    </Text>
                  </View>
                  <PressableScale
                    onPress={() => {
                      setPreviewing(null);
                      onSelect(item);
                    }}
                    accessibilityLabel={`Use ${item.title}`}
                    style={active ? [styles.useButton, styles.useButtonActive] : styles.useButton}
                  >
                    <Text style={[styles.useText, active && styles.useTextActive]}>
                      {active ? 'Selected' : 'Use'}
                    </Text>
                  </PressableScale>
                </View>
              );
            }}
          />
        )}
        {previewing ? (
          <Video
            source={musicPlaybackSource(previewing.playback)}
            style={styles.hidden}
            repeat
            paused={false}
            ignoreSilentSwitch="ignore"
            onError={() => setPreviewing(null)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '70%',
    minHeight: 280,
    backgroundColor: '#16161a',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3d3d44',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  remove: { color: '#ff8b96', fontWeight: '700' },
  center: { paddingVertical: 48, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 12, gap: 10 },
  emptyTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  emptyBody: { color: '#a4a4a8', textAlign: 'center', lineHeight: 19 },
  retry: { color: '#8ab4ff', fontWeight: '700', marginTop: 4 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, gap: 2 },
  trackTitle: { color: '#fff', fontWeight: '700' },
  trackMeta: { color: '#9a9aa0', fontSize: 12 },
  useButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  useButtonActive: { backgroundColor: '#2a2a30' },
  useText: { color: '#111', fontWeight: '800', fontSize: 13 },
  useTextActive: { color: '#fff' },
  hidden: { width: 0, height: 0, position: 'absolute' },
});
