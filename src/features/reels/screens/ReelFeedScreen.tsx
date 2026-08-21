import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import { reels } from '@/shared/data/mocks';
import { ReelItem } from '@/shared/types';
import { useCartStore } from '@/shared/store/cartStore';
import {
  BookIcon,
  BookmarkIcon,
  CartIcon,
  CommentIcon,
  HeartIcon,
  SearchIcon,
  ThumbDownIcon,
} from '@/shared/components/Icons';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function ReelFeedScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const addToCart = useCartStore(s => s.add);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const book = useCallback(
    (item: ReelItem) => {
      if (!item.bookTarget) return;
      const { kind, id } = item.bookTarget;
      if (kind === 'doctor') navigation.navigate('DoctorProfile', { doctorId: id });
      else if (kind === 'lab') navigation.navigate('LabDetail', { labId: id });
      else navigation.navigate('ClassDetail', { classId: id });
    },
    [navigation],
  );

  const renderItem = ({ item, index }: { item: ReelItem; index: number }) => {
    const isLiked = liked[item.id] ?? !!item.liked;
    const isSaved = saved[item.id] ?? !!item.saved;

    return (
      <View style={[styles.reel, { height: WINDOW_HEIGHT, width: WINDOW_WIDTH }]}>
        <StatusBar barStyle="light-content" />
        <VideoPlayer uri={item.videoUrl} paused={index !== activeIndex} />
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title}>Clips</Text>
          <Pressable onPress={() => navigation.navigate('Search')}>
            <SearchIcon color="#fff" size={22} />
          </Pressable>
        </View>

        <View style={[styles.sideActions, { bottom: 110 + insets.bottom }]}>
          <Pressable style={styles.action} onPress={() => navigation.navigate('Search')}>
            <SearchIcon color="#fff" size={26} />
            <Text style={styles.actionLabel}>Search</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => book(item)}>
            <BookIcon color="#fff" size={26} />
            <Text style={styles.actionLabel}>Book</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => {
              addToCart(1);
              navigation.navigate('Main', { screen: 'Shop' });
            }}>
            <CartIcon color="#fff" size={26} />
            <Text style={styles.actionLabel}>Cart</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => setLiked(prev => ({ ...prev, [item.id]: !isLiked }))}>
            <HeartIcon filled={isLiked} color={isLiked ? '#ED4956' : '#fff'} size={28} />
            <Text style={styles.actionLabel}>
              {formatCount(item.likeCount + (isLiked ? 1 : 0))}
            </Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => setLiked(prev => ({ ...prev, [item.id]: false }))}>
            <ThumbDownIcon color="#fff" size={26} />
            <Text style={styles.actionLabel}>Unlike</Text>
          </Pressable>
          <Pressable style={styles.action}>
            <CommentIcon color="#fff" size={26} />
            <Text style={styles.actionLabel}>{formatCount(item.commentCount)}</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => setSaved(prev => ({ ...prev, [item.id]: !isSaved }))}>
            <BookmarkIcon filled={isSaved} color="#fff" size={26} />
            <Text style={styles.actionLabel}>Save</Text>
          </Pressable>
        </View>

        <View style={[styles.meta, { bottom: 36 + insets.bottom, paddingRight: 78 }]}>
          <Text style={styles.author}>@{item.author}</Text>
          <Text style={styles.caption}>{item.caption}</Text>
          {item.bookTarget ? (
            <Pressable style={styles.bookCta} onPress={() => book(item)}>
              <Text style={styles.bookCtaText}>Book related service</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={reels}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={WINDOW_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: WINDOW_HEIGHT,
          offset: WINDOW_HEIGHT * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  reel: { backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sideActions: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 16,
  },
  action: { alignItems: 'center', gap: 4 },
  actionLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  meta: { position: 'absolute', left: 16 },
  author: { color: '#fff', fontWeight: '700', fontSize: 15 },
  caption: { color: '#fff', marginTop: 6, fontSize: 13 },
  bookCta: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#2D9EB3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bookCtaText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
