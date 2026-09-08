import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import type { PickedClipVideo } from '@/features/reels/media/clipMediaPicker';

type Props = {
  clips: PickedClipVideo[];
  onBack: () => void;
  onNext: () => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
};
const tools: { icon: IconName; label: string }[] = [
  { icon: 'edit', label: 'Text' },
  { icon: 'sparkles', label: 'Effects' },
  { icon: 'music', label: 'Music' },
  { icon: 'mic', label: 'Voiceover' },
  { icon: 'zap', label: 'Speed' },
  { icon: 'camera', label: 'Cover' },
];

export function ReelEditor({
  clips,
  onBack,
  onNext,
  onAdd,
  onRemove,
  onMove,
}: Props) {
  const insets = useSafeAreaInsets();
  const active = clips[0];
  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <PressableScale onPress={onBack} accessibilityLabel="Back to camera">
          <AppIcon name="back" size={27} color="#fff" />
        </PressableScale>
        <Text style={styles.title}>Edit Reel</Text>
        <PressableScale
          onPress={onNext}
          accessibilityLabel="Continue to Reel publish"
        >
          <Text style={styles.next}>Next</Text>
        </PressableScale>
      </View>
      <View style={styles.preview}>
        {active ? (
          <VideoPlayer uri={active.previewSource} muted={false} />
        ) : null}
      </View>
      <View style={styles.timeline}>
        <Text style={styles.timelineTitle}>Clips</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.clipRow}
        >
          {clips.map((clip, index) => (
            <View key={clip.id} style={styles.clip}>
              <View style={styles.clipThumb}>
                <Text style={styles.clipNo}>{index + 1}</Text>
              </View>
              <View style={styles.clipActions}>
                <PressableScale
                  onPress={() => onMove(clip.id, -1)}
                  accessibilityLabel="Move clip earlier"
                >
                  <AppIcon name="chevron-left" size={16} color="#fff" />
                </PressableScale>
                <PressableScale
                  onPress={() => onRemove(clip.id)}
                  accessibilityLabel="Delete clip"
                >
                  <AppIcon name="trash" size={15} color="#ff8b96" />
                </PressableScale>
                <PressableScale
                  onPress={() => onMove(clip.id, 1)}
                  accessibilityLabel="Move clip later"
                >
                  <AppIcon name="chevron-right" size={16} color="#fff" />
                </PressableScale>
              </View>
            </View>
          ))}
          <PressableScale
            onPress={onAdd}
            accessibilityLabel="Add another clip"
            style={styles.add}
          >
            <AppIcon name="plus" size={22} color="#fff" />
          </PressableScale>
        </ScrollView>
        <View style={styles.trim}>
          <View style={styles.trimFill} />
          <Text style={styles.trimText}>Drag handles to trim</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tools}
      >
        {tools.map(tool => (
          <PressableScale
            key={tool.label}
            accessibilityLabel={tool.label}
            style={styles.tool}
          >
            <View style={styles.toolIcon}>
              <AppIcon name={tool.icon} size={21} color="#fff" />
            </View>
            <Text style={styles.toolText}>{tool.label}</Text>
          </PressableScale>
        ))}
      </ScrollView>
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
  timeline: { padding: 16, gap: 10 },
  timelineTitle: { color: '#fff', fontWeight: '800' },
  clipRow: { gap: 9 },
  clip: { width: 74, gap: 5 },
  clipThumb: {
    height: 74,
    borderRadius: 10,
    backgroundColor: '#303036',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipNo: { color: '#fff', fontWeight: '800' },
  clipActions: { flexDirection: 'row', justifyContent: 'space-around' },
  add: {
    width: 54,
    height: 74,
    borderWidth: 1,
    borderColor: '#777',
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trim: {
    height: 30,
    borderRadius: 8,
    backgroundColor: '#25252a',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trimFill: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 8,
    bottom: 8,
    backgroundColor: '#e8e8ea',
    borderRadius: 4,
  },
  trimText: {
    color: '#050505',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  tools: { paddingHorizontal: 18, paddingBottom: 18, gap: 18 },
  tool: { alignItems: 'center', gap: 6 },
  toolIcon: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: '#27272c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { color: '#d2d2d5', fontSize: 11 },
});
