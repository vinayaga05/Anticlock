/** Keep category labels readable on narrow screens and with larger text. */
export function getShopCategoryColumns(
  contentWidth: number,
  fontScale = 1,
): 2 | 3 {
  return contentWidth < 300 || fontScale > 1.2 ? 2 : 3;
}

type ShopArtworkKey =
  | 'ecom.sports'
  | 'ecom.health'
  | 'ecom.fitness'
  | 'ecom.beauty'
  | 'ecom.garments'
  | 'ecom.property'
  | 'ecom.kitchen'
  | 'ecom.games'
  | 'ecom.electronics';

export type ShopCategory = {
  id: string;
  name: string;
  artworkKey?: ShopArtworkKey;
  imageUrl?: string;
};

const categoryArtwork: Record<string, ShopArtworkKey> = {
  sports: 'ecom.sports',
  sportinggoods: 'ecom.sports',
  sportsequipment: 'ecom.sports',
  health: 'ecom.health',
  supplements: 'ecom.health',
  healthsupplements: 'ecom.health',
  nutrition: 'ecom.health',
  wellness: 'ecom.health',
  fitness: 'ecom.fitness',
  fitnessequipment: 'ecom.fitness',
  gymequipment: 'ecom.fitness',
  beauty: 'ecom.beauty',
  beautyspa: 'ecom.beauty',
  beautyandspa: 'ecom.beauty',
  beautyandpersonalcare: 'ecom.beauty',
  garments: 'ecom.garments',
  clothing: 'ecom.garments',
  apparel: 'ecom.garments',
  fashion: 'ecom.garments',
  property: 'ecom.property',
  landproperty: 'ecom.property',
  landandproperty: 'ecom.property',
  landandproperties: 'ecom.property',
  realestate: 'ecom.property',
  kitchen: 'ecom.kitchen',
  kitchenappliances: 'ecom.kitchen',
  homeandkitchen: 'ecom.kitchen',
  games: 'ecom.games',
  toys: 'ecom.games',
  gamesandtoys: 'ecom.games',
  gamestoys: 'ecom.games',
  electronics: 'ecom.electronics',
  gadgets: 'ecom.electronics',
  electronicsandgadgets: 'ecom.electronics',
  electronicsgadgets: 'ecom.electronics',
};

export function getShopCategoryArtworkKey(
  value: string,
): ShopArtworkKey | undefined {
  const normalized = value
    .toLowerCase()
    .replace(/^ecom[.\s_-]+/, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
  return categoryArtwork[normalized];
}

export function isShopCategoryUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function getPublishedShopCategories(
  categories: readonly {
    id: string;
    name: string;
    slug: string;
    status: string;
    imageUrl?: string;
  }[],
): ShopCategory[] {
  return categories
    .filter(
      category =>
        category.status === 'published' && isShopCategoryUuid(category.id),
    )
    .map(category => ({
      id: category.id,
      name: category.name,
      artworkKey:
        getShopCategoryArtworkKey(category.slug) ??
        getShopCategoryArtworkKey(category.name),
      imageUrl: category.imageUrl,
    }));
}

export function resolveShopCategoryFilter(
  selectedId: string | null,
  categories: readonly ShopCategory[],
  categoriesLoading: boolean,
):
  | { status: 'all' | 'loading' | 'unavailable'; categoryId?: undefined }
  | { status: 'selected'; categoryId: string } {
  if (!selectedId) return { status: 'all' };
  if (isShopCategoryUuid(selectedId))
    return { status: 'selected', categoryId: selectedId };
  if (categoriesLoading) return { status: 'loading' };
  const artworkKey = getShopCategoryArtworkKey(selectedId);
  const matches = artworkKey
    ? categories.filter(
        category =>
          category.artworkKey === artworkKey && isShopCategoryUuid(category.id),
      )
    : [];
  return matches.length === 1
    ? { status: 'selected', categoryId: matches[0].id }
    : { status: 'unavailable' };
}
