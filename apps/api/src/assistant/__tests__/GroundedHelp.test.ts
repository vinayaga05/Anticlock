import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getProductHelp } from '../tools/index.js';
import { searchService } from '../SearchService.js';

describe('grounded Genie help', () => {
  it('returns first-party catalog facts to the next model turn', async () => {
    const original = searchService.searchCatalogGrounding;
    searchService.searchCatalogGrounding = async () => [
      {
        sourceType: 'service_category',
        sourceId: 'fitness.yoga',
        title: 'Yoga',
        excerpt: 'Browse yoga providers and classes.',
        metadata: { treeId: 'fitness', treeName: 'Fitness' },
      },
    ];

    try {
      const result = await getProductHelp(
        { query: 'yoga', limit: 5 },
        {
          auth: {
            sub: 'user-1',
            email: 'test@example.com',
            name: 'Test',
            roles: [],
            permissions: [],
            kind: 'mobile',
          },
          conversationId: 'conversation-1',
          recentResults: [],
        },
      );

      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.deepEqual(result.data, {
        query: 'yoga',
        sourceCount: 1,
        sources: [
          {
            sourceType: 'service_category',
            sourceId: 'fitness.yoga',
            title: 'Yoga',
            excerpt: 'Browse yoga providers and classes.',
            metadata: { treeId: 'fitness', treeName: 'Fitness' },
          },
        ],
      });
      assert.equal(result.cards?.[0]?.metadata?.categoryId, 'fitness.yoga');
    } finally {
      searchService.searchCatalogGrounding = original;
    }
  });

  it('does not invent generic help when no verified source is available', async () => {
    const original = searchService.searchCatalogGrounding;
    searchService.searchCatalogGrounding = async () => [];

    try {
      const result = await getProductHelp(
        { query: 'unpublished thing' },
        {
          auth: {
            sub: 'user-1',
            email: 'test@example.com',
            name: 'Test',
            roles: [],
            permissions: [],
            kind: 'mobile',
          },
          conversationId: 'conversation-1',
          recentResults: [],
        },
      );

      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.resultOutcome, 'no_results');
      assert.match(result.resultMessage ?? '', /verified Knock information/);
      assert.deepEqual(result.data, {
        query: 'unpublished thing',
        sourceCount: 0,
        sources: [],
      });
    } finally {
      searchService.searchCatalogGrounding = original;
    }
  });
});
