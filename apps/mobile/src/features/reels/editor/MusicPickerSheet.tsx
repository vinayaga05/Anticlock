import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Video from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { GlassFill, GlassIconButton, HIT } from '@/features/reels/ui/GlassIconButton';
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

const ART_TINTS = ['#6d4aff', '#ff4d7d', '#14b8a6', '#f59e0b', '#3b82f6', '#a855f7'];

function tintFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 1000003;
  return ART_TINTS[Math.abs(hash) % ART_TINTS.length];
}

function Artwork({ track }: { track: MusicTrackOption }) {
  if (track.artwork != null) {
    const source = typeof track.artwork === 'number' ? track.artwork : { uri: track.artwork };
    return <Image source={source} style={styles.art} />;
  }
  return (
    <View style={[styles.art, { backgroundColor: tintFor(track.id) }]}>
      <AppIcon name="music" size={20} color="#fff" strokeWidth={2} />
    </View>
  );
}

export function MusicPickerSheet({ visible, selectedId, onSelect, onRemove, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const library = useMusicLibraryQuery(visible);
  const [previewing, setPreviewing] = useState<MusicTrackOption | null>(null);
  const [query, setQuery] = useState('');
  const tracks = useMemo(() => library.data?.tracks ?? [], [library.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      track =>
        track.title.toLowerCase().includes(q) ||
        (track.artist ?? '').toLowerCase().includes(q),
    );
  }, [query, tracks]);
  const failed = Boolean(library.data?.remoteFailed || library.isError);

  const close = () => {
    setPreviewing(null);
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close music" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <GlassFill radius={0} tint="rgba(14,14,16,0.82)" androidTint="#141416" />
        <View style={styles.grabber} />
        <View style={styles.searchRow}>
          <View style={styles.search}>
            <AppIcon name="search" size={17} color="rgba(255,255,255,0.6)" strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search music"
              selectionColor="#fff"
            />
            {query ? (
              <PressableScale onPress={() => setQuery('')} accessibilityLabel="Clear search" style={styles.clear}>
                <AppIcon name="close" size={15} color="rgba(255,255,255,0.7)" strokeWidth={2.25} />
              </PressableScale>
            ) : null}
          </View>
          {selectedId ? (
            <GlassIconButton
              icon="trash"
              accessibilityLabel="Remove music"
              bare
              iconSize={20}
              onPress={() => {
                setPreviewing(null);
                onRemove();
              }}
            />
          ) : null}
        </View>

        {library.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <AppIcon
              name={tracks.length === 0 ? 'music' : 'search'}
              size={30}
              color="rgba(255,255,255,0.55)"
              strokeWidth={1.75}
            />
            <Text style={styles.emptyLine}>{tracks.length === 0 ? 'No music yet' : 'No results'}</Text>
            {tracks.length === 0 && failed ? (
              <GlassIconButton
                icon="refresh"
                accessibilityLabel="Retry loading music"
                onPress={() => library.refetch()}
                iconSize={18}
              />
            ) : null}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={track => `${track.source}:${track.id}`}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.id === selectedId;
              const isPreviewing =
                previewing?.id === item.id && previewing.source === item.source;
              return (
                <PressableScale
                  onPress={() => {
                    setPreviewing(null);
                    onSelect(item);
                  }}
                  accessibilityLabel={active ? `${item.title}, selected` : `Use ${item.title}`}
                  style={styles.row}
                  scaleTo={0.98}
                >
                  <Artwork track={item} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.trackMeta} numberOfLines={1}>
                      {[item.artist, formatClock(item.durationMs)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {active ? (
                    <View style={styles.selected} accessibilityElementsHidden>
                      <AppIcon name="check" size={16} color="#111" strokeWidth={3} />
                    </View>
                  ) : null}
                  <GlassIconButton
                    icon={isPreviewing ? 'pause' : 'play'}
                    accessibilityLabel={isPreviewing ? `Stop preview of ${item.title}` : `Preview ${item.title}`}
                    onPress={() => setPreviewing(isPreviewing ? null : item)}
                    bare
                    iconSize={20}
                    iconFill="#fff"
                  />
                </PressableScale>
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
    maxHeight: '72%',
    minHeight: 300,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  search: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 0 },
  clear: { width: HIT, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { paddingVertical: 56, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 44, gap: 10 },
  emptyLine: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  art: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowCopy: { flex: 1, gap: 2 },
  trackTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  trackMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  selected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { width: 0, height: 0, position: 'absolute' },
});
