import React, { useMemo } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { EmptyState } from '@/shared/components/EmptyState';
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  getCategory,
  getCourse,
  getEvent,
  getProduct,
  getProvider,
  resolvePrimaryCta,
} from '@/shared/data/services';
import { PrimaryActionBar } from '@/features/services/components/PrimaryActionBar';
import { RootStackParamList } from '@/shared/navigation/types';
import { useCartStore } from '@/shared/store/cartStore';

export function UniversalDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'UniversalDetail'>>();
  const { entityType, entityId, categoryId } = route.params;
  const addToCart = useCartStore(s => s.add);

  const category = getCategory(categoryId);
  const provider = entityType === 'provider' ? getProvider(entityId) : undefined;
  const event = entityType === 'event' ? getEvent(entityId) : undefined;
  const course = entityType === 'course' ? getCourse(entityId) : undefined;
  const product = entityType === 'product' ? getProduct(entityId) : undefined;

  const actionType =
    provider?.actionType ??
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
          fee: price || 499,
        });
        break;
      }
      case 'request':
        navigation.navigate('ServiceRequest', {
          categoryId,
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
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.hero} /> : null}
        <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}

        {provider ? (
          <View style={styles.metaRow}>
            <AppIcon name="star" size={14} color={theme.colors.orange} />
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              {provider.rating} ({provider.reviewCount}) · {provider.location.area}
            </Text>
          </View>
        ) : null}

        {price ? (
          <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>
            {product?.isProperty
              ? `Rs ${(price / 100000).toFixed(1)}L`
              : `From Rs ${price}`}
          </Text>
        ) : null}

        <Card style={{ marginTop: 16, gap: 8 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            About
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            {about || category?.description || 'Premium Anticlock partner.'}
          </Text>
        </Card>

        {category ? (
          <Card style={{ gap: 6 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              Category
            </Text>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
              {category.name}
            </Text>
          </Card>
        ) : null}

        {provider?.tags?.length ? (
          <View style={styles.tags}>
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
                ]}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScreenContainer>
      <PrimaryActionBar cta={cta} onPress={onPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    marginBottom: 16,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
