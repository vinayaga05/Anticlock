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
import { PostVisibility } from '@/shared/data/flash/types';
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


const VISIBILITY: { id: PostVisibility; label: string }[] = [
  { id: 'public', label: 'Public' },
  { id: 'followers', label: 'Followers' },
  { id: 'friends', label: 'Friends' },
  { id: 'community', label: 'Community' },
  { id: 'only_me', label: 'Only me' },
];

export function FlashComposerScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const publisher = usePublisherSelection('flash');
  const { identities, identity } = publisher;
  const publishContent = usePublishContentMutation();

  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
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
    if (!text.trim() && !hasRealMedia) return;
    if (!isApiEnabled) {
      Alert.alert('Publishing unavailable', 'Connect to the Anticlock service to publish this post.');
      return;
    }

    // Publish to the server as the selected profile only.
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
        <PostingAsCard
          identities={identities}
          identity={identity}
          onSelect={publisher.select}
          isLoading={publisher.isLoading}
          fallbackApplied={publisher.fallbackApplied}
          disabled={uploading}
        />

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
