import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import { reels as mockReels } from '@/shared/data/mocks';
import { ReelItem } from '@/shared/types';
import { useCartStore } from '@/shared/store/cartStore';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useCommentsSheetStore } from '@/shared/store/commentsSheetStore';
import { useReelsQuery } from '@/shared/api/hooks';
import { TAB_BAR_VISIBLE_HEIGHT } from '@/shared/navigation/FloatingPillTabBar';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Product clips → Shop; service/trip clips → Book. */
function getReelAction(item: ReelItem): 'cart' | 'book' | 'trip' | null {
  const t = item.bookTarget;
  if (!t) return null;
  if (t.cta === 'cart' || t.entityType === 'product') return 'cart';
  if (t.cta === 'trip') return 'trip';
  return 'book';
}

function SideAction({
  icon,
  label,
  active,
  activeColor,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  label?: string;
  active?: boolean;
  activeColor?: string;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View style={styles.sideAction}>
        <View style={styles.sideIconCircle}>
          <AppIcon
            name={icon}
            size={24}
            color={active ? activeColor ?? '#FB7185' : '#FFFFFF'}
            strokeWidth={active ? 2.2 : 1.85}
          />
        </View>
        {label ? <Text style={styles.sideLabel}>{label}</Text> : null}
      </View>
    </PressableScale>
  );
}

function TopChromeButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View style={styles.topBtn}>
        <AppIcon name={icon} size={22} color="#fff" strokeWidth={1.85} />
      </View>
    </PressableScale>
  );
}

function VerticalFade({
  height,
  fromTop,
}: {
  height: number;
  fromTop: boolean;
}) {
  const id = fromTop ? 'clipsTopFade' : 'clipsBottomFade';
  const stops = fromTop
    ? [
        { offset: '0', opacity: '0.72' },
        { offset: '0.55', opacity: '0.28' },
        { offset: '1', opacity: '0' },
      ]
    : [
        { offset: '0', opacity: '0' },
        { offset: '0.35', opacity: '0.35' },
        { offset: '1', opacity: '0.82' },
      ];

  return (
    <Svg
      width={WINDOW_WIDTH}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {stops.map(s => (
            <Stop
              key={s.offset}
              offset={s.offset}
              stopColor="#000"
              stopOpacity={s.opacity}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={WINDOW_WIDTH} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

export function ReelFeedScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const addToCart = useCartStore(s => s.add);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [coins] = useState(120);
  const commentsOpen = useCommentsSheetStore(
    s => (s.open || s.closing) && s.sourceType === 'clip',
  );
  const playbackActive = useCommentsSheetStore(s => s.playbackActive);
  const openComments = useCommentsSheetStore(s => s.openComments);
  const { data: reels = mockReels } = useReelsQuery(mockReels);

  const bottomSafe =
    TAB_BAR_VISIBLE_HEIGHT + Math.max(insets.bottom, 8) + 20;
  const topFadeH = insets.top + 96;
  const bottomFadeH = bottomSafe + 160;

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
      const target = item.bookTarget;
      if (target.entityType && target.entityId && target.categoryId) {
        if (target.entityType === 'event') {
          navigation.navigate('EventDetail', { eventId: target.entityId });
          return;
        }
        if (target.entityType === 'course') {
          navigation.navigate('CourseDetail', { courseId: target.entityId });
          return;
        }
        if (target.entityType === 'product') {
          navigation.navigate('ProductDetail', { productId: target.entityId });
          return;
        }
        navigation.navigate('UniversalDetail', {
          entityType: target.entityType,
          entityId: target.entityId,
          categoryId: target.categoryId,
        });
        return;
      }
      if (target.entityType === 'product' && target.entityId) {
        navigation.navigate('ProductDetail', { productId: target.entityId });
        return;
      }
      if (target.serviceCategoryId && target.serviceTreeId) {
        navigation.navigate('ServiceCategory', {
          treeId: target.serviceTreeId,
          categoryId: target.serviceCategoryId,
        });
        return;
      }
      const { kind, id } = target;
      if (!kind || !id) return;
      if (kind === 'doctor') navigation.navigate('DoctorProfile', { doctorId: id });
      else if (kind === 'lab') navigation.navigate('LabDetail', { labId: id });
      else navigation.navigate('ClassDetail', { classId: id });
    },
    [navigation],
  );

  const addProduct = useCallback(
    (item: ReelItem) => {
      addToCart(1);
      const productId = item.bookTarget?.entityId;
      if (productId) {
        navigation.navigate('ProductDetail', { productId });
        return;
      }
      navigation.navigate('Main', { screen: 'Shop' });
    },
    [addToCart, navigation],
  );

  const renderItem = ({ item, index }: { item: ReelItem; index: number }) => {
    const isLiked = liked[item.id] ?? !!item.liked;
    const isSaved = saved[item.id] ?? !!item.saved;
    const action = getReelAction(item);
    const musicLabel = item.title ? `♪ ${item.title}` : '♪ Original audio';

    return (
      <View style={[styles.reel, { height: WINDOW_HEIGHT, width: WINDOW_WIDTH }]}>
        <VideoPlayer
          uri={item.videoUrl}
          muted
          paused={
            index !== activeIndex || (commentsOpen && !playbackActive)
          }
        />

        {/* Top fade + chrome */}
        <View style={[styles.topFade, { height: topFadeH }]} pointerEvents="none">
          <VerticalFade height={topFadeH} fromTop />
        </View>
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
          <TopChromeButton
            icon="profile"
            accessibilityLabel="Profile"
            onPress={() => navigation.navigate('Profile')}
          />
          <View style={styles.topRightCluster}>
            <TopChromeButton
              icon="search"
              accessibilityLabel="Search"
              onPress={() => navigation.navigate('Search')}
            />
            <PressableScale
              accessibilityLabel="Coins"
              onPress={() => {}}
              style={styles.coinsChip}>
              <AppIcon name="coins" size={16} color="#FBBF24" strokeWidth={2} />
              <Text style={styles.coinsText}>{coins}</Text>
            </PressableScale>
            <TopChromeButton
              icon="circle-plus"
              accessibilityLabel="Create"
              onPress={() => navigation.navigate('FlashComposer')}
            />
          </View>
        </View>

        {/* Right engagement only */}
        <View style={[styles.sideActions, { bottom: bottomSafe + 72 }]}>
          <SideAction
            icon="heart"
            label={formatCount(item.likeCount + (isLiked ? 1 : 0))}
            active={isLiked}
            accessibilityLabel="Like"
            onPress={() => setLiked(prev => ({ ...prev, [item.id]: !isLiked }))}
          />
          <SideAction
            icon="comment"
            label={formatCount(item.commentCount)}
            accessibilityLabel="Comments"
            onPress={() =>
              openComments({
                sourceType: 'clip',
                contentId: item.id,
                commentCount: item.commentCount,
              })
            }
          />
          <SideAction icon="share" accessibilityLabel="Share" />
          <SideAction
            icon="bookmark"
            label={isSaved ? 'Saved' : undefined}
            active={isSaved}
            activeColor={theme.colors.primary}
            accessibilityLabel="Save"
            onPress={() => setSaved(prev => ({ ...prev, [item.id]: !isSaved }))}
          />
        </View>

        {/* Bottom fade + meta + CTA */}
        <View
          style={[styles.bottomFade, { height: bottomFadeH }]}
          pointerEvents="none">
          <VerticalFade height={bottomFadeH} fromTop={false} />
        </View>
        <View
          style={[
            styles.meta,
            { bottom: bottomSafe, paddingRight: 78 },
          ]}>
          <Text style={styles.creator}>@{item.author}</Text>
          <Text style={styles.caption} numberOfLines={2}>
            {item.caption}
          </Text>
          <View style={styles.musicRow}>
            <AppIcon name="music" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.musicText} numberOfLines={1}>
              {musicLabel}
            </Text>
          </View>
          {action ? (
            <PressableScale
              onPress={() => (action === 'cart' ? addProduct(item) : book(item))}
              accessibilityLabel={
                action === 'cart' ? 'Shop product' : 'Book related service'
              }
              style={[
                styles.cta,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.pill,
                },
              ]}>
              <AppIcon
                name={
                  action === 'cart'
                    ? 'cart'
                    : action === 'trip'
                      ? 'globe'
                      : 'calendar'
                }
                size={16}
                color="#042F2E"
              />
              <Text style={styles.ctaLabel}>
                {action === 'cart'
                  ? 'Shop'
                  : action === 'trip'
                    ? 'Book trip'
                    : 'Book'}
              </Text>
            </PressableScale>
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
        scrollEnabled={!commentsOpen}
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
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  topBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  coinsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  coinsText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sideActions: {
    position: 'absolute',
    right: 10,
    alignItems: 'center',
    gap: 16,
  },
  sideAction: {
    alignItems: 'center',
    gap: 4,
  },
  sideIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  sideLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  meta: {
    position: 'absolute',
    left: 16,
    gap: 6,
  },
  creator: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  caption: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  musicText: {
    flex: 1,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
  },
  cta: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaLabel: {
    color: '#042F2E',
    fontWeight: '800',
    fontSize: 13,
  },
});
