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
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { FilterPills } from '@/shared/components/FilterPills';
import { PressableScale } from '@/shared/components/PressableScale';
import {
  uploadContentMedia,
  usePublishContentMutation,
  usePublishingIdentitiesQuery,
} from '@/shared/api/publishingHooks';
import { useTheme } from '@/shared/hooks/useTheme';
import type { PostVisibility } from '@/shared/data/flash/types';
import {
  coverFromExport,
  createCoverUploadFile,
  createVideoUploadFile,
  pickClipCover,
  pickClipSource,
  videoFromExport,
  type PickedClipCover,
  type PickedClipVideo,
} from '@/features/reels/media/clipMediaPicker';
import { STORAGE_KEYS } from '@/shared/constants';
import { storage } from '@/shared/services/storage';
import type { ClipExportResult } from '@anticlock/react-native-clip-editor';
import type { CreationMode } from '@/features/reels/components/CreationCameraShell';
import { ClipCameraScreen } from '@/features/reels/camera/ClipCameraScreen';
import { ReelEditor } from '@/features/reels/components/ReelEditor';
import {
  MAX_CLIP_DURATION_MS,
  MAX_CLIP_SEGMENTS,
  buildEditMetadata,
  createEditState,
  totalDurationMs,
  type ClipEditMetadata,
  type ClipEditState,
  type ClipSource,
} from '@/features/reels/editor/clipEditModel';
import {
  displayBytes,
  normalizeHashtags,
  normalizeTaggedUserIds,
} from './clipComposerUtils';
import {
  parseDraft,
  serializeEdit,
  type ClipComposerDraftV2,
  type CoverMode,
  type RestoredDraft,
} from './clipComposerDraft';

const VISIBILITY: { id: PostVisibility; label: string }[] = [
  { id: 'public', label: 'Public' },
  { id: 'followers', label: 'Followers' },
  { id: 'friends', label: 'Friends' },
  { id: 'community', label: 'Community' },
  { id: 'only_me', label: 'Only me' },
];

type UploadPhase =
  | 'idle'
  | 'preparing'
  | 'video'
  | 'cover'
  | 'publishing'
  | 'complete'
  | 'error';

type UploadStatus = {
  phase: UploadPhase;
  progress: number;
  message?: string;
};

function loadDraft(): RestoredDraft | null {
  const raw = storage.getString(STORAGE_KEYS.CLIP_COMPOSER_DRAFT);
  if (!raw) return null;
  try {
    return parseDraft(raw);
  } catch {
    storage.remove(STORAGE_KEYS.CLIP_COMPOSER_DRAFT);
    return null;
  }
}

function imageSource(source: string | number) {
  return typeof source === 'number' ? source : { uri: source };
}

function phaseTitle(status: UploadStatus) {
  if (status.message) return status.message;
  switch (status.phase) {
    case 'preparing':
      return 'Preparing your clip…';
    case 'video':
      return 'Uploading video…';
    case 'cover':
      return 'Uploading cover…';
    case 'publishing':
      return 'Publishing your clip…';
    case 'complete':
      return 'Your clip is published.';
    default:
      return '';
  }
}

export function ClipComposerScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { data: identities = [], isLoading: identitiesLoading } =
    usePublishingIdentitiesQuery();
  const publishContent = usePublishContentMutation();

  const [identityId, setIdentityId] = useState<string | null>(null);
  const [stage, setStage] = useState<'capture' | 'editor' | 'publish'>(
    'capture',
  );
  const [creationMode, setCreationMode] = useState<CreationMode>('reel');
  /** Takes recorded in the camera (kept when returning from the editor). */
  const [segments, setSegments] = useState<ClipSource[]>([]);
  /** Current editor state; the source of truth for trim/music/volume. */
  const [edit, setEdit] = useState<ClipEditState | null>(null);
  /** Exported MP4 (what gets uploaded) and the edit that produced it. */
  const [video, setVideo] = useState<PickedClipVideo | null>(null);
  const [exportedEdit, setExportedEdit] = useState<ClipEditMetadata | null>(
    null,
  );
  const [generatedCover, setGeneratedCover] = useState<PickedClipCover | null>(
    null,
  );
  const [coverMode, setCoverMode] = useState<CoverMode>('generated');
  const [cover, setCover] = useState<PickedClipCover | null>(null);
  const [caption, setCaption] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [taggedUserIdsInput, setTaggedUserIdsInput] = useState('');
  const [locationName, setLocationName] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    phase: 'idle',
    progress: 0,
  });

  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    setIdentityId(draft.identityId);
    setCover(draft.cover);
    setCoverMode(draft.coverMode);
    setCaption(draft.caption);
    setHashtagsInput(draft.hashtagsInput);
    setTaggedUserIdsInput(draft.taggedUserIdsInput);
    setLocationName(draft.locationName);
    setVisibility(draft.visibility);
    if (draft.edit) {
      setEdit(draft.edit);
      setSegments(draft.edit.sources.filter(s => s.origin === 'camera'));
      setStage('editor');
    }
  }, []);

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
  const isPublishing =
    uploadStatus.phase !== 'idle' &&
    uploadStatus.phase !== 'complete' &&
    uploadStatus.phase !== 'error';

  /** Any change to the edit invalidates a previous export. */
  const changeEdit = (next: ClipEditState) => {
    setEdit(next);
    setVideo(null);
    setExportedEdit(null);
    setGeneratedCover(null);
  };

  const openEditor = (sources: ClipSource[]) => {
    if (sources.length === 0) return;
    const sameSources =
      edit &&
      edit.sources.length === sources.length &&
      edit.sources.every((source, index) => source.uri === sources[index].uri);
    if (!sameSources) changeEdit(createEditState(sources));
    setStage('editor');
  };

  const addSources = (extra: ClipSource[]) => {
    const current = edit?.sources ?? segments;
    const sources = [...current, ...extra].slice(0, MAX_CLIP_SEGMENTS);
    const previousTotal = totalDurationMs(current);
    const base = edit ?? createEditState(current);
    const total = totalDurationMs(sources);
    // Extend the window if it was open-ended (covered the whole timeline).
    const trimEndMs =
      !edit || base.trimEndMs >= previousTotal - 1
        ? Math.min(total, base.trimStartMs + MAX_CLIP_DURATION_MS)
        : base.trimEndMs;
    changeEdit({ ...base, sources, trimEndMs });
    setStage('editor');
  };

  const chooseFromGallery = async () => {
    try {
      const selected = await pickClipSource();
      if (!selected) return;
      if (stage === 'editor' || segments.length > 0) {
        addSources([selected]);
      } else {
        changeEdit(createEditState([selected]));
        setStage('editor');
      }
    } catch (error) {
      Alert.alert(
        'Couldn’t choose video',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const removeSource = (id: string) => {
    if (!edit) return;
    const sources = edit.sources.filter(source => source.id !== id);
    setSegments(current => current.filter(source => source.id !== id));
    if (sources.length === 0) {
      changeEdit(createEditState([]));
      setEdit(null);
      setStage('capture');
      return;
    }
    const total = totalDurationMs(sources);
    changeEdit({
      ...edit,
      sources,
      trimStartMs: 0,
      trimEndMs: Math.min(total, MAX_CLIP_DURATION_MS),
      coverAtMs: 0,
    });
  };

  const onExported = (result: ClipExportResult) => {
    if (!edit) return;
    setVideo(videoFromExport(result));
    setGeneratedCover(coverFromExport(result));
    setExportedEdit(buildEditMetadata(edit));
    setStage('publish');
  };

  const chooseCover = async () => {
    try {
      const selected = await pickClipCover();
      if (selected) {
        setCover(selected);
        setCoverMode('custom');
      }
    } catch (error) {
      Alert.alert(
        'Couldn’t choose cover',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const publish = async () => {
    if (!video) {
      Alert.alert('Edit your clip', 'Finish editing your clip before publishing.');
      return;
    }
    if (!identity) {
      Alert.alert(
        'Publishing profile unavailable',
        'Wait for your profile to load, then try again.',
      );
      return;
    }
    if (coverMode === 'custom' && !cover) {
      Alert.alert(
        'Choose a cover',
        'Add a custom cover image or switch to the video-frame cover option.',
      );
      return;
    }

    let hashtags: string[];
    let taggedUserIds: string[];
    try {
      hashtags = normalizeHashtags(hashtagsInput);
      taggedUserIds = normalizeTaggedUserIds(taggedUserIdsInput);
    } catch (error) {
      Alert.alert(
        'Check your post details',
        error instanceof Error ? error.message : 'Please review the details.',
      );
      return;
    }

    try {
      setUploadStatus({ phase: 'preparing', progress: 8 });
      const uploadFile = await createVideoUploadFile(video);
      setUploadStatus({
        phase: 'video',
        progress: 35,
        message: `Uploading video (${displayBytes(uploadFile.byteSize)})…`,
      });
      const mediaId = await uploadContentMedia(
        identity,
        uploadFile,
        visibility,
      );

      let thumbnailMediaId: string | null = null;
      const coverToUpload =
        coverMode === 'custom' ? cover : generatedCover;
      if (coverToUpload) {
        const coverFile = await createCoverUploadFile(coverToUpload);
        setUploadStatus({
          phase: 'cover',
          progress: 68,
          message: `Uploading cover (${displayBytes(coverFile.byteSize)})…`,
        });
        thumbnailMediaId = await uploadContentMedia(
          identity,
          coverFile,
          visibility,
        );
      }

      setUploadStatus({ phase: 'publishing', progress: 88 });
      await publishContent.mutateAsync({
        format: 'clip',
        mediaType: 'video',
        caption: caption.trim(),
        mediaIds: [mediaId],
        thumbnailMediaId,
        hashtags,
        taggedUserIds,
        location: locationName.trim() ? { name: locationName.trim() } : null,
        visibility,
        edit: exportedEdit ?? undefined,
        identity,
      });
      setUploadStatus({ phase: 'complete', progress: 100 });
      storage.remove(STORAGE_KEYS.CLIP_COMPOSER_DRAFT);
      Alert.alert('Clip published', 'Your video is ready to appear in Clips.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Please try publishing again.';
      setUploadStatus({ phase: 'error', progress: 0, message });
      Alert.alert('Couldn’t publish clip', message);
    }
  };

  const saveDraft = () => {
    const draft: ClipComposerDraftV2 = {
      version: 2,
      identityId,
      edit: serializeEdit(edit),
      cover: cover
        ? {
            id: cover.id,
            label: cover.label,
            filename: cover.filename,
            contentType: cover.contentType,
            width: cover.width,
            height: cover.height,
            localUri: cover.localUri,
            byteSize: cover.byteSize,
          }
        : null,
      coverMode,
      caption,
      hashtagsInput,
      taggedUserIdsInput,
      locationName,
      visibility,
    };
    storage.set(STORAGE_KEYS.CLIP_COMPOSER_DRAFT, JSON.stringify(draft));
    Alert.alert(
      'Draft saved',
      'Your Clip edit and details are saved on this device.',
    );
  };

  if (stage === 'capture') {
    return (
      <ClipCameraScreen
        mode={creationMode}
        onModeChange={setCreationMode}
        onClose={() => navigation.goBack()}
        onGallery={chooseFromGallery}
        segments={segments}
        onSegmentsChange={setSegments}
        onDone={takes => {
          // Keep gallery sources already in the edit after the new takes.
          const extras = (edit?.sources ?? []).filter(
            source => source.origin === 'gallery',
          );
          openEditor([...takes, ...extras]);
        }}
      />
    );
  }

  if (stage === 'editor' && edit) {
    return (
      <ReelEditor
        edit={edit}
        onEditChange={changeEdit}
        onBack={() => setStage('capture')}
        onAddClip={chooseFromGallery}
        onRemoveSource={removeSource}
        onExported={onExported}
      />
    );
  }

  const coverPreview = coverMode === 'custom' ? cover : generatedCover;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.spacing.lg,
            paddingTop: insets.top + theme.spacing.sm,
            paddingBottom: insets.bottom + 112,
            gap: theme.spacing.lg,
          },
        ]}
      >
        <View style={styles.composerTopBar}>
          <Button
            icon="close"
            variant="icon"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Close Clip creator"
          />
        </View>
        <View style={styles.heading}>
          <Text
            style={[
              theme.typography.title,
              { color: theme.colors.textPrimary },
            ]}
          >
            Create a Clip
          </Text>
          <Text
            style={[
              theme.typography.bodySmall,
              { color: theme.colors.textSecondary },
            ]}
          >
            Preview your video and choose exactly how it is shared.
          </Text>
        </View>

        <Card style={styles.profileCard}>
          <View style={styles.authorRow}>
            {identity?.avatarUrl ? (
              <Image
                source={{ uri: identity.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: theme.colors.primarySoft },
                ]}
              />
            )}
            <View style={styles.authorCopy}>
              <Text
                style={[
                  theme.typography.section,
                  { color: theme.colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {identity?.name ?? 'Loading profile…'}
              </Text>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {identity?.type === 'provider'
                  ? 'Posting as business profile'
                  : 'Posting as personal profile'}
              </Text>
            </View>
          </View>

          {identityPills.length > 1 ? (
            <View style={styles.sectionGap}>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Publish as
              </Text>
              <FilterPills
                activeId={identity?.id ?? ''}
                onChange={setIdentityId}
                pills={identityPills}
              />
            </View>
          ) : identitiesLoading ? (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textTertiary },
              ]}
            >
              Loading publishing profiles…
            </Text>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text
                style={[
                  theme.typography.section,
                  { color: theme.colors.textPrimary },
                ]}
              >
                Video
              </Text>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {video?.label ?? 'Edit your clip to preview it here.'}
              </Text>
            </View>
            {video ? (
              <PressableScale
                onPress={() => setStage('editor')}
                disabled={isPublishing}
                accessibilityLabel="Edit clip"
              >
                <Text
                  style={[
                    theme.typography.bodySmall,
                    { color: theme.colors.primary },
                  ]}
                >
                  Edit
                </Text>
              </PressableScale>
            ) : null}
          </View>

          {video ? (
            <View
              style={[styles.videoPreview, { borderRadius: theme.radius.lg }]}
            >
              <VideoPlayer uri={video.previewSource} muted={false} />
            </View>
          ) : (
            <View
              style={[
                styles.videoEmpty,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.bodySmall,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Your selected video will play here before you publish it.
              </Text>
            </View>
          )}

          <View style={styles.mediaActions}>
            <Button
              title="Edit clip"
              icon="video"
              variant="secondary"
              style={styles.actionButton}
              onPress={() => setStage(edit ? 'editor' : 'capture')}
              disabled={isPublishing}
            />
          </View>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textTertiary },
            ]}
          >
            Edited on this device: trimmed to 90 seconds max and exported as MP4
            {exportedEdit?.music ? ` with ♪ ${exportedEdit.music.title}` : ''}.
          </Text>
        </Card>

        <Card style={styles.section}>
          <Text
            style={[
              theme.typography.section,
              { color: theme.colors.textPrimary },
            ]}
          >
            Cover image
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textSecondary },
            ]}
          >
            Use the frame you picked in the editor or choose a custom image.
          </Text>
          <FilterPills
            activeId={coverMode}
            onChange={value => setCoverMode(value as CoverMode)}
            pills={[
              { id: 'generated', label: 'Use video frame' },
              { id: 'custom', label: 'Custom cover' },
            ]}
          />
          {coverMode === 'generated' && coverPreview ? (
            <View style={styles.coverRow}>
              <Image
                source={imageSource(coverPreview.previewSource)}
                style={[styles.coverPreview, { borderRadius: theme.radius.md }]}
              />
              <View style={styles.coverCopy}>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Frame from your edited clip. Change it in the editor’s Cover tool.
                </Text>
              </View>
            </View>
          ) : null}
          {coverMode === 'custom' ? (
            <View style={styles.coverRow}>
              {cover ? (
                <Image
                  source={imageSource(cover.previewSource)}
                  style={[
                    styles.coverPreview,
                    { borderRadius: theme.radius.md },
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.coverPreview,
                    styles.coverEmpty,
                    {
                      borderColor: theme.colors.border,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textTertiary },
                    ]}
                  >
                    Cover
                  </Text>
                </View>
              )}
              <View style={styles.coverCopy}>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {cover?.label ?? 'Add a thumbnail image for your clip.'}
                </Text>
                <Button
                  title="Choose cover"
                  icon="camera"
                  variant="secondary"
                  onPress={chooseCover}
                  disabled={isPublishing}
                />
              </View>
            </View>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <Text
            style={[
              theme.typography.section,
              { color: theme.colors.textPrimary },
            ]}
          >
            Post details
          </Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            maxLength={2200}
            editable={!isPublishing}
            multiline
            placeholder="Write a caption…"
            placeholderTextColor={theme.colors.textTertiary}
            style={[
              styles.textArea,
              {
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background,
                borderRadius: theme.radius.md,
              },
            ]}
          />
          <Text
            style={[
              theme.typography.caption,
              styles.captionCounter,
              { color: theme.colors.textTertiary },
            ]}
          >
            {caption.length}/2200
          </Text>
          <TextInput
            value={hashtagsInput}
            onChangeText={setHashtagsInput}
            editable={!isPublishing}
            placeholder="#fitness, #wellness"
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background,
                borderRadius: theme.radius.md,
              },
            ]}
          />
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textTertiary },
            ]}
          >
            Hashtags (letters, numbers, and underscores)
          </Text>
          <TextInput
            value={taggedUserIdsInput}
            onChangeText={setTaggedUserIdsInput}
            editable={!isPublishing}
            placeholder="User IDs, separated by commas"
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background,
                borderRadius: theme.radius.md,
              },
            ]}
          />
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textTertiary },
            ]}
          >
            Tagged people — profile search can be connected when a people-search
            API is available.
          </Text>
          <TextInput
            value={locationName}
            onChangeText={setLocationName}
            editable={!isPublishing}
            placeholder="Add a location"
            placeholderTextColor={theme.colors.textTertiary}
            maxLength={160}
            style={[
              styles.input,
              {
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background,
                borderRadius: theme.radius.md,
              },
            ]}
          />
        </Card>

        <Card style={styles.section}>
          <Text
            style={[
              theme.typography.section,
              { color: theme.colors.textPrimary },
            ]}
          >
            Who can see this?
          </Text>
          <FilterPills
            activeId={visibility}
            onChange={value => setVisibility(value as PostVisibility)}
            pills={VISIBILITY}
          />
        </Card>

        {uploadStatus.phase !== 'idle' ? (
          <Card
            style={{
              ...styles.uploadStatus,
              backgroundColor:
                uploadStatus.phase === 'error'
                  ? theme.colors.error + '12'
                  : theme.colors.primarySoft,
            }}
          >
            <Text
              style={[
                theme.typography.bodySmall,
                styles.uploadStatusLabel,
                {
                  color:
                    uploadStatus.phase === 'error'
                      ? theme.colors.error
                      : theme.colors.textPrimary,
                },
              ]}
            >
              {phaseTitle(uploadStatus)}
            </Text>
            {uploadStatus.phase !== 'error' ? (
              <View
                style={[
                  styles.progressTrack,
                  {
                    backgroundColor: theme.colors.backgroundElevated,
                    borderRadius: theme.radius.pill,
                  },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${uploadStatus.progress}%`,
                      backgroundColor: theme.colors.primary,
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                />
              </View>
            ) : null}
          </Card>
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
        <View style={styles.footerActions}>
          <Button
            title="Save draft"
            variant="secondary"
            style={styles.actionButton}
            onPress={saveDraft}
            disabled={isPublishing}
          />
          <Button
            title={
              uploadStatus.phase === 'complete' ? 'Published' : 'Publish clip'
            }
            icon="reels"
            style={styles.actionButton}
            onPress={publish}
            loading={isPublishing || publishContent.isPending}
            disabled={!video || !identity || uploadStatus.phase === 'complete'}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1 },
  composerTopBar: { alignItems: 'flex-end' },
  heading: { gap: 5 },
  profileCard: { gap: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorCopy: { flex: 1, gap: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  sectionGap: { gap: 7 },
  section: { gap: 10 },
  mediaActions: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionHeaderCopy: { flex: 1, gap: 2 },
  videoPreview: { height: 330, overflow: 'hidden', backgroundColor: '#000' },
  videoEmpty: {
    height: 160,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coverCopy: { flex: 1, gap: 8 },
  coverPreview: { width: 86, height: 86 },
  coverEmpty: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    minHeight: 130,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  captionCounter: { textAlign: 'right' },
  uploadStatus: { gap: 9 },
  uploadStatusLabel: { fontWeight: '700' },
  progressTrack: { height: 8, overflow: 'hidden' },
  progressFill: { height: '100%' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerActions: { flexDirection: 'row', gap: 10 },
});
