import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import {
  PermissionSchema,
  ROLE_PERMISSIONS,
  RoleSchema,
} from '@anticlock/contracts';
import { db, sql } from '../db/client.js';
import {
  permissions,
  rolePermissions,
  roles,
  serviceCategories,
  serviceTrees,
  stubBanners,
  stubProducts,
  stubProviders,
  providerFormSchemas,
  userRoles,
  users,
  mediaAssets,
  reels,
  communities,
  communityMembers,
  mobileUsers,
} from '../db/schema.js';
import catalog from './catalog.json' with { type: 'json' };
import {
  CATEGORY_PROVIDER_FORM_SCHEMAS,
  GLOBAL_PROVIDER_FORM_SCHEMA,
} from './providerFormSchemas.js';

const isProduction = process.env.NODE_ENV === 'production';

function enabled(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes';
}

function initialAdminCredentials() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!isProduction) {
    return {
      email: email || 'admin@anticlock.app',
      password: password || 'admin123',
    };
  }

  if (!email && !password) return null;
  if (!email || !password) {
    throw new Error(
      'INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required when creating the first production admin',
    );
  }
  if (password.length < 8) {
    throw new Error('INITIAL_ADMIN_PASSWORD must be at least 8 characters');
  }

  return { email, password };
}

async function seed() {
  const seedDemoData = enabled('SEED_DEMO_DATA', !isProduction);
  const roleValues = RoleSchema.options.map(id => ({
    id,
    name: id
      .split('_')
      .map(p => p[0]!.toUpperCase() + p.slice(1))
      .join(' '),
    description: `${id} role`,
  }));

  for (const role of roleValues) {
    await db.insert(roles).values(role).onConflictDoNothing();
  }

  for (const id of PermissionSchema.options) {
    await db
      .insert(permissions)
      .values({ id, description: id })
      .onConflictDoNothing();
  }

  for (const [roleId, perms] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permissionId of perms) {
      await db
        .insert(rolePermissions)
        .values({ roleId, permissionId })
        .onConflictDoNothing();
    }
  }

  const credentials = initialAdminCredentials();
  let adminId: string | undefined;

  if (isProduction) {
    const [existingAdmin] = await db
      .select({ id: users.id })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(eq(userRoles.roleId, 'super_admin'))
      .limit(1);
    adminId = existingAdmin?.id;
  } else if (credentials) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, credentials.email));
    adminId = existing[0]?.id;
  }

  if (!adminId) {
    if (!credentials) {
      console.warn(
        'Skipping initial admin creation: set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD, or create a super_admin manually.',
      );
    } else {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, credentials.email));

      if (existingUser) {
        adminId = existingUser.id;
      } else {
        const passwordHash = await bcrypt.hash(credentials.password, 10);
        const [created] = await db
          .insert(users)
          .values({
            email: credentials.email,
            name: 'Anticlock Admin',
            passwordHash,
          })
          .returning();
        adminId = created!.id;
      }
    }
  }

  if (adminId) {
    await db
      .insert(userRoles)
      .values({ userId: adminId, roleId: 'super_admin' })
      .onConflictDoNothing();
  }

  for (const tree of catalog.trees) {
    await db
      .insert(serviceTrees)
      .values({
        id: tree.id,
        slug: tree.id,
        name: tree.name,
        description: tree.description ?? null,
        icon: tree.icon ?? null,
        accentColor: tree.accentColor ?? null,
        sortOrder: tree.sortOrder,
        status: 'published',
      })
      .onConflictDoUpdate({
        target: serviceTrees.id,
        set: {
          name: tree.name,
          description: tree.description ?? null,
          icon: tree.icon ?? null,
          accentColor: tree.accentColor ?? null,
          sortOrder: tree.sortOrder,
          updatedAt: new Date(),
        },
      });
  }

  for (const cat of catalog.categories) {
    await db
      .insert(serviceCategories)
      .values({
        id: cat.id,
        treeId: cat.treeId,
        name: cat.name,
        sortOrder: cat.sortOrder,
        status: 'published',
      })
      .onConflictDoUpdate({
        target: serviceCategories.id,
        set: {
          name: cat.name,
          treeId: cat.treeId,
          sortOrder: cat.sortOrder,
          updatedAt: new Date(),
        },
      });
  }

  const [existingGlobalSchema] = await db
    .select()
    .from(providerFormSchemas)
    .where(eq(providerFormSchemas.scope, 'global'))
    .limit(1);

  if (!existingGlobalSchema) {
    await db.insert(providerFormSchemas).values({
      scope: GLOBAL_PROVIDER_FORM_SCHEMA.scope,
      categoryId: null,
      providerKinds: GLOBAL_PROVIDER_FORM_SCHEMA.providerKinds,
      version: GLOBAL_PROVIDER_FORM_SCHEMA.version,
      status: GLOBAL_PROVIDER_FORM_SCHEMA.status,
      sections: GLOBAL_PROVIDER_FORM_SCHEMA.sections,
      fields: GLOBAL_PROVIDER_FORM_SCHEMA.fields,
    });
  }

  for (const schema of CATEGORY_PROVIDER_FORM_SCHEMAS) {
    const [existing] = await db
      .select()
      .from(providerFormSchemas)
      .where(eq(providerFormSchemas.categoryId, schema.categoryId!))
      .limit(1);
    if (existing) continue;
    await db.insert(providerFormSchemas).values({
      scope: schema.scope,
      categoryId: schema.categoryId ?? null,
      providerKinds: schema.providerKinds,
      version: schema.version,
      status: schema.status,
      sections: schema.sections,
      fields: schema.fields,
    });
  }

  if (!seedDemoData) {
    console.log(
      `Seeded ${catalog.trees.length} trees and ${catalog.categories.length} categories.`,
    );
    await sql.end({ timeout: 5 });
    return;
  }

  const providerSeeds = [
    { id: 'prov-ananya', name: 'Dr. Ananya Rao', status: 'active' },
    { id: 'prov-vikram', name: 'Coach Vikram Singh', status: 'active' },
  ];
  for (const p of providerSeeds) {
    await db.insert(stubProviders).values(p).onConflictDoNothing();
  }

  const productSeeds = [
    { id: 'prod-protein', name: 'Whey Protein 1kg', status: 'published' },
    { id: 'prod-mat', name: 'Yoga Mat Pro', status: 'draft' },
  ];
  for (const p of productSeeds) {
    await db.insert(stubProducts).values(p).onConflictDoNothing();
  }

  const bannerSeeds = [
    { id: 'ban-physio', title: 'Physiotherapy Campaign', status: 'published' },
    { id: 'ban-summer', title: 'Summer Fitness Push', status: 'draft' },
  ];
  for (const b of bannerSeeds) {
    await db.insert(stubBanners).values(b).onConflictDoNothing();
  }

  const sampleVideos = [
    {
      key: 'seed-reel-1',
      title: 'Morning mobility',
      creatorName: 'coach.sathish',
      caption: '5-minute warm-up before sports training',
      category: 'Fitness',
      url: 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',
      likes: 1280,
      comments: 42,
      saves: 84,
      order: 1,
    },
    {
      key: 'seed-reel-2',
      title: 'GP tips',
      creatorName: 'dr.remya',
      caption: 'When to book an online consult vs clinic visit',
      category: 'Health',
      url: 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',
      likes: 890,
      comments: 31,
      saves: 40,
      order: 2,
    },
    {
      key: 'seed-reel-3',
      title: 'Strength session',
      creatorName: 'fit.ananya',
      caption: 'Dumbbell circuit you can do at home',
      category: 'Fitness',
      url: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
      likes: 2100,
      comments: 88,
      saves: 120,
      order: 3,
    },
    {
      key: 'seed-reel-4',
      title: 'Weekend trek',
      creatorName: 'trailblaze.tours',
      caption: 'Yercaud adventure seats filling fast',
      category: 'Tours',
      url: 'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4',
      likes: 420,
      comments: 12,
      saves: 28,
      order: 4,
    },
    {
      key: 'seed-reel-5',
      title: 'Mindful minute',
      creatorName: 'wellness.mira',
      caption: 'One-minute breath reset between meetings',
      category: 'Wellness',
      url: 'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',
      likes: 980,
      comments: 37,
      saves: 65,
      order: 5,
    },
  ];

  for (const sample of sampleVideos) {
    const existingMedia = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.storageKey, sample.url))
      .limit(1);

    let mediaId = existingMedia[0]?.id;
    if (!mediaId) {
      const [asset] = await db
        .insert(mediaAssets)
        .values({
          kind: 'video',
          storageProvider: 'external',
          storageKey: sample.url,
          bucket: 'external',
          mimeType: 'video/mp4',
          accessLevel: 'public',
          processingStatus: 'ready',
          moderationStatus: 'not_required',
          durationMs: 60_000,
          originalFilename: `${sample.key}.mp4`,
          createdBy: adminId,
        })
        .returning();
      mediaId = asset!.id;
    }

    const existingReel = await db
      .select()
      .from(reels)
      .where(eq(reels.title, sample.title))
      .limit(1);

    if (!existingReel[0]) {
      await db.insert(reels).values({
        title: sample.title,
        caption: sample.caption,
        creatorName: sample.creatorName,
        category: sample.category,
        status: 'published',
        isSample: true,
        likeCount: sample.likes,
        commentCount: sample.comments,
        saveCount: sample.saves,
        displayOrder: sample.order,
        mediaId,
        createdBy: adminId,
        publishedAt: new Date(),
      });
    }
  }

  // Seed communities
  const sampleCommunities = [
    {
      name: 'Chennai Cricket Fans',
      slug: 'chennai-cricket-fans',
      description: 'For everyone who loves cricket in Chennai! Share updates, organize meetups, and discuss matches.',
      tags: ['Cricket', 'Sports', 'Chennai'],
    },
    {
      name: 'Fitness & Wellness',
      slug: 'fitness-wellness',
      description: 'A community for fitness enthusiasts, wellness seekers, and healthy living advocates.',
      tags: ['Fitness', 'Wellness', 'Health'],
    },
    {
      name: 'Tech Talk Chennai',
      slug: 'tech-talk-chennai',
      description: 'Discuss the latest in technology, startups, and innovations happening in Chennai.',
      tags: ['Technology', 'Startups', 'Chennai'],
    },
  ];

  const existingUsers = await db.select().from(mobileUsers).limit(5);
  if (existingUsers.length > 0) {
    for (const communityData of sampleCommunities) {
      const existing = await db
        .select()
        .from(communities)
        .where(eq(communities.slug, communityData.slug))
        .limit(1);

      if (!existing[0]) {
        const [community] = await db.insert(communities).values({
          ownerId: existingUsers[0]!.id,
          name: communityData.name,
          slug: communityData.slug,
          description: communityData.description,
          tags: communityData.tags,
          memberCount: 1,
          postCount: 0,
          status: 'published',
        }).returning();

        await db.insert(communityMembers).values({
          communityId: community!.id,
          mobileUserId: existingUsers[0]!.id,
          role: 'owner',
        });
      }
    }
  }

  console.log(
    `Seeded ${catalog.trees.length} trees and ${catalog.categories.length} categories, including demo data.`,
  );
  await sql.end({ timeout: 5 });
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
