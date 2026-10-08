import React, { useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { HealthScreenShell } from '@/shared/components/HealthScreenShell';
import { healthTheme } from '@/shared/theme/healthTheme';
import { SearchBar } from '@/shared/components/SearchBar';
import { EmptyState } from '@/shared/components/EmptyState';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { FilterPills } from '@/shared/components/FilterPills';
import { useTheme } from '@/shared/hooks/useTheme';
import { useSearchScrollRestoration } from '@/shared/hooks/useSearchScrollRestoration';
import {
  getCategory,
  getChildCategories,
  getCoursesForCategory,
  getEventsForCategory,
  getProductsForCategory,
} from '@/shared/data/services';
import { ProviderCard } from '@/features/services/components/ProviderCard';
import {
  isMarketplaceProviderId,
  useMarketplaceProvidersQuery,
} from '@/shared/api/marketplaceHooks';
import { EventCard } from '@/features/services/components/EventCard';
import { CourseCard } from '@/features/services/components/CourseCard';
import { ProductCard } from '@/features/services/components/ProductCard';
import { ServiceCategoryGrid } from '@/features/services/components/ServiceCategoryGrid';
import { RootStackParamList } from '@/shared/navigation/types';
import { treeColors, TreeColorId } from '@/shared/theme/colors';

function matchesQuery(query: string, ...values: Array<string | undefined>) {
  return !query || values.some(value => value?.toLowerCase().includes(query));
}

export function ServiceCategoryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceCategory'>>();
  const { categoryId, treeId, q: initialQ, areaLabel, sort: initialSort } =
    route.params;
  const category = getCategory(categoryId);
  const [sort, setSort] = useState(initialSort ?? 'near');
  const { searchQuery, onChangeText, scrollRef, onScroll } =
    useSearchScrollRestoration(initialQ ?? '');
  const treeKey = (
    treeId in treeColors ? treeId : category?.treeId ?? 'health'
  ) as TreeColorId;
  const accent =
    treeKey === 'health' ? healthTheme.navy : treeColors[treeKey].accent;
  const isHealth = treeKey === 'health';
  const Shell = isHealth ? HealthScreenShell : ScreenContainer;

  useLayoutEffect(() => {
    if (category) navigation.setOptions({ title: category.name });
  }, [category, navigation]);

  // Approved businesses offering this category (or a sub-category) come
  // from the API; fixtures are only used when the app runs offline.
  const providersQuery = useMarketplaceProvidersQuery({ categoryId, limit: 50 });
  const providers = useMemo(
    () => providersQuery.data ?? [],
    [providersQuery.data],
  );
  const events = useMemo(() => getEventsForCategory(categoryId), [categoryId]);
  const courses = useMemo(
    () => getCoursesForCategory(categoryId),
    [categoryId],
  );
  const products = useMemo(
    () => getProductsForCategory(categoryId),
    [categoryId],
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const childCategories = useMemo(
    () => getChildCategories(categoryId),
    [categoryId],
  );
  const filteredChildCategories = useMemo(
    () =>
      childCategories.filter(child =>
        matchesQuery(normalizedQuery, child.name, child.description),
      ),
    [childCategories, normalizedQuery],
  );
  const filteredProviders = useMemo(
    () =>
      providers.filter(provider =>
        matchesQuery(
          normalizedQuery,
          provider.name,
          provider.type,
          provider.subtitle,
          provider.location.city,
          provider.location.area,
          ...(provider.tags ?? []),
        ),
      ),
    [providers, normalizedQuery],
  );
  const filteredEvents = useMemo(
    () =>
      events.filter(event =>
        matchesQuery(
          normalizedQuery,
          event.title,
          event.organizer,
          event.destination,
        ),
      ),
    [events, normalizedQuery],
  );
  const filteredCourses = useMemo(
    () =>
      courses.filter(course =>
        matchesQuery(
          normalizedQuery,
          course.title,
          course.instructor,
          course.level,
        ),
      ),
    [courses, normalizedQuery],
  );
  const filteredProducts = useMemo(
    () =>
      products.filter(product =>
        matchesQuery(
          normalizedQuery,
          product.name,
          product.seller,
          product.description,
        ),
      ),
    [products, normalizedQuery],
  );

  if (!category) {
    return (
      <Shell tabAware={false}>
        <EmptyState
          icon="search"
          title="Category not found"
          illustration="search"
        />
      </Shell>
    );
  }

  if (isHealth && childCategories.length) {
    return (
      <Shell
        scrollable
        tabAware={false}
        scrollRef={scrollRef}
        onScroll={onScroll}
      >
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.textSecondary },
          ]}
        >
          {category.description}
        </Text>
        <SearchBar
          placeholder={`Search ${category.name} specialties`}
          value={searchQuery}
          onChangeText={onChangeText}
        />
        <SectionHeader title={`${category.name} specialties`} />
        {filteredChildCategories.length ? (
          <ServiceCategoryGrid
            categories={filteredChildCategories}
            treeId={treeId}
            compact
          />
        ) : (
          <EmptyState
            icon="search"
            title="No specialties found"
            description={`No ${category.name.toLowerCase()} specialties match “${searchQuery.trim()}”.`}
          />
        )}
      </Shell>
    );
  }

  const isEvent =
    category.actionType === 'event_booking' ||
    category.actionType === 'transport_booking';
  const isCourse = category.actionType === 'course_enrollment';
  const isProduct =
    category.actionType === 'product_purchase' ||
    category.actionType === 'property_enquiry';
  const isRequest =
    category.actionType === 'home_service' ||
    category.actionType === 'service_request';

  return (
    <Shell
      scrollable
      tabAware={false}
      scrollRef={scrollRef}
      onScroll={onScroll}
    >
      <Text
        style={[
          theme.typography.bodySmall,
          { color: theme.colors.textSecondary },
        ]}
      >
        {category.description}
      </Text>
      {areaLabel ? (
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.primary, marginBottom: 4 },
          ]}>
          Showing results for {areaLabel}
        </Text>
      ) : null}
      <SearchBar
        placeholder={`Search ${category.name}`}
        value={searchQuery}
        onChangeText={onChangeText}
      />
      <FilterPills
        activeId={sort}
        onChange={setSort}
        accent={accent}
        pills={[
          { id: 'near', label: 'Near you' },
          { id: 'rating', label: 'Top rated' },
          { id: 'price', label: 'Price' },
        ]}
      />

      {isEvent ? (
        filteredEvents.length === 0 ? (
          <EmptyState
            icon="globe"
            title={normalizedQuery ? 'No matching trips' : 'No trips yet'}
            description={
              normalizedQuery
                ? `No trips in ${category.name} match “${searchQuery.trim()}”.`
                : 'Check back soon for new dates.'
            }
          />
        ) : (
          filteredEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onPress={() =>
                navigation.navigate('EventDetail', { eventId: event.id })
              }
            />
          ))
        )
      ) : isCourse ? (
        filteredCourses.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title={normalizedQuery ? 'No matching courses' : 'No courses'}
          />
        ) : (
          filteredCourses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onPress={() =>
                navigation.navigate('CourseDetail', { courseId: course.id })
              }
            />
          ))
        )
      ) : isProduct ? (
        filteredProducts.length === 0 ? (
          <EmptyState
            icon="shopping-bag"
            title={normalizedQuery ? 'No matching products' : 'No products'}
          />
        ) : (
          <View style={styles.productGrid}>
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onPress={() =>
                  navigation.navigate('ProductDetail', {
                    productId: product.id,
                  })
                }
              />
            ))}
          </View>
        )
      ) : filteredProviders.length === 0 ? (
        <EmptyState
          icon="search"
          title={
            normalizedQuery ? 'No matching providers' : 'No providers nearby'
          }
          description={
            isRequest
              ? 'You can still submit a service request.'
              : 'Try another area or category.'
          }
          actionLabel={isRequest ? 'Request service' : undefined}
          onAction={
            isRequest
              ? () => navigation.navigate('ServiceRequest', { categoryId })
              : undefined
          }
        />
      ) : (
        filteredProviders.map(provider => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            health={isHealth}
            onPress={() => {
              // Real businesses always open their own detail page; the legacy
              // jumps below only apply to the offline demo fixtures.
              if (isMarketplaceProviderId(provider.id)) {
                navigation.navigate('UniversalDetail', {
                  entityType: 'provider',
                  entityId: provider.id,
                  categoryId,
                });
                return;
              }
              if (
                category.legacyRoute === 'Doctors' &&
                provider.id === 'prov-doc-remya'
              ) {
                navigation.navigate('DoctorProfile', { doctorId: 'doc-remya' });
                return;
              }
              if (
                category.legacyRoute === 'LabList' ||
                category.legacyRoute === 'DiagnosticsHub'
              ) {
                navigation.navigate('LabDetail', { labId: 'lab-thyrocare' });
                return;
              }
              if (
                category.legacyRoute === 'FitnessFeed' ||
                category.legacyRoute === 'PhysioHub'
              ) {
                navigation.navigate('ClassDetail', {
                  classId: 'fit-sathish-am',
                });
                return;
              }
              navigation.navigate('UniversalDetail', {
                entityType: 'provider',
                entityId: provider.id,
                categoryId,
              });
            }}
          />
        ))
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
