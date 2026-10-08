import React, { useState } from 'react';
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
  ensureContentDraft,
  usePublishContentMutation,
  uploadContentMedia,
} from '@/shared/api/publishingHooks';
import { PostingAsCard } from '@/shared/publishing/PostingAsCard';
import { usePublisherSelection } from '@/shared/publishing/usePublisherSelection';
import { isApiEnabled } from '@/shared/api/config';
import {
  pickClipVideo,
  pickClipCover,
  createVideoUploadFile,
  createCoverUploadFile,
} from '@/features/reels/media/clipMediaPicker';
import type { PickedClipVideo, PickedClipCover } from '@/features/reels/media/clipMediaPicker';

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
  const publisher = usePublisherSelection('flash');
  const { identities, identity } = publisher;
  const publishContent = usePublishContentMutation();

  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [pickedPhotos, setPickedPhotos] = useState<PickedClipCover[]>([]);
  const [pickedVideos, setPickedVideos] = useState<PickedClipVideo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handlePickPhoto = async () => {
    try {
      const photo = await pickClipCover();
      if (photo) {
        setPickedPhotos(prev => [...prev, photo]);
      }
    } catch (error) {
      Alert.alert(
        'Could not select photo',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const handlePickVideo = async () => {
    try {
      const video = await pickClipVideo();
      if (video) {
        setPickedVideos(prev => [...prev, video]);
      }
    } catch (error) {
      Alert.alert(
        'Could not select video',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const publish = async () => {
    const hasRealMedia = pickedPhotos.length > 0 || pickedVideos.length > 0;
    if (!text.trim() && media.length === 0 && !hasRealMedia) return;

    // API mode: publish to the server as the selected profile only. The
    // Flash feed and the profile refetch after publish (no local copy, which
    // used to show the post under the mock personal user).
    if (isApiEnabled && (hasRealMedia || media.length === 0)) {
      if (!identity) {
        Alert.alert(
          'Publishing profile unavailable',
          'Wait for your profiles to load, then try again.',
        );
        return;
      }
      const mediaType = hasRealMedia
        ? pickedPhotos.length + pickedVideos.length > 1
          ? 'hybrid'
          : pickedVideos.length > 0
            ? 'video'
            : 'image'
        : 'text';
      try {
        setUploading(true);
        setUploadProgress(0);
        const draftId = await ensureContentDraft({
          format: 'flash',
          mediaType,
          caption: text.trim(),
          visibility,
          identity,
        });
        const mediaIds: string[] = [];
        const totalMedia = pickedPhotos.length + pickedVideos.length;
        let uploadedCount = 0;

        for (const photo of pickedPhotos) {
          const file = await createCoverUploadFile(photo);
          mediaIds.push(
            await uploadContentMedia(identity, file, visibility, draftId),
          );
          uploadedCount++;
          setUploadProgress(Math.round((uploadedCount / totalMedia) * 70));
        }

        for (const video of pickedVideos) {
          const file = await createVideoUploadFile(video);
          mediaIds.push(
            await uploadContentMedia(identity, file, visibility, draftId),
          );
          uploadedCount++;
          setUploadProgress(Math.round((uploadedCount / totalMedia) * 70));
        }

        setUploadProgress(80);
        const result = await publishContent.mutateAsync({
          draftId,
          format: 'flash',
          mediaType,
          caption: text.trim(),
          mediaIds,
          visibility,
          identity,
        });
        setUploadProgress(100);
        if (result?.post.contentStatus === 'pending_review') {
          Alert.alert(
            'Post submitted',
            `Your post from ${identity.name} will appear once it is reviewed.`,
          );
        }
      } catch (error) {
        Alert.alert(
          'Could not publish',
          error instanceof Error ? error.message : 'Please try again.',
        );
        return;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
      navigation.goBack();
      return;
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
        {isApiEnabled ? (
          <PostingAsCard
            identities={identities}
            identity={identity}
            onSelect={publisher.select}
            isLoading={publisher.isLoading}
            fallbackApplied={publisher.fallbackApplied}
            disabled={uploading}
          />
        ) : (
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
                {`Posting as ${identity?.name ?? CURRENT_USER.name}`}
              </Text>
            </View>
          </View>
        )}

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
          Add media
        </Text>
        <View style={styles.row}>
          <PressableScale
            onPress={handlePickPhoto}
            style={[
              styles.mediaPickerButton,
              {
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.primarySoft,
                borderRadius: theme.radius.md,
              },
            ]}>
            <Text style={[theme.typography.section, { color: theme.colors.primary }]}>
              Photo
            </Text>
          </PressableScale>
          <PressableScale
            onPress={handlePickVideo}
            style={[
              styles.mediaPickerButton,
              {
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.primarySoft,
                borderRadius: theme.radius.md,
              },
            ]}>
            <Text style={[theme.typography.section, { color: theme.colors.primary }]}>
              Video
            </Text>
          </PressableScale>
        </View>
        {pickedPhotos.length > 0 || pickedVideos.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewScroll}>
              {pickedPhotos.map((photo, idx) => (
                <View key={`photo-${idx}`} style={styles.mediaPreviewItem}>
                  <Image
                    source={{ uri: typeof photo.previewSource === 'string' ? photo.previewSource : undefined }}
                    style={styles.mediaPreviewThumb}
                    resizeMode="cover"
                  />
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    Photo
                  </Text>
                </View>
              ))}
              {pickedVideos.map((video, idx) => (
                <View key={`video-${idx}`} style={styles.mediaPreviewItem}>
                  <Image
                    source={{ uri: typeof video.previewSource === 'string' ? video.previewSource : undefined }}
                    style={styles.mediaPreviewThumb}
                    resizeMode="cover"
                  />
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {Math.round(video.durationMs / 1000)}s
                  </Text>
                </View>
              ))}
            </ScrollView>
            <PressableScale onPress={() => { setPickedPhotos([]); setPickedVideos([]); }}>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.primary },
                ]}
              >
                Clear media
              </Text>
            </PressableScale>
          </>
        ) : null}
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textTertiary },
          ]}
        >
          Or use sample media for testing
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
              Clear sample media
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
          title={uploading ? `Uploading ${uploadProgress}%` : "Publish"}
          onPress={() => void publish()}
          loading={publishContent.isPending || uploading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  mediaPickerButton: {
    flex: 1,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  mediaPreviewScroll: {
    flexGrow: 0,
  },
  mediaPreviewItem: {
    marginRight: 10,
    alignItems: 'center',
    gap: 4,
  },
  mediaPreviewThumb: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
