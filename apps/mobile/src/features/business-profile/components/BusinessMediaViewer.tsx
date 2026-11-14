import React, { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import { PressableScale } from '@/shared/components/PressableScale';
import { AppIcon } from '@/shared/components/AppIcon';

export type BusinessGalleryItem = {
  id: string;
  kind: 'image' | 'video';
  url: string;
};
export function BusinessMediaViewer({
  items,
  initialIndex,
  onClose,
}: {
  items: BusinessGalleryItem[];
  initialIndex: number | null;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex ?? 0);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (initialIndex !== null) setIndex(initialIndex);
  }, [initialIndex]);
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));
  const selected = initialIndex === null ? undefined : items[safeIndex];
  useEffect(() => {
    setFailedUrl(null);
    setRetry(0);
  }, [selected?.url]);
  if (!selected) return null;
  return (
    <Modal
      visible
      onRequestClose={onClose}
      animationType="fade"
      presentationStyle="fullScreen"
    >
      <View style={styles.root}>
        {selected?.kind === 'video' ? (
          <VideoPlayer key={selected.id} uri={selected.url} muted={false} />
        ) : selected ? (
          failedUrl === selected.url ? (
            <View style={styles.failed}>
              <AppIcon name="images" color="#C9D5CD" size={32} />
              <Text style={styles.failedTitle}>This image could not load.</Text>
              <PressableScale
                accessibilityLabel="Retry gallery image"
                onPress={() => {
                  setFailedUrl(null);
                  setRetry(value => value + 1);
                }}
                style={styles.retry}
              >
                <AppIcon name="refresh" color="#FFFFFF" size={18} />
                <Text style={styles.failedTitle}>Try again</Text>
              </PressableScale>
            </View>
          ) : (
            <Image
              key={`${selected.id}-${retry}`}
              source={{ uri: selected.url }}
              onError={() => setFailedUrl(selected.url)}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              accessibilityLabel="Business gallery image"
            />
          )
        ) : null}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.count}>
            {safeIndex + 1} / {items.length}
          </Text>
          <PressableScale
            onPress={onClose}
            accessibilityLabel="Close gallery"
            style={styles.button}
          >
            <AppIcon name="close" color="#FFFFFF" size={22} />
          </PressableScale>
        </View>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <PressableScale
            onPress={() =>
              setIndex(current =>
                Math.max(0, Math.min(current, items.length - 1) - 1),
              )
            }
            disabled={safeIndex <= 0}
            accessibilityLabel="Previous gallery item"
            style={[styles.button, { opacity: safeIndex <= 0 ? 0.3 : 1 }]}
          >
            <AppIcon name="back" color="#FFFFFF" size={24} />
          </PressableScale>
          <PressableScale
            onPress={() =>
              setIndex(current =>
                Math.min(items.length - 1, Math.max(0, current) + 1),
              )
            }
            disabled={safeIndex >= items.length - 1}
            accessibilityLabel="Next gallery item"
            style={[
              styles.button,
              { opacity: safeIndex >= items.length - 1 ? 0.3 : 1 },
            ]}
          >
            <AppIcon name="chevron-right" color="#FFFFFF" size={24} />
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0E0C' },
  failed: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 24,
  },
  failedTitle: { color: '#FFFFFF', fontSize: 15 },
  retry: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#294336',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  header: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  count: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: '#00000080',
    padding: 10,
    borderRadius: 14,
  },
  button: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2C23B0',
  },
  footer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
