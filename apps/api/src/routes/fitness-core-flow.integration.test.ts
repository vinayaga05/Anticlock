import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it, mock } from "node:test";

const testDatabase = process.env.TEST_DATABASE_URL?.trim();
if (testDatabase) process.env.DATABASE_URL = testDatabase;
describe(
  "private Fitness core persisted flows (PostgreSQL integration)",
  { skip: !testDatabase },
  () => {
    const closing = randomUUID(),
      legacy = randomUUID();
    const owner = randomUUID(),
      other = randomUUID(),
      inactive = randomUUID(),
      run = randomUUID();
    const fixtureUsers = [owner, other, inactive, closing, legacy];
    const tokens: Record<string, string> = {};
    let app: any, db: any, sql: any, schema: any;
    let workoutId = "",
      foodId = "",
      weightId = "";
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const base = "/v1/fitness";
    const assessment = {
      dateOfBirth: "1990-06-12",
      gender: "nonbinary",
      heightCm: 175,
      weightKg: 75,
      goals: ["strength"],
      activityLevel: "light",
      experience: "beginner",
      availableDays: [1, 3, 5],
      equipment: ["bodyweight"],
      foodPreferences: ["vegetarian"],
      timezone: "UTC",
      disclaimerAccepted: true,
    };
    async function request(
      userId: string | null,
      method: string,
      path: string,
      body?: unknown
    ) {
      const response = await app.request(base + path, {
        method,
        headers: {
          ...(userId ? { Authorization: `Bearer ${tokens[userId]}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as any };
    }
    before(async () => {
      const { Hono } = await import("hono");
      const { fitnessMobileRoutes } = await import("./fitness.js");
      const { signToken } = await import('../testutils/phoneBoundToken.js');
      const client = await import("../db/client.js");
      db = client.db;
      sql = client.sql;
      schema = await import("../db/schema.js");
      app = new Hono().route(base, fitnessMobileRoutes);
      await db.insert(schema.mobileUsers).values([
        {
          id: owner,
          phone: `fitness-owner-${run}`,
          displayName: "Fitness integration owner",
        },
        {
          id: other,
          phone: `fitness-other-${run}`,
          displayName: "Fitness integration other",
        },
        {
          id: legacy,
          phone: `fitness-legacy-${run}`,
          displayName: "Legacy cache fixture",
        },
        {
          id: closing,
          phone: `fitness-closing-${run}`,
          displayName: "Closing fixture",
        },
        {
          id: inactive,
          phone: `fitness-inactive-${run}`,
          displayName: "Inactive",
          isActive: false,
        },
      ]);
      for (const user of fixtureUsers)
        tokens[user] = await signToken({
          kind: "mobile",
          sub: user,
          email: "",
          name: "Fixture",
          roles: [],
          permissions: [],
        });
      tokens.admin = await signToken({
        kind: "admin",
        sub: randomUUID(),
        email: "",
        name: "Admin",
        roles: [],
        permissions: [],
      });
    });
    after(async () => {
      if (!db) return;
      try {
        const { inArray } = await import("drizzle-orm");
        await db
          .delete(schema.mobileUsers)
          .where(inArray(schema.mobileUsers.id, fixtureUsers));
      } finally {
        await sql.end({ timeout: 5 });
      }
    });
    it("requires active mobile owner and reports honest empty state", async () => {
      for (const [user, status] of [
        [null, 401],
        ["admin", 403],
        [inactive, 401],
      ] as const)
        assert.equal((await request(user, "GET", "/profile")).status, status);
      const initial = await request(
        owner,
        "GET",
        `/summary?date=${today}&timezone=UTC`
      );
      assert.equal(initial.status, 200);
      assert.equal(initial.body.profile, null);
      assert.equal(initial.body.plan, null);
      assert.equal(initial.body.today.workouts, 0);
      assert.equal(initial.body.today.weightKg, null);
    });
    it("persists partial private drafts, rejects premature completion, and keeps owners isolated", async () => {
      const draft = await request(owner, "PATCH", "/profile", {
        heightCm: 175,
        medicalConditions: "sensitive fixture detail",
      });
      assert.equal(draft.status, 200);
      assert.equal(draft.body.profile.status, "draft");
      assert.equal(
        (await request(owner, "GET", "/profile")).body.profile.assessment
          .medicalConditions,
        "sensitive fixture detail"
      );
      assert.equal(
        (await request(other, "GET", "/profile")).body.profile,
        null
      );
      assert.equal(
        (await request(owner, "POST", "/profile/complete", {})).status,
        400
      );
      const cleared = await request(owner, "PATCH", "/profile", {
        medicalConditions: null,
      });
      assert.equal(cleared.status, 200);
      assert.equal(
        cleared.body.profile.assessment.medicalConditions,
        undefined
      );
      assert.equal(
        (await request(owner, "GET", "/profile")).body.profile.assessment
          .medicalConditions,
        undefined
      );
      const { eq } = await import("drizzle-orm");
      const [stored] = await db
        .select()
        .from(schema.fitnessProfiles)
        .where(eq(schema.fitnessProfiles.userId, owner));
      assert.ok(stored.encryptedData.startsWith("v1."));
      assert.ok(!JSON.stringify(stored).includes("sensitive fixture detail"));
    });
    it("completes actual assessment and serializes repeat plan generation without duplicate versions", async () => {
      const complete = await request(owner, "POST", "/profile/complete", {
        ...assessment,
        medicalConditions: "",
      });
      assert.equal(complete.status, 200);
      assert.equal(complete.body.profile.status, "complete");
      assert.equal(complete.body.profile.assessment.gender, "nonbinary");
      assert.ok(
        complete.body.profile.baseline.bmr.min <
          complete.body.profile.baseline.bmr.max
      );
      const plans = await Promise.all(
        Array.from({ length: 4 }, () =>
          request(owner, "POST", "/plans/generate")
        )
      );
      assert.ok(plans.every((plan) => plan.status === 201));
      assert.equal(new Set(plans.map((plan) => plan.body.plan.id)).size, 1);
      const planId = plans[0]!.body.plan.id;
      assert.equal(plans[0]!.body.plan.currentVersion, 1);
      const repeated = await request(owner, "POST", "/profile/complete", {});
      assert.equal(
        repeated.body.profile.updatedAt,
        complete.body.profile.updatedAt
      );
      assert.equal(
        (await request(owner, "POST", "/plans/generate")).body.plan
          .currentVersion,
        1
      );
      assert.equal(
        (await request(owner, "GET", `/plans/${planId}/versions`)).body.versions
          .length,
        1
      );
      assert.equal(
        (await request(other, "GET", `/plans/${planId}/versions`)).status,
        404
      );
    });
    it("revalidates current risk before reusing an inconsistent cached starter and preserves version history", async () => {
      assert.equal(
        (await request(legacy, "POST", "/profile/complete", assessment)).status,
        200
      );
      const first = await request(legacy, "POST", "/plans/generate");
      assert.equal(first.status, 201);
      assert.equal(first.body.plan.content.requiresProfessionalReview, false);
      const { eq } = await import("drizzle-orm");
      const { decryptFitnessData: decrypt, encryptFitnessData: encrypt } =
        await import("../fitness/privacy.js");
      const [row] = await db
        .select()
        .from(schema.fitnessProfiles)
        .where(eq(schema.fitnessProfiles.userId, legacy));
      const payload = decrypt<any>(legacy, row.encryptedData);
      assert.equal(payload.baseline.requiresProfessionalReview, false);
      // Synthetic legacy corruption: a new risk flag exists with an old healthy cache and unchanged timestamps.
      payload.assessment.pregnant = true;
      await db
        .update(schema.fitnessProfiles)
        .set({ encryptedData: encrypt(legacy, payload) })
        .where(eq(schema.fitnessProfiles.id, row.id));
      const refreshed = await request(legacy, "POST", "/plans/generate");
      assert.equal(refreshed.status, 201);
      assert.equal(refreshed.body.plan.id, first.body.plan.id);
      assert.equal(refreshed.body.plan.currentVersion, 2);
      assert.equal(
        refreshed.body.plan.content.requiresProfessionalReview,
        true
      );
      assert.deepEqual(refreshed.body.plan.content.workouts, []);
      assert.equal(refreshed.body.plan.content.nutrition.calories, null);
      assert.equal(
        (await request(legacy, "GET", "/profile")).body.profile.baseline
          .requiresProfessionalReview,
        true
      );
      assert.equal(
        (await request(legacy, "POST", "/plans/generate")).body.plan
          .currentVersion,
        2
      );
      assert.equal(
        (await request(legacy, "GET", `/plans/${first.body.plan.id}/versions`))
          .body.versions.length,
        2
      );
      const { and } = await import("drizzle-orm");
      const unsafe = {
        ...refreshed.body.plan.content,
        baselineTargets: {
          proteinG: { min: 50, max: 70 },
          carbsG: null,
          fatG: null,
          fibreG: null,
          waterMl: null,
        },
        nutrition: {
          ...refreshed.body.plan.content.nutrition,
          targets: { waterMl: { min: 2000, max: 2500 } },
        },
      };
      await db
        .update(schema.fitnessPlanVersions)
        .set({ encryptedData: encrypt(legacy, unsafe) })
        .where(
          and(
            eq(schema.fitnessPlanVersions.planId, first.body.plan.id),
            eq(schema.fitnessPlanVersions.version, 2)
          )
        );
      const sanitized = await request(legacy, "POST", "/plans/generate");
      assert.equal(sanitized.body.plan.currentVersion, 3);
      assert.equal(sanitized.body.plan.content.nutrition.targets, undefined);
      assert.ok(
        Object.values(sanitized.body.plan.content.baselineTargets).every(
          (value) => value === null
        )
      );
    });
    it("preserves completed profiles when changing reminders and versions changed assessments safely", async () => {
      const original = (await request(owner, "GET", "/plans")).body.plans[0];
      const scheduling = await request(owner, "PATCH", "/profile", {
        reminders: {
          enabled: false,
          workouts: false,
          meals: false,
          water: false,
          habits: false,
          weeklySummary: false,
        },
      });
      assert.equal(scheduling.status, 200);
      assert.equal(scheduling.body.profile.status, "complete");
      assert.ok(scheduling.body.profile.baseline);
      assert.equal(
        (await request(owner, "GET", "/plans")).body.plans[0].status,
        "active"
      );
      const changed = await request(owner, "PATCH", "/profile", {
        heightCm: 176,
      });
      assert.equal(changed.body.profile.status, "draft");
      assert.equal(
        (await request(owner, "GET", "/plans")).body.plans[0].status,
        "needs_review"
      );
      assert.equal(
        (await request(owner, "POST", "/plans/generate")).status,
        409
      );
      assert.equal(
        (await request(owner, "POST", "/profile/complete", {})).status,
        200
      );
      const regenerated = await request(owner, "POST", "/plans/generate");
      assert.equal(regenerated.status, 201);
      assert.equal(regenerated.body.plan.id, original.id);
      assert.equal(regenerated.body.plan.currentVersion, 2);
      assert.equal(
        (await request(owner, "GET", `/plans/${original.id}/versions`)).body
          .versions.length,
        2
      );
    });
    it("persists workout/exercise logs, enforces transitions and rejects cross-owner mutation", async () => {
      const payload = {
        date: today,
        clientRequestId: randomUUID(),
        data: {
          name: "Actual logged workout",
          status: "in_progress",
          durationMinutes: 25,
          exercises: [
            { name: "Bodyweight squat", sets: [{ reps: 10, weightKg: 0 }] },
          ],
        },
      };
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          request(owner, "POST", "/logs/workout", payload)
        )
      );
      assert.ok(results.every((result) => result.status === 201));
      assert.equal(
        new Set(results.map((result) => result.body.log.id)).size,
        1
      );
      workoutId = results[0]!.body.log.id;
      assert.equal(
        (await request(other, "GET", `/logs/workout/${workoutId}`)).status,
        404
      );
      assert.equal(
        (
          await request(other, "POST", `/workouts/${workoutId}/actions`, {
            action: "complete",
          })
        ).status,
        404
      );
      assert.equal(
        (await request(other, "DELETE", `/logs/workout/${workoutId}`)).status,
        404
      );
      assert.equal(
        (
          await request(owner, "POST", `/workouts/${workoutId}/actions`, {
            action: "pause",
          })
        ).body.log.data.status,
        "paused"
      );
      assert.equal(
        (
          await request(owner, "POST", `/workouts/${workoutId}/actions`, {
            action: "pause",
          })
        ).status,
        200
      );
      assert.equal(
        (
          await request(owner, "POST", `/workouts/${workoutId}/actions`, {
            action: "request_help",
            painNote: "Private knee discomfort",
          })
        ).body.log.data.helpRequested,
        true
      );
      assert.equal(
        (
          await request(owner, "POST", `/workouts/${workoutId}/actions`, {
            action: "resume",
          })
        ).body.log.data.status,
        "in_progress"
      );
      assert.equal(
        (
          await request(owner, "POST", `/workouts/${workoutId}/actions`, {
            action: "complete",
          })
        ).body.log.data.status,
        "completed"
      );
      const { eq } = await import("drizzle-orm");
      const exercises = await db
        .select()
        .from(schema.exerciseLogs)
        .where(eq(schema.exerciseLogs.workoutLogId, workoutId));
      assert.equal(exercises.length, 1);
      assert.ok(!exercises[0].encryptedData.includes("Bodyweight squat"));
      assert.equal(
        (
          await request(owner, "POST", "/logs/workout", {
            ...payload,
            data: { ...payload.data, name: "Changed request" },
          })
        ).status,
        409
      );
    });
    it("stores real private foods/recipes, uses canonical servings and isolates food searches", async () => {
      const food = {
        clientRequestId: randomUUID(),
        name: "Private custom lentil portion",
        servingName: "bowl",
        servingGrams: 150,
        nutrients: {
          calories: 200,
          proteinG: 12,
          carbsG: 30,
          fatG: 3,
          fibreG: 8,
        },
      };
      const created = await request(owner, "POST", "/foods", food);
      assert.equal(created.status, 201);
      foodId = created.body.food.id;
      const retries = await Promise.all(
        Array.from({ length: 3 }, () => request(owner, "POST", "/foods", food))
      );
      assert.ok(
        retries.every(
          (result) => result.status === 201 && result.body.food.id === foodId
        )
      );
      assert.equal(
        (
          await request(owner, "POST", "/foods", {
            ...food,
            name: "Conflicting name",
          })
        ).status,
        409
      );
      assert.equal(
        (await request(other, "GET", "/foods?q=lentil")).body.foods.length,
        0
      );
      assert.equal(
        (await request(owner, "GET", "/foods?q=lentil")).body.foods.length,
        1
      );
      const recipeInput = {
        clientRequestId: randomUUID(),
        name: "My private recipe",
        servings: 2,
        ingredients: [{ foodId, servings: 3 }],
      };
      const recipe = await request(owner, "POST", "/recipes", recipeInput);
      assert.equal(recipe.status, 201);
      assert.equal(recipe.body.recipe.nutrients.calories, 300);
      const recipeRetries = await Promise.all(
        Array.from({ length: 3 }, () =>
          request(owner, "POST", "/recipes", recipeInput)
        )
      );
      assert.ok(
        recipeRetries.every(
          (result) =>
            result.status === 201 &&
            result.body.recipe.id === recipe.body.recipe.id
        )
      );
      assert.equal(
        (
          await request(owner, "POST", "/recipes", {
            ...recipeInput,
            name: "Changed recipe",
          })
        ).status,
        409
      );
      assert.equal(
        (
          await request(other, "POST", "/recipes", {
            name: "Forbidden recipe",
            servings: 1,
            ingredients: [{ foodId, servings: 1 }],
          })
        ).status,
        404
      );
      const meal = await request(owner, "POST", "/logs/meal", {
        date: today,
        data: {
          mealType: "lunch",
          foods: [
            {
              foodId,
              name: "Forged title",
              servings: 2,
              nutrients: {
                calories: 0,
                proteinG: 0,
                carbsG: 0,
                fatG: 0,
                fibreG: 0,
              },
            },
          ],
        },
      });
      assert.equal(meal.status, 201);
      assert.equal(meal.body.log.data.foods[0].name, food.name);
      assert.equal(meal.body.log.data.foods[0].nutrients.calories, 200);
    });
    it("imports selected catalog items privately with stable owner IDs and editable estimates", async () => {
      const { foodCatalogService } = await import(
        "../fitness/FoodCatalogService.js"
      );
      const fixture = {
        barcode: "12345678",
        name: "Catalog fixture food",
        servingName: "100 g",
        servingGrams: 100,
        nutrients: {
          calories: 100,
          proteinG: 5,
          carbsG: 15,
          fatG: 2,
          fibreG: 3,
        },
        source: "open_food_facts" as const,
        isEstimate: true as const,
        missingNutrients: [],
      };
      const adapter = mock.method(
        foodCatalogService,
        "product",
        async () => fixture
      );
      try {
        const first = await request(owner, "POST", "/foods/import", {
          barcode: fixture.barcode,
        });
        assert.equal(first.status, 201);
        assert.equal(first.body.food.source, "open_food_facts");
        const retry = await request(owner, "POST", "/foods/import", {
          barcode: fixture.barcode,
        });
        assert.equal(retry.body.food.id, first.body.food.id);
        assert.equal(adapter.mock.callCount(), 1);
        const secondOwner = await request(other, "POST", "/foods/import", {
          barcode: fixture.barcode,
        });
        assert.equal(secondOwner.status, 201);
        assert.notEqual(secondOwner.body.food.id, first.body.food.id);
        const previous = new Date(`${today}T12:00:00Z`);
        previous.setUTCDate(previous.getUTCDate() - 1);
        const meal = await request(owner, "POST", "/logs/meal", {
          date: previous.toISOString().slice(0, 10),
          data: {
            mealType: "snack",
            estimate: true,
            foods: [
              {
                foodId: first.body.food.id,
                name: first.body.food.name,
                servings: 1,
                nutrients: { ...fixture.nutrients, calories: 150 },
              },
            ],
          },
        });
        assert.equal(meal.status, 201);
        assert.equal(meal.body.log.data.foods[0].nutrients.calories, 150);
      } finally {
        adapter.mock.restore();
      }
    });
    it("aggregates actual water/habit/sleep/steps/weight and exports without storage secrets", async () => {
      const writes: [string, unknown][] = [
        ["water", { amountMl: 300 }],
        ["water", { amountMl: 200 }],
        ["habit", { key: "stretch", completed: true }],
        ["sleep", { durationMinutes: 420 }],
        ["steps", { count: 3200 }],
        ["weight", { weightKg: 74.5 }],
      ];
      for (const [kind, data] of writes) {
        const result = await request(owner, "POST", `/logs/${kind}`, {
          date: today,
          data,
        });
        assert.equal(result.status, 201);
        if (kind === "weight") weightId = result.body.log.id;
      }
      const summary = await request(
        owner,
        "GET",
        `/summary?date=${today}&timezone=Asia%2FKolkata`
      );
      assert.equal(summary.status, 200);
      assert.equal(summary.body.today.workouts, 1);
      assert.equal(summary.body.today.workoutMinutes, 25);
      assert.equal(summary.body.today.nutrients.calories, 400);
      assert.equal(summary.body.today.waterMl, 500);
      assert.equal(summary.body.today.sleepMinutes, 420);
      assert.equal(summary.body.today.steps, 3200);
      assert.equal(summary.body.today.weightKg, 74.5);
      const progress = await request(
        owner,
        "GET",
        `/progress?from=${today}&to=${today}&timezone=UTC`
      );
      assert.equal(progress.body.totals.habitsCompleted, 1);
      assert.equal(progress.body.totals.activeDays, 1);
      assert.equal(progress.body.weightChangeKg, null);
      assert.equal(
        (await request(other, "GET", `/logs/weight/${weightId}`)).status,
        404
      );
      const exported = await request(owner, "GET", "/export");
      assert.equal(exported.status, 200);
      assert.ok(exported.body.logs.length >= 8);
      assert.equal(exported.body.foods.length, 2);
      assert.equal(exported.body.recipes.length, 1);
      assert.ok(!JSON.stringify(exported.body).includes("encryptedData"));
      assert.ok(!JSON.stringify(exported.body).includes("storageKey"));
    });
    it("rejects forged media, impossible quantities/future dates and deletes only owner data", async () => {
      assert.equal(
        (
          await request(owner, "POST", "/logs/workout", {
            date: today,
            data: {
              name: "Foreign plan reference",
              status: "in_progress",
              exercises: [],
              planId: randomUUID(),
            },
          })
        ).status,
        403
      );
      assert.equal(
        (
          await request(owner, "POST", "/logs/workout", {
            date: today,
            data: {
              name: "Foreign media",
              status: "in_progress",
              exercises: [],
              mediaIds: [randomUUID()],
            },
          })
        ).status,
        403
      );
      assert.equal(
        (
          await request(owner, "POST", "/logs/water", {
            date: today,
            data: { amountMl: -1 },
          })
        ).status,
        400
      );
      assert.equal(
        (
          await request(owner, "POST", "/logs/steps", {
            date: "2099-01-01",
            data: { count: 10 },
          })
        ).status,
        400
      );
      await request(other, "PATCH", "/profile", { heightCm: 180 });
      assert.equal((await request(owner, "DELETE", "/data")).status, 200);
      assert.equal(
        (await request(owner, "GET", "/profile")).body.profile,
        null
      );
      assert.equal(
        (await request(owner, "GET", "/logs/workout")).body.logs.length,
        0
      );
      assert.equal(
        (await request(owner, "GET", "/plans")).body.plans.length,
        0
      );
      assert.equal(
        (await request(owner, "GET", "/foods")).body.foods.length,
        0
      );
      assert.equal(
        (await request(other, "GET", "/profile")).body.profile.assessment
          .heightCm,
        180
      );
    });
    it("rolls back storage failures and serializes account closure against late writes", async () => {
      const { fitnessService } = await import("../fitness/FitnessService.js");
      await request(closing, "PATCH", "/profile", {
        heightCm: 170,
        medicalConditions: "must survive failed purge",
      });
      fitnessService.setMediaPurger(async () => {
        throw new Error("Injected object-store failure");
      });
      await assert.rejects(
        () => fitnessService.deleteData(closing, { deactivateAccount: true }),
        /Injected object-store failure/
      );
      assert.equal(
        (await request(closing, "GET", "/profile")).body.profile.assessment
          .medicalConditions,
        "must survive failed purge"
      );
      let release!: () => void, entered!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      fitnessService.setMediaPurger(async (_user, tx) => {
        assert.ok(tx, "purger must use the existing locked transaction");
        entered();
        await gate;
      });
      try {
        const deletion = fitnessService.deleteData(closing, {
          deactivateAccount: true,
        });
        await started;
        const lateWrite = fitnessService
          .createLog(closing, "water", { date: today, data: { amountMl: 200 } })
          .then(
            () => ({ allowed: true }),
            (error) => ({ allowed: false, status: error.status })
          );
        release();
        await deletion;
        const result = await lateWrite;
        assert.equal(result.allowed, false);
        assert.equal("status" in result ? result.status : undefined, 403);
        assert.equal((await request(closing, "GET", "/profile")).status, 401);
        const { eq } = await import("drizzle-orm");
        const records = await db
          .select()
          .from(schema.waterLogs)
          .where(eq(schema.waterLogs.userId, closing));
        assert.equal(records.length, 0);
        const [user] = await db
          .select()
          .from(schema.mobileUsers)
          .where(eq(schema.mobileUsers.id, closing));
        assert.equal(user.isActive, false);
      } finally {
        release();
        fitnessService.configureDeleteHooks({});
      }
    });
  }
);
