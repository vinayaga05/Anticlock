import type { AssistantResultCard } from '@anticlock/contracts';
import { algoliasearch } from 'algoliasearch';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

function algoliaClient() {
  const appId = process.env.ALGOLIA_APP_ID?.trim();
  const apiKey = process.env.ALGOLIA_API_KEY?.trim();
  if (!appId || !apiKey) return null;
  return algoliasearch(appId, apiKey);
}

export class SearchService {
  async searchUsers(query: string, limit = 5): Promise<AssistantResultCard[]> {
    const rows = await db.execute<{
      id: string;
      display_name: string;
      avatar_url: string | null;
    }>(sql`
      SELECT id, display_name, avatar_url
      FROM mobile_users
      WHERE search_vector @@ plainto_tsquery('english', ${query})
        AND is_active = true
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC
      LIMIT ${limit}
    `);

    return rows.map(r => ({
      id: r.id,
      type: 'user' as const,
      title: r.display_name,
      imageUrl: r.avatar_url ?? undefined,
      metadata: { userId: r.id },
    }));
  }

  async searchReels(query: string, limit = 5): Promise<AssistantResultCard[]> {
    const client = algoliaClient();
    const indexName = process.env.ALGOLIA_REELS_INDEX?.trim() ?? 'anticlock_reels';

    if (client) {
      try {
        const result = await client.searchSingleIndex({
          indexName,
          searchParams: { query, hitsPerPage: limit },
        });
        return result.hits.map((hit, i) => {
          const h = hit as Record<string, unknown>;
          return {
            id: String(h.objectID ?? h.id ?? i),
            type: 'reel' as const,
            title: String(h.title ?? 'Reel'),
            subtitle: h.caption ? String(h.caption) : undefined,
            imageUrl: h.thumbnailUrl ? String(h.thumbnailUrl) : undefined,
            metadata: { reelId: String(h.objectID ?? h.id) },
          };
        });
      } catch {
        /* fall through to PG */
      }
    }

    const rows = await db.execute<{
      id: string;
      title: string;
      caption: string | null;
      creator_name: string;
    }>(sql`
      SELECT id, title, caption, creator_name
      FROM reels
      WHERE status = 'published'
        AND moderation_status = 'clear'
        AND search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC,
               published_at DESC NULLS LAST
      LIMIT ${limit}
    `);

    return rows.map(r => ({
      id: r.id,
      type: 'reel' as const,
      title: r.title,
      subtitle: r.caption ?? r.creator_name,
      metadata: { reelId: r.id },
    }));
  }

  async searchPosts(query: string, limit = 5): Promise<AssistantResultCard[]> {
    const reels = await this.searchReels(query, limit);
    return reels.map(r => ({ ...r, type: 'post' as const }));
  }

  async searchCatalog(query: string, limit = 10): Promise<AssistantResultCard[]> {
    const trees = await db.execute<{
      id: string;
      name: string;
      description: string | null;
    }>(sql`
      SELECT id, name, description
      FROM service_trees
      WHERE status = 'published'
        AND search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC
      LIMIT ${Math.ceil(limit / 2)}
    `);

    const categories = await db.execute<{
      id: string;
      tree_id: string;
      name: string;
      description: string | null;
    }>(sql`
      SELECT id, tree_id, name, description
      FROM service_categories
      WHERE status = 'published'
        AND search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC
      LIMIT ${Math.ceil(limit / 2)}
    `);

    const treeCards: AssistantResultCard[] = trees.map(t => ({
      id: t.id,
      type: 'catalog',
      title: t.name,
      subtitle: t.description ?? undefined,
      metadata: { treeId: t.id, kind: 'tree' },
    }));

    const categoryCards: AssistantResultCard[] = categories.map(c => ({
      id: c.id,
      type: 'catalog',
      title: c.name,
      subtitle: c.description ?? undefined,
      metadata: { treeId: c.tree_id, categoryId: c.id, kind: 'category' },
    }));

    return [...treeCards, ...categoryCards].slice(0, limit);
  }

  async indexReel(reel: {
    id: string;
    title: string;
    caption?: string | null;
    category?: string | null;
    creatorName?: string;
    thumbnailUrl?: string | null;
    status?: string;
  }) {
    const client = algoliaClient();
    if (!client || reel.status !== 'published') return;
    const indexName = process.env.ALGOLIA_REELS_INDEX?.trim() ?? 'anticlock_reels';
    await client.saveObject({
      indexName,
      body: {
        objectID: reel.id,
        title: reel.title,
        caption: reel.caption ?? '',
        category: reel.category ?? '',
        creatorName: reel.creatorName ?? '',
        thumbnailUrl: reel.thumbnailUrl ?? '',
      },
    });
  }

  async removeReelFromIndex(reelId: string) {
    const client = algoliaClient();
    if (!client) return;
    const indexName = process.env.ALGOLIA_REELS_INDEX?.trim() ?? 'anticlock_reels';
    await client.deleteObject({ indexName, objectID: reelId });
  }
}

export const searchService = new SearchService();
