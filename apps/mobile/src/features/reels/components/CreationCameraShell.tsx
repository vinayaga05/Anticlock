import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import type { ClipPreviewSource } from '@/features/reels/media/clipMediaPicker';

export type CreationMode = 'post' | 'reel' | 'story' | 'instants';

const MODES: { id: CreationMode; label: string }[] = [
  { id: 'post', label: 'POST' },
  { id: 'reel', label: 'REEL' },
  { id: 'story', label: 'STORY' },
  { id: 'instants', label: 'INSTANTS' },
];

function CameraControl({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={styles.control}
    >
      <AppIcon name={icon} size={23} color="#fff" />
    </PressableScale>
  );
}

export function TopCameraControls({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.topControls}>
      <CameraControl icon="close" label="Close creator" onPress={onClose} />
      <CameraControl icon="zap" label="Flash" />
      <CameraControl icon="settings" label="Camera settings" />
    </View>
  );
}

export function CreationToolRail() {
  const tools: { icon: IconName; label: string }[] = [
    { icon: 'edit', label: 'Add text' },
    { icon: 'sparkles', label: 'Effects and filters' },
    { icon: 'grid', label: 'Layout' },
    { icon: 'music', label: 'Creative tools' },
    { icon: 'chevron-down', label: 'More tools' },
  ];
  return (
    <View style={styles.toolRail}>
      {tools.map(tool => (
        <PressableScale
          key={tool.label}
          accessibilityLabel={tool.label}
          style={styles.tool}
        >
          <AppIcon name={tool.icon} size={23} color="#fff" />
        </PressableScale>
      ))}
    </View>
  );
}

export function CaptureButton({
  recording,
  onCapture,
}: {
  recording: boolean;
  onCapture: () => void;
}) {
  return (
    <PressableScale
      onPress={onCapture}
      onLongPress={onCapture}
      accessibilityLabel={
        recording ? 'Stop recording' : 'Hold to record a Reel'
      }
      style={
        recording
          ? [styles.captureOuter, styles.captureRecording]
          : styles.captureOuter
      }
    >
      <View
        style={[
          styles.captureInner,
          recording ? styles.captureInnerRecording : undefined,
        ]}
      />
    </PressableScale>
  );
}

export function CreationModePicker({
  mode,
  onChange,
}: {
  mode: CreationMode;
  onChange: (mode: CreationMode) => void;
}) {
  const move = (direction: number) => {
    const index = MODES.findIndex(item => item.id === mode);
    const next = MODES[index + direction];
    if (next) onChange(next.id);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-20, 20])
    .onEnd(e => {
      if (e.translationX < -44) runOnJS(move)(1);
      if (e.translationX > 44) runOnJS(move)(-1);
    });
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.modePicker}>
        <AppIcon name="grid" size={19} color="#a4a4a8" />
        {MODES.map(item => (
          <PressableScale
            key={item.id}
            onPress={() => onChange(item.id)}
            accessibilityLabel={`${item.label} mode`}
          >
            <Text
              style={[styles.modeLabel, item.id === mode && styles.modeActive]}
            >
              {item.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </GestureDetector>
  );
}

export function CreationCameraShell({
  mode,
  onModeChange,
  onClose,
  onRecord,
  onGallery,
  preview,
}: {
  mode: CreationMode;
  onModeChange: (mode: CreationMode) => void;
  onClose: () => void;
  onRecord: () => void;
  onGallery: () => void;
  preview?: ClipPreviewSource;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.preview, { marginTop: insets.top + 8 }]}>
        {preview ? (
          <Image
            source={typeof preview === 'number' ? preview : { uri: preview }}
            style={styles.previewImage}
          />
        ) : (
          <View style={styles.cameraReady}>
            <AppIcon name="camera" size={30} color="#fff" />
            <Text style={styles.cameraReadyText}>Ready to capture</Text>
          </View>
        )}
        <TopCameraControls onClose={onClose} />
        <CreationToolRail />
        <View style={styles.captureRow}>
          <PressableScale
            accessibilityLabel="Open gallery"
            onPress={onGallery}
            style={styles.thumb}
          >
            <AppIcon name="grid" size={23} color="#fff" />
          </PressableScale>
          <CaptureButton recording={false} onCapture={onRecord} />
          <PressableScale
            accessibilityLabel="Camera filters"
            style={styles.thumb}
          >
            <AppIcon name="sparkles" size={23} color="#fff" />
          </PressableScale>
          <CameraControl icon="camera" label="Switch camera" />
        </View>
      </View>
      <CreationModePicker mode={mode} onChange={onModeChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505', paddingHorizontal: 8 },
  preview: {
    flex: 1,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: '#151515',
  },
  previewImage: {
    ...StyleSheet.absoluteFill,
    width: undefined,
    height: undefined,
    resizeMode: 'cover',
    opacity: 0.68,
  },
  cameraReady: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cameraReadyText: { color: '#fff', fontWeight: '700' },
  topControls: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  control: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolRail: { position: 'absolute', left: 14, top: 82, gap: 16 },
  tool: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureRow: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureRecording: { borderColor: '#ff4d5e' },
  captureInner: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  captureInnerRecording: { borderRadius: 10, backgroundColor: '#ff4d5e' },
  modePicker: {
    height: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 12,
    paddingHorizontal: 10,
  },
  modeLabel: { color: '#828287', fontSize: 13, fontWeight: '700' },
  modeActive: { color: '#fff', fontSize: 15 },
});
