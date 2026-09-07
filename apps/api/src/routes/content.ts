import { and, desc, eq, gt, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  ContentFormatSchema,
  CompleteUploadRequestSchema,
  CreateContentContainerRequestSchema,
  CreateContentUploadRequestSchema,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  contentClusterDeliveries,
  contentContainers,
  contentPostDeliveries,
  contentPosts,
  mobileUsers,
  providers,
} from '../db/schema.js';
import { mediaService } from '../media/MediaService.js';
import { getBlockedProfileIds } from '../blocks/BlockService.js';
import { requireAuth, type AppEnv } from '../middleware/auth.js';
import {
  listPublishingIdentities,
  resolvePublishingContext,
} from '../publishing/PublishingContextService.js';

function errorResponse(error: unknown) {
  const err = error as { status?: number; code?: string; message?: string };
  return {
    status: (err.status ?? 500) as 400 | 403 | 404 | 500,
    body: { error: { code: err.code ?? 'error', message: err.message ?? 'Unexpected error' } },
  };
}

function requestContext(c: { req: { header: (name: string) => string | undefined } }) {
  return {
    type: c.req.header('x-anticlock-context-type'),
    id: c.req.header('x-anticlock-context-id'),
  };
}

function requireMobile(auth: { kind: string; sub: string }) {
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('Mobile session required'), {
      code: 'forbidden',
      status: 403,
    });
  }
  return auth.sub;
}

export const contentMobileRoutes = new Hono<AppEnv>();
contentMobileRoutes.use('/identities', requireAuth);
contentMobileRoutes.use('/uploads', requireAuth);
contentMobileRoutes.use('/uploads/*', requireAuth);
contentMobileRoutes.use('/containers', requireAuth);
contentMobileRoutes.use('/containers/*', requireAuth);

contentMobileRoutes.get('/identities', async c => {
  try {
    return c.json({ identities: await listPublishingIdentities(c.get('auth')) });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/** Mobile-owned upload sessions, separate from the admin Media Library. */
contentMobileRoutes.post('/uploads', async c => {
  try {
    const auth = c.get('auth');
    const mobileUserId = requireMobile(auth);
    const body = CreateContentUploadRequestSchema.parse(await c.req.json());
    const identity = await resolvePublishingContext(auth, requestContext(c));
    const upload = await mediaService.createMobileContentUploadSession(mobileUserId, body);
    return c.json({ upload, identity }, 201);
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.put('/uploads/:sessionId/content', async c => {
  try {
    await mediaService.putMobileContentLocalContent(
      requireMobile(c.get('auth')),
      c.req.param('sessionId'),
      Buffer.from(await c.req.arrayBuffer()),
    );
    return c.json({ ok: true });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.post('/uploads/:sessionId/complete', async c => {
  try {
    const body = CompleteUploadRequestSchema.parse(await c.req.json().catch(() => ({})));
    const result = await mediaService.completeMobileContentUpload(
      requireMobile(c.get('auth')),
      c.req.param('sessionId'),
      body.checksumSha256,
    );
    return c.json({ asset: result.asset, duplicateOf: result.duplicateOf ?? null });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.post('/containers', async c => {
  try {
    const auth = c.get('auth');
    const mobileUserId = requireMobile(auth);
    const body = CreateContentContainerRequestSchema.parse(await c.req.json());
    const actor = await resolvePublishingContext(auth, requestContext(c));
    const mediaIds = [...new Set(body.mediaIds)];
    const { assets } = await mediaService.requireMobileContentAssets(
      mobileUserId,
      mediaIds,
      body.thumbnailMediaId,
      body.visibility,
    );
    if (body.format === 'clip' && (assets.length !== 1 || assets[0]?.kind !== 'video')) {
      throw Object.assign(new Error('A Clip needs exactly one ready video'), {
        code: 'invalid_clip_media',
        status: 400,
      });
    }
    const [container] = await db
      .insert(contentContainers)
      .values({
        createdByMobileUserId: mobileUserId,
        authorMobileUserId: actor.type === 'user' ? actor.id : null,
        authorProviderId: actor.type === 'provider' ? actor.id : null,
        format: body.format,
        mediaType: body.mediaType,
        caption: body.caption,
        mediaIds,
        thumbnailMediaId: body.thumbnailMediaId ?? null,
        hashtags: [...new Set(body.hashtags)],
        taggedMobileUserIds: [...new Set(body.taggedUserIds)],
        location: body.location ?? null,
        visibility: body.visibility,
        status: 'ready_to_publish',
      })
      .returning();
    return c.json({
      container: {
        id: container!.id,
        status: container!.status,
        format: container!.format,
        author: actor,
        createdAt: container!.createdAt.toISOString(),
      },
    }, 201);
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.post('/containers/:id/publish', async c => {
  try {
    const auth = c.get('auth');
    const mobileUserId = requireMobile(auth);
    const actor = await resolvePublishingContext(auth, requestContext(c));
    const [container] = await db
      .select()
      .from(contentContainers)
      .where(and(eq(contentContainers.id, c.req.param('id')), eq(contentContainers.createdByMobileUserId, mobileUserId)))
      .limit(1);
    if (!container) throw Object.assign(new Error('Content container not found'), { code: 'not_found', status: 404 });
    if (container.status !== 'ready_to_publish') throw Object.assign(new Error('Content is not ready to publish'), { code: 'invalid_status', status: 400 });
    if ((actor.type === 'user' ? container.authorMobileUserId !== actor.id : container.authorProviderId !== actor.id)) {
      throw Object.assign(new Error('Publishing identity does not match this container'), { code: 'forbidden', status: 403 });
    }
    // Recheck asset ownership/readiness at publish time; an archived or
    // moderated asset must not be smuggled through an old draft.
    const { assets } = await mediaService.requireMobileContentAssets(
      mobileUserId,
      container.mediaIds,
      container.thumbnailMediaId,
      container.visibility,
    );
    if (container.format === 'clip' && (assets.length !== 1 || assets[0]?.kind !== 'video')) {
      throw Object.assign(new Error('A Clip needs exactly one ready video'), {
        code: 'invalid_clip_media',
        status: 400,
      });
    }
    const now = new Date();
    const expiresAt = container.format === 'story' ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : null;
    const firstVideo = assets.find(asset => asset.kind === 'video');
    const duplicateClusterId = firstVideo?.checksumSha256 ?? firstVideo?.id ?? container.id;
    const [post] = await db.insert(contentPosts).values({
      containerId: container.id,
      createdByMobileUserId: mobileUserId,
      authorMobileUserId: container.authorMobileUserId,
      authorProviderId: container.authorProviderId,
      format: container.format,
      mediaType: container.mediaType,
      caption: container.caption,
      mediaIds: container.mediaIds,
      thumbnailMediaId: container.thumbnailMediaId,
      hashtags: container.hashtags,
      taggedMobileUserIds: container.taggedMobileUserIds,
      location: container.location,
      duplicateClusterId,
      visibility: container.visibility,
      status: 'published',
      expiresAt,
      publishedAt: now,
    }).returning();
    await db.update(contentContainers).set({ status: 'published', publishedAt: now }).where(eq(contentContainers.id, container.id));
    return c.json({ post: { id: post!.id, format: post!.format, expiresAt: post!.expiresAt?.toISOString() ?? null } }, 201);
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/**
 * Authenticated Clips feed. It claims both a post (90 days) and its exact
 * media cluster (7 days) in one transaction, so refreshes and concurrent
 * devices cannot surface repeated videos or duplicate uploads to one viewer.
 */
contentMobileRoutes.get('/feeds/clip', requireAuth, async c => {
  try {
    const mobileUserId = requireMobile(c.get('auth'));
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 12) || 12, 1), 30);
    const now = new Date();
    const posts = await db
      .select()
      .from(contentPosts)
      .where(
        and(
          eq(contentPosts.format, 'clip'),
          eq(contentPosts.mediaType, 'video'),
          eq(contentPosts.status, 'published'),
          eq(contentPosts.visibility, 'public'),
        ),
      )
      .orderBy(desc(contentPosts.likeCount), desc(contentPosts.viewCount), desc(contentPosts.publishedAt))
      .limit(120);
    const blocked = await getBlockedProfileIds(mobileUserId);
    const candidates = posts.filter(post =>
      post.authorProviderId
        ? !blocked.providerIds.has(post.authorProviderId)
        : post.authorMobileUserId
          ? !blocked.mobileUserIds.has(post.authorMobileUserId)
          : false,
    );
    const postExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const clusterExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const selected = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${mobileUserId}))`);
      await tx.delete(contentPostDeliveries).where(
        and(eq(contentPostDeliveries.mobileUserId, mobileUserId), lte(contentPostDeliveries.expiresAt, now)),
      );
      await tx.delete(contentClusterDeliveries).where(
        and(eq(contentClusterDeliveries.mobileUserId, mobileUserId), lte(contentClusterDeliveries.expiresAt, now)),
      );
      const [postClaims, clusterClaims] = await Promise.all([
        tx.select({ id: contentPostDeliveries.contentPostId }).from(contentPostDeliveries).where(
          and(eq(contentPostDeliveries.mobileUserId, mobileUserId), gt(contentPostDeliveries.expiresAt, now)),
        ),
        tx.select({ id: contentClusterDeliveries.duplicateClusterId }).from(contentClusterDeliveries).where(
          and(eq(contentClusterDeliveries.mobileUserId, mobileUserId), gt(contentClusterDeliveries.expiresAt, now)),
        ),
      ]);
      const deliveredPosts = new Set(postClaims.map(claim => claim.id));
      const deliveredClusters = new Set(clusterClaims.map(claim => claim.id));
      const claimed = [] as typeof candidates;
      for (const post of candidates) {
        if (claimed.length >= limit || deliveredPosts.has(post.id) || deliveredClusters.has(post.duplicateClusterId)) continue;
        const [postClaim] = await tx.insert(contentPostDeliveries).values({
          mobileUserId,
          contentPostId: post.id,
          expiresAt: postExpiresAt,
        }).onConflictDoNothing().returning({ id: contentPostDeliveries.contentPostId });
        if (!postClaim) continue;
        const [clusterClaim] = await tx.insert(contentClusterDeliveries).values({
          mobileUserId,
          duplicateClusterId: post.duplicateClusterId,
          expiresAt: clusterExpiresAt,
        }).onConflictDoNothing().returning({ id: contentClusterDeliveries.duplicateClusterId });
        if (!clusterClaim) {
          // Do not leave a 90-day phantom post claim after its cluster lost a race.
          await tx.delete(contentPostDeliveries).where(
            and(eq(contentPostDeliveries.mobileUserId, mobileUserId), eq(contentPostDeliveries.contentPostId, post.id)),
          );
          continue;
        }
        deliveredPosts.add(post.id);
        deliveredClusters.add(post.duplicateClusterId);
        claimed.push(post);
      }
      return claimed;
    });
    const items = (await Promise.all(selected.map(async post => {
      const playbackUrl = post.mediaIds[0]
        ? await mediaService.getPublicContentDeliveryUrl(post.mediaIds[0])
        : null;
      if (!playbackUrl) return null;
      const posterUrl = post.thumbnailMediaId
        ? await mediaService.getPublicContentDeliveryUrl(post.thumbnailMediaId)
        : null;
      if (post.authorProviderId) {
        const [provider] = await db.select().from(providers).where(eq(providers.id, post.authorProviderId)).limit(1);
        if (!provider) return null;
        return { ...post, playbackUrl, posterUrl, author: { type: 'provider', id: provider.id, name: provider.name, avatarUrl: null } };
      }
      const [user] = await db.select().from(mobileUsers).where(eq(mobileUsers.id, post.authorMobileUserId!)).limit(1);
      if (!user) return null;
      return { ...post, playbackUrl, posterUrl, author: { type: 'user', id: user.id, name: user.displayName, avatarUrl: user.avatarUrl } };
    }))).filter(Boolean);
    return c.json({ items, nextCursor: null });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

export const contentPublicRoutes = new Hono<AppEnv>();
contentPublicRoutes.get('/feeds/:format', async c => {
  const parsed = ContentFormatSchema.safeParse(c.req.param('format'));
  if (!parsed.success) return c.json({ error: { code: 'validation_error', message: 'Unknown feed format' } }, 400);
  const now = new Date();
  const rows = await db.select().from(contentPosts).where(
    and(
      eq(contentPosts.format, parsed.data),
      eq(contentPosts.status, 'published'),
      // This endpoint has no viewer identity, so it must never reveal content
      // intended for followers, friends, or a community.
      eq(contentPosts.visibility, 'public'),
      parsed.data === 'story' ? gt(contentPosts.expiresAt, now) : undefined,
    ),
  ).orderBy(desc(contentPosts.publishedAt)).limit(50);
  const items = await Promise.all(rows.map(async post => {
    if (post.authorProviderId) {
      const [provider] = await db.select().from(providers).where(eq(providers.id, post.authorProviderId)).limit(1);
      return { ...post, author: { type: 'provider', id: post.authorProviderId, name: provider?.name ?? 'Business', avatarUrl: null } };
    }
    const [user] = await db.select().from(mobileUsers).where(eq(mobileUsers.id, post.authorMobileUserId!)).limit(1);
    return { ...post, author: { type: 'user', id: post.authorMobileUserId, name: user?.displayName ?? 'User', avatarUrl: user?.avatarUrl ?? null } };
  }));
  return c.json({ items });
});
