import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it, mock } from "node:test";
import {
  FitnessConsentRequestSchema,
  FitnessPlanRevisionSchema,
} from "@anticlock/contracts";
import {
  approvedFitnessQualifications,
  consultationCanJoin,
  fitnessCategoryKind,
  sharedFitnessProfile,
} from "../fitness/fitnessExpertPolicy.js";

describe("Fitness expert permission contracts", () => {
  it("requires explicit confirmation and individual resources for every log/media scope", () => {
    assert.equal(
      FitnessConsentRequestSchema.safeParse({
        scopes: ["profile"],
        confirmed: true,
      }).success,
      true
    );
    assert.equal(
      FitnessConsentRequestSchema.safeParse({
        scopes: ["health"],
        confirmed: true,
      }).success,
      true
    );
    assert.equal(
      FitnessConsentRequestSchema.safeParse({
        scopes: ["workouts"],
        confirmed: true,
      }).success,
      false
    );
    assert.equal(
      FitnessConsentRequestSchema.safeParse({ scopes: ["profile"] }).success,
      false
    );
    assert.equal(
      FitnessConsentRequestSchema.safeParse({
        scopes: ["media"],
        resourceIds: [randomUUID()],
        confirmed: true,
      }).success,
      true
    );
  });
  it("keeps birth date, conditions and goals out of profile basics", () => {
    const privateProfile = {
      assessment: {
        dateOfBirth: "1990-01-01",
        heightCm: 170,
        weightKg: 70,
        medicalConditions: "private condition",
        medications: "private medication",
        foodPreferences: ["vegetarian"],
        breastfeeding: true,
        goals: ["strength"],
        targetWeightKg: 65,
      },
      baseline: { age: 36, bmi: 24 },
    };
    assert.deepEqual(sharedFitnessProfile(privateProfile, "profile"), {
      heightCm: 170,
      weightKg: 70,
      foodPreferences: ["vegetarian"],
      age: 36,
    });
    assert.deepEqual(sharedFitnessProfile(privateProfile, "goals"), {
      goals: ["strength"],
      targetWeightKg: 65,
    });
    assert.deepEqual(sharedFitnessProfile(privateProfile, "health"), {
      medicalConditions: "private condition",
      medications: "private medication",
      breastfeeding: true,
    });
    assert.deepEqual(sharedFitnessProfile(privateProfile, "media"), {});
  });
  it("uses only approved professional application text and real category identifiers", () => {
    assert.deepEqual(
      approvedFitnessQualifications("trainer", {
        trainer: { certifications: "Approved certificate" },
      }),
      ["Approved certificate"]
    );
    assert.deepEqual(
      approvedFitnessQualifications("nutritionist", {
        "nutrition.qualification": "BSc Nutrition",
      }),
      ["BSc Nutrition"]
    );
    assert.deepEqual(
      approvedFitnessQualifications("trainer", {
        profile: { certifications: ["Editable public claim"] },
      }),
      []
    );
    assert.equal(fitnessCategoryKind("fitness.gym"), null);
    assert.equal(
      fitnessCategoryKind("wellness.nutrition_sports"),
      "nutritionist"
    );
  });
  it("limits scheduled calls to confirmed online booking windows", () => {
    const startsAt = new Date("2026-11-14T10:00:00Z");
    const booking = {
      status: "confirmed",
      serviceMode: "online",
      startsAt,
      endsAt: null,
      durationMinutes: 30,
    };
    assert.equal(
      consultationCanJoin(booking, new Date("2026-11-14T09:45:00Z")),
      true
    );
    assert.equal(
      consultationCanJoin(booking, new Date("2026-11-14T11:00:00Z")),
      true
    );
    assert.equal(
      consultationCanJoin(booking, new Date("2026-11-14T11:00:00.001Z")),
      false
    );
    assert.equal(
      consultationCanJoin({ ...booking, status: "cancelled" }, startsAt),
      false
    );
    assert.equal(
      consultationCanJoin({ ...booking, serviceMode: "center" }, startsAt),
      false
    );
  });
  it("rejects impossible revision values and preserves optimistic version control", () => {
    assert.equal(
      FitnessPlanRevisionSchema.safeParse({
        expectedVersion: 1,
        note: "Updated",
        nutrition: {
          guidance: ["Balanced meals"],
          calories: { min: 2000, max: 1500 },
        },
      }).success,
      false
    );
    assert.equal(
      FitnessPlanRevisionSchema.safeParse({
        expectedVersion: 0,
        note: "Updated",
        habits: [],
      }).success,
      false
    );
    assert.equal(
      FitnessPlanRevisionSchema.safeParse({
        expectedVersion: 1,
        note: "Updated",
        workouts: [
          {
            day: 1,
            name: "Strength",
            durationMinutes: 30,
            exercises: [{ name: "Squat", sets: 3, reps: -1 }],
          },
        ],
      }).success,
      false
    );
  });
});

const testDatabase = process.env.TEST_DATABASE_URL?.trim();
if (testDatabase) process.env.DATABASE_URL = testDatabase;
describe(
  "Fitness experts across customer, trainer and nutritionist (PostgreSQL)",
  { skip: !testDatabase },
  () => {
    const customer = randomUUID(),
      stranger = randomUUID(),
      trainer = randomUUID(),
      nutritionist = randomUUID(),
      unqualified = randomUUID(),
      creator = randomUUID();
    const trainerId = randomUUID(),
      nutritionId = randomUUID(),
      unqualifiedId = randomUUID();
    const run = randomUUID();
    let app: any, db: any, client: any, schema: any, encrypt: any, service: any;
    const tokens: Record<string, string> = {};
    const raceUsers: string[] = [];
    let bookingId: string, workoutId: string, mealId: string, planId: string;
    async function request(
      userId: string,
      method: string,
      path: string,
      body?: unknown
    ) {
      const response = await app.request("/v1/fitness" + path, {
        method,
        headers: {
          Authorization: `Bearer ${tokens[userId]}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as any };
    }
    before(async () => {
      process.env.FITNESS_DATA_ENCRYPTION_KEY ??= "4".repeat(64);
      const { Hono } = await import("hono");
      const { fitnessExpertRoutes } = await import("./fitness-experts.js");
      const { signToken } = await import('../testutils/phoneBoundToken.js');
      const dbModule = await import("../db/client.js");
      db = dbModule.db;
      client = dbModule.sql;
      schema = await import("../db/schema.js");
      encrypt = (await import("../fitness/privacy.js")).encryptFitnessData;
      service = (await import("../fitness/FitnessExpertService.js"))
        .fitnessExpertService;
      app = new Hono().route("/v1/fitness", fitnessExpertRoutes);
      await db
        .insert(schema.mobileUsers)
        .values(
          [customer, stranger, trainer, nutritionist, unqualified, creator].map(
            (id, index) => ({
              id,
              phone: `fitness-experts-${run}-${index}`,
              displayName: [
                "Customer",
                "Stranger",
                "Trainer",
                "Nutritionist",
                "Unqualified",
                "Creator",
              ][index],
            })
          )
        );
      for (const id of [
        customer,
        stranger,
        trainer,
        nutritionist,
        unqualified,
        creator,
      ])
        tokens[id] = await signToken({
          kind: "mobile",
          sub: id,
          name: "Fitness test",
          email: "fitness@example.test",
          roles: [],
          permissions: [],
        });
      await db
        .insert(schema.serviceTrees)
        .values([
          { id: "fitness", slug: "fitness", name: "Fitness" },
          { id: "wellness", slug: "wellness", name: "Wellness" },
        ])
        .onConflictDoNothing();
      await db
        .insert(schema.serviceCategories)
        .values([
          {
            id: "fitness.personal_trainer",
            treeId: "fitness",
            name: "Personal Trainer",
          },
          {
            id: "wellness.nutrition_sports",
            treeId: "wellness",
            name: "Sports Nutritionist",
          },
        ])
        .onConflictDoNothing();
      for (const [owner, id, category, payload] of [
        [
          trainer,
          trainerId,
          "fitness.personal_trainer",
          {
            trainer: {
              certifications: "Accredited trainer certificate",
              expertise: ["strength"],
            },
          },
        ],
        [
          nutritionist,
          nutritionId,
          "wellness.nutrition_sports",
          { nutrition: { qualification: "BSc Nutrition" } },
        ],
        [unqualified, unqualifiedId, "fitness.personal_trainer", {}],
      ] as const) {
        const applicationId = randomUUID();
        await db
          .insert(schema.providerApplications)
          .values({
            id: applicationId,
            mobileUserId: owner,
            providerKind: "individual",
            status: "approved",
            dynamicPayload: payload,
            reviewedAt: new Date(),
          });
        await db
          .insert(schema.providers)
          .values({
            id,
            mobileUserId: owner,
            providerKind: "individual",
            name: `Fitness ${owner}`,
            sourceApplicationId: applicationId,
            publicProfile: {
              common: {
                profile: { languages: ["English"] },
                services: { online: true },
                availability: {
                  workingDays: [
                    "mon",
                    "tue",
                    "wed",
                    "thu",
                    "fri",
                    "sat",
                    "sun",
                  ],
                  openingTime: "00:00",
                  closingTime: "23:59",
                },
              },
            },
          });
        const { eq } = await import("drizzle-orm");
        await db
          .update(schema.providerApplications)
          .set({ providerId: id })
          .where(eq(schema.providerApplications.id, applicationId));
        await db
          .insert(schema.providerApplicationServices)
          .values({ applicationId, categoryId: category });
        await db
          .insert(schema.providerServiceOfferings)
          .values({
            providerId: id,
            categoryId: category,
            pricingStartsAt: 500,
          });
      }
      await db
        .insert(schema.providerMemberships)
        .values({
          providerId: trainerId,
          mobileUserId: creator,
          role: "content_creator",
        });
      const [booking] = await db
        .insert(schema.bookings)
        .values({
          mobileUserId: customer,
          providerId: trainerId,
          categoryId: "fitness.personal_trainer",
          category: "Fitness",
          status: "confirmed",
          serviceMode: "online",
          startsAt: new Date(Date.now() - 60000),
          durationMinutes: 30,
          detail: {},
        })
        .returning();
      bookingId = booking.id;
      await db
        .insert(schema.fitnessProfiles)
        .values({
          userId: customer,
          status: "complete",
          encryptedData: encrypt(customer, {
            assessment: {
              heightCm: 170,
              weightKg: 70,
              dateOfBirth: "1990-01-01",
              allergies: ["Private allergy"],
              goals: ["strength"],
              activityLevel: "light",
              experience: "beginner",
              availableDays: [1, 3, 5],
              equipment: ["none"],
              foodPreferences: ["no preference"],
              disclaimerAccepted: true,
              timezone: "Asia/Kolkata",
            },
            baseline: { age: 36 },
          }),
        });
      const [workout] = await db
        .insert(schema.workoutLogs)
        .values({
          userId: customer,
          date: "2026-11-14",
          encryptedData: encrypt(customer, {
            name: "Selected workout",
            status: "completed",
            exercises: [],
          }),
        })
        .returning();
      workoutId = workout.id;
      const [meal] = await db
        .insert(schema.mealLogs)
        .values({
          userId: customer,
          date: "2026-11-14",
          encryptedData: encrypt(customer, { mealType: "lunch", foods: [] }),
        })
        .returning();
      mealId = meal.id;
      const [plan] = await db
        .insert(schema.fitnessPlans)
        .values({ userId: customer, title: "Saved plan" })
        .returning();
      planId = plan.id;
      await db
        .insert(schema.fitnessPlanVersions)
        .values({
          planId,
          version: 1,
          authorUserId: customer,
          encryptedData: encrypt(customer, {
            name: "Saved plan",
            description: "Real saved plan",
            requiresProfessionalReview: false,
            workouts: [],
            nutrition: { guidance: ["Balanced meals"], calories: null },
            habits: [],
            assumptions: [],
          }),
        });
    });
    after(async () => {
      if (!db) return;
      try {
        const { inArray } = await import("drizzle-orm");
        await db
          .delete(schema.mobileUsers)
          .where(
            inArray(schema.mobileUsers.id, [
              customer,
              stranger,
              trainer,
              nutritionist,
              unqualified,
              creator,
              ...raceUsers,
            ])
          );
      } finally {
        await client.end({ timeout: 5 });
      }
    });
    it("discovers only credentialed approved experts, with real filters", async () => {
      const found = await request(
        customer,
        "GET",
        "/experts?language=English&maxPrice=500"
      );
      assert.equal(found.status, 200);
      assert(found.body.experts.some((e: any) => e.id === trainerId));
      assert(found.body.experts.some((e: any) => e.id === nutritionId));
      assert(!found.body.experts.some((e: any) => e.id === unqualifiedId));
      assert(!JSON.stringify(found.body).includes("dynamicPayload"));
      const filtered = await request(
        customer,
        "GET",
        "/experts?kind=nutritionist"
      );
      assert(
        filtered.body.experts.every((e: any) => e.kind === "nutritionist")
      );
    });
    it("denies unassigned clients, unconfirmed sharing and foreign resources", async () => {
      assert.equal(
        (
          await request(
            trainer,
            "GET",
            `/workspace/${trainerId}/clients/${customer}`
          )
        ).status,
        403
      );
      assert.equal(
        (
          await request(stranger, "PUT", `/consents/${trainerId}`, {
            scopes: ["profile"],
            confirmed: true,
          })
        ).status,
        403
      );
      assert.equal(
        (
          await request(customer, "PUT", `/consents/${trainerId}`, {
            scopes: ["profile"],
          })
        ).status,
        400
      );
      assert.equal(
        (
          await request(customer, "PUT", `/consents/${trainerId}`, {
            scopes: ["workouts"],
            resourceIds: [mealId],
            confirmed: true,
          })
        ).status,
        400
      );
    });
    it("shares only chosen categories and entries with owner managers", async () => {
      const saved = await request(customer, "PUT", `/consents/${trainerId}`, {
        scopes: ["profile", "workouts"],
        resourceIds: [workoutId],
        confirmed: true,
      });
      assert.equal(saved.status, 200);
      const detail = await request(
        trainer,
        "GET",
        `/workspace/${trainerId}/clients/${customer}`
      );
      assert.equal(detail.status, 200);
      assert.equal(detail.body.shared.length, 2);
      assert(!JSON.stringify(detail.body).includes("Private allergy"));
      assert(!JSON.stringify(detail.body).includes("1990-01-01"));
      assert(!JSON.stringify(detail.body).includes(mealId));
      assert.equal(detail.body.plan, null);
      assert.equal(
        (
          await request(
            creator,
            "GET",
            `/workspace/${trainerId}/clients/${customer}`
          )
        ).status,
        403
      );
      assert.deepEqual(
        (await request(customer, "GET", "/workspace")).body.providers,
        []
      );
    });
    it("creates immutable encrypted role-scoped revisions and generic notifications", async () => {
      await request(customer, "PUT", `/consents/${trainerId}`, {
        scopes: ["plan_write"],
        confirmed: true,
      });
      const path = `/workspace/${trainerId}/clients/${customer}/plans/${planId}`;
      assert.equal(
        (
          await request(trainer, "PUT", path, {
            expectedVersion: 1,
            note: "Updated guidance",
            nutrition: { guidance: ["New meal guidance"], calories: null },
          })
        ).status,
        403
      );
      const result = await request(trainer, "PUT", path, {
        expectedVersion: 1,
        note: "Start gently and review comfort",
        habits: [{ key: "water", label: "Water", target: 2000, unit: "ml" }],
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.client.plan.version, 2);
      assert.equal(
        (
          await request(trainer, "PUT", path, {
            expectedVersion: 1,
            note: "Stale request",
            habits: [],
          })
        ).status,
        409
      );
      const { eq } = await import("drizzle-orm");
      const versions = await db
        .select()
        .from(schema.fitnessPlanVersions)
        .where(eq(schema.fitnessPlanVersions.planId, planId));
      assert.equal(versions.length, 2);
      assert(
        versions.every((v: any) => !v.encryptedData.includes("Start gently"))
      );
      const notifications = await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.mobileUserId, customer));
      assert(notifications.some((n: any) => n.type === "fitness_plan_updated"));
      assert(!JSON.stringify(notifications).includes("Private allergy"));
    });
    it("uses existing bookings for consultations without duplicating bookings", async () => {
      const listed = await request(customer, "GET", "/consultations");
      assert.equal(listed.status, 200);
      assert(
        listed.body.consultations.some(
          (c: any) => c.bookingId === bookingId && c.canJoin
        )
      );
      const registered = await request(customer, "POST", "/consultations", {
        bookingId,
        mode: "audio",
      });
      assert.equal(registered.status, 201);
      assert.equal(
        (
          await request(stranger, "POST", "/consultations", {
            bookingId,
            mode: "video",
          })
        ).status,
        404
      );
    });
    it("nutritionist reads selected meals and revises nutrition without gaining workout access", async () => {
      await db
        .insert(schema.bookings)
        .values({
          mobileUserId: customer,
          providerId: nutritionId,
          categoryId: "wellness.nutrition_sports",
          category: "Wellness",
          status: "confirmed",
          serviceMode: "online",
          startsAt: new Date(),
          durationMinutes: 30,
          detail: {},
        });
      const grant = await request(customer, "PUT", `/consents/${nutritionId}`, {
        scopes: ["meals", "plan_write"],
        resourceIds: [mealId],
        confirmed: true,
      });
      assert.equal(grant.status, 200);
      const detail = await request(
        nutritionist,
        "GET",
        `/workspace/${nutritionId}/clients/${customer}`
      );
      assert.equal(detail.status, 200);
      assert.equal(detail.body.shared.length, 1);
      assert.equal(detail.body.shared[0].id, mealId);
      assert(!JSON.stringify(detail.body.shared).includes(workoutId));
      const path = `/workspace/${nutritionId}/clients/${customer}/plans/${planId}`;
      assert.equal(
        (
          await request(nutritionist, "PUT", path, {
            expectedVersion: 2,
            note: "Updated meal structure",
            nutrition: {
              guidance: ["Use a balanced plate with preferred foods."],
              calories: null,
            },
          })
        ).status,
        200
      );
      assert.equal(
        (
          await request(nutritionist, "PUT", path, {
            expectedVersion: 3,
            note: "Exercise outside role",
            workouts: [],
          })
        ).status,
        403
      );
    });
    it("versions explicit nutrition targets with role, clinical, media and private-title authority", async () => {
      const { eq, and } = await import("drizzle-orm");
      const { decryptFitnessData } = await import("../fitness/privacy.js");
      const { buildFitnessBaseline } = await import(
        "../fitness/FitnessEngine.js"
      );
      const { fitnessService } = await import("../fitness/FitnessService.js");
      const userId = randomUUID();
      raceUsers.push(userId);
      await db
        .insert(schema.mobileUsers)
        .values({
          id: userId,
          phone: `nutrition-targets-${run}`,
          displayName: "Nutrition targets fixture",
        });
      const assessment = {
        dateOfBirth: "1990-01-01",
        heightCm: 170,
        weightKg: 70,
        goals: ["strength"] as const,
        activityLevel: "light" as const,
        experience: "beginner" as const,
        availableDays: [1, 3, 5],
        equipment: ["none"],
        foodPreferences: ["no preference"],
        disclaimerAccepted: true,
        timezone: "Asia/Kolkata",
      };
      const baseline = buildFitnessBaseline({
        ...assessment,
        goals: [...assessment.goals],
      });
      await db
        .insert(schema.fitnessProfiles)
        .values({
          userId,
          status: "complete",
          encryptedData: encrypt(userId, { assessment, baseline }),
        });
      const content = {
        name: "Target fixture plan",
        description: "Saved assessment plan",
        requiresProfessionalReview: false,
        workouts: [
          {
            day: 1,
            name: "Saved movement",
            durationMinutes: 20,
            exercises: [
              {
                name: "Walk",
                sets: 1,
                durationSeconds: 600,
                restSeconds: 30,
                instructions: "Comfortable pace",
                substitutions: ["Indoor walk"],
              },
              { name: "Mobility", sets: 1, durationSeconds: 120 },
            ],
          },
          {
            day: 3,
            name: "Other saved day",
            durationMinutes: 15,
            exercises: [{ name: "Chair stand", sets: 2, reps: 6 }],
          },
        ],
        nutrition: {
          guidance: ["Balanced preferred meals"],
          calories: baseline.calories,
        },
        habits: [],
        assumptions: [],
        baselineTargets: {
          proteinG: baseline.proteinG,
          carbsG: baseline.carbsG,
          fatG: baseline.fatG,
          fibreG: baseline.fibreG,
          waterMl: baseline.waterMl,
        },
      };
      const [plan] = await db
        .insert(schema.fitnessPlans)
        .values({ userId, title: "Fitness plan" })
        .returning();
      await db
        .insert(schema.fitnessPlanVersions)
        .values({
          planId: plan.id,
          version: 1,
          authorUserId: userId,
          encryptedData: encrypt(userId, content),
        });
      for (const providerId of [trainerId, nutritionId]) {
        const [booking] = await db
          .insert(schema.bookings)
          .values({
            mobileUserId: userId,
            providerId,
            category: providerId === trainerId ? "Fitness" : "Wellness",
            status: "confirmed",
            serviceMode: "online",
            startsAt: new Date(),
            detail: {},
          })
          .returning();
        await db
          .insert(schema.providerClientRelationships)
          .values({
            userId,
            providerId,
            bookingId: booking.id,
            status: "active",
          });
        await db
          .insert(schema.healthConsents)
          .values({
            userId,
            providerId,
            scopes: ["plan_write"],
            resourceIds: [],
            status: "active",
          });
      }
      const path = (providerId: string) =>
        `/workspace/${providerId}/clients/${userId}/plans/${plan.id}`;
      const ranges = {
        proteinG: { min: 60, max: 90 },
        carbsG: { min: 180, max: 250 },
        fatG: { min: 45, max: 70 },
        fibreG: { min: 25, max: 35 },
        waterMl: { min: 1800, max: 2200 },
      };
      assert.equal(
        (
          await request(trainer, "PUT", path(trainerId), {
            expectedVersion: 1,
            note: "Forbidden nutrition target",
            nutrition: {
              guidance: ["Retained meals"],
              calories: null,
              targets: ranges,
            },
          })
        ).status,
        403
      );
      assert.equal(
        (
          await request(nutritionist, "PUT", path(nutritionId), {
            expectedVersion: 1,
            note: "Invalid protein target",
            nutrition: {
              guidance: ["Retained meals"],
              calories: null,
              targets: { proteinG: { min: 300, max: 350 } },
            },
          })
        ).status,
        400
      );
      const saved = await request(nutritionist, "PUT", path(nutritionId), {
        expectedVersion: 1,
        title: "Synthetic private plan title",
        note: "Reviewed practical targets",
        nutrition: {
          guidance: ["Preferred foods and regular meals"],
          calories: baseline.calories,
          targets: ranges,
        },
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      assert.deepEqual(saved.body.plan.nutrition.targets, ranges);
      assert.equal(saved.body.client.plan.version, 2);
      assert.equal(
        saved.body.client.plan.title,
        "Synthetic private plan title"
      );
      const [stored] = await db
        .select()
        .from(schema.fitnessPlans)
        .where(eq(schema.fitnessPlans.id, plan.id));
      assert.equal(stored.title, "Fitness plan");
      const partial = await request(nutritionist, "PUT", path(nutritionId), {
        expectedVersion: 2,
        note: "Adjust protein range only",
        nutrition: {
          guidance: ["Preferred foods and regular meals"],
          calories: baseline.calories,
          targets: { proteinG: { min: 70, max: 100 } },
        },
      });
      assert.equal(partial.status, 200);
      assert.deepEqual(
        partial.body.plan.nutrition.targets.carbsG,
        ranges.carbsG
      );
      assert.deepEqual(
        partial.body.plan.baselineTargets,
        content.baselineTargets
      );
      const cleared = await request(nutritionist, "PUT", path(nutritionId), {
        expectedVersion: 3,
        note: "Use baseline protein again",
        nutrition: {
          guidance: ["Preferred foods and regular meals"],
          calories: baseline.calories,
          clearTargets: ["proteinG"],
        },
      });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.plan.nutrition.targets.proteinG, undefined);
      assert.deepEqual(
        cleared.body.plan.nutrition.targets.waterMl,
        ranges.waterMl
      );
      const summary = await fitnessService.summary(userId);
      assert.deepEqual(summary.targets.proteinG, baseline.proteinG);
      assert.deepEqual(summary.targets.waterMl, ranges.waterMl);
      const instructionId = randomUUID();
      await db
        .insert(schema.progressMedia)
        .values({
          id: instructionId,
          userId,
          purpose: "workout",
          kind: "video",
          storageProvider: "local",
          storageKey: `private/fitness/${userId}/${instructionId}/synthetic.mp4`,
          bucket: "private-documents",
          contentType: "video/mp4",
          byteSize: 40,
          status: "ready",
        });
      const workouts = content.workouts.map((day) => ({
        ...day,
        exercises: day.exercises.map((exercise, index) => ({
          ...exercise,
          ...(day.day === 1 && index === 0 ? { mediaId: instructionId } : {}),
        })),
      }));
      assert.equal(
        (
          await request(trainer, "PUT", path(trainerId), {
            expectedVersion: 4,
            note: "Unshared instruction media",
            workouts,
          })
        ).status,
        403
      );
      await db
        .update(schema.healthConsents)
        .set({ scopes: ["plan_write", "media"], resourceIds: [instructionId] })
        .where(
          and(
            eq(schema.healthConsents.userId, userId),
            eq(schema.healthConsents.providerId, trainerId)
          )
        );
      const multi = await request(trainer, "PUT", path(trainerId), {
        expectedVersion: 4,
        note: "Retain the complete routine",
        workouts,
      });
      assert.equal(multi.status, 200, JSON.stringify(multi.body));
      assert.equal(multi.body.plan.workouts[0].exercises.length, 2);
      assert.deepEqual(multi.body.plan.workouts[0].exercises[0].substitutions, [
        "Indoor walk",
      ]);
      assert.deepEqual(
        multi.body.plan.nutrition.targets,
        cleared.body.plan.nutrition.targets
      );
      const [prior] = await db
        .select()
        .from(schema.fitnessPlanVersions)
        .where(
          and(
            eq(schema.fitnessPlanVersions.planId, plan.id),
            eq(schema.fitnessPlanVersions.version, 2)
          )
        );
      assert.deepEqual(
        decryptFitnessData<any>(userId, prior.encryptedData).nutrition.targets,
        ranges
      );
      assert(!prior.encryptedData.includes("Synthetic private plan title"));
      await fitnessService.saveProfile(userId, { pregnant: true }, true);
      const clinical = await fitnessService.generatePlan(userId);
      const denied = await request(
        nutritionist,
        "PUT",
        `/workspace/${nutritionId}/clients/${userId}/plans/${clinical.id}`,
        {
          expectedVersion: clinical.currentVersion,
          note: "Numeric targets remain blocked",
          nutrition: {
            guidance: ["Professional review first"],
            calories: null,
            targets: { waterMl: { min: 1800, max: 2000 } },
          },
        }
      );
      assert.equal(denied.status, 422, JSON.stringify(denied.body));
      assert.equal(denied.body.error.code, "clinical_review_required");
      await db
        .delete(schema.progressMedia)
        .where(eq(schema.progressMedia.id, instructionId));
    });
    it("rechecks booking status, approved category, source approval and active owner on every read", async () => {
      const { eq, and } = await import("drizzle-orm");
      await db
        .update(schema.bookings)
        .set({ status: "cancelled" })
        .where(eq(schema.bookings.id, bookingId));
      assert.equal(
        (
          await request(
            trainer,
            "GET",
            `/workspace/${trainerId}/clients/${customer}`
          )
        ).status,
        403
      );
      await db
        .update(schema.bookings)
        .set({ status: "confirmed" })
        .where(eq(schema.bookings.id, bookingId));
      const [provider] = await db
        .select()
        .from(schema.providers)
        .where(eq(schema.providers.id, trainerId));
      await db
        .delete(schema.providerApplicationServices)
        .where(
          and(
            eq(
              schema.providerApplicationServices.applicationId,
              provider.sourceApplicationId
            ),
            eq(
              schema.providerApplicationServices.categoryId,
              "fitness.personal_trainer"
            )
          )
        );
      assert.equal(
        (
          await request(
            trainer,
            "GET",
            `/workspace/${trainerId}/clients/${customer}`
          )
        ).status,
        404
      );
      await db
        .insert(schema.providerApplicationServices)
        .values({
          applicationId: provider.sourceApplicationId,
          categoryId: "fitness.personal_trainer",
        });
      await db
        .update(schema.providerApplications)
        .set({ status: "rejected" })
        .where(
          eq(schema.providerApplications.id, provider.sourceApplicationId)
        );
      assert.equal(
        (
          await request(
            trainer,
            "GET",
            `/workspace/${trainerId}/clients/${customer}`
          )
        ).status,
        404
      );
      await db
        .update(schema.providerApplications)
        .set({ status: "approved" })
        .where(
          eq(schema.providerApplications.id, provider.sourceApplicationId)
        );
      await db
        .update(schema.mobileUsers)
        .set({ isActive: false })
        .where(eq(schema.mobileUsers.id, trainer));
      assert.equal(
        (
          await request(
            trainer,
            "GET",
            `/workspace/${trainerId}/clients/${customer}`
          )
        ).status,
        401
      );
      await db
        .update(schema.mobileUsers)
        .set({ isActive: true })
        .where(eq(schema.mobileUsers.id, trainer));
    });
    it("uses the current private assessment to block stale legacy plans without exposing health details", async () => {
      const { eq } = await import("drizzle-orm");
      const { decryptFitnessData } = await import("../fitness/privacy.js");
      const [profile] = await db
        .select()
        .from(schema.fitnessProfiles)
        .where(eq(schema.fitnessProfiles.userId, customer));
      const original = decryptFitnessData<any>(customer, profile.encryptedData);
      const before = await db
        .select()
        .from(schema.fitnessPlanVersions)
        .where(eq(schema.fitnessPlanVersions.planId, planId));
      try {
        for (const patch of [
          { dateOfBirth: "2012-01-01" },
          { pregnant: true },
          { breastfeeding: true },
          { eatingDisorderRisk: true },
          { goals: ["rehabilitation_support"] },
          { medicalConditions: "Synthetic private clinical concern" },
        ]) {
          await db
            .update(schema.fitnessProfiles)
            .set({
              encryptedData: encrypt(customer, {
                ...original,
                assessment: { ...original.assessment, ...patch },
                baseline: {
                  ...original.baseline,
                  requiresProfessionalReview: false,
                },
              }),
            })
            .where(eq(schema.fitnessProfiles.id, profile.id));
          const result = await request(
            trainer,
            "PUT",
            `/workspace/${trainerId}/clients/${customer}/plans/${planId}`,
            {
              expectedVersion: 3,
              note: "Review current saved data",
              habits: [
                { key: "sleep", label: "Sleep", target: 8, unit: "hours" },
              ],
            }
          );
          assert.equal(result.status, 409, JSON.stringify(result.body));
          assert.equal(result.body.error.code, "fresh_plan_required");
          assert(
            !JSON.stringify(result.body).includes(
              "Synthetic private clinical concern"
            )
          );
          assert(!JSON.stringify(result.body).includes("2012-01-01"));
        }
        await db
          .update(schema.fitnessProfiles)
          .set({
            encryptedData: encrypt(customer, {
              ...original,
              assessment: {
                ...original.assessment,
                targetDate: new Date(Date.now() - 86400000)
                  .toISOString()
                  .slice(0, 10),
              },
            }),
          })
          .where(eq(schema.fitnessProfiles.id, profile.id));
        const expired = await request(
          trainer,
          "PUT",
          `/workspace/${trainerId}/clients/${customer}/plans/${planId}`,
          {
            expectedVersion: 3,
            note: "Review the saved assessment",
            habits: [],
          }
        );
        assert.equal(expired.status, 409);
        assert.equal(expired.body.error.code, "assessment_update_required");
        assert(!expired.body.error.message.toLowerCase().includes("clinical"));
        await db
          .update(schema.fitnessProfiles)
          .set({ status: "draft", encryptedData: profile.encryptedData })
          .where(eq(schema.fitnessProfiles.id, profile.id));
        const incomplete = await request(
          trainer,
          "PUT",
          `/workspace/${trainerId}/clients/${customer}/plans/${planId}`,
          { expectedVersion: 3, note: "Wait for reassessment", habits: [] }
        );
        assert.equal(incomplete.status, 409);
        assert.equal(incomplete.body.error.code, "assessment_review_required");
        assert.equal(
          (
            await db
              .select()
              .from(schema.fitnessPlanVersions)
              .where(eq(schema.fitnessPlanVersions.planId, planId))
          ).length,
          before.length
        );
      } finally {
        await db
          .update(schema.fitnessProfiles)
          .set({ status: profile.status, encryptedData: profile.encryptedData })
          .where(eq(schema.fitnessProfiles.id, profile.id));
      }
    });
    it("revokes server reads, media checks and plan writes immediately", async () => {
      assert.equal(
        (await request(customer, "DELETE", `/consents/${trainerId}`)).status,
        200
      );
      assert.equal(
        (
          await request(
            trainer,
            "GET",
            `/workspace/${trainerId}/clients/${customer}`
          )
        ).status,
        403
      );
      await assert.rejects(() =>
        service.assertResourceAccess(
          trainer,
          customer,
          "media",
          randomUUID(),
          trainerId
        )
      );
      assert.equal(
        (
          await request(
            trainer,
            "PUT",
            `/workspace/${trainerId}/clients/${customer}/plans/${planId}`,
            { expectedVersion: 3, note: "Should be denied", habits: [] }
          )
        ).status,
        403
      );
    });
    it("does not recreate private expert records when account closure wins after write prechecks", async () => {
      const { eq } = await import("drizzle-orm");
      const { fitnessService } = await import("../fitness/FitnessService.js");
      for (const operation of [
        "consent",
        "revoke",
        "consultation",
        "revision",
      ]) {
        const clientId = randomUUID();
        raceUsers.push(clientId);
        await db
          .insert(schema.mobileUsers)
          .values({
            id: clientId,
            phone: `closure-${run}-${operation}`,
            displayName: "Account closure fixture",
          });
        const [booking] = await db
          .insert(schema.bookings)
          .values({
            mobileUserId: clientId,
            providerId: trainerId,
            categoryId: "fitness.personal_trainer",
            category: "Fitness",
            status: "confirmed",
            serviceMode: "online",
            startsAt: new Date(),
            durationMinutes: 30,
            detail: {},
          })
          .returning();
        await db
          .insert(schema.providerClientRelationships)
          .values({
            userId: clientId,
            providerId: trainerId,
            bookingId: booking.id,
            status: "active",
          });
        await db
          .insert(schema.healthConsents)
          .values({
            userId: clientId,
            providerId: trainerId,
            scopes: ["profile", "plan_write"],
            resourceIds: [],
            status: "active",
          });
        const [plan] = await db
          .insert(schema.fitnessPlans)
          .values({ userId: clientId, title: "Closure fixture" })
          .returning();
        await db
          .insert(schema.fitnessPlanVersions)
          .values({
            planId: plan.id,
            version: 1,
            authorUserId: clientId,
            encryptedData: encrypt(clientId, {
              name: "Closure fixture",
              description: "Synthetic",
              requiresProfessionalReview: false,
              workouts: [],
              nutrition: { guidance: [], calories: null },
              habits: [],
              assumptions: [],
            }),
          });
        let reached!: () => void, release!: () => void;
        const entered = new Promise<void>((resolve) => {
            reached = resolve;
          }),
          resume = new Promise<void>((resolve) => {
            release = resolve;
          });
        const original = db.transaction.bind(db);
        let first = true;
        const pause = mock.method(
          db,
          "transaction",
          (callback: any, ...args: any[]) => {
            if (!first) return original(callback, ...args);
            first = false;
            reached();
            return resume.then(() => original(callback, ...args));
          }
        );
        let pending: Promise<any> | undefined;
        try {
          pending =
            operation === "consent"
              ? service.setConsent(clientId, trainerId, {
                  scopes: ["profile"],
                  resourceIds: [],
                  confirmed: true,
                })
              : operation === "revoke"
              ? service.revokeConsent(clientId, trainerId)
              : operation === "consultation"
              ? service.registerConsultation(clientId, booking.id, "video")
              : service.revisePlan(trainer, trainerId, clientId, plan.id, {
                  expectedVersion: 1,
                  note: "Concurrent synthetic revision",
                  habits: [],
                });
          await Promise.race([
            entered,
            pending.then(() => {
              throw new Error(
                "The expert write bypassed its owner transaction."
              );
            }),
          ]);
          await fitnessService.deleteData(clientId, {
            deactivateAccount: true,
          });
          release();
          await assert.rejects(pending, (error: any) => error.status === 403);
          for (const table of [
            schema.healthConsents,
            schema.providerClientRelationships,
            schema.fitnessConsultations,
            schema.fitnessPlans,
          ])
            assert.equal(
              (await db.select().from(table).where(eq(table.userId, clientId)))
                .length,
              0,
              `${operation} recreated fitness data after closure.`
            );
        } finally {
          release();
          if (pending) await Promise.allSettled([pending]);
          pause.mock.restore();
        }
      }
    });
    it("denies stale approvals and blocked providers after a grant", async () => {
      await request(customer, "PUT", `/consents/${trainerId}`, {
        scopes: ["profile"],
        confirmed: true,
      });
      const { eq } = await import("drizzle-orm");
      await db
        .insert(schema.mobileUserBlocks)
        .values({
          blockerMobileUserId: customer,
          blockedProviderId: trainerId,
        });
      assert.equal(
        (
          await request(
            trainer,
            "GET",
            `/workspace/${trainerId}/clients/${customer}`
          )
        ).status,
        404
      );
      await db
        .delete(schema.mobileUserBlocks)
        .where(eq(schema.mobileUserBlocks.blockerMobileUserId, customer));
      await db
        .update(schema.providers)
        .set({ status: "deleted" })
        .where(eq(schema.providers.id, trainerId));
      assert.equal(
        (
          await request(
            trainer,
            "GET",
            `/workspace/${trainerId}/clients/${customer}`
          )
        ).status,
        404
      );
    });
  }
);

// Auth verification opens a real pool even when the route service is mocked.
// Register last, so this file's fixture cleanup finishes before the pool closes.
import { after as afterDatabaseTestFile } from 'node:test';
afterDatabaseTestFile(async () => {
  const { sql: authTestSql } = await import('../db/client.js');
  await authTestSql.end({ timeout: 5 });
});
