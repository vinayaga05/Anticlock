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
  mobileUsers,
  productCategories,
  products,
  trips,
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

  // Seed product categories and products
  const categorySeeds = [
    {
      id: 'cat-fitness',
      name: 'Fitness Equipment',
      slug: 'fitness-equipment',
      description: 'Home and gym fitness equipment',
      sortOrder: 1,
      status: 'published',
    },
    {
      id: 'cat-supplements',
      name: 'Supplements',
      slug: 'supplements',
      description: 'Nutritional supplements and vitamins',
      sortOrder: 2,
      status: 'published',
    },
    {
      id: 'cat-wellness',
      name: 'Wellness',
      slug: 'wellness',
      description: 'Wellness and recovery products',
      sortOrder: 3,
      status: 'published',
    },
  ];

  for (const cat of categorySeeds) {
    await db.insert(productCategories).values(cat).onConflictDoNothing();
  }

  const shopProductSeeds = [
    {
      categoryId: 'cat-supplements',
      name: 'Whey Protein Isolate 1kg',
      slug: 'whey-protein-isolate-1kg',
      description:
        'Premium whey protein isolate with 25g protein per serving. Fast absorption for post-workout recovery.',
      price: 2499,
      compareAtPrice: 2999,
      inventory: 50,
      status: 'published',
    },
    {
      categoryId: 'cat-fitness',
      name: 'Premium Yoga Mat',
      slug: 'premium-yoga-mat',
      description:
        'Non-slip, eco-friendly yoga mat with extra cushioning. Perfect for yoga, pilates, and floor exercises.',
      price: 1299,
      compareAtPrice: 1599,
      inventory: 30,
      status: 'published',
    },
    {
      categoryId: 'cat-fitness',
      name: 'Resistance Bands Set',
      slug: 'resistance-bands-set',
      description:
        'Set of 5 resistance bands with varying resistance levels. Includes carry bag and door anchor.',
      price: 899,
      inventory: 45,
      status: 'published',
    },
    {
      categoryId: 'cat-supplements',
      name: 'Multivitamin Complex',
      slug: 'multivitamin-complex',
      description:
        'Complete daily multivitamin with essential vitamins and minerals. 60 tablets.',
      price: 599,
      compareAtPrice: 799,
      inventory: 100,
      status: 'published',
    },
    {
      categoryId: 'cat-wellness',
      name: 'Foam Roller',
      slug: 'foam-roller',
      description:
        'High-density foam roller for muscle recovery and myofascial release. 33cm length.',
      price: 799,
      inventory: 25,
      status: 'published',
    },
    {
      categoryId: 'cat-fitness',
      name: 'Adjustable Dumbbells',
      slug: 'adjustable-dumbbells',
      description:
        'Space-saving adjustable dumbbells from 2kg to 12kg per hand. Quick adjustment mechanism.',
      price: 3999,
      compareAtPrice: 4999,
      inventory: 15,
      status: 'published',
    },
  ];

  for (const product of shopProductSeeds) {
    await db.insert(products).values(product).onConflictDoNothing();
  }

  // Seed trips
  const tripSeeds = [
    {
      name: 'Yercaud Weekend Adventure',
      slug: 'yercaud-weekend-adventure',
      description:
        'Escape to the scenic hills of Yercaud for a refreshing weekend getaway. Experience misty mornings, serene lakes, and lush coffee plantations in this charming hill station of Tamil Nadu.',
      destination: 'Yercaud, Tamil Nadu',
      durationDays: 2,
      basePrice: 4999,
      maxGroupSize: 20,
      itinerary: [
        {
          day: 1,
          title: 'Arrival and Lake Tour',
          description:
            'Arrive in Yercaud and check into your comfortable accommodation',
          activities: [
            'Visit Yercaud Lake and enjoy a boat ride',
            'Explore Lady\'s Seat viewpoint for panoramic valley views',
            'Evening bonfire and group activities',
          ],
          meals: ['Lunch', 'Dinner'],
        },
        {
          day: 2,
          title: 'Coffee Estate and Departure',
          description: 'Explore the famous coffee plantations and natural beauty',
          activities: [
            'Guided tour of coffee plantation',
            'Visit Killiyur Falls (seasonal)',
            'Shopping at local markets',
            'Departure by evening',
          ],
          meals: ['Breakfast', 'Lunch'],
        },
      ],
      inclusions: [
        'Accommodation for 1 night',
        'All meals as per itinerary',
        'Transportation in AC vehicle',
        'Experienced tour guide',
        'Entry fees to viewpoints',
      ],
      exclusions: [
        'Personal expenses',
        'Adventure activities (optional)',
        'Travel insurance',
      ],
      difficulty: 'easy',
      status: 'published',
    },
    {
      name: 'Mahabalipuram Heritage Tour',
      slug: 'mahabalipuram-heritage-tour',
      description:
        'Discover the ancient rock-cut temples and UNESCO World Heritage sites of Mahabalipuram. A perfect blend of history, culture, and coastal beauty.',
      destination: 'Mahabalipuram, Tamil Nadu',
      durationDays: 1,
      basePrice: 1999,
      maxGroupSize: 25,
      itinerary: [
        {
          day: 1,
          title: 'Heritage Sites Tour',
          description: 'Full day exploration of ancient monuments and beach',
          activities: [
            'Visit Shore Temple at sunrise',
            'Explore Arjuna\'s Penance and Krishna\'s Butter Ball',
            'Tour the Five Rathas (Pancha Rathas)',
            'Relax at Mahabalipuram Beach',
            'Visit local handicraft stores',
          ],
          meals: ['Breakfast', 'Lunch'],
        },
      ],
      inclusions: [
        'AC transportation from Chennai',
        'Professional heritage guide',
        'All entry fees',
        'Breakfast and lunch',
        'Bottled water',
      ],
      exclusions: ['Dinner', 'Shopping expenses', 'Tips for guide'],
      difficulty: 'easy',
      status: 'published',
    },
    {
      name: 'Kodaikanal Nature Retreat',
      slug: 'kodaikanal-nature-retreat',
      description:
        'Immerse yourself in the pristine beauty of Kodaikanal, the "Princess of Hill Stations". Trek through pine forests, visit stunning viewpoints, and experience the tranquility of hill country.',
      destination: 'Kodaikanal, Tamil Nadu',
      durationDays: 3,
      basePrice: 8999,
      maxGroupSize: 15,
      itinerary: [
        {
          day: 1,
          title: 'Arrival and Lake Exploration',
          description: 'Settle in and explore the famous Kodaikanal Lake area',
          activities: [
            'Check-in and welcome refreshments',
            'Evening walk around Kodaikanal Lake',
            'Visit Bryant Park',
            'Shopping at local markets',
          ],
          meals: ['Dinner'],
        },
        {
          day: 2,
          title: 'Viewpoints and Waterfalls',
          description: 'Full day tour of scenic viewpoints and natural wonders',
          activities: [
            'Coaker\'s Walk at sunrise',
            'Trek to Dolphin\'s Nose',
            'Visit Pillar Rocks',
            'Explore Bear Shola Falls',
            'Evening bonfire at hotel',
          ],
          meals: ['Breakfast', 'Lunch', 'Dinner'],
        },
        {
          day: 3,
          title: 'Pine Forest Trek and Departure',
          description: 'Morning nature walk and departure',
          activities: [
            'Guided trek through Pine Forest',
            'Visit Guna Caves (Devil\'s Kitchen)',
            'Last minute shopping',
            'Departure by afternoon',
          ],
          meals: ['Breakfast', 'Lunch'],
        },
      ],
      inclusions: [
        'Accommodation for 2 nights',
        'All meals as per itinerary',
        'AC transportation',
        'Experienced trekking guide',
        'Entry fees to all attractions',
        'First aid kit',
      ],
      exclusions: [
        'Adventure activities (rock climbing, etc.)',
        'Personal expenses',
        'Camera fees at monuments',
        'Travel insurance',
      ],
      difficulty: 'moderate',
      status: 'published',
    },
  ];

  for (const trip of tripSeeds) {
    await db.insert(trips).values(trip).onConflictDoNothing();
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
