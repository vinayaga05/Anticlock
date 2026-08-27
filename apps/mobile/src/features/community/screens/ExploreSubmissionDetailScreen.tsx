import React from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  getExploreItem,
  reviewStatusLabel,
  visibilityLabel,
} from '@/shared/data/explore';
import { RootStackParamList } from '@/shared/navigation/types';

export function ExploreSubmissionDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ExploreSubmissionDetail'>>();
  const item = getExploreItem(route.params.itemId);

  if (!item) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="search" title="Listing not found" />
      </ScreenContainer>
    );
  }

  const isEvent = item.kind === 'event';
  const needsEdit = item.meta.reviewStatus === 'needs_changes';

  return (
    <ScreenContainer scrollable tabAware={false}>
      <AppHeader title={isEvent ? 'Event' : 'Product'} showBrand={false} showActions={false} />
      <Image source={{ uri: item.imageUrl }} style={styles.hero} />
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
        {item.title}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {isEvent ? item.organizer : item.seller}
      </Text>

      <Card style={{ gap: 8, marginTop: 8 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          {reviewStatusLabel(item.meta.reviewStatus)}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
          {visibilityLabel(item.meta.visibility)}
        </Text>
        {item.meta.reviewNote ? (
          <Text style={[theme.typography.bodySmall, { color: theme.colors.warning }]}>
            Reason: {item.meta.reviewNote}
          </Text>
        ) : null}
      </Card>

      {isEvent ? (
        <Card style={{ gap: 6, marginTop: 8 }}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            {item.dateLabel}
            {item.timeLabel ? ` · ${item.timeLabel}` : ''}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            {item.location}
            {item.distanceKm != null ? ` · ${item.distanceKm} km` : ''}
          </Text>
          <Text style={[theme.typography.title, { color: theme.colors.primary }]}>
            {item.price === 0 ? 'Free' : `₹${item.price}`} · {item.spotsLeft} spots left
          </Text>
        </Card>
      ) : (
        <Card style={{ gap: 6, marginTop: 8 }}>
          <Text style={[theme.typography.title, { color: theme.colors.primary }]}>
            ₹{item.price}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            ★ {item.rating > 0 ? item.rating : 'New'} · {item.reviewCount} reviews
          </Text>
        </Card>
      )}

      <View style={{ marginTop: 16, gap: 10 }}>
        {needsEdit ? (
          <Button
            title="Edit & Resubmit"
            icon="wrench"
            onPress={() =>
              navigation.navigate(isEvent ? 'CreateExploreEvent' : 'CreateExploreProduct')
            }
          />
        ) : null}
        <Button
          title={isEvent ? 'Register / Book' : 'Add to Cart'}
          onPress={() =>
            Alert.alert(
              isEvent ? 'Registered' : 'Added',
              isEvent
                ? 'You are on the list for this event.'
                : 'Product added to cart.',
            )
          }
        />
        <Button title="Share" variant="secondary" icon="share" onPress={() => Alert.alert('Shared')} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#EEE',
  },
});
