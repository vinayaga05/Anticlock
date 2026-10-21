import React, { useEffect, useRef, useState } from 'react';
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
import { AppIcon } from '@/shared/components/AppIcon';
import {
  discardContentDraft,
  ensureContentDraft,
  uploadContentMedia,
  UploadCancelledError,
  usePublishContentMutation,
} from '@/shared/api/publishingHooks';
import { PostingAsCard } from '@/shared/publishing/PostingAsCard';
import { usePublisherSelection } from '@/shared/publishing/usePublisherSelection';
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
  canCancelUpload,
  normalizeHashtags,
  normalizeTaggedUserIds,
  uploadProgressPercent,
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
    case 'video':
    case 'cover':
      return `Uploading… ${status.progress}%`;
    case 'publishing':
      return 'Posting…';
    case 'complete':
      return 'Posted';
    default:
      return '';
  }
}

export function ClipComposerScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const publishContent = usePublishContentMutation();
  // Persisted per format; a restored draft re-asserts its own profile and
  // nothing resets it to the personal profile afterwards.
  const publisher = usePublisherSelection('clip');
  const {
    identities,
    identity,
    selectedId: identityId,
    restore: restoreIdentity,
  } = publisher;
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
  /** In-flight upload: lets the creator cancel and discards its draft. */
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadDraftIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    restoreIdentity(draft.identityId);
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
    // Restore once on mount; `restoreIdentity` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPublishing =
    uploadStatus.phase !== 'idle' &&
    uploadStatus.phase !== 'complete' &&
    uploadStatus.phase !== 'error';

  const cancelUpload = () => {
    const controller = uploadAbortRef.current;
    if (!controller || controller.signal.aborted) return;
    controller.abort();
    const draftId = uploadDraftIdRef.current;
    uploadDraftIdRef.current = null;
    if (draftId) void discardContentDraft('clip', draftId);
    if (mountedRef.current) setUploadStatus({ phase: 'idle', progress: 0 });
  };

  // Leaving mid-upload would orphan the upload (and its draft) and could let
  // a second upload reuse the same draft. Ask first; cancelling discards it.
  const uploadPhaseRef = useRef(uploadStatus.phase);
  uploadPhaseRef.current = uploadStatus.phase;
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      const phase = uploadPhaseRef.current;
      if (
        phase === 'idle' ||
        phase === 'complete' ||
        phase === 'error'
      ) {
        return;
      }
      event.preventDefault();
      if (!canCancelUpload(phase)) return; // publishing: finishes in a moment
      Alert.alert('Discard this clip?', 'Your upload will stop.', [
        { text: 'Keep uploading', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            cancelUpload();
            navigation.dispatch(event.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
    // `cancelUpload` only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

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

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const { signal } = controller;
    const ifActive = (update: () => void) => {
      if (!signal.aborted && mountedRef.current) update();
    };
    try {
      setUploadStatus({ phase: 'preparing', progress: uploadProgressPercent('preparing') });
      // Bring the progress (and Cancel) into view.
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      // Draft first: owner + publisher are fixed before any upload, and a
      // retry continues the same draft for the same profile. `identity` is
      // captured here, so switching profile later cannot change this post.
      const draftId = await ensureContentDraft({
        format: 'clip',
        mediaType: 'video',
        caption: caption.trim(),
        visibility,
        identity,
      });
      uploadDraftIdRef.current = draftId;
      if (signal.aborted) throw new UploadCancelledError();
      const uploadFile = await createVideoUploadFile(video);
      ifActive(() =>
        setUploadStatus({ phase: 'video', progress: uploadProgressPercent('video') }),
      );
      const mediaId = await uploadContentMedia(
        identity,
        uploadFile,
        visibility,
        draftId,
        {
          signal,
          onProgress: fraction =>
            ifActive(() =>
              setUploadStatus({
                phase: 'video',
                progress: uploadProgressPercent('video', fraction),
              }),
            ),
        },
      );

      let thumbnailMediaId: string | null = null;
      const coverToUpload =
        coverMode === 'custom' ? cover : generatedCover;
      if (coverToUpload) {
        const coverFile = await createCoverUploadFile(coverToUpload);
        ifActive(() =>
          setUploadStatus({ phase: 'cover', progress: uploadProgressPercent('cover') }),
        );
        thumbnailMediaId = await uploadContentMedia(
          identity,
          coverFile,
          visibility,
          draftId,
          { signal },
        );
      }

      if (signal.aborted) throw new UploadCancelledError();
      setUploadStatus({ phase: 'publishing', progress: uploadProgressPercent('publishing') });
      const result = await publishContent.mutateAsync({
        draftId,
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
      uploadAbortRef.current = null;
      uploadDraftIdRef.current = null;
      storage.remove(STORAGE_KEYS.CLIP_COMPOSER_DRAFT);
      if (!mountedRef.current) return;
      setUploadStatus({ phase: 'complete', progress: 100 });
      const pendingReview = result?.post.contentStatus === 'pending_review';
      Alert.alert(
        pendingReview ? 'Clip submitted' : 'Clip published',
        pendingReview
          ? `Your clip from ${identity.name} will appear once it is reviewed.`
          : `Your clip is live on ${identity.name}.`,
        [
          {
            text: 'Done',
            onPress: () => {
              // Only close this composer, never a screen opened since.
              if (mountedRef.current && navigation.isFocused()) {
                navigation.goBack();
              }
            },
          },
        ],
      );
    } catch (error) {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      if (error instanceof UploadCancelledError || signal.aborted) return;
      if (!mountedRef.current) return;
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
        ref={scrollRef}
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
        </View>

        <PostingAsCard
          identities={identities}
          identity={identity}
          onSelect={publisher.select}
          isLoading={publisher.isLoading}
          fallbackApplied={publisher.fallbackApplied}
          disabled={isPublishing}
        />

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
                {video?.label ?? ''}
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
            />
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
          {exportedEdit?.music ? (
            <View style={styles.musicRow}>
              <AppIcon name="music" size={14} color={theme.colors.textTertiary} />
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textTertiary },
                ]}
                numberOfLines={1}
              >
                {exportedEdit.music.title}
              </Text>
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
            Cover image
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
              <View style={styles.coverCopy} />
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
            {canCancelUpload(uploadStatus.phase) ? (
              <PressableScale
                onPress={cancelUpload}
                accessibilityLabel="Cancel upload"
                style={styles.cancelUpload}
              >
                <AppIcon name="close" size={16} color={theme.colors.textSecondary} />
                <Text
                  style={[
                    theme.typography.bodySmall,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </PressableScale>
            ) : null}
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
  cancelUpload: {
    position: 'absolute',
    right: 14,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressTrack: { height: 8, overflow: 'hidden' },
  progressFill: { height: '100%' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerActions: { flexDirection: 'row', gap: 10 },
});
