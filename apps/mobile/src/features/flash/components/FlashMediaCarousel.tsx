import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
  type ViewToken,
  useWindowDimensions,
} from 'react-native';
import { AppIcon } from '@/shared/components/AppIcon';
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import { feedMediaMemory } from '@/features/video/playback/feedMediaMemory';
import type { PostMedia } from '@/shared/data/flash/types';
import { useTheme } from '@/shared/hooks/useTheme';

const ASPECT_RATIO = 4 / 5;
type Props = {
  postId: string;
  media: PostMedia[];
  playbackActive?: boolean;
  preparationEnabled?: boolean;
};

function ActiveMedia({
  item,
  memoryKey,
  postKey,
  active,
}: {
  item: PostMedia;
  memoryKey: string;
  postKey: string;
  active: boolean;
}) {
  const [intent, setIntent] = useState(() => ({
    ...feedMediaMemory.get(memoryKey),
    muted: feedMediaMemory.get(postKey).muted,
  }));
  // VideoPlayer restores only once per source load, including URL refreshes.
  const initialPosition = feedMediaMemory.get(memoryKey).position;
  return (
    <VideoPlayer
      key={item.url}
      uri={item.url}
      preloading={!active}
      poster={item.posterUrl}
      mediaKind={item.type === 'audio' ? 'audio' : 'video'}
      muted={intent.muted}
      muteControlStyle={styles.muteControl}
      paused={intent.paused}
      initialPositionSeconds={initialPosition}
      onMutedChange={muted => {
        feedMediaMemory.update(memoryKey, { muted });
        feedMediaMemory.update(postKey, { muted });
        setIntent(previous => ({ ...previous, muted }));
      }}
      onPausedChange={paused => {
        feedMediaMemory.update(memoryKey, { paused });
        setIntent(previous => ({ ...previous, paused }));
      }}
      onPlaybackProgress={position =>
        feedMediaMemory.update(memoryKey, { position })
      }
      onPlaybackComplete={() =>
        feedMediaMemory.update(memoryKey, { position: 0 })
      }
    />
  );
}

function MediaSlide({
  item,
  postId,
  width,
  active,
  prepare = false,
}: {
  item: PostMedia;
  postId: string;
  width: number;
  active: boolean;
  prepare?: boolean;
}) {
  const theme = useTheme();
  const playable = item.type === 'video' || item.type === 'audio';
  return (
    <View
      style={[
        styles.slide,
        {
          width,
          aspectRatio: ASPECT_RATIO,
          backgroundColor: theme.colors.surfaceMuted,
        },
      ]}
    >
      {playable && (active || prepare) ? (
        <ActiveMedia
          key={`${postId}:${item.id}`}
          item={item}
          active={active}
          memoryKey={`flash:${postId}:${item.id}`}
          postKey={`flash:${postId}:sound`}
        />
      ) : item.type === 'image' || item.posterUrl ? (
        <Image
          source={
            item.type === 'image'
              ? typeof item.url === 'number'
                ? item.url
                : { uri: item.url }
              : { uri: item.posterUrl }
          }
          style={styles.mediaImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholder}>
          <AppIcon
            name={item.type === 'audio' ? 'music' : 'play'}
            size={32}
            color={theme.colors.textSecondary}
          />
          <Text style={{ color: theme.colors.textSecondary }}>
            {item.type === 'audio' ? 'Audio post' : 'Video'}
          </Text>
        </View>
      )}
      {playable && !active && !prepare ? (
        <View style={styles.playBadge} pointerEvents="none">
          <AppIcon name="play" size={20} color="#fff" fill="#fff" />
        </View>
      ) : null}
    </View>
  );
}

export function FlashMediaCarousel({
  postId,
  media,
  playbackActive = false,
  preparationEnabled = false,
}: Props) {
  const { width } = useWindowDimensions();
  const [activeId, setActiveId] = useState<string | null>(media[0]?.id ?? null);
  const [moving, setMoving] = useState(false);
  useLayoutEffect(() => {
    // A tab/overlay/background transition can interrupt a gesture before its
    // end event arrives. Do not retain that transient lock on return.
    if (!playbackActive) setMoving(false);
  }, [playbackActive]);
  const mediaIds = JSON.stringify(media.map(item => item.id));
  const previousMediaIds = useRef(mediaIds);
  const ownershipChanged = previousMediaIds.current !== mediaIds;
  useLayoutEffect(() => {
    if (previousMediaIds.current === mediaIds) return;
    previousMediaIds.current = mediaIds;
    // A retained id can move to a hidden page after a refresh. Wait for a
    // current viewability callback before giving any new page playback.
    if (media.length > 1) setActiveId(null);
  }, [media.length, mediaIds]);
  const latestMedia = useRef(media);
  latestMedia.current = media;
  const viewability = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<PostMedia>[] }) => {
      const visible = viewableItems.find(
        v =>
          v.isViewable &&
          v.index != null &&
          latestMedia.current[v.index]?.id === v.item.id,
      );
      setActiveId(visible?.item.id ?? null);
    },
    [],
  );
  if (!media.length) return null;
  const currentId =
    !ownershipChanged && media.some(m => m.id === activeId) ? activeId : null;
  if (media.length === 1)
    return (
      <MediaSlide
        item={media[0]}
        postId={postId}
        width={width}
        prepare={preparationEnabled}
        active={playbackActive}
      />
    );
  return (
    <View style={[styles.wrap, { height: width / ASPECT_RATIO }]}>
      <FlatList
        data={media}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        style={styles.list}
        keyExtractor={item => item.id}
        extraData={[playbackActive, preparationEnabled, currentId, moving]}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewability}
        onScrollBeginDrag={() => setMoving(true)}
        onMomentumScrollBegin={() => setMoving(true)}
        onScrollEndDrag={event => {
          if (!event.nativeEvent.velocity?.x) setMoving(false);
        }}
        onMomentumScrollEnd={() => setMoving(false)}
        initialNumToRender={1}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item }) => (
          <MediaSlide
            item={item}
            postId={postId}
            width={width}
            prepare={preparationEnabled && !moving && item.id === currentId}
            active={playbackActive && !moving && item.id === currentId}
          />
        )}
      />
      <View style={styles.pageControl} pointerEvents="none">
        {media.map(item => (
          <View
            key={item.id}
            style={[
              styles.dot,
              item.id === currentId ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  muteControl: { right: 12, bottom: 16 },
  wrap: { width: '100%' },
  list: { flexGrow: 0 },
  slide: { overflow: 'hidden' },
  mediaImage: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  playBadge: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,.15)',
  },
  pageControl: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
  },
  dot: { borderRadius: 9, backgroundColor: '#fff' },
  dotInactive: { width: 6, height: 6, opacity: 0.45 },
  dotActive: { width: 7, height: 7 },
});
