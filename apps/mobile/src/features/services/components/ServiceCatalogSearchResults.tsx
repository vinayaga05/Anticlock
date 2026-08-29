import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmptyState } from '@/shared/components/EmptyState';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { useTheme } from '@/shared/hooks/useTheme';
import { searchCatalog } from '@/shared/data/services';
import { ServiceCategoryCard } from './ServiceCategoryGrid';
import { ProviderCard } from './ProviderCard';
import { EventCard } from './EventCard';
import { CourseCard } from './CourseCard';
import { ProductCard } from './ProductCard';

/** Live, in-place search across the complete service marketplace catalog. */
export function ServiceCatalogSearchResults({ query }: { query: string }) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const normalizedQuery = query.trim();
  const results = useMemo(
    () => searchCatalog(normalizedQuery),
    [normalizedQuery],
  );
  const resultCount =
    results.categories.length +
    results.providers.length +
    results.events.length +
    results.courses.length +
    results.products.length;

  if (!normalizedQuery) return null;

  if (!resultCount) {
    return (
      <EmptyState
        icon="search"
        title="No services found"
        description={`No services match “${normalizedQuery}”.`}
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.textSecondary },
        ]}
      >
        {resultCount} result{resultCount === 1 ? '' : 's'} for “
        {normalizedQuery}”
      </Text>

      {results.categories.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Service categories" />
          {results.categories.map(category => (
            <ServiceCategoryCard
              key={category.id}
              category={category}
              treeId={category.treeId}
              compact={false}
            />
          ))}
        </View>
      ) : null}

      {results.providers.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Providers" />
          {results.providers.map(provider => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onPress={() =>
                navigation.navigate('UniversalDetail', {
                  entityType: 'provider',
                  entityId: provider.id,
                  categoryId: provider.categoryIds[0],
                })
              }
            />
          ))}
        </View>
      ) : null}

      {results.events.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Events & trips" />
          {results.events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onPress={() =>
                navigation.navigate('EventDetail', { eventId: event.id })
              }
            />
          ))}
        </View>
      ) : null}

      {results.courses.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Courses" />
          {results.courses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onPress={() =>
                navigation.navigate('CourseDetail', { courseId: course.id })
              }
            />
          ))}
        </View>
      ) : null}

      {results.products.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Products" />
          {results.products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onPress={() =>
                navigation.navigate('ProductDetail', { productId: product.id })
              }
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
