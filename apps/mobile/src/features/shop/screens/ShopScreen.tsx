import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { SearchBar } from '@/shared/components/SearchBar';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  getEcommerceCategories,
  getProductsForCategory,
  marketplaceProducts,
} from '@/shared/data/services';
import { ShopProductCard } from '@/features/shop/components/ShopProductCard';
import { useCartStore } from '@/shared/store/cartStore';
import { AppIcon } from '@/shared/components/AppIcon';
import type { MainTabParamList } from '@/shared/navigation/types';
import { useProductsQuery, isApiEnabled } from '@/shared/api';
import { useProductCategoriesQuery } from '@/shared/api/shopHooks';
import { useTabBarBottomInset } from '@/shared/navigation/tabBarInset';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import {
  getPublishedShopCategories,
  getShopCategoryArtworkKey,
  resolveShopCategoryFilter,
  type ShopCategory,
} from './shopLayout';

const shopCategoryImages: Record<string, ImageSourcePropType> = {
  'ecom.sports': require('../../../shared/assets/categories/shop-sports-3d.png'),
  'ecom.health': require('../../../shared/assets/categories/shop-health-3d.png'),
  'ecom.fitness': require('../../../shared/assets/categories/shop-fitness-3d.png'),
  'ecom.beauty': require('../../../shared/assets/categories/shop-beauty-3d.png'),
  'ecom.garments': require('../../../shared/assets/categories/shop-garments-3d.png'),
  'ecom.property': require('../../../shared/assets/categories/shop-property-3d.png'),
  'ecom.kitchen': require('../../../shared/assets/categories/shop-kitchen-3d.png'),
  'ecom.games': require('../../../shared/assets/categories/shop-games-3d.png'),
  'ecom.electronics': require('../../../shared/assets/categories/shop-electronics-3d.png'),
};

export function ShopScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MainTabParamList, 'Shop'>>();
  const { count } = useCartStore();
  const { active } = useActiveProfile();
  const businessProfile =
    active &&
    identityProfileType(active) === 'business' &&
    active.role !== 'analyst'
      ? active
      : null;
  const { width, fontScale } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const productSectionY = useRef(0);
  const [sort, setSort] = useState<'featured' | 'low' | 'high'>('featured');
  const [budgetOnly, setBudgetOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const bottomInset = useTabBarBottomInset();
  const categoryTileWidth = 80 * Math.max(1, fontScale);
  const collectionImageSize = Math.min(190, (width - 32) * 0.4);
  const productColumns =
    width < 350 || fontScale > 1.35 ? 1 : width >= 720 ? 3 : 2;
  const categoryQuery = useProductCategoriesQuery({ enabled: isApiEnabled });
  const categories = useMemo<ShopCategory[]>(
    () =>
      isApiEnabled
        ? getPublishedShopCategories(categoryQuery.data ?? [])
        : getEcommerceCategories().map(category => ({
            id: category.id,
            name: category.name,
            artworkKey: getShopCategoryArtworkKey(category.id),
          })),
    [categoryQuery.data],
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    route.params?.categoryId ?? null,
  );
  const [query, setQuery] = useState(route.params?.q ?? '');
  const categoryFilter = resolveShopCategoryFilter(
    categoryId,
    categories,
    categoryQuery.isLoading,
  );
  const canLoadProducts =
    isApiEnabled &&
    categoryFilter.status !== 'loading' &&
    categoryFilter.status !== 'unavailable';

  useEffect(() => {
    if (route.params?.q !== undefined) setQuery(route.params.q);
    if (route.params?.categoryId !== undefined) {
      setCategoryId(route.params.categoryId);
    }
  }, [route.params?.q, route.params?.categoryId]);

  const {
    data: apiData,
    refetch: refetchProducts,
    isLoading,
    error,
  } = useProductsQuery(isApiEnabled ? categoryFilter.categoryId : undefined, {
    enabled: canLoadProducts,
  });

  const refetchCategories = categoryQuery.refetch;
  useFocusEffect(
    useCallback(() => {
      if (!isApiEnabled) return;
      void refetchCategories();
      if (canLoadProducts) void refetchProducts();
    }, [refetchCategories, refetchProducts, canLoadProducts]),
  );

  const products = useMemo(() => {
    if (!isApiEnabled) {
      const base = categoryId
        ? getProductsForCategory(categoryId)
        : marketplaceProducts.filter(product => !product.isProperty);
      const q = query.trim().toLowerCase();
      if (!q) return base;
      return base.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.seller?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      );
    }

    const apiProducts = canLoadProducts ? apiData?.products ?? [] : [];
    const q = query.trim().toLowerCase();
    if (!q) return apiProducts.map(mapApiProductToCard);
    return apiProducts
      .filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      )
      .map(mapApiProductToCard);
  }, [categoryId, query, apiData, canLoadProducts]);

  const selectedName =
    categories.find(
      c => c.id === (isApiEnabled ? categoryFilter.categoryId : categoryId),
    )?.name ?? (categoryId ? 'Selected category' : 'All products');

  const displayedProducts = useMemo(() => {
    const list = budgetOnly
      ? products.filter(product => product.price <= 999)
      : [...products];
    if (sort === 'low') list.sort((a, b) => a.price - b.price);
    if (sort === 'high') list.sort((a, b) => b.price - a.price);
    return list;
  }, [products, budgetOnly, sort]);
  const showCollection = !query.trim() && !categoryId;
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchCategories(),
        canLoadProducts ? refetchProducts() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  const resetFilters = () => {
    setCategoryId(null);
    setBudgetOnly(false);
    setQuery('');
  };

  return (
    <ScreenContainer padded={false} contentStyle={styles.screenContent}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerBrand}>
          <AppHeader title="Shop" showActions={false} />
        </View>
        <PressableScale
          accessibilityLabel="My orders"
          onPress={() => navigation.navigate('MyOrders')}
          style={styles.headerAction}
        >
          <AppIcon
            name="shopping-bag"
            size={23}
            color={theme.colors.textPrimary}
          />
        </PressableScale>
        <PressableScale
          accessibilityLabel={`Cart, ${count} ${
            count === 1 ? 'item' : 'items'
          }`}
          onPress={() => navigation.navigate('Checkout')}
          style={[
            styles.cartButton,
            { backgroundColor: theme.colors.primarySoft },
          ]}
        >
          <AppIcon name="cart" size={24} color={theme.colors.primary} />
          {count > 0 ? (
            <View
              testID="shop-cart-badge"
              pointerEvents="none"
              style={[
                styles.cartBadge,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text style={styles.cartBadgeText}>
                {count > 99 ? '99+' : count}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </View>
      <View
        style={[styles.searchBand, { backgroundColor: theme.colors.primary }]}
      >
        <SearchBar
          placeholder="Search products"
          emphasized={false}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <ScrollView
        ref={scrollRef}
        style={[
          styles.scroll,
          {
            backgroundColor:
              theme.mode === 'dark' ? theme.colors.background : '#F2F5FA',
          },
        ]}
        contentContainerStyle={{ paddingBottom: bottomInset, gap: 16 }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View
          style={[
            styles.categorySection,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          {isApiEnabled && categoryQuery.isLoading ? (
            <View style={styles.categoryState}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={{ color: theme.colors.textSecondary }}>
                Loading product categories…
              </Text>
            </View>
          ) : isApiEnabled && categoryQuery.error ? (
            <EmptyState
              icon="alert"
              title="Could not load categories"
              description="Please retry to browse product categories."
              actionLabel="Retry categories"
              onAction={() => categoryQuery.refetch()}
            />
          ) : categories.length === 0 ? (
            <EmptyState
              icon="shopping-bag"
              title="No categories available"
              description="Published categories will appear here. You can still browse all products below."
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
              accessibilityLabel="Product categories"
            >
              <PressableScale
                accessibilityLabel="All categories"
                accessibilityState={{ selected: !categoryId }}
                onPress={() => setCategoryId(null)}
                style={[styles.catCell, { width: categoryTileWidth }]}
              >
                <View
                  style={[
                    styles.allCategory,
                    {
                      backgroundColor: theme.colors.primarySoft,
                      borderColor: !categoryId
                        ? theme.colors.primary
                        : 'transparent',
                    },
                  ]}
                >
                  <AppIcon
                    name="shopping-bag"
                    size={29}
                    color={theme.colors.primary}
                  />
                </View>
                <Text
                  numberOfLines={3}
                  style={[
                    styles.categoryLabel,
                    {
                      color: !categoryId
                        ? theme.colors.primary
                        : theme.colors.textPrimary,
                    },
                  ]}
                >
                  For you
                </Text>
              </PressableScale>
              {categories.map(c => {
                const selected =
                  (isApiEnabled ? categoryFilter.categoryId : categoryId) ===
                  c.id;
                const source =
                  (c.artworkKey
                    ? shopCategoryImages[c.artworkKey]
                    : undefined) ??
                  (c.imageUrl ? { uri: c.imageUrl } : undefined);
                return (
                  <View
                    key={c.id}
                    style={[styles.catCell, { width: categoryTileWidth }]}
                  >
                    <PressableScale
                      accessibilityLabel={c.name}
                      accessibilityState={{ selected }}
                      onPress={() => setCategoryId(c.id)}
                      style={styles.catTile}
                    >
                      <View
                        style={[
                          styles.categoryCircle,
                          {
                            borderColor: selected
                              ? theme.colors.primary
                              : 'transparent',
                            backgroundColor: theme.colors.surfaceMuted,
                          },
                        ]}
                      >
                        {source ? (
                          <Image
                            source={source}
                            style={styles.categoryImage}
                            resizeMode="cover"
                            resizeMethod="resize"
                            accessible
                            accessibilityLabel={`${c.name} product category image`}
                          />
                        ) : (
                          <AppIcon
                            name="shopping-bag"
                            size={28}
                            color={theme.colors.primary}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.categoryLabel,
                          {
                            color: selected
                              ? theme.colors.primary
                              : theme.colors.textPrimary,
                          },
                        ]}
                        numberOfLines={3}
                      >
                        {c.name}
                      </Text>
                    </PressableScale>
                    {selected ? (
                      <PressableScale
                        accessibilityLabel={`Clear ${c.name} filter`}
                        onPress={() => setCategoryId(null)}
                        style={[
                          styles.clearFilter,
                          { backgroundColor: theme.colors.primary },
                        ]}
                      >
                        <AppIcon name="x" size={11} color="#fff" />
                      </PressableScale>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {showCollection ? (
          <View style={styles.collection}>
            <View style={styles.collectionOrb} />
            <View style={styles.collectionCopy}>
              <View style={styles.collectionEyebrow}>
                <Text style={styles.collectionEyebrowText}>THE KNOCK EDIT</Text>
              </View>
              <Text style={styles.collectionTitle}>
                Everyday finds.{'\n'}Extraordinary you.
              </Text>
              <Text style={styles.collectionSubtitle}>
                Little upgrades for the way you live.
              </Text>
              <PressableScale
                accessibilityLabel="Explore products"
                onPress={() =>
                  scrollRef.current?.scrollTo({
                    y: productSectionY.current,
                    animated: true,
                  })
                }
                style={styles.collectionCta}
              >
                <Text style={styles.collectionCtaText}>Explore now</Text>
                <AppIcon name="arrow-right" size={16} color="#fff" />
              </PressableScale>
            </View>
            <Image
              source={shopCategoryImages['ecom.electronics']}
              style={[
                styles.collectionImage,
                {
                  width: collectionImageSize,
                  height: collectionImageSize,
                  borderRadius: collectionImageSize / 2,
                },
              ]}
              resizeMode="contain"
              resizeMethod="resize"
            />
          </View>
        ) : null}

        {businessProfile ? (
          <View style={styles.inset}>
            <Card elevated={false} style={styles.sellerCard}>
              <View style={styles.sellerInfo}>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  YOUR BUSINESS STOREFRONT
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    theme.typography.section,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  {businessProfile.name}
                </Text>
              </View>
              <Button
                title="Add product"
                icon="plus"
                accessibilityLabel={`Add product for ${businessProfile.name}`}
                onPress={() =>
                  navigation.navigate('CreateExploreProduct', {
                    publisherProfileId: businessProfile.id,
                    publisherProfileType: 'business',
                  })
                }
                style={styles.checkoutBtn}
              />
            </Card>
          </View>
        ) : null}

        <View
          style={styles.inset}
          onLayout={event => {
            productSectionY.current = event.nativeEvent.layout.y;
          }}
        >
          <View style={styles.productHeading}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.textPrimary },
                ]}
              >
                {categoryId
                  ? selectedName
                  : query.trim()
                  ? 'Search results'
                  : 'Discover your next favourite'}
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {displayedProducts.length}{' '}
                {displayedProducts.length === 1 ? 'find' : 'finds'} to explore
              </Text>
            </View>
          </View>
          <View style={styles.filterRow}>
            <PressableScale
              accessibilityLabel="Products under ₹999"
              accessibilityState={{ selected: budgetOnly }}
              onPress={() => setBudgetOnly(value => !value)}
              style={[
                styles.filterChip,
                {
                  borderColor: budgetOnly
                    ? theme.colors.primary
                    : theme.colors.borderSoft,
                  backgroundColor: budgetOnly
                    ? theme.colors.primarySoft
                    : theme.colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: budgetOnly
                      ? theme.colors.primary
                      : theme.colors.textPrimary,
                  },
                ]}
              >
                Under ₹999
              </Text>
            </PressableScale>
            <PressableScale
              accessibilityLabel={`Sort products: ${
                sort === 'low'
                  ? 'price low to high'
                  : sort === 'high'
                  ? 'price high to low'
                  : 'featured'
              }`}
              onPress={() =>
                setSort(value =>
                  value === 'featured'
                    ? 'low'
                    : value === 'low'
                    ? 'high'
                    : 'featured',
                )
              }
              style={[
                styles.filterChip,
                {
                  borderColor: theme.colors.borderSoft,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <AppIcon name="arrow-up" size={14} color={theme.colors.primary} />
              <Text
                style={[styles.filterText, { color: theme.colors.textPrimary }]}
              >
                {sort === 'low'
                  ? 'Price: low to high'
                  : sort === 'high'
                  ? 'Price: high to low'
                  : 'Sort: featured'}
              </Text>
            </PressableScale>
          </View>
          {isApiEnabled && categoryFilter.status === 'loading' ? (
            <View style={styles.categoryState}>
              <Text style={{ color: theme.colors.textSecondary }}>
                Finding the selected category…
              </Text>
            </View>
          ) : isApiEnabled && categoryFilter.status === 'unavailable' ? (
            <EmptyState
              icon="shopping-bag"
              title="Category unavailable"
              description="This category is no longer available or cannot be matched uniquely. Choose a category above or browse all products."
              actionLabel="Show all products"
              onAction={resetFilters}
            />
          ) : isLoading && isApiEnabled ? (
            <View style={styles.categoryState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : error && isApiEnabled ? (
            <EmptyState
              icon="alert"
              title="Error loading products"
              description={(error as Error).message}
              actionLabel="Try again"
              onAction={() => refetchProducts()}
            />
          ) : displayedProducts.length === 0 ? (
            <EmptyState
              icon="shopping-bag"
              title="No products"
              description={
                query.trim() || budgetOnly
                  ? 'Try a different search or clear your filters.'
                  : 'New finds are on their way. Pull down to refresh.'
              }
              actionLabel="Clear filters"
              onAction={resetFilters}
            />
          ) : (
            <View style={styles.productGrid}>
              {displayedProducts.map(product => (
                <View
                  key={product.id}
                  style={[
                    styles.productCell,
                    { width: `${100 / productColumns}%` },
                  ]}
                >
                  <ShopProductCard
                    product={product}
                    onPress={() =>
                      navigation.navigate('ProductDetail', {
                        productId: product.id,
                      })
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={styles.footer}>
          <AppIcon
            name="shopping-bag"
            size={18}
            color={theme.colors.textTertiary}
          />
          <Text
            style={[styles.footerText, { color: theme.colors.textTertiary }]}
          >
            A little more for your everyday.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function mapApiProductToCard(apiProduct: any): any {
  return {
    id: apiProduct.id,
    name: apiProduct.name,
    description: apiProduct.description || '',
    price: apiProduct.price / 100,
    compareAtPrice: apiProduct.compareAtPrice
      ? apiProduct.compareAtPrice / 100
      : undefined,
    inventory: apiProduct.inventory,
    seller: apiProduct.publisher?.displayName ?? 'Knock Shop',
    imageUrl:
      apiProduct.images?.find((image: any) => image.kind !== 'video')?.url ??
      apiProduct.images?.[0]?.thumbnailUrl,
    isTestProduct: apiProduct.metadata?.isTestProduct === true,
    isProperty: false,
  };
}

const styles = StyleSheet.create({
  screenContent: { flex: 1, paddingBottom: 0 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBrand: { flex: 1 },
  headerAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchBand: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  scroll: { flex: 1 },
  categorySection: { paddingTop: 10, paddingBottom: 4 },
  categoryRow: { paddingHorizontal: 12, alignItems: 'flex-start' },
  catCell: { padding: 4, position: 'relative', alignItems: 'center' },
  catTile: { alignItems: 'center', gap: 7, width: '100%' },
  allCategory: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  categoryCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryImage: { width: 56, height: 56, borderRadius: 28 },
  categoryState: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  categoryLabel: {
    alignSelf: 'stretch',
    minHeight: 34,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  clearFilter: {
    position: 'absolute',
    top: 1,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  collection: {
    marginHorizontal: 16,
    minHeight: 206,
    borderRadius: 22,
    backgroundColor: '#DFEBFF',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  collectionOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#CADDFD',
    right: -70,
    top: -50,
  },
  collectionCopy: { width: '62%', padding: 18, zIndex: 1 },
  collectionEyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    marginBottom: 10,
  },
  collectionEyebrowText: {
    color: '#0047AB',
    fontSize: 8,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  collectionTitle: {
    color: '#102A56',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  collectionSubtitle: {
    color: '#48628D',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  collectionImage: {
    position: 'absolute',
    right: -3,
    bottom: 22,
    overflow: 'hidden',
  },
  collectionCta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0047AB',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 9,
    marginTop: 14,
  },
  collectionCtaText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  inset: { paddingHorizontal: 16 },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sellerInfo: { flex: 1, minWidth: 0 },
  checkoutBtn: { minHeight: 44, paddingHorizontal: 14, flexShrink: 0 },
  productHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.4,
    fontWeight: '800',
  },
  sectionSubtitle: { fontSize: 11, marginTop: 4 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
  },
  filterText: { fontSize: 11, fontWeight: '600' },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    alignItems: 'stretch',
  },
  productCell: { padding: 5 },
  footer: { paddingVertical: 16, alignItems: 'center', gap: 7 },
  footerText: { fontSize: 11 },
});
