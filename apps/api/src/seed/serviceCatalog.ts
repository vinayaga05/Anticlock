import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { serviceCategories, serviceTrees } from '../db/schema.js';
import catalog from './catalog.json' with { type: 'json' };

type CatalogCategory = {
  id: string;
  treeId: string;
  name: string;
  sortOrder: number;
  parentId?: string | null;
  actionType?: string;
};

export async function syncServiceCatalog(options?: { onlyIfMissingTree: string }) {
  await db.transaction(async tx => {
    // Serialize seed and migration runs so a failed update cannot leave a partial catalog.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('knock-service-catalog'))`);
    if (options) {
      const [existing] = await tx
        .select({ id: serviceTrees.id })
        .from(serviceTrees)
        .where(eq(serviceTrees.id, options.onlyIfMissingTree));
      if (existing) return;
    }

    for (const tree of catalog.trees) {
      const fields = {
        name: tree.name,
        description: tree.description ?? null,
        icon: tree.icon ?? null,
        accentColor: tree.accentColor ?? null,
        sortOrder: tree.sortOrder,
      };
      await tx
        .insert(serviceTrees)
        .values({ id: tree.id, slug: tree.id, ...fields })
        .onConflictDoUpdate({
          target: serviceTrees.id,
          set: { ...fields, updatedAt: new Date() },
        });
    }

    for (const category of catalog.categories as CatalogCategory[]) {
      const { id, ...fields } = category;
      await tx
        .insert(serviceCategories)
        .values({ id, ...fields })
        .onConflictDoUpdate({
          target: serviceCategories.id,
          set: { ...fields, updatedAt: new Date() },
        });
    }
  });
}
