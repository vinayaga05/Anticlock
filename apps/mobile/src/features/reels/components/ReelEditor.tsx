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
import { GlassFill, GlassIconButton, HIT } from '@/features/reels/ui/GlassIconButton';
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
  muteOriginalAudio,
  removeMusic,
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
  { id: 'trim', icon: 'scissors', label: 'Trim' },
  { id: 'music', icon: 'music', label: 'Music' },
  { id: 'volume', icon: 'volume', label: 'Volume' },
  { id: 'cover', icon: 'image', label: 'Cover' },
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
      <View style={StyleSheet.absoluteFill}>
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
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <GlassIconButton
          icon="back"
          accessibilityLabel="Back to camera"
          onPress={onBack}
          disabled={exporting}
          iconSize={26}
        />
        <View style={styles.topCenter} pointerEvents="none">
          <View style={styles.durationPill}>
            <Text style={styles.durationText}>{formatSeconds(lengthMs)}</Text>
          </View>
          {music ? (
            <View style={styles.musicBadge}>
              <AppIcon name="music" size={12} color="#fff" strokeWidth={2.25} />
              <Text style={styles.musicBadgeText} numberOfLines={1}>
                {music.track.title}
                {music.track.artist ? ` · ${music.track.artist}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
        <PressableScale
          onPress={runExport}
          disabled={exporting || edit.sources.length === 0}
          accessibilityLabel="Next: continue to Reel publish"
          style={styles.nextPill}
        >
          <Text style={styles.nextText}>Next</Text>
          <AppIcon name="arrow-right" size={16} color="#111" strokeWidth={2.5} />
        </PressableScale>
      </View>

      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.panel}>
          <GlassFill radius={22} tint="rgba(0,0,0,0.38)" androidTint="rgba(10,10,12,0.78)" />
          {!editorAvailable ? (
            <View
              style={styles.warning}
              accessible
              accessibilityLabel="On-device editing needs a native rebuild. Preview only."
            >
              <AppIcon name="alert" size={13} color="#ffcf70" strokeWidth={2.25} />
              <Text style={styles.warningText}>Preview only</Text>
            </View>
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
                  <View
                    key={source.id}
                    style={styles.clipChip}
                    accessible={edit.sources.length <= 1}
                    accessibilityLabel={`Clip ${index + 1}, ${formatSeconds(source.durationMs)}`}
                  >
                    <Text style={styles.clipChipText}>{formatSeconds(source.durationMs)}</Text>
                    {edit.sources.length > 1 ? (
                      <PressableScale
                        onPress={() => onRemoveSource(source.id)}
                        accessibilityLabel={`Remove clip ${index + 1}`}
                        style={styles.chipRemove}
                      >
                        <AppIcon name="close" size={13} color="#fff" strokeWidth={2.5} />
                      </PressableScale>
                    ) : null}
                  </View>
                ))}
                <GlassIconButton
                  icon="plus"
                  accessibilityLabel="Add a clip from gallery"
                  onPress={onAddClip}
                  size={32}
                  iconSize={18}
                />
              </ScrollView>
            </View>
          ) : null}

          {tab === 'music' ? (
            <View style={styles.panelBody}>
              {music ? (
                <>
                  <View style={styles.musicRow}>
                    <View style={styles.musicArt}>
                      <AppIcon name="music" size={18} color="#fff" strokeWidth={2} />
                    </View>
                    <View style={styles.musicCopy}>
                      <Text style={styles.musicTitle} numberOfLines={1}>
                        {music.track.title}
                      </Text>
                      {music.track.artist ? (
                        <Text style={styles.musicMeta} numberOfLines={1}>
                          {music.track.artist}
                        </Text>
                      ) : null}
                    </View>
                    <GlassIconButton
                      icon="refresh"
                      accessibilityLabel="Change music"
                      onPress={() => setMusicOpen(true)}
                      bare
                      iconSize={20}
                    />
                    <GlassIconButton
                      icon="trash"
                      accessibilityLabel="Remove music"
                      onPress={() => update(removeMusic(editRef.current))}
                      bare
                      iconSize={20}
                    />
                  </View>
                  <EditorSlider
                    icon="clock"
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
                    <Text style={styles.attribution} numberOfLines={1}>
                      {music.track.attribution}
                    </Text>
                  ) : null}
                </>
              ) : (
                <View style={styles.emptyMusic}>
                  <GlassIconButton
                    icon="music"
                    accessibilityLabel="Add music"
                    onPress={() => setMusicOpen(true)}
                    active
                    size={52}
                    iconSize={24}
                  />
                </View>
              )}
            </View>
          ) : null}

          {tab === 'volume' ? (
            <View style={styles.panelBody}>
              {hasOriginalAudio ? (
                <PressableScale
                  accessibilityLabel={
                    edit.originalVolume <= 0.001
                      ? 'Restore original sound'
                      : 'Mute original sound'
                  }
                  onPress={() =>
                    update(
                      edit.originalVolume <= 0.001
                        ? { originalVolume: 1 }
                        : muteOriginalAudio(editRef.current),
                    )
                  }
                  style={styles.audioToggle}
                >
                  <AppIcon
                    name={edit.originalVolume <= 0.001 ? 'volume' : 'mute'}
                    size={18}
                    color="#fff"
                    strokeWidth={2.25}
                  />
                  <Text style={styles.audioToggleText}>
                    {edit.originalVolume <= 0.001
                      ? 'Restore original sound'
                      : 'Mute original sound'}
                  </Text>
                </PressableScale>
              ) : null}
              <EditorSlider
                icon={hasOriginalAudio ? 'volume' : 'mute'}
                valueLabel={`${Math.round(edit.originalVolume * 100)}`}
                accessibilityLabel="Original sound volume"
                disabled={!hasOriginalAudio}
                value={edit.originalVolume}
                onChange={value => update({ originalVolume: value })}
              />
              <EditorSlider
                icon="music"
                valueLabel={music ? `${Math.round(music.volume * 100)}` : '–'}
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
                  <AppIcon name="image" size={18} color="rgba(255,255,255,0.6)" />
                </View>
              )}
              <View style={styles.coverSlider}>
                <EditorSlider
                  icon="image"
                  valueLabel={formatClock(edit.coverAtMs)}
                  accessibilityLabel="Cover frame position"
                  value={lengthMs > 1 ? edit.coverAtMs / (lengthMs - 1) : 0}
                  onChange={value =>
                    update({
                      coverAtMs: Math.round(value * Math.max(0, lengthMs - 1)),
                    })
                  }
                />
              </View>
            </View>
          ) : null}
        </View>

        <View
          style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 12) }]}
          accessibilityRole="tablist"
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
                  {!active ? <GlassFill radius={22} /> : null}
                  <AppIcon
                    name={item.icon}
                    size={21}
                    color={active ? '#111' : '#fff'}
                    strokeWidth={2}
                  />
                </View>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {item.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <MusicPickerSheet
        visible={musicOpen}
        selectedId={music?.track.id ?? null}
        onSelect={selectTrack}
        onRemove={() => {
          update(removeMusic(editRef.current));
          setMusicOpen(false);
        }}
        onClose={() => setMusicOpen(false)}
      />

      {exporting ? (
        <View style={styles.exportOverlay}>
          <View style={styles.exportCard} accessible accessibilityLabel={`Exporting ${Math.round(progress * 100)} percent`}>
            <Text style={styles.exportPercent}>{Math.round(progress * 100)}%</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
          </View>
          <GlassIconButton
            icon="close"
            accessibilityLabel="Cancel export"
            onPress={() => cancelExport()}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  topCenter: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 8, paddingHorizontal: 8 },
  durationPill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  durationText: { color: '#fff', fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },
  musicBadge: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  musicBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  nextPill: {
    height: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 18,
    paddingRight: 14,
    borderRadius: 22,
    backgroundColor: '#fff',
  },
  nextText: { color: '#111', fontWeight: '800', fontSize: 15 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  panel: {
    marginHorizontal: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 132,
    justifyContent: 'center',
  },
  panelBody: { gap: 10 },
  audioToggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  audioToggleText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  warning: {
    position: 'absolute',
    top: 8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  warningText: { color: '#ffcf70', fontSize: 11, fontWeight: '700' },
  clipRow: { gap: 8, alignItems: 'center' },
  clipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingLeft: 12,
    paddingRight: 4,
    minWidth: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  chipRemove: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  clipChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingRight: 8,
  },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  musicArt: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#6d4aff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicCopy: { flex: 1, gap: 1 },
  musicTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  musicMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  attribution: { color: 'rgba(255,255,255,0.45)', fontSize: 10 },
  emptyMusic: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  coverBody: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  coverThumb: {
    width: 56,
    height: 84,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverSlider: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  tab: { alignItems: 'center', gap: 3, minWidth: HIT },
  tabIcon: {
    width: HIT,
    height: HIT,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabIconActive: { backgroundColor: '#fff' },
  tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  exportOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  exportCard: { width: 200, gap: 12, alignItems: 'center' },
  progressTrack: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  exportPercent: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
