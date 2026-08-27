import React, { useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { SearchBar } from '@/shared/components/SearchBar';
import { EmptyState } from '@/shared/components/EmptyState';
import { FilterPills } from '@/shared/components/FilterPills';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  getCategory,
  getCoursesForCategory,
  getEventsForCategory,
  getProductsForCategory,
  getProvidersForCategory,
} from '@/shared/data/services';
import { ProviderCard } from '@/features/services/components/ProviderCard';
import { EventCard } from '@/features/services/components/EventCard';
import { CourseCard } from '@/features/services/components/CourseCard';
import { ProductCard } from '@/features/services/components/ProductCard';
import { RootStackParamList } from '@/shared/navigation/types';
import { treeColors, TreeColorId } from '@/shared/theme/colors';

export function ServiceCategoryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceCategory'>>();
  const { categoryId, treeId } = route.params;
  const category = getCategory(categoryId);
  const [sort, setSort] = useState('near');
  const treeKey = (
    treeId in treeColors ? treeId : category?.treeId ?? 'health'
  ) as TreeColorId;
  const accent = treeColors[treeKey].accent;

  useLayoutEffect(() => {
    if (category) navigation.setOptions({ title: category.name });
  }, [category, navigation]);

  const providers = useMemo(() => getProvidersForCategory(categoryId), [categoryId]);
  const events = useMemo(() => getEventsForCategory(categoryId), [categoryId]);
  const courses = useMemo(() => getCoursesForCategory(categoryId), [categoryId]);
  const products = useMemo(() => getProductsForCategory(categoryId), [categoryId]);

  if (!category) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="search" title="Category not found" illustration="search" />
      </ScreenContainer>
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
    <ScreenContainer scrollable tabAware={false}>
      <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
        {category.description}
      </Text>
      <SearchBar placeholder={`Search ${category.name}`} />
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
        events.length === 0 ? (
          <EmptyState
            icon="globe"
            title="No trips yet"
            description="Check back soon for new dates."
          />
        ) : (
          events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
            />
          ))
        )
      ) : isCourse ? (
        courses.length === 0 ? (
          <EmptyState icon="clipboard" title="No courses" />
        ) : (
          courses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onPress={() => navigation.navigate('CourseDetail', { courseId: course.id })}
            />
          ))
        )
      ) : isProduct ? (
        products.length === 0 ? (
          <EmptyState icon="shopping-bag" title="No products" />
        ) : (
          <View style={styles.productGrid}>
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onPress={() =>
                  navigation.navigate('ProductDetail', { productId: product.id })
                }
              />
            ))}
          </View>
        )
      ) : providers.length === 0 ? (
        <EmptyState
          icon="search"
          title="No providers nearby"
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
        providers.map(provider => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onPress={() => {
              if (category.legacyRoute === 'Doctors' && provider.id === 'prov-doc-remya') {
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
                navigation.navigate('ClassDetail', { classId: 'fit-sathish-am' });
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
