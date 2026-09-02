import 'dotenv/config';
import { sql } from '../db/client.js';
import { searchService } from '../assistant/SearchService.js';

async function backfillAlgoliaReels() {
  const reels = await sql`
    SELECT r.id, r.title, r.caption, r.category, r.creator_name, m.thumbnail_url
    FROM reels r
    LEFT JOIN media_assets m ON m.id = r.thumbnail_media_id
    WHERE r.status = 'published' AND r.moderation_status = 'clear'
  ` as Array<{
    id: string;
    title: string;
    caption: string | null;
    category: string | null;
    creator_name: string;
    thumbnail_url: string | null;
  }>;

  let indexed = 0;
  for (const reel of reels) {
    await searchService.indexReel({
      id: reel.id,
      title: reel.title,
      caption: reel.caption,
      category: reel.category,
      creatorName: reel.creator_name,
      thumbnailUrl: reel.thumbnail_url,
      status: 'published',
    });
    indexed += 1;
  }

  console.log(`Indexed ${indexed} reels to Algolia`);
  await sql.end({ timeout: 5 });
}

backfillAlgoliaReels().catch(err => {
  console.error(err);
  process.exit(1);
});
