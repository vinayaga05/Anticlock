import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  View,
  ViewToken,
  useWindowDimensions,
} from 'react-native';
import { AppIcon } from '@/shared/components/AppIcon';
import { PostMedia } from '@/shared/data/flash/types';
import { useTheme } from '@/shared/hooks/useTheme';

const ASPECT_RATIO = 4 / 5;

type Props = {
  media: PostMedia[];
};

function MediaSlide({
  item,
  width,
  ready,
  onLoad,
}: {
  item: PostMedia;
  width: number;
  ready: boolean;
  onLoad: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.slide,
        { width, aspectRatio: ASPECT_RATIO, backgroundColor: theme.colors.surfaceMuted },
      ]}>
      <Image
        source={{
          uri:
            item.type === 'video'
              ? item.posterUrl ??
                (typeof item.url === 'string'
                  ? item.url
                  : Image.resolveAssetSource(item.url)?.uri)
              : typeof item.url === 'string'
                ? item.url
                : Image.resolveAssetSource(item.url)?.uri,
        }}
        style={[styles.mediaImage, { opacity: ready ? 1 : 0 }]}
        onLoad={onLoad}
      />
      {item.type === 'video' ? (
        <View style={styles.playBadge}>
          <AppIcon name="play" size={20} color="#fff" strokeWidth={2} fill="#fff" />
        </View>
      ) : null}
    </View>
  );
}

export function FlashMediaCarousel({ media }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const slideHeight = screenWidth / ASPECT_RATIO;
  const [activeIndex, setActiveIndex] = useState(0);
  const [mediaReady, setMediaReady] = useState<Record<string, boolean>>({});

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const index = viewableItems[0]?.index;
      if (index != null) setActiveIndex(index);
    },
    [],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;

  if (media.length === 0) return null;

  if (media.length === 1) {
    const item = media[0];
    return (
      <MediaSlide
        item={item}
        width={screenWidth}
        ready={!!mediaReady[item.id]}
        onLoad={() => setMediaReady(prev => ({ ...prev, [item.id]: true }))}
      />
    );
  }

  return (
    <View style={[styles.wrap, { height: slideHeight }]}>
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
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        renderItem={({ item }) => (
          <MediaSlide
            item={item}
            width={screenWidth}
            ready={!!mediaReady[item.id]}
            onLoad={() => setMediaReady(prev => ({ ...prev, [item.id]: true }))}
          />
        )}
      />

      <View style={styles.pageControl} pointerEvents="none">
        {media.map((item, index) => {
          const active = index === activeIndex;
          return (
            <View
              key={item.id}
              style={[styles.dot, active ? styles.dotActive : styles.dotInactive]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  list: {
    flexGrow: 0,
  },
  slide: {
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  playBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  pageControl: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    borderRadius: 999,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  dotInactive: {
    width: 6,
    height: 6,
    opacity: 0.45,
  },
  dotActive: {
    width: 7,
    height: 7,
    opacity: 1,
  },
});
