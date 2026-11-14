/** Pure association rules shared by every serialized mobile Clip surface. */
export type BusinessClipPost = {
  id: string;
  format: string;
  mediaType: string;
  authorProviderId: string | null;
  mediaIds: string[];
};

/** Only approved, published, public product/video links enter this resolver. */
export type EligibleClipProductLink = {
  productId: string;
  providerId: string | null;
  mediaId: string;
};

export type BusinessClipCta = {
  entityType: 'provider' | 'product';
  entityId: string;
  ctaLabel: 'Book' | 'Buy';
};

export function resolveBusinessClipCtas(
  posts: BusinessClipPost[],
  links: EligibleClipProductLink[],
): Map<string, BusinessClipCta | null> {
  const productsByVideo = new Map<string, Set<string>>();
  for (const link of links) {
    if (!link.providerId) continue;
    const key = `${link.providerId}:${link.mediaId}`;
    const products = productsByVideo.get(key) ?? new Set<string>();
    products.add(link.productId);
    productsByVideo.set(key, products);
  }
  return new Map(posts.map(post => {
    if (post.format !== 'clip' || post.mediaType !== 'video' || !post.authorProviderId) return [post.id, null];
    const productIds = new Set(post.mediaIds.flatMap(mediaId => [...(productsByVideo.get(`${post.authorProviderId}:${mediaId}`) ?? [])]));
    // A shared video cannot identify one product when multiple listings use it.
    const productId = productIds.size === 1 ? [...productIds][0] : null;
    return [post.id, productId
      ? { entityType: 'product', entityId: productId, ctaLabel: 'Buy' }
      : { entityType: 'provider', entityId: post.authorProviderId, ctaLabel: 'Book' }];
  }));
}
