import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { EmptyState } from '@/shared/components/EmptyState';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  getCoursesForCategory,
  getEventsForCategory,
  getProductsForCategory,
  getProvidersForCategory,
  ServiceCategory,
} from '@/shared/data/services';
import { ServiceCategoryCard } from './ServiceCategoryGrid';
import { ProviderCard } from './ProviderCard';
import { EventCard } from './EventCard';
import { CourseCard } from './CourseCard';
import { ProductCard } from './ProductCard';

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map(item => [item.id, item])).values()];
}

function matches(query: string, ...values: Array<string | undefined>) {
  return values.some(value => value?.toLowerCase().includes(query));
}

/** Searches a single service tree and all services nested beneath its categories. */
export function ServiceTreeSearchResults({
  query,
  categories,
}: {
  query: string;
  categories: ServiceCategory[];
}) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => {
    const categoryIds = new Set(categories.map(category => category.id));
    const categoryResults = categories.filter(category =>
      matches(normalizedQuery, category.name, category.description),
    );
    const providers = uniqueById(
      categories
        .flatMap(category => getProvidersForCategory(category.id))
        .filter(provider =>
          provider.categoryIds.some(id => categoryIds.has(id)),
        )
        .filter(provider =>
          matches(
            normalizedQuery,
            provider.name,
            provider.type,
            provider.subtitle,
            provider.location.city,
            provider.location.area,
            ...(provider.tags ?? []),
          ),
        ),
    );
    const events = uniqueById(
      categories
        .flatMap(category => getEventsForCategory(category.id))
        .filter(event => categoryIds.has(event.categoryId))
        .filter(event =>
          matches(
            normalizedQuery,
            event.title,
            event.organizer,
            event.destination,
          ),
        ),
    );
    const courses = uniqueById(
      categories
        .flatMap(category => getCoursesForCategory(category.id))
        .filter(course => categoryIds.has(course.categoryId))
        .filter(course =>
          matches(
            normalizedQuery,
            course.title,
            course.instructor,
            course.level,
          ),
        ),
    );
    const products = uniqueById(
      categories
        .flatMap(category => getProductsForCategory(category.id))
        .filter(product => categoryIds.has(product.categoryId))
        .filter(product =>
          matches(
            normalizedQuery,
            product.name,
            product.seller,
            product.description,
          ),
        ),
    );

    return {
      categories: categoryResults,
      providers,
      events,
      courses,
      products,
    };
  }, [categories, normalizedQuery]);

  const resultCount =
    results.categories.length +
    results.providers.length +
    results.events.length +
    results.courses.length +
    results.products.length;

  if (!resultCount) {
    return (
      <EmptyState
        icon="search"
        title="No services found"
        description={`No services in this category match “${query.trim()}”.`}
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
        {resultCount} result{resultCount === 1 ? '' : 's'} in this category
      </Text>

      {results.categories.length ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Subcategories" />
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
          <SectionHeader title="Providers & services" />
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
