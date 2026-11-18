import { finishCreation } from '@/shared/publishing/creationNavigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import { useStoryStore } from '@/shared/data/flash/storyStore';
import type { StoryAudience } from '@/shared/data/flash/storyTypes';
import type { RootStackParamList } from '@/shared/navigation/types';
import {
  ensureContentDraft,
  usePublishContentMutation,
  uploadContentMedia,
} from '@/shared/api/publishingHooks';
import {
  ProfileSwitcherSheet,
  identityAvatarUrl,
} from '@/shared/publishing/ProfileSwitcherSheet';
import { ProfileAvatar } from '@/shared/publishing/ProfileAvatar';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { usePublisherSelection } from '@/shared/publishing/usePublisherSelection';
import { isApiEnabled } from '@/shared/api/config';
import {
  captureStoryMedia,
  pickStoryMedia,
  storyUploadFile,
  STORY_MAX_SELECTION,
  type StoryPickedMedia,
} from '../media/storyMediaPicker';
import {
  DEFAULT_STORY_STYLE,
  STORY_AUDIENCES,
  STORY_COLORS,
  STORY_STICKERS,
  movedStoryText,
  publishStorySequence,
  storyPublishFailure,
  type StoryStyle,
} from '../utils/storyComposerModel';

type Segment = {
  id: string;
  media?: StoryPickedMedia;
  text: string;
  location: string;
  style: StoryStyle;
};
type Filter = 'all' | 'photos' | 'videos';
type Tool = 'text' | 'stickers' | 'location' | 'style' | null;
const BLUE = '#063eea';

function IconAction({
  icon,
  label,
  onPress,
  dark = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  dark?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.iconAction,
        dark && styles.darkAction,
        disabled && styles.disabled,
      ]}
    >
      <AppIcon name={icon} size={23} color={dark ? '#fff' : '#111434'} />
    </Pressable>
  );
}

function DraggableCaption({
  segment,
  width,
  height,
  onMove,
}: {
  segment: Segment;
  width: number;
  height: number;
  onMove: (position: { textX: number; textY: number }) => void;
}) {
  const current = useRef({ segment, width, height, onMove });
  current.current = { segment, width, height, onMove };
  const start = useRef({ x: 0.5, y: 0.35 });
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = {
          x: current.current.segment.style.textX,
          y: current.current.segment.style.textY,
        };
      },
      onPanResponderMove: (_, gesture) => {
        const c = current.current;
        c.onMove(
          movedStoryText(
            start.current.x,
            start.current.y,
            gesture.dx,
            gesture.dy,
            c.width,
            c.height,
          ),
        );
      },
    }),
  ).current;
  if (!segment.text) return null;
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityLabel="Story text. Drag to move."
      style={[
        styles.captionOverlay,
        {
          top: segment.style.textY * height,
          left: segment.style.textX * width - width * 0.4,
          width: width * 0.8,
        },
      ]}
    >
      <Text
        style={[
          styles.canvasText,
          {
            color: segment.style.textColor,
            fontSize: 28 * segment.style.textScale,
            lineHeight: 36 * segment.style.textScale,
          },
        ]}
      >
        {segment.text}
      </Text>
    </View>
  );
}

export function StoryCreatorScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'StoryCreator'>>();
  const publisher = usePublisherSelection(
    'story',
    route.params?.publisherProfileId,
  );
  const { identity, identities } = publisher;
  const publishContent = usePublishContentMutation();
  const publishLocal = useStoryStore(s => s.publishStory);
  const [stage, setStage] = useState<'choose' | 'edit'>('choose');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [filter, setFilter] = useState<Filter>('all');
  const [tool, setTool] = useState<Tool>(null);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [audience, setAudience] = useState<StoryAudience>('public');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string>();
  const [canvas, setCanvas] = useState({ width: 360, height: 640 });
  const sharing = useRef(false);
  const uploadScope = useRef('');
  const uploaded = useRef(
    new Map<string, { draftId: string; mediaId?: string }>(),
  );
  const current = segments.find(s => s.id === activeId) ?? segments[0];
  const selectedAudience =
    STORY_AUDIENCES.find(a => a.id === audience) ?? STORY_AUDIENCES[0];
  const patch = (changes: Partial<Segment>) =>
    setSegments(items =>
      items.map(item =>
        item.id === current?.id ? { ...item, ...changes } : item,
      ),
    );
  const patchStyle = (changes: Partial<StoryStyle>) =>
    current && patch({ style: { ...current.style, ...changes } });
  const canShare =
    segments.length > 0 &&
    segments.every(s => s.media || s.text.trim()) &&
    !busy;
  const foreground = theme.colors.textPrimary;
  const background = theme.colors.background;

  const leaveCreator = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { screen: 'Flash' } }],
    });
  }, [navigation]);
  const close = useCallback(() => {
    if (busy) return;
    if (!segments.length) {
      leaveCreator();
      return;
    }
    Alert.alert(
      'Discard story?',
      'Your selected moments and edits will be lost.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: leaveCreator,
        },
      ],
    );
  }, [busy, leaveCreator, segments.length]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (navigation.isFocused?.() === false) return false;
        if (busy) return true;
        if (tool) setTool(null);
        else if (stage === 'edit') setStage('choose');
        else close();
        return true;
      },
    );
    return () => subscription.remove();
  }, [busy, close, navigation, stage, tool]);
  const appendMedia = (media: StoryPickedMedia[]) => {
    if (!media.length) return;
    const additions = media
      .filter(m => !segments.some(s => s.media?.id === m.id))
      .map(m => ({
        id: m.id,
        media: m,
        text: '',
        location: '',
        style: { ...DEFAULT_STORY_STYLE },
      }));
    const next = [...segments, ...additions].slice(0, STORY_MAX_SELECTION);
    setSegments(next);
    setActiveId(additions[0]?.id ?? next[0]?.id);
    setError(undefined);
  };
  const pick = async (nextFilter: Filter = filter) => {
    if (picking || busy) return;
    if (segments.length >= STORY_MAX_SELECTION) {
      Alert.alert(
        'Selection full',
        `You can share up to ${STORY_MAX_SELECTION} moments at once.`,
      );
      return;
    }
    setPicking(true);
    try {
      appendMedia(
        await pickStoryMedia(nextFilter, STORY_MAX_SELECTION - segments.length),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open your library.');
    } finally {
      setPicking(false);
    }
  };
  const capture = () =>
    Alert.alert('Capture a moment', 'Choose what to capture.', [
      {
        text: 'Photo',
        onPress: () => {
          void take('photo');
        },
      },
      {
        text: 'Record video',
        onPress: () => {
          void take('video');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  const take = async (type: 'photo' | 'video') => {
    if (picking || busy || segments.length >= STORY_MAX_SELECTION) return;
    setPicking(true);
    try {
      const media = await captureStoryMedia(type);
      if (media) {
        appendMedia([media]);
        setStage('edit');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the camera.');
    } finally {
      setPicking(false);
    }
  };
  const addText = () => {
    if (segments.length >= STORY_MAX_SELECTION) return;
    const id = `text-${Date.now()}`;
    setSegments(items => [
      ...items,
      { id, text: '', location: '', style: { ...DEFAULT_STORY_STYLE } },
    ]);
    setActiveId(id);
    setTool('text');
    setStage('edit');
    setError(undefined);
  };
  const removeCurrent = () => {
    if (!current || busy) return;
    const next = segments.filter(s => s.id !== current.id);
    setSegments(next);
    setActiveId(next[0]?.id);
    if (!next.length) {
      setStage('choose');
      setTool(null);
    }
  };

  const share = async () => {
    if (sharing.current || !canShare) return;
    if (
      isApiEnabled &&
      (!identity ||
        (route.params?.publisherProfileId &&
          identity.id !== route.params.publisherProfileId))
    ) {
      setError(
        'Your publishing profile is unavailable. Reopen the profile and try again.',
      );
      return;
    }
    sharing.current = true;
    const scope = `${identity?.type}/${identity?.id}/${selectedAudience.visibility}`;
    if (uploadScope.current !== scope) {
      uploaded.current.clear();
      uploadScope.current = scope;
    }
    setBusy(true);
    setTool(null);
    setError(undefined);
    const snapshot = [...segments];
    let count = 0;
    let reviewed = false;
    try {
      await publishStorySequence(
        snapshot,
        async segment => {
          setProgress(`Sharing ${count + 1} of ${snapshot.length}…`);
          if (!isApiEnabled) {
            publishLocal({
              type: segment.media?.type ?? 'text',
              mediaUrl: segment.media?.uri,
              textContent: segment.text.trim(),
              backgroundColor: segment.style.backgroundColor,
              storyStyle: segment.style,
              locationName: segment.location.trim() || undefined,
              durationMs: segment.media?.durationMs,
              audience,
            });
            return;
          }
          const input = {
            format: 'story' as const,
            mediaType: segment.media
              ? segment.media.type === 'photo'
                ? ('image' as const)
                : ('video' as const)
              : ('text' as const),
            caption: segment.text.trim(),
            visibility: selectedAudience.visibility,
            identity: identity!,
            storyStyle: segment.style,
            location: segment.location.trim()
              ? { name: segment.location.trim() }
              : null,
          };
          const uploadKey = `${identity!.type}/${identity!.id}/${segment.id}`;
          const cached = uploaded.current.get(uploadKey);
          let draftId = cached?.draftId;
          let mediaId = cached?.mediaId;
          if (!draftId) {
            draftId = await ensureContentDraft(input);
            uploaded.current.set(uploadKey, { draftId });
          }
          if (segment.media) {
            if (!mediaId) {
              const file = await storyUploadFile(segment.media);
              mediaId = await uploadContentMedia(
                identity!,
                file,
                selectedAudience.visibility,
                draftId,
              );
              uploaded.current.set(uploadKey, { draftId: draftId!, mediaId });
            }
          }
          const result = await publishContent.mutateAsync({
            ...input,
            ...(draftId ? { draftId } : {}),
            ...(mediaId ? { mediaIds: [mediaId] } : {}),
          });
          reviewed =
            reviewed || result?.post.contentStatus === 'pending_review';
        },
        segment => {
          count += 1;
          setSegments(items => items.filter(item => item.id !== segment.id));
        },
      );
      if (reviewed)
        Alert.alert(
          'Story submitted',
          'Some moments will appear once they have been reviewed.',
        );
      if (isApiEnabled) finishCreation(navigation, 'story');
      else navigation.replace('StoryViewer', { authorId: 'user-me' });
    } catch (e) {
      setError(storyPublishFailure(e, count));
    } finally {
      sharing.current = false;
      setBusy(false);
      setProgress('');
    }
  };

  const audienceSheet = (
    <Modal
      visible={audienceOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setAudienceOpen(false)}
    >
      <Pressable
        style={styles.scrim}
        accessibilityLabel="Close audience selection"
        onPress={() => setAudienceOpen(false)}
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: background, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <Text style={[styles.sheetTitle, { color: foreground }]}>
          Who can see this story?
        </Text>
        {STORY_AUDIENCES.map(item => (
          <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: audience === item.id }}
            onPress={() => {
              setAudience(item.id);
              setAudienceOpen(false);
            }}
            style={styles.audienceRow}
          >
            <AppIcon
              name={item.id === 'public' ? 'globe' : 'users'}
              size={22}
              color={BLUE}
            />
            <Text style={[styles.audienceLabel, { color: foreground }]}>
              {item.label}
            </Text>
            {audience === item.id ? (
              <AppIcon name="check" size={22} color={BLUE} />
            ) : null}
          </Pressable>
        ))}
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        { backgroundColor: stage === 'edit' ? '#11121a' : background },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar
        barStyle={
          stage === 'edit'
            ? 'light-content'
            : theme.mode === 'dark'
            ? 'light-content'
            : 'dark-content'
        }
      />
      {stage === 'choose' ? (
        <>
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <IconAction
              icon="close"
              label="Close story creator"
              onPress={close}
            />
            <Text style={[styles.heading, { color: foreground }]}>
              Create story
            </Text>
            <View style={styles.iconAction} />
          </View>
          <ScrollView contentContainerStyle={styles.chooseContent}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change publishing profile"
              onPress={() => setProfilesOpen(true)}
              disabled={!isApiEnabled || picking}
              style={styles.profileRow}
            >
              <ProfileAvatar
                name={identity?.name ?? 'You'}
                uri={identity ? identityAvatarUrl(identity) : null}
                size={46}
              />
              <View style={styles.profileCopy}>
                <Text style={[styles.profileName, { color: foreground }]}>
                  {identity?.name ??
                    (publisher.isLoading ? 'Loading profile…' : 'Your story')}
                </Text>
                <Text style={styles.muted}>
                  {identity && identityProfileType(identity) === 'business'
                    ? 'Business'
                    : 'Personal'}
                </Text>
              </View>
              <AppIcon name="chevron-down" size={20} color={foreground} />
            </Pressable>
            <View style={styles.modeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Capture story photo or video"
                onPress={capture}
                disabled={picking}
                style={[styles.modeTile, styles.cameraTile]}
              >
                <AppIcon name="camera" size={35} color="#fff" />
                <Text style={styles.tileLabel}>Camera</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create text story"
                onPress={addText}
                style={[styles.modeTile, styles.textTile]}
              >
                <Text style={styles.aa}>Aa</Text>
                <Text style={styles.tileLabel}>Text</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose story videos"
                onPress={() => {
                  setFilter('videos');
                  void pick('videos');
                }}
                disabled={picking}
                style={[styles.modeTile, styles.videoTile]}
              >
                <AppIcon name="play" size={35} color="#fff" />
                <Text style={styles.tileLabel}>Video</Text>
              </Pressable>
            </View>
            <View style={styles.recentsHeading}>
              <Pressable
                style={styles.inline}
                onPress={() => {
                  void pick();
                }}
                accessibilityRole="button"
                accessibilityLabel="Open recent photos and videos"
              >
                <Text style={[styles.sectionTitle, { color: foreground }]}>
                  Recents
                </Text>
                <AppIcon name="chevron-down" size={18} color={foreground} />
              </Pressable>
              <IconAction
                icon="plus"
                label="Add moments from gallery"
                onPress={() => {
                  void pick();
                }}
                disabled={picking}
              />
            </View>
            <View style={styles.filterRow}>
              {(['all', 'photos', 'videos'] as const).map(f => (
                <Pressable
                  key={f}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: f === filter }}
                  onPress={() => setFilter(f)}
                  style={[
                    styles.filter,
                    { backgroundColor: theme.colors.surfaceSecondary },
                    filter === f && styles.selectedFilter,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: filter === f ? '#fff' : foreground },
                    ]}
                  >
                    {f === 'all' ? 'All' : f === 'photos' ? 'Photos' : 'Videos'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {picking ? (
              <ActivityIndicator color={BLUE} style={styles.pickerSpinner} />
            ) : null}
            <View style={styles.grid}>
              {segments
                .filter(
                  s =>
                    filter === 'all' ||
                    (filter === 'photos'
                      ? s.media?.type === 'photo'
                      : s.media?.type === 'video'),
                )
                .map((segment, index) => (
                  <Pressable
                    key={segment.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit moment ${index + 1}`}
                    onPress={() => {
                      setActiveId(segment.id);
                      setStage('edit');
                    }}
                    style={[
                      styles.gridItem,
                      { backgroundColor: segment.style.backgroundColor },
                      segment.id === activeId && styles.selectedItem,
                    ]}
                  >
                    {segment.media?.type === 'photo' ||
                    segment.media?.thumbnailUri ? (
                      <Image
                        source={{
                          uri: segment.media.thumbnailUri ?? segment.media.uri,
                        }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.gridCenter}>
                        {segment.media ? (
                          <AppIcon name="play" size={35} color="#fff" />
                        ) : (
                          <Text numberOfLines={4} style={styles.textThumbnail}>
                            {segment.text || 'Aa'}
                          </Text>
                        )}
                      </View>
                    )}
                    <View style={styles.selectionBadge}>
                      <Text style={styles.selectionNumber}>{index + 1}</Text>
                    </View>
                    {segment.media?.type === 'video' ? (
                      <Text style={styles.duration}>
                        ▶ {Math.ceil((segment.media.durationMs ?? 0) / 1000)}s
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
            </View>
            {!segments.length ? (
              <Pressable
                onPress={() => {
                  void pick();
                }}
                style={[
                  styles.emptyGallery,
                  { borderColor: theme.colors.borderSoft },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Browse device gallery"
              >
                <AppIcon name="image" color={BLUE} size={40} />
                <Text style={[styles.emptyTitle, { color: foreground }]}>
                  Choose a moment
                </Text>
                <Text style={styles.emptyCopy}>
                  Browse your recent photos and videos.{'\n'}Select up to 10
                  moments to tell your story.
                </Text>
                <Text style={styles.browse}>Open gallery →</Text>
              </Pressable>
            ) : null}
            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <View
            style={[
              styles.selectionFooter,
              {
                paddingBottom: Math.max(insets.bottom, 16),
                backgroundColor: background,
                borderColor: theme.colors.borderSoft,
              },
            ]}
          >
            <Text style={[styles.selectionCopy, { color: foreground }]}>
              {segments.length
                ? `${segments.length} selected`
                : 'Select photos or videos'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next: edit story"
              disabled={!segments.length || picking}
              onPress={() => {
                setStage('edit');
                setError(undefined);
              }}
              style={[
                styles.nextButton,
                (!segments.length || picking) && styles.disabled,
              ]}
            >
              <Text style={styles.buttonLabel}>Next</Text>
              <AppIcon name="arrow-right" size={19} color="#fff" />
            </Pressable>
          </View>
        </>
      ) : current ? (
        <>
          <View
            style={styles.canvas}
            onLayout={e => setCanvas(e.nativeEvent.layout)}
          >
            {current.media?.type === 'photo' ? (
              <Image
                source={{ uri: current.media.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : current.media?.type === 'video' ? (
              <VideoPlayer
                key={current.id}
                uri={current.media.uri}
                muted
                paused={busy || tool !== null}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: current.style.backgroundColor },
                ]}
              />
            )}
            <View pointerEvents="none" style={styles.topShade} />
            <DraggableCaption
              segment={current}
              width={canvas.width}
              height={canvas.height}
              onMove={position => patchStyle(position)}
            />
            {current.style.sticker ? (
              <Text pointerEvents="none" style={styles.sticker}>
                {current.style.sticker}
              </Text>
            ) : null}
            {current.location ? (
              <View pointerEvents="none" style={styles.locationPill}>
                <AppIcon name="map-pin" size={15} color="#fff" />
                <Text style={styles.locationLabel}>{current.location}</Text>
              </View>
            ) : null}
            <View style={[styles.editorHeader, { top: insets.top }]}>
              <IconAction
                icon="back"
                label="Back to story selection"
                dark
                disabled={busy}
                onPress={() => {
                  setStage('choose');
                  setTool(null);
                }}
              />
              <Text style={styles.editorTitle}>Edit story</Text>
              <IconAction
                icon="trash"
                label="Remove this moment"
                dark
                disabled={busy}
                onPress={removeCurrent}
              />
            </View>
            <View style={[styles.tools, { top: insets.top + 72 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit story text"
                onPress={() => setTool(tool === 'text' ? null : 'text')}
                disabled={busy}
                style={styles.darkAction}
              >
                <Text style={styles.textTool}>Aa</Text>
              </Pressable>
              <IconAction
                icon="heart"
                label="Add sticker"
                dark
                disabled={busy}
                onPress={() => setTool(tool === 'stickers' ? null : 'stickers')}
              />
              <IconAction
                icon="map-pin"
                label="Add location label"
                dark
                disabled={busy}
                onPress={() => setTool(tool === 'location' ? null : 'location')}
              />
              <IconAction
                icon="sparkles"
                label="Change story style"
                dark
                disabled={busy}
                onPress={() => setTool(tool === 'style' ? null : 'style')}
              />
            </View>
            <View style={styles.editorBottom}>
              {tool ? (
                <View style={styles.toolPanel}>
                  <View style={styles.toolHeading}>
                    <Text style={styles.toolTitle}>
                      {tool === 'text'
                        ? 'Add your words'
                        : tool === 'stickers'
                        ? 'Choose a sticker'
                        : tool === 'location'
                        ? 'Location label'
                        : 'Make it yours'}
                    </Text>
                    <IconAction
                      icon="check"
                      label="Done editing"
                      dark
                      onPress={() => setTool(null)}
                    />
                  </View>
                  {tool === 'text' ? (
                    <>
                      <TextInput
                        accessibilityLabel="Story text"
                        value={current.text}
                        onChangeText={text => patch({ text })}
                        placeholder="Little moments, big memories…"
                        placeholderTextColor="#b2b4c3"
                        multiline
                        maxLength={500}
                        autoFocus
                        style={styles.textInput}
                      />
                      <Text style={styles.panelHint}>
                        Drag the text on your story to move it.
                      </Text>
                    </>
                  ) : null}
                  {tool === 'location' ? (
                    <TextInput
                      accessibilityLabel="Story location"
                      value={current.location}
                      onChangeText={location => patch({ location })}
                      maxLength={80}
                      placeholder="Add a place, e.g. Pondicherry"
                      placeholderTextColor="#b2b4c3"
                      style={styles.textInput}
                      autoFocus
                    />
                  ) : null}
                  {tool === 'stickers' ? (
                    <View style={styles.stickerChoices}>
                      {STORY_STICKERS.map(sticker => (
                        <Pressable
                          key={sticker}
                          accessibilityLabel={`Use sticker ${sticker}`}
                          onPress={() => {
                            patchStyle({ sticker });
                            setTool(null);
                          }}
                          style={styles.stickerChoice}
                        >
                          <Text style={styles.stickerChoiceText}>
                            {sticker}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable
                        onPress={() => {
                          patchStyle({ sticker: undefined });
                          setTool(null);
                        }}
                        accessibilityLabel="Remove sticker"
                      >
                        <Text style={styles.panelHint}>Remove</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {tool === 'style' ? (
                    <>
                      <Text style={styles.panelHint}>
                        {current.media ? 'Text color' : 'Background color'}
                      </Text>
                      <View style={styles.colorRow}>
                        {[...STORY_COLORS, '#ffffff'].map(color => (
                          <Pressable
                            key={color}
                            accessibilityRole="button"
                            accessibilityLabel={`Use color ${color}`}
                            onPress={() =>
                              patchStyle(
                                current.media
                                  ? { textColor: color }
                                  : { backgroundColor: color },
                              )
                            }
                            style={[styles.color, { backgroundColor: color }]}
                          />
                        ))}
                      </View>
                      <View style={styles.sizeRow}>
                        <Pressable
                          accessibilityLabel="Smaller story text"
                          onPress={() =>
                            patchStyle({
                              textScale: Math.max(
                                0.5,
                                current.style.textScale - 0.1,
                              ),
                            })
                          }
                        >
                          <Text style={styles.sizeControl}>A−</Text>
                        </Pressable>
                        <Text style={styles.panelHint}>Text size</Text>
                        <Pressable
                          accessibilityLabel="Larger story text"
                          onPress={() =>
                            patchStyle({
                              textScale: Math.min(
                                2,
                                current.style.textScale + 0.1,
                              ),
                            })
                          }
                        >
                          <Text style={styles.sizeControl}>A+</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}
              {segments.length > 1 && !tool ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.segmentStrip}
                >
                  {segments.map((s, i) => (
                    <Pressable
                      key={s.id}
                      accessibilityLabel={`Edit moment ${i + 1}`}
                      disabled={busy}
                      onPress={() => setActiveId(s.id)}
                      style={[
                        styles.segmentButton,
                        s.id === current.id && styles.segmentActive,
                      ]}
                    >
                      <Text style={styles.segmentNumber}>{i + 1}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {error ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.editorError}
                >
                  {error}
                </Text>
              ) : null}
              <View style={styles.shareRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Story audience"
                  disabled={busy}
                  onPress={() => setAudienceOpen(true)}
                  style={styles.audienceButton}
                >
                  <AppIcon
                    name={audience === 'public' ? 'globe' : 'users'}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.audienceButtonLabel}>
                    {selectedAudience.label}
                  </Text>
                  <AppIcon name="chevron-down" size={17} color="#fff" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Share story"
                  disabled={!canShare}
                  onPress={() => {
                    void share();
                  }}
                  style={[styles.shareButton, !canShare && styles.disabled]}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.buttonLabel}>Share story</Text>
                      <AppIcon name="arrow-right" size={20} color="#fff" />
                    </>
                  )}
                </Pressable>
              </View>
              <Text accessibilityLiveRegion="polite" style={styles.visibility}>
                {progress || 'Visible for 24h'}
              </Text>
            </View>
          </View>
          <View style={{ height: insets.bottom, backgroundColor: '#11121a' }} />
        </>
      ) : (
        <View style={styles.gridCenter}>
          <Text style={styles.muted}>Your moments have been shared.</Text>
        </View>
      )}
      {audienceSheet}
      <ProfileSwitcherSheet
        visible={profilesOpen}
        onClose={() => setProfilesOpen(false)}
        title="Post story as"
        identities={identities}
        activeId={identity?.id ?? null}
        onSelect={item => {
          publisher.select(item.id);
          setProfilesOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  iconAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  chooseContent: { paddingHorizontal: 14, paddingBottom: 24, gap: 12 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  profileCopy: { flex: 1, gap: 3 },
  profileName: { fontSize: 16, fontWeight: '700' },
  muted: { color: '#818194', fontSize: 13 },
  modeRow: { flexDirection: 'row', gap: 7 },
  modeTile: {
    flex: 1,
    height: 118,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraTile: { backgroundColor: '#171a29' },
  textTile: { backgroundColor: '#7334de' },
  videoTile: { backgroundColor: '#127d8c' },
  aa: { fontSize: 36, color: '#fff', fontWeight: '600' },
  tileLabel: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  recentsHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inline: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: 9 },
  filter: { paddingHorizontal: 21, paddingVertical: 9, borderRadius: 22 },
  selectedFilter: { backgroundColor: BLUE },
  filterText: { fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  gridItem: {
    width: '32.3%',
    aspectRatio: 0.86,
    borderRadius: 10,
    overflow: 'hidden',
  },
  selectedItem: { borderWidth: 3, borderColor: BLUE },
  gridCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  textThumbnail: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '700',
  },
  selectionBadge: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: BLUE,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionNumber: { color: '#fff', fontSize: 12, fontWeight: '700' },
  duration: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#0008',
    color: '#fff',
    padding: 4,
    borderRadius: 6,
    fontSize: 11,
  },
  emptyGallery: {
    minHeight: 260,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    marginVertical: 10,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyCopy: {
    textAlign: 'center',
    fontSize: 14,
    color: '#818194',
    lineHeight: 22,
  },
  browse: { color: BLUE, fontWeight: '700', marginTop: 5 },
  pickerSpinner: { margin: 16 },
  selectionFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 12,
  },
  selectionCopy: { flex: 1, fontSize: 14, fontWeight: '600' },
  nextButton: {
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 20,
    backgroundColor: BLUE,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  buttonLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  error: { color: '#ce3549', padding: 12, lineHeight: 20 },
  canvas: { flex: 1, overflow: 'hidden', backgroundColor: '#171923' },
  topShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: '#0002',
  },
  editorHeader: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  darkAction: {
    width: 44,
    height: 44,
    borderRadius: 24,
    backgroundColor: '#17192399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tools: { position: 'absolute', right: 13, gap: 10 },
  textTool: { fontSize: 23, color: '#fff', fontWeight: '600' },
  captionOverlay: { position: 'absolute', padding: 8 },
  canvasText: {
    textAlign: 'center',
    fontWeight: '700',
    textShadowColor: '#0008',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sticker: {
    position: 'absolute',
    top: '68%',
    alignSelf: 'center',
    fontSize: 48,
  },
  locationPill: {
    position: 'absolute',
    bottom: '20%',
    alignSelf: 'center',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#17192380',
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  locationLabel: { color: '#fff', fontSize: 13 },
  editorBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 12,
    backgroundColor: '#11121aa0',
  },
  shareRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  audienceButton: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 44,
    borderRadius: 23,
    backgroundColor: '#ffffff15',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ffffff55',
    maxWidth: '48%',
  },
  audienceButtonLabel: { color: '#fff', fontSize: 12, flexShrink: 1 },
  shareButton: {
    flex: 1,
    borderRadius: 25,
    height: 48,
    backgroundColor: BLUE,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  visibility: {
    textAlign: 'center',
    color: '#dedee5',
    marginTop: 12,
    fontSize: 12,
  },
  editorError: { color: '#ffb2bb', marginBottom: 12, lineHeight: 19 },
  toolPanel: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#252633',
    marginBottom: 14,
    gap: 12,
  },
  toolHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  textInput: {
    color: '#fff',
    minHeight: 50,
    maxHeight: 110,
    fontSize: 18,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ffffff30',
    borderRadius: 12,
  },
  panelHint: { color: '#d4d5df', fontSize: 12 },
  stickerChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 13,
    alignItems: 'center',
  },
  stickerChoice: { padding: 5 },
  stickerChoiceText: { fontSize: 28 },
  colorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  color: {
    width: 28,
    height: 28,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ffffff66',
  },
  sizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  sizeControl: { padding: 9, color: '#fff', fontSize: 22, fontWeight: '600' },
  segmentStrip: { gap: 8, paddingBottom: 12 },
  segmentButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#ffffff20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { borderWidth: 2, borderColor: '#fff', backgroundColor: BLUE },
  segmentNumber: { color: '#fff', fontWeight: '700' },
  scrim: { flex: 1, backgroundColor: '#0007' },
  sheet: { padding: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 18 },
  audienceRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  audienceLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
});
