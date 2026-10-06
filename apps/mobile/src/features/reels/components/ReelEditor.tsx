import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelExport,
  exportClip,
  generateThumbnails,
  isClipEditorAvailable,
  type ClipExportResult,
} from '@anticlock/react-native-clip-editor';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { ClipPreview } from '@/features/reels/editor/ClipPreview';
import { EditorSlider } from '@/features/reels/editor/EditorSlider';
import { MusicPickerSheet } from '@/features/reels/editor/MusicPickerSheet';
import { TrimTimeline } from '@/features/reels/editor/TrimTimeline';
import {
  buildExportOptions,
  clampTrim,
  formatClock,
  formatSeconds,
  maxMusicStartMs,
  segmentOffsets,
  totalDurationMs,
  trimmedDurationMs,
  type ClipEditState,
  type MusicTrackOption,
} from '@/features/reels/editor/clipEditModel';

type Tab = 'trim' | 'music' | 'volume' | 'cover';

/**
 * v1 tools. Text, Effects, Speed and Voiceover are intentionally hidden until
 * they are implemented end to end (see docs/reels-instagram-editor-plan.md).
 */
const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'trim', icon: 'film', label: 'Trim' },
  { id: 'music', icon: 'music', label: 'Music' },
  { id: 'volume', icon: 'volume', label: 'Volume' },
  { id: 'cover', icon: 'camera', label: 'Cover' },
];

const THUMBNAIL_COUNT = 10;

type Props = {
  edit: ClipEditState;
  onEditChange: (edit: ClipEditState) => void;
  onBack: () => void;
  onAddClip: () => void;
  onRemoveSource: (id: string) => void;
  onExported: (result: ClipExportResult) => void;
};

function errorCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
}

export function ReelEditor({
  edit,
  onEditChange,
  onBack,
  onAddClip,
  onRemoveSource,
  onExported,
}: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('trim');
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [playheadMs, setPlayheadMs] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const editorAvailable = isClipEditorAvailable();
  const editRef = useRef(edit);
  editRef.current = edit;

  const totalMs = useMemo(() => totalDurationMs(edit.sources), [edit.sources]);
  const lengthMs = trimmedDurationMs(edit);
  const boundaries = useMemo(
    () => segmentOffsets(edit.sources).slice(1),
    [edit.sources],
  );
  const sourceKey = edit.sources.map(source => source.uri).join('|');
  const hasOriginalAudio = edit.sources.some(
    source => source.hasAudio !== false,
  );

  useEffect(() => {
    let cancelled = false;
    setThumbnails([]);
    if (!editorAvailable || edit.sources.length === 0) return;
    generateThumbnails(
      edit.sources.map(source => source.uri),
      THUMBNAIL_COUNT,
      160,
    )
      .then(result => {
        if (!cancelled) setThumbnails(result);
      })
      .catch(() => {
        if (!cancelled) setThumbnails([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by source URIs
  }, [sourceKey, editorAvailable]);

  const update = (patch: Partial<ClipEditState>) =>
    onEditChange({ ...editRef.current, ...patch });

  const onTrimChange = (
    startMs: number,
    endMs: number,
    anchor: 'start' | 'end',
  ) => {
    const next = clampTrim(totalMs, startMs, endMs, anchor);
    const nextLength = next.trimEndMs - next.trimStartMs;
    const current = editRef.current;
    update({
      ...next,
      coverAtMs: Math.min(current.coverAtMs, Math.max(0, nextLength - 1)),
      music: current.music
        ? {
            ...current.music,
            startMs: Math.min(
              current.music.startMs,
              maxMusicStartMs(current.music.track.durationMs, nextLength),
            ),
          }
        : null,
    });
  };

  const selectTrack = (track: MusicTrackOption) => {
    const current = editRef.current;
    update({
      music: { track, startMs: 0, volume: current.music?.volume ?? 0.8 },
      // Duck the original sound so the music is audible by default.
      originalVolume: current.music
        ? current.originalVolume
        : Math.min(current.originalVolume, 0.5),
    });
    setMusicOpen(false);
    setTab('music');
  };

  const runExport = async () => {
    if (!editorAvailable) {
      Alert.alert(
        'Editor unavailable',
        'This build is missing the on-device clip editor. Rebuild the app after pod install / Gradle sync.',
      );
      return;
    }
    if (lengthMs < 1000) {
      Alert.alert('Clip too short', 'Keep at least 1 second of video.');
      return;
    }
    setExporting(true);
    setProgress(0);
    try {
      const result = await exportClip(
        buildExportOptions(editRef.current),
        value => setProgress(value),
      );
      onExported(result);
    } catch (error) {
      if (errorCode(error) !== 'E_CANCELLED') {
        Alert.alert(
          'Couldn’t prepare your clip',
          error instanceof Error ? error.message : 'Please try again.',
        );
      }
    } finally {
      setExporting(false);
    }
  };

  const coverThumb = (() => {
    if (thumbnails.length === 0 || totalMs <= 0) return null;
    const at = edit.trimStartMs + edit.coverAtMs;
    const index = Math.min(
      thumbnails.length - 1,
      Math.max(0, Math.floor((at / totalMs) * thumbnails.length)),
    );
    return thumbnails[index];
  })();

  const music = edit.music;
  const musicMaxStart = music
    ? maxMusicStartMs(music.track.durationMs, lengthMs)
    : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <PressableScale
          onPress={onBack}
          accessibilityLabel="Back to camera"
          disabled={exporting}
        >
          <AppIcon name="back" size={27} color="#fff" />
        </PressableScale>
        <Text style={styles.title}>Edit Reel · {formatSeconds(lengthMs)}</Text>
        <PressableScale
          onPress={runExport}
          disabled={exporting || edit.sources.length === 0}
          accessibilityLabel="Continue to Reel publish"
        >
          <Text style={styles.next}>Next</Text>
        </PressableScale>
      </View>

      <View style={styles.preview}>
        {edit.sources.length > 0 ? (
          <ClipPreview
            sources={edit.sources}
            trimStartMs={edit.trimStartMs}
            trimEndMs={edit.trimEndMs}
            originalVolume={edit.originalVolume}
            music={edit.music}
            paused={scrubbing || exporting || musicOpen}
            onTimeUpdate={setPlayheadMs}
          />
        ) : null}
        {music ? (
          <View style={styles.musicBadge} pointerEvents="none">
            <AppIcon name="music" size={13} color="#fff" />
            <Text style={styles.musicBadgeText} numberOfLines={1}>
              {music.track.title}
              {music.track.artist ? ` · ${music.track.artist}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        {!editorAvailable ? (
          <Text style={styles.warning}>
            On-device editing needs a native rebuild (pod install / Gradle).
            Preview only.
          </Text>
        ) : null}

        {tab === 'trim' ? (
          <View style={styles.panelBody}>
            <TrimTimeline
              totalMs={totalMs}
              trimStartMs={edit.trimStartMs}
              trimEndMs={edit.trimEndMs}
              thumbnails={thumbnails}
              boundariesMs={boundaries}
              playheadMs={playheadMs}
              onTrimChange={onTrimChange}
              onScrubbing={setScrubbing}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.clipRow}
            >
              {edit.sources.map((source, index) => (
                <View key={source.id} style={styles.clipChip}>
                  <Text style={styles.clipChipText}>
                    {index + 1} · {formatSeconds(source.durationMs)}
                  </Text>
                  {edit.sources.length > 1 ? (
                    <PressableScale
                      onPress={() => onRemoveSource(source.id)}
                      accessibilityLabel={`Remove clip ${index + 1}`}
                    >
                      <AppIcon name="close" size={14} color="#ff8b96" />
                    </PressableScale>
                  ) : null}
                </View>
              ))}
              <PressableScale
                onPress={onAddClip}
                accessibilityLabel="Add a clip from gallery"
                style={styles.addChip}
              >
                <AppIcon name="plus" size={16} color="#fff" />
                <Text style={styles.clipChipText}>Add</Text>
              </PressableScale>
            </ScrollView>
          </View>
        ) : null}

        {tab === 'music' ? (
          <View style={styles.panelBody}>
            {music ? (
              <>
                <View style={styles.musicRow}>
                  <View style={styles.musicIcon}>
                    <AppIcon name="music" size={18} color="#fff" />
                  </View>
                  <View style={styles.musicCopy}>
                    <Text style={styles.musicTitle} numberOfLines={1}>
                      {music.track.title}
                    </Text>
                    <Text style={styles.musicMeta} numberOfLines={1}>
                      {music.track.artist ?? 'Unknown artist'} ·{' '}
                      {formatClock(music.track.durationMs)}
                    </Text>
                  </View>
                  <PressableScale
                    onPress={() => setMusicOpen(true)}
                    accessibilityLabel="Change music"
                  >
                    <Text style={styles.link}>Change</Text>
                  </PressableScale>
                </View>
                <EditorSlider
                  label="Music starts at"
                  valueLabel={formatClock(music.startMs)}
                  accessibilityLabel="Music start position"
                  disabled={musicMaxStart <= 0}
                  value={musicMaxStart > 0 ? music.startMs / musicMaxStart : 0}
                  onChange={value =>
                    update({
                      music: {
                        ...music,
                        startMs: Math.round(value * musicMaxStart),
                      },
                    })
                  }
                />
                {music.track.attribution ? (
                  <Text style={styles.hint}>{music.track.attribution}</Text>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyMusic}>
                <Text style={styles.hint}>
                  Add licensed music. It’s mixed into your clip on this device.
                </Text>
                <PressableScale
                  onPress={() => setMusicOpen(true)}
                  accessibilityLabel="Add music"
                  style={styles.primaryChip}
                >
                  <AppIcon name="music" size={16} color="#111" />
                  <Text style={styles.primaryChipText}>Add music</Text>
                </PressableScale>
              </View>
            )}
          </View>
        ) : null}

        {tab === 'volume' ? (
          <View style={styles.panelBody}>
            <EditorSlider
              label="Original sound"
              valueLabel={`${Math.round(edit.originalVolume * 100)}%`}
              accessibilityLabel="Original sound volume"
              disabled={!hasOriginalAudio}
              value={edit.originalVolume}
              onChange={value => update({ originalVolume: value })}
            />
            <EditorSlider
              label="Music"
              valueLabel={
                music ? `${Math.round(music.volume * 100)}%` : 'No music'
              }
              accessibilityLabel="Music volume"
              disabled={!music}
              value={music?.volume ?? 0}
              onChange={value => {
                if (music) update({ music: { ...music, volume: value } });
              }}
            />
          </View>
        ) : null}

        {tab === 'cover' ? (
          <View style={[styles.panelBody, styles.coverBody]}>
            {coverThumb ? (
              <Image source={{ uri: coverThumb }} style={styles.coverThumb} />
            ) : (
              <View style={[styles.coverThumb, styles.coverPlaceholder]}>
                <AppIcon name="camera" size={18} color="#8d8d93" />
              </View>
            )}
            <View style={styles.coverSlider}>
              <EditorSlider
                label="Cover frame"
                valueLabel={formatClock(edit.coverAtMs)}
                accessibilityLabel="Cover frame position"
                value={lengthMs > 1 ? edit.coverAtMs / (lengthMs - 1) : 0}
                onChange={value =>
                  update({
                    coverAtMs: Math.round(value * Math.max(0, lengthMs - 1)),
                  })
                }
              />
              <Text style={styles.hint}>
                The cover comes from your edited clip. You can choose a custom
                image on the next screen.
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View
        style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 14) }]}
      >
        {TABS.map(item => {
          const active = item.id === tab;
          return (
            <PressableScale
              key={item.id}
              onPress={() =>
                item.id === 'music' && !music
                  ? setMusicOpen(true)
                  : setTab(item.id)
              }
              accessibilityLabel={item.label}
              style={styles.tab}
            >
              <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                <AppIcon
                  name={item.icon}
                  size={20}
                  color={active ? '#111' : '#fff'}
                />
              </View>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {item.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <MusicPickerSheet
        visible={musicOpen}
        selectedId={music?.track.id ?? null}
        onSelect={selectTrack}
        onRemove={() => {
          update({ music: null, originalVolume: 1 });
          setMusicOpen(false);
        }}
        onClose={() => setMusicOpen(false)}
      />

      {exporting ? (
        <View style={styles.exportOverlay}>
          <View style={styles.exportCard}>
            <Text style={styles.exportTitle}>Preparing your clip…</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.exportPercent}>
              {Math.round(progress * 100)}%
            </Text>
            <PressableScale
              onPress={() => cancelExport()}
              accessibilityLabel="Cancel export"
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  title: { color: '#fff', fontWeight: '800', fontSize: 16 },
  next: { color: '#fff', fontWeight: '800', fontSize: 16 },
  preview: {
    flex: 1,
    marginHorizontal: 10,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#121212',
  },
  musicBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  musicBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  panel: { paddingHorizontal: 16, paddingTop: 14, minHeight: 150 },
  panelBody: { gap: 12 },
  warning: { color: '#ffcf70', fontSize: 12, marginBottom: 8 },
  clipRow: { gap: 8 },
  clipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#25252a',
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#555',
    borderStyle: 'dashed',
  },
  clipChipText: { color: '#e6e6e8', fontSize: 12, fontWeight: '700' },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  musicIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2a2a30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicCopy: { flex: 1, gap: 2 },
  musicTitle: { color: '#fff', fontWeight: '800' },
  musicMeta: { color: '#9a9aa0', fontSize: 12 },
  link: { color: '#8ab4ff', fontWeight: '700' },
  hint: { color: '#9a9aa0', fontSize: 12, lineHeight: 17 },
  emptyMusic: { gap: 12, alignItems: 'flex-start' },
  primaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  primaryChipText: { color: '#111', fontWeight: '800' },
  coverBody: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  coverThumb: {
    width: 64,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#25252a',
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverSlider: { flex: 1, gap: 6 },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  tab: { alignItems: 'center', gap: 6 },
  tabIcon: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: '#27272c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: { backgroundColor: '#fff' },
  tabText: { color: '#d2d2d5', fontSize: 11 },
  tabTextActive: { color: '#fff', fontWeight: '800' },
  exportOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportCard: {
    width: 260,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#1b1b20',
    gap: 12,
    alignItems: 'center',
  },
  exportTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  progressTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#33333a',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  exportPercent: { color: '#bdbdc2', fontVariant: ['tabular-nums'] },
  cancel: { paddingHorizontal: 18, paddingVertical: 8 },
  cancelText: { color: '#ff8b96', fontWeight: '800' },
});
