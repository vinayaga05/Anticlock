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
<<<<<<< HEAD
  communities,
  communityMembers,
  mobileUsers,
=======
  mobileUsers,
  productCategories,
  products,
  trips,
>>>>>>> origin/main
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

<<<<<<< HEAD
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
=======
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
>>>>>>> origin/main
  }

  console.log(
    `Seeded ${catalog.trees.length} trees and ${catalog.categories.length} categories, including demo data.`,
  );

  /** Seed demo courses */
  const courseSeeds = [
    {
      slug: 'introduction-to-wellness',
      name: 'Introduction to Wellness and Mindfulness',
      shortDescription: 'Learn the fundamentals of wellness and mindfulness practices',
      description:
        'This comprehensive course covers the basics of wellness, meditation, and mindfulness techniques to improve your daily life. Perfect for beginners looking to start their wellness journey.',
      difficulty: 'beginner',
      durationHours: 8,
      price: 4999,
      compareAtPrice: 7999,
      instructorName: 'Dr. Priya Sharma',
      instructorBio:
        'Dr. Priya Sharma is a certified wellness coach with over 15 years of experience in mindfulness and meditation practices.',
      learningOutcomes: [
        'Understand the principles of wellness',
        'Practice basic meditation techniques',
        'Develop a daily mindfulness routine',
        'Manage stress effectively',
      ],
      prerequisites: ['None - suitable for beginners'],
      status: 'published',
      publishedAt: new Date(),
      lessons: [
        {
          moduleNumber: 1,
          moduleName: 'Introduction to Wellness',
          lessonNumber: 1,
          title: 'What is Wellness?',
          description: 'Understanding the core concepts of wellness',
          type: 'video',
          durationMinutes: 20,
          sortOrder: 1,
          isFree: true,
        },
        {
          moduleNumber: 1,
          moduleName: 'Introduction to Wellness',
          lessonNumber: 2,
          title: 'The Mind-Body Connection',
          description: 'Exploring how mental and physical health are interconnected',
          type: 'article',
          durationMinutes: 15,
          sortOrder: 2,
          isFree: true,
        },
        {
          moduleNumber: 2,
          moduleName: 'Meditation Basics',
          lessonNumber: 1,
          title: 'Breathing Techniques',
          description: 'Learn fundamental breathing exercises for relaxation',
          type: 'video',
          durationMinutes: 25,
          sortOrder: 3,
          isFree: false,
        },
        {
          moduleNumber: 2,
          moduleName: 'Meditation Basics',
          lessonNumber: 2,
          title: 'Guided Meditation Practice',
          description: 'Follow along with a guided meditation session',
          type: 'video',
          durationMinutes: 30,
          sortOrder: 4,
          isFree: false,
        },
        {
          moduleNumber: 3,
          moduleName: 'Daily Practice',
          lessonNumber: 1,
          title: 'Creating Your Wellness Routine',
          description: 'Build a sustainable daily wellness practice',
          type: 'article',
          durationMinutes: 20,
          sortOrder: 5,
          isFree: false,
        },
      ],
    },
    {
      slug: 'yoga-for-beginners',
      name: 'Yoga for Beginners: Foundation Course',
      shortDescription: 'Master the fundamentals of yoga practice',
      description:
        'Start your yoga journey with this beginner-friendly course. Learn essential poses, proper alignment, and breathing techniques in a supportive environment.',
      difficulty: 'beginner',
      durationHours: 12,
      price: 5999,
      compareAtPrice: 9999,
      instructorName: 'Ravi Kumar',
      instructorBio:
        'Ravi Kumar is a certified yoga instructor with 10 years of teaching experience and expertise in Hatha and Vinyasa yoga.',
      learningOutcomes: [
        'Learn 20+ fundamental yoga poses',
        'Understand proper alignment and form',
        'Master breathing techniques (Pranayama)',
        'Build strength and flexibility safely',
      ],
      prerequisites: ['No prior yoga experience required', 'Comfortable clothing and a yoga mat'],
      status: 'published',
      publishedAt: new Date(),
      lessons: [
        {
          moduleNumber: 1,
          moduleName: 'Yoga Foundations',
          lessonNumber: 1,
          title: 'Introduction to Yoga Philosophy',
          description: 'Learn the core principles of yoga',
          type: 'video',
          durationMinutes: 25,
          sortOrder: 1,
          isFree: true,
        },
        {
          moduleNumber: 1,
          moduleName: 'Yoga Foundations',
          lessonNumber: 2,
          title: 'Standing Poses',
          description: 'Practice fundamental standing asanas',
          type: 'video',
          durationMinutes: 35,
          sortOrder: 2,
          isFree: false,
        },
        {
          moduleNumber: 2,
          moduleName: 'Building Strength',
          lessonNumber: 1,
          title: 'Core Strengthening Poses',
          description: 'Develop core stability and strength',
          type: 'video',
          durationMinutes: 30,
          sortOrder: 3,
          isFree: false,
        },
      ],
    },
    {
      slug: 'advanced-nutrition-science',
      name: 'Advanced Nutrition Science',
      shortDescription: 'Deep dive into nutritional biochemistry and dietary strategies',
      description:
        'An advanced course exploring the science of nutrition, metabolism, and evidence-based dietary approaches for optimal health.',
      difficulty: 'advanced',
      durationHours: 20,
      price: 12999,
      compareAtPrice: 19999,
      instructorName: 'Dr. Anjali Mehta',
      instructorBio:
        'Dr. Anjali Mehta holds a PhD in Nutritional Biochemistry and has published over 30 research papers in peer-reviewed journals.',
      learningOutcomes: [
        'Understand macronutrient metabolism',
        'Evaluate nutrition research critically',
        'Design evidence-based meal plans',
        'Understand nutrient-gene interactions',
      ],
      prerequisites: [
        'Basic understanding of biology and chemistry',
        'Prior knowledge of nutrition fundamentals recommended',
      ],
      status: 'published',
      publishedAt: new Date(),
      lessons: [
        {
          moduleNumber: 1,
          moduleName: 'Nutritional Biochemistry',
          lessonNumber: 1,
          title: 'Carbohydrate Metabolism',
          description: 'Understanding how the body processes carbohydrates',
          type: 'video',
          durationMinutes: 45,
          sortOrder: 1,
          isFree: true,
        },
        {
          moduleNumber: 1,
          moduleName: 'Nutritional Biochemistry',
          lessonNumber: 2,
          title: 'Protein Synthesis and Breakdown',
          description: 'The role of proteins in metabolism',
          type: 'article',
          durationMinutes: 40,
          sortOrder: 2,
          isFree: false,
        },
      ],
    },
  ];

  for (const courseSeed of courseSeeds) {
    const { lessons, ...courseData } = courseSeed;
    
    const [existingCourse] = await sql`
      SELECT id FROM courses WHERE slug = ${courseData.slug}
    `;

    if (existingCourse) {
      console.log(`Course "${courseData.name}" already exists, skipping...`);
      continue;
    }

    const [course] = await sql`
      INSERT INTO courses (
        slug, name, short_description, description, difficulty, duration_hours,
        price, compare_at_price, instructor_name, instructor_bio,
        learning_outcomes, prerequisites, status, published_at
      )
      VALUES (
        ${courseData.slug},
        ${courseData.name},
        ${courseData.shortDescription},
        ${courseData.description},
        ${courseData.difficulty},
        ${courseData.durationHours},
        ${courseData.price},
        ${courseData.compareAtPrice ?? null},
        ${courseData.instructorName},
        ${courseData.instructorBio},
        ${JSON.stringify(courseData.learningOutcomes)},
        ${JSON.stringify(courseData.prerequisites)},
        ${courseData.status},
        ${courseData.publishedAt}
      )
      RETURNING id
    `;

    const courseId = course.id;

    for (const lesson of lessons) {
      await sql`
        INSERT INTO course_lessons (
          course_id, module_number, module_name, lesson_number, title,
          description, type, duration_minutes, sort_order, is_free
        )
        VALUES (
          ${courseId},
          ${lesson.moduleNumber},
          ${lesson.moduleName},
          ${lesson.lessonNumber},
          ${lesson.title},
          ${lesson.description ?? null},
          ${lesson.type},
          ${lesson.durationMinutes},
          ${lesson.sortOrder},
          ${lesson.isFree}
        )
      `;
    }

    console.log(`Seeded course: ${courseData.name}`);
  }

  console.log('Seeding complete.');
  await sql.end({ timeout: 5 });
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
