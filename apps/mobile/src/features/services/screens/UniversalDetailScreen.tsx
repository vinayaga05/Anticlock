import React, { useCallback, useMemo } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { EmptyState } from '@/shared/components/EmptyState';
import { Card } from '@/shared/components/Card';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  getCategory,
  getCourse,
  getEvent,
  getProduct,
  resolvePrimaryCta,
} from '@/shared/data/services';
import {
  isMarketplaceProviderId,
  useMarketplaceProviderQuery,
} from '@/shared/api/marketplaceHooks';
import { useProfileClipReelsQuery } from '@/shared/api/hooks';
import { PrimaryActionBar } from '@/features/services/components/PrimaryActionBar';
import { ProviderIntroVideoSection } from '@/features/services/components/ProviderIntroVideoSection';
import { RootStackParamList } from '@/shared/navigation/types';
import { useCartStore } from '@/shared/store/cartStore';
import { useContentProfileQuery } from '@/shared/api/storyHooks';
import { softFill } from '@/shared/theme/colors';

function MetaChip({
  icon,
  label,
  color,
}: {
  icon: IconName;
  label: string;
  color: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: softFill(color, 0.12),
          borderRadius: theme.radius.pill,
        },
      ]}
    >
      <AppIcon name={icon} size={13} color={color} />
      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.textPrimary, fontWeight: '600', flexShrink: 1 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function SectionCard({
  icon,
  title,
  children,
  delay = 0,
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(delay)}>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View
            style={[
              styles.sectionIcon,
              { backgroundColor: softFill(theme.colors.primary, 0.12) },
            ]}
          >
            <AppIcon name={icon} size={15} color={theme.colors.primary} />
          </View>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
        </View>
        {children}
      </Card>
    </Animated.View>
  );
}

export function UniversalDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'UniversalDetail'>>();
  const { entityType, entityId, categoryId } = route.params;
  const addToCart = useCartStore(s => s.add);

  const providerQuery = useMarketplaceProviderQuery(
    entityType === 'provider' ? entityId : undefined,
  );
  const provider = providerQuery.data ?? undefined;
  const isRealProvider = Boolean(provider && isMarketplaceProviderId(provider.id));
  const providerProfileQuery = useContentProfileQuery(
    isRealProvider ? 'business' : undefined,
    isRealProvider ? provider!.id : undefined,
  );
  const providerClipsQuery = useProfileClipReelsQuery(
    isRealProvider ? 'business' : undefined,
    isRealProvider ? provider!.id : undefined,
  );
  const effectiveCategoryId = categoryId || provider?.categoryIds[0] || '';
  const category =
    getCategory(effectiveCategoryId) ??
    (provider ? provider.categoryIds.map(id => getCategory(id)).find(Boolean) : undefined);
  const event = entityType === 'event' ? getEvent(entityId) : undefined;
  const course = entityType === 'course' ? getCourse(entityId) : undefined;
  const product = entityType === 'product' ? getProduct(entityId) : undefined;

  const actionType =
    isRealProvider && provider?.actionType === 'product_purchase'
      ? 'service_request'
      : provider?.actionType ??
        category?.actionType ??
        (product?.isProperty ? 'property_enquiry' : 'product_purchase');

  const cta = useMemo(() => resolvePrimaryCta(actionType), [actionType]);

  const title =
    provider?.name ?? event?.title ?? course?.title ?? product?.name ?? 'Details';
  const imageUrl =
    provider?.imageUrl ?? event?.imageUrl ?? course?.imageUrl ?? product?.imageUrl;
  const subtitle =
    provider?.subtitle ??
    provider?.type ??
    event?.destination ??
    course?.instructor ??
    product?.seller;
  const about =
    provider?.about ??
    event?.itinerary?.join(' · ') ??
    course?.curriculum?.join(' · ') ??
    product?.description;
  const price =
    provider?.priceFrom ?? event?.price ?? course?.price ?? product?.price ?? 0;
  const providerClipCategoryId = provider?.categoryIds[0];
  const locationLabel = provider
    ? [provider.location.area, provider.location.city].filter(Boolean).join(', ')
    : '';
  const clips = providerClipsQuery.data ?? [];
  const showIntroSection = Boolean(isRealProvider && providerClipCategoryId);

  const priceLabel = price
    ? product?.isProperty
      ? `Rs ${(price / 100000).toFixed(1)}L`
      : `Rs ${price}`
    : null;

  const sideFacts = useMemo(() => {
    if (!provider) return [];
    const facts: Array<{
      icon: 'coins' | 'star' | 'location' | 'briefcase' | 'badge-check' | 'check-circle';
      label: string;
      value: string;
      color?: string;
    }> = [];

    if (priceLabel) {
      facts.push({
        icon: 'coins',
        label: 'Starting from',
        value: priceLabel,
        color: theme.colors.primary,
      });
    }

    facts.push({
      icon: 'star',
      label: 'Rating',
      value:
        provider.reviewCount > 0
          ? `${provider.rating} (${provider.reviewCount})`
          : 'New on Knock',
      color: theme.colors.orange,
    });

    if (locationLabel) {
      facts.push({
        icon: 'location',
        label: 'Location',
        value: locationLabel,
        color: theme.colors.primary,
      });
    }

    if (category?.name) {
      facts.push({
        icon: 'briefcase',
        label: 'Category',
        value: category.name,
        color: theme.colors.primary,
      });
    } else if (provider.verified) {
      facts.push({
        icon: 'badge-check',
        label: 'Status',
        value: 'Verified partner',
        color: theme.colors.primary,
      });
    } else if (provider.tags?.[0]) {
      facts.push({
        icon: 'check-circle',
        label: 'Service mode',
        value: provider.tags[0],
        color: theme.colors.primary,
      });
    }

    return facts.slice(0, 4);
  }, [category?.name, locationLabel, priceLabel, provider, theme.colors.orange, theme.colors.primary]);

  const openProviderClips = useCallback(
    (reelId?: string) => {
      if (!provider || !providerClipCategoryId) return;
      navigation.navigate('ProviderClips', {
        providerId: provider.id,
        serviceCategoryId: providerClipCategoryId,
        providerName: title,
        ...(reelId ? { reelId } : {}),
        ...(providerProfileQuery.data?.counts.clips || clips.length
          ? { providerHasClips: true }
          : {}),
      });
    },
    [
      clips.length,
      navigation,
      provider,
      providerClipCategoryId,
      providerProfileQuery.data?.counts.clips,
      title,
    ],
  );

  if (entityType === 'provider' && providerQuery.isLoading) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="search" title="Loading…" />
      </ScreenContainer>
    );
  }

  if (entityType === 'provider' && !provider) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState
          icon="search"
          title="Business not available"
          description={
            providerQuery.error instanceof Error
              ? providerQuery.error.message
              : 'This business is not accepting bookings right now.'
          }
        />
      </ScreenContainer>
    );
  }

  if (!category && !provider && !event && !course && !product) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="search" title="Not found" />
      </ScreenContainer>
    );
  }

  const onPrimary = () => {
    switch (cta.action) {
      case 'schedule': {
        const kind =
          actionType === 'class_booking' || actionType === 'membership'
            ? 'class'
            : 'appointment';
        navigation.navigate('Schedule', {
          kind,
          id: entityId,
          title,
          fee: price || (isRealProvider ? 0 : 499),
          ...(isRealProvider && provider
            ? { providerId: provider.id, categoryId: provider.categoryIds[0] ?? categoryId }
            : {}),
        });
        break;
      }
      case 'request':
        navigation.navigate('ServiceRequest', {
          categoryId: effectiveCategoryId,
          providerId: provider?.id,
        });
        break;
      case 'enroll':
        navigation.navigate('CourseDetail', { courseId: course?.id ?? entityId });
        break;
      case 'event_book':
        navigation.navigate('EventDetail', { eventId: event?.id ?? entityId });
        break;
      case 'cart':
        addToCart(1);
        Alert.alert('Added to cart', `${title} is in your cart.`);
        break;
      case 'enquiry':
        Alert.alert('Enquiry sent', 'The seller will contact you shortly.');
        break;
      case 'membership':
        Alert.alert('Memberships', 'Monthly and annual plans are available at the center.');
        break;
      default:
        break;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenContainer scrollable tabAware={false} contentStyle={{ paddingBottom: 100 }}>
        <Animated.View entering={FadeIn.duration(360)} style={styles.heroWrap}>
          {imageUrl ? (
            <View
              style={[
                styles.hero,
                {
                  borderRadius: theme.radius['2xl'],
                  backgroundColor: softFill(theme.colors.primary, 0.2),
                  ...theme.shadows.card,
                },
              ]}
            >
              <View style={styles.heroPlaceholder}>
                <AppIcon name="briefcase" size={42} color={theme.colors.primary} />
              </View>
              <Image source={{ uri: imageUrl }} style={styles.heroImage} />
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                <Defs>
                  <LinearGradient id="detailHeroShade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0.35" stopColor="#0F172A" stopOpacity="0" />
                    <Stop offset="1" stopColor="#0F172A" stopOpacity="0.72" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#detailHeroShade)" />
              </Svg>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={styles.heroSubtitle} numberOfLines={2}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.titleBlock}>
              <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          )}
        </Animated.View>

        {showIntroSection ? (
          <ProviderIntroVideoSection
            clips={clips}
            fallbackPosterUrl={imageUrl || undefined}
            providerName={title}
            clipCount={providerProfileQuery.data?.counts.clips ?? clips.length}
            loading={providerClipsQuery.isLoading}
            sideFacts={sideFacts}
            onOpenClip={openProviderClips}
          />
        ) : (
          <>
            {provider ? (
              <Animated.View
                entering={FadeInDown.duration(400).delay(40)}
                style={styles.chipRow}
              >
                <MetaChip
                  icon="star"
                  color={theme.colors.orange}
                  label={
                    provider.reviewCount > 0
                      ? `${provider.rating} (${provider.reviewCount})`
                      : 'New on Knock'
                  }
                />
                {locationLabel ? (
                  <MetaChip icon="location" color={theme.colors.primary} label={locationLabel} />
                ) : null}
                {provider.verified ? (
                  <MetaChip icon="badge-check" color={theme.colors.primary} label="Verified" />
                ) : null}
              </Animated.View>
            ) : null}

            {priceLabel ? (
              <Animated.View
                entering={FadeInDown.duration(400).delay(70)}
                style={[
                  styles.priceCard,
                  {
                    backgroundColor: softFill(theme.colors.primary, 0.1),
                    borderRadius: theme.radius.xl,
                  },
                ]}
              >
                <View
                  style={[
                    styles.priceIcon,
                    { backgroundColor: softFill(theme.colors.primary, 0.18) },
                  ]}
                >
                  <AppIcon name="coins" size={16} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                    Starting from
                  </Text>
                  <Text style={[theme.typography.title, { color: theme.colors.primary }]}>
                    {priceLabel}
                  </Text>
                </View>
              </Animated.View>
            ) : null}
          </>
        )}

        <SectionCard icon="sparkles" title="About" delay={140}>
          <Text
            style={[
              theme.typography.bodySmall,
              { color: theme.colors.textSecondary, lineHeight: 20 },
            ]}
          >
            {about || category?.description || 'Premium Knock partner.'}
          </Text>
        </SectionCard>

        {!showIntroSection && category ? (
          <SectionCard icon="briefcase" title="Category" delay={180}>
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textPrimary, fontWeight: '700' },
              ]}
            >
              {category.name}
            </Text>
          </SectionCard>
        ) : null}

        {provider?.tags?.length ? (
          <Animated.View entering={FadeInDown.duration(420).delay(220)} style={styles.tags}>
            {provider.tags.map(tag => (
              <View
                key={tag}
                style={[
                  styles.tag,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.pill,
                  },
                ]}
              >
                <AppIcon name="check-circle" size={12} color={theme.colors.primary} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </Animated.View>
        ) : null}

        {provider?.verified && showIntroSection ? (
          <Animated.View entering={FadeInDown.duration(420).delay(240)} style={styles.verifiedRow}>
            <View
              style={[
                styles.verifiedCard,
                {
                  backgroundColor: softFill(theme.colors.primary, 0.1),
                  borderRadius: theme.radius.xl,
                },
              ]}
            >
              <AppIcon name="badge-check" size={16} color={theme.colors.primary} />
              <Text
                style={[
                  theme.typography.bodySmall,
                  { color: theme.colors.textPrimary, fontWeight: '700' },
                ]}
              >
                Verified Knock partner
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </ScreenContainer>
      <PrimaryActionBar cta={cta} onPress={onPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { marginBottom: 4 },
  hero: {
    height: 220,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
  },
  heroPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    gap: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    fontWeight: '500',
  },
  titleBlock: { gap: 6 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  priceIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  verifiedRow: { marginTop: 2 },
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
