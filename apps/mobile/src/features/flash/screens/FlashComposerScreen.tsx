import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/components/Button';
import { FilterPills } from '@/shared/components/FilterPills';
import { PressableScale } from '@/shared/components/PressableScale';
import { PostMedia, PostVisibility } from '@/shared/data/flash/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { CURRENT_USER } from '@/shared/data/flash';
import { getFlashCloudflareVideo } from '@/shared/data/cloudflareVideos';
import {
  usePublishContentMutation,
  usePublishingIdentitiesQuery,
} from '@/shared/api/publishingHooks';
import { isApiEnabled } from '@/shared/api/config';

const canvaSampleVideo = getFlashCloudflareVideo();

const VISIBILITY: { id: PostVisibility; label: string }[] = [
  { id: 'public', label: 'Public' },
  { id: 'followers', label: 'Followers' },
  { id: 'friends', label: 'Friends' },
  { id: 'community', label: 'Community' },
  { id: 'only_me', label: 'Only me' },
];

const SAMPLE_MEDIA: PostMedia[] = [
  {
    id: 'sample-img',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&h=600&q=80',
  },
  {
    id: 'sample-vid',
    type: 'video',
    url:
      canvaSampleVideo?.url ??
      require('@/shared/assets/videos/canva/yoga-flow.mp4'),
    posterUrl:
      canvaSampleVideo?.posterUrl ??
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&h=600&q=80',
  },
];

export function FlashComposerScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const publishPost = useEngagementStore(s => s.publishPost);
  const { data: identities = [] } = usePublishingIdentitiesQuery();
  const publishContent = usePublishContentMutation();

  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [identityId, setIdentityId] = useState<string | null>(null);

  useEffect(() => {
    if (!identityId && identities[0]) setIdentityId(identities[0].id);
  }, [identities, identityId]);

  const identity =
    identities.find(item => item.id === identityId) ?? identities[0];
  const identityPills = useMemo(
    () =>
      identities.map(item => ({
        id: item.id,
        label: item.type === 'provider' ? item.name : 'Personal',
      })),
    [identities],
  );

  const publish = async () => {
    if (!text.trim() && media.length === 0) return;
    if (isApiEnabled && identity && media.length === 0) {
      try {
        await publishContent.mutateAsync({
          format: 'flash',
          mediaType: 'text',
          caption: text.trim(),
          visibility,
          identity,
        });
      } catch (error) {
        Alert.alert(
          'Could not publish',
          error instanceof Error ? error.message : 'Please try again.',
        );
        return;
      }
    }
    publishPost({
      text: text.trim(),
      visibility,
      media,
    });
    navigation.goBack();
  };

  const toggleSampleMedia = (item: PostMedia) => {
    setMedia(prev =>
      prev.some(m => m.id === item.id)
        ? prev.filter(m => m.id !== item.id)
        : [...prev, item],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: 120,
          gap: theme.spacing.lg,
        }}
      >
        <View style={styles.author}>
          <Image
            source={{ uri: CURRENT_USER.avatarUrl }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                theme.typography.section,
                { color: theme.colors.textPrimary },
              ]}
            >
              {identity?.name ?? CURRENT_USER.name}
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary },
              ]}
            >
              Publishing as{' '}
              {identity?.type === 'provider' ? 'business' : 'personal profile'}
            </Text>
          </View>
        </View>

        {identityPills.length > 1 ? (
          <View style={styles.identityPicker}>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary },
              ]}
            >
              Publishing as
            </Text>
            <FilterPills
              activeId={identity?.id ?? ''}
              onChange={setIdentityId}
              pills={identityPills}
            />
          </View>
        ) : null}

        <PressableScale
          onPress={() => navigation.navigate('ClipComposer')}
          accessibilityLabel="Create a video clip"
          style={[
            styles.clipEntry,
            {
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.primarySoft,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <View style={styles.clipEntryCopy}>
            <Text
              style={[
                theme.typography.section,
                { color: theme.colors.textPrimary },
              ]}
            >
              Create a video clip
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary },
              ]}
            >
              Upload a video with a cover, tags, location, and privacy settings.
            </Text>
          </View>
          <Text
            style={[
              theme.typography.bodySmall,
              styles.clipEntryAction,
              { color: theme.colors.primary },
            ]}
          >
            Open
          </Text>
        </PressableScale>

        <FilterPills
          activeId={visibility}
          onChange={id => setVisibility(id as PostVisibility)}
          pills={VISIBILITY}
        />

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What’s happening?"
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          style={[
            styles.input,
            {
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
            },
          ]}
        />

        <Text
          style={[
            theme.typography.section,
            { color: theme.colors.textPrimary },
          ]}
        >
          Add media (mock)
        </Text>
        <View style={styles.row}>
          {SAMPLE_MEDIA.map(m => {
            const active = media.some(x => x.id === m.id);
            return (
              <PressableScale
                key={m.id}
                onPress={() => toggleSampleMedia(m)}
                style={[
                  styles.mediaChip,
                  {
                    borderColor: active
                      ? theme.colors.primary
                      : theme.colors.border,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Image
                  source={
                    typeof m.url === 'number' && !m.posterUrl
                      ? m.url
                      : {
                          uri:
                            m.posterUrl ??
                            (typeof m.url === 'string'
                              ? m.url
                              : Image.resolveAssetSource(m.url)?.uri ?? ''),
                        }
                  }
                  style={styles.mediaThumb}
                />
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {m.type}
                  {active ? ' · added' : ''}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        {media.length > 0 ? (
          <PressableScale onPress={() => setMedia([])}>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.primary },
              ]}
            >
              Clear media
            </Text>
          </PressableScale>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.backgroundElevated,
          },
        ]}
      >
        <Button
          title="Publish"
          onPress={() => void publish()}
          loading={publishContent.isPending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identityPicker: { gap: 6 },
  clipEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  clipEntryCopy: { flex: 1, gap: 3 },
  clipEntryAction: { fontWeight: '700' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  input: {
    minHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 10 },
  mediaChip: {
    flex: 1,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 6,
    paddingBottom: 8,
  },
  mediaThumb: { width: '100%', height: 90 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
