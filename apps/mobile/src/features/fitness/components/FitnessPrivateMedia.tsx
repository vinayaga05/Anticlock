import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video from 'react-native-video';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, X } from 'lucide-react-native';
import { useAuth } from '@/shared/context/AuthProvider';
import { getApiToken } from '@/shared/api/client';
import { useTheme } from '@/shared/hooks/useTheme';
import { getFitnessMedia } from '../fitnessMedia';
import { useFitnessMutation } from '../api/fitnessApi';

export function FitnessPrivateMedia({
  mediaId,
  providerId,
  compact = false,
  onDelete,
}: {
  mediaId: string;
  providerId?: string;
  compact?: boolean;
  onDelete?: () => void;
}) {
  const { user } = useAuth(),
    token = getApiToken(),
    theme = useTheme(),
    insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false),
    [failed, setFailed] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  const mutation = useFitnessMutation();
  const query = useQuery({
    queryKey: [
      'fitness',
      user?.id,
      token,
      'private-media',
      mediaId,
      providerId,
    ],
    enabled: !!user && !!token && user.id !== 'temporary-guest',
    queryFn: ({ signal }) => getFitnessMedia(mediaId, providerId, signal),
    retry: false,
    staleTime: 0,
  });
  useEffect(() => {
    setVisible(false);
    setFailed(false);
    setNotice(null);
  }, [mediaId, providerId, token]);
  const image = query.data?.media.kind === 'image';
  const remove = () =>
    Alert.alert(
      'Delete private media?',
      'This removes the file from your private fitness space.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await mutation.mutateAsync({
                path: `/media/${mediaId}`,
                method: 'DELETE',
              });
              setVisible(false);
              onDelete?.();
            } catch (error) {
              setNotice((error as Error).message);
            }
          },
        },
      ],
    );
  return (
    <View style={{ gap: 10 }}>
      {query.isLoading ? (
        <Text style={{ color: theme.colors.textSecondary }}>
          Loading private media…
        </Text>
      ) : query.error || failed ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setFailed(false);
            void query.refetch();
          }}
          style={styles.retry}
        >
          <Text style={{ color: theme.colors.textPrimary }}>
            Private media unavailable. Tap to retry.
          </Text>
        </Pressable>
      ) : query.data ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open private fitness ${
            image ? 'photo' : 'video'
          }`}
          onPress={() => setVisible(true)}
          style={[
            styles.preview,
            {
              height: compact ? 110 : 190,
              backgroundColor: theme.colors.surfaceMuted,
            },
          ]}
        >
          {image ? (
            <Image
              source={query.data.source}
              resizeMode="cover"
              onError={() => setFailed(true)}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <>
              <Play size={26} color={theme.colors.textPrimary} />
              <Text style={{ color: theme.colors.textPrimary }}>
                View private video
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
      {notice ? (
        <Text style={{ color: theme.colors.error }}>{notice}</Text>
      ) : null}
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete private media"
          disabled={mutation.isPending}
          onPress={remove}
          style={styles.retry}
        >
          <Text style={{ color: theme.colors.error }}>
            {mutation.isPending ? 'Removing…' : 'Delete private media'}
          </Text>
        </Pressable>
      ) : null}
      <Modal
        visible={visible && !!query.data}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View
          style={[
            styles.viewer,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close private media"
            onPress={() => setVisible(false)}
            style={styles.close}
          >
            <X size={24} color="#FFFFFF" />
          </Pressable>
          {visible && query.data ? (
            image ? (
              <Image
                source={query.data.source}
                resizeMode="contain"
                onError={() => setFailed(true)}
                style={styles.full}
              />
            ) : (
              <Video
                source={query.data.source}
                controls
                paused={!visible}
                muted={false}
                resizeMode="contain"
                ignoreSilentSwitch="ignore"
                onError={() => {
                  setFailed(true);
                  setVisible(false);
                }}
                style={styles.full}
              />
            )
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  preview: {
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  retry: { minHeight: 44, justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: '#07100DFC' },
  close: {
    zIndex: 2,
    width: 48,
    height: 48,
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  full: { flex: 1, width: '100%' },
});
