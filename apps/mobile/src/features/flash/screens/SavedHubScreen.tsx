import React, { useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { FilterPills } from '@/shared/components/FilterPills';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { SavedContentKind } from '@/shared/data/flash/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';

const BUCKETS: { id: SavedContentKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'flash', label: 'Flash Posts' },
  { id: 'clip', label: 'Clips' },
  { id: 'service', label: 'Services' },
  { id: 'product', label: 'Products' },
  { id: 'course', label: 'Courses' },
  { id: 'event', label: 'Events' },
];

export function SavedHubScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const saved = useEngagementStore(s => s.saved);
  const unsaveContent = useEngagementStore(s => s.unsaveContent);
  const [bucket, setBucket] = useState<SavedContentKind | 'all'>('all');

  const items = useMemo(
    () => (bucket === 'all' ? saved : saved.filter(s => s.kind === bucket)),
    [saved, bucket],
  );

  const openItem = (kind: SavedContentKind, refId: string) => {
    switch (kind) {
      case 'flash':
        navigation.navigate('Main', { screen: 'Flash' });
        break;
      case 'clip':
        navigation.navigate('Main', { screen: 'PlayFeed' });
        break;
      case 'product':
        navigation.navigate('ProductDetail', { productId: refId });
        break;
      case 'course':
        navigation.navigate('CourseDetail', { courseId: refId });
        break;
      case 'event':
        navigation.navigate('EventDetail', { eventId: refId });
        break;
      case 'service':
        navigation.navigate('Main', { screen: 'Needs' });
        break;
    }
  };

  return (
    <ScreenContainer scrollable={false} tabAware={false} padded={false}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md, flex: 1 }}>
        <FilterPills
          activeId={bucket}
          onChange={id => setBucket(id as SavedContentKind | 'all')}
          pills={BUCKETS}
        />
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyState
              icon="save"
              title="Nothing saved yet"
              description="Save Flash posts, Play videos, and marketplace items to find them here."
            />
          }
          renderItem={({ item }) => (
            <Card
              onPress={() => openItem(item.kind, item.refId)}
              style={styles.row}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              ) : (
                <View
                  style={[
                    styles.thumb,
                    { backgroundColor: theme.colors.surfaceMuted },
                  ]}
                />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.textPrimary, fontWeight: '700' },
                  ]}
                  numberOfLines={2}>
                  {item.title}
                </Text>
                <Text
                  style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
                  numberOfLines={1}>
                  {item.kind}
                  {item.subtitle ? ` · ${item.subtitle}` : ''}
                </Text>
              </View>
              <Text
                onPress={() => unsaveContent(item.id)}
                style={[theme.typography.caption, { color: theme.colors.primary }]}>
                Remove
              </Text>
            </Card>
          )}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
});
