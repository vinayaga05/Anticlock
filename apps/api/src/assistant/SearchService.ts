import type { AssistantResultCard } from '@anticlock/contracts';
import { algoliasearch } from 'algoliasearch';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

export type GroundedCatalogSource = {
  sourceType: 'service_tree' | 'service_category';
  sourceId: string;
  title: string;
  excerpt?: string;
  metadata: Record<string, string>;
};

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

  /**
   * Retrieves published catalog facts in a model-friendly format. The source
   * IDs are deliberately retained so a trace can explain which first-party
   * data supported a response without saving raw conversation text.
   */
  async searchCatalogGrounding(
    query: string,
    limit = 10,
  ): Promise<GroundedCatalogSource[]> {
    const safeLimit = Math.max(1, Math.min(limit, 20));
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
      LIMIT ${Math.ceil(safeLimit / 2)}
    `);

    const categories = await db.execute<{
      id: string;
      tree_id: string;
      name: string;
      description: string | null;
      parent_id: string | null;
      action_type: string | null;
      tree_name: string;
    }>(sql`
      SELECT c.id, c.tree_id, c.name, c.description, c.parent_id, c.action_type,
             t.name AS tree_name
      FROM service_categories c
      JOIN service_trees t ON t.id = c.tree_id
      WHERE c.status = 'published' AND t.status = 'published'
        AND c.search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY ts_rank(c.search_vector, plainto_tsquery('english', ${query})) DESC
      LIMIT ${Math.ceil(safeLimit / 2)}
    `);

    return [
      ...trees.map(t => ({
        sourceType: 'service_tree' as const,
        sourceId: t.id,
        title: t.name,
        excerpt: t.description ?? undefined,
        metadata: { treeId: t.id },
      })),
      ...categories.map(c => ({
        sourceType: 'service_category' as const,
        sourceId: c.id,
        title: c.name,
        excerpt: c.description ?? undefined,
        metadata: {
          treeId: c.tree_id,
          treeName: c.tree_name,
          ...(c.parent_id ? { parentId: c.parent_id } : {}),
          ...(c.action_type ? { actionType: c.action_type } : {}),
        },
      })),
    ].slice(0, safeLimit);
  }

  async searchCatalog(query: string, limit = 10): Promise<AssistantResultCard[]> {
    const sources = await this.searchCatalogGrounding(query, limit);

    return sources.map(source => ({
      id: source.sourceId,
      type: 'catalog' as const,
      title: source.title,
      subtitle: source.excerpt,
      metadata:
        source.sourceType === 'service_tree'
          ? { treeId: source.metadata.treeId, kind: 'tree' }
          : {
              treeId: source.metadata.treeId,
              categoryId: source.sourceId,
              kind: 'category',
            },
    }));
  }

  /**
   * Resolve a free-text service query to the best matching published category
   * (and optionally tree). Uses FTS + simple alias/name fallbacks.
   */
  async resolveServiceCategory(query: string): Promise<{
    treeId: string;
    categoryId: string;
    name: string;
    treeName: string;
  } | null> {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return null;

    const byName = await db.execute<{
      id: string;
      tree_id: string;
      name: string;
      tree_name: string;
    }>(sql`
      SELECT c.id, c.tree_id, c.name, t.name AS tree_name
      FROM service_categories c
      JOIN service_trees t ON t.id = c.tree_id
      WHERE c.status = 'published' AND t.status = 'published'
        AND (
          lower(c.name) = ${normalized}
          OR lower(c.id) = ${normalized}
          OR lower(c.name) LIKE ${`%${normalized}%`}
          OR c.search_vector @@ plainto_tsquery('english', ${query})
        )
      ORDER BY
        CASE WHEN lower(c.name) = ${normalized} THEN 0
             WHEN lower(c.id) = ${normalized} THEN 1
             ELSE 2 END,
        ts_rank(c.search_vector, plainto_tsquery('english', ${query})) DESC NULLS LAST
      LIMIT 1
    `);

    const row = byName[0];
    if (!row) return null;
    return {
      treeId: row.tree_id,
      categoryId: row.id,
      name: row.name,
      treeName: row.tree_name,
    };
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
