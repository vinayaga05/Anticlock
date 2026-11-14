import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { shiftFitnessDate, fitnessDateInZone } from "../fitness/aggregates.js";
import {
  fitnessWeightSnapshots,
  compareFitnessTarget,
  fitnessProfileNeedsReview,
} from "../fitness/comparisons.js";
import type { FitnessPlanContent, FitnessProfile } from "@anticlock/contracts";
const testDatabase = process.env.TEST_DATABASE_URL?.trim();
if (testDatabase) process.env.DATABASE_URL = testDatabase;
describe("Fitness source-aware comparisons", () => {
  it("does not classify a healthy profile as clinical solely because its optional goal deadline passed", async () => {
    const { buildFitnessBaseline } = await import(
      "../fitness/FitnessEngine.js"
    );
    const earlier = new Date("2026-11-14T12:00:00Z"),
      later = new Date("2026-11-16T12:00:00Z");
    const assessment = {
      dateOfBirth: "1990-01-01",
      heightCm: 175,
      weightKg: 80,
      goals: ["strength" as const],
      activityLevel: "light" as const,
      experience: "beginner" as const,
      availableDays: [1],
      equipment: ["none"],
      foodPreferences: ["no preference"],
      disclaimerAccepted: true,
      timezone: "UTC",
      targetDate: "2026-11-15",
    };
    const baseline = buildFitnessBaseline(assessment, earlier);
    const profile = {
      assessment,
      baseline,
      status: "complete",
    } as FitnessProfile;
    assert.equal(fitnessProfileNeedsReview(profile, later), false);
    assert.equal(
      fitnessProfileNeedsReview(
        { ...profile, assessment: { ...assessment, pregnant: true } },
        later
      ),
      true
    );
    assert.equal(
      fitnessProfileNeedsReview(
        { ...profile, assessment: { ...assessment, targetWeightKg: 40 } },
        later
      ),
      true
    );
  });

  it("keeps absent targets unavailable and reports actual zero separately from missing records", () => {
    assert.equal(compareFitnessTarget(0, null), null);
    assert.deepEqual(compareFitnessTarget(0, { min: 100, max: 200 }), {
      actual: 0,
      targetMin: 100,
      targetMax: 200,
      percent: 0,
      inRange: false,
      relation: "below",
    });
  });
  it("does not pretend an assessment starting weight is measured progress or use future starting data", () => {
    const profile = {
      assessment: { weightKg: 80, targetWeightKg: 70 },
      assessmentStart: { date: "2026-11-10", weightKg: 80 },
      completedAt: "2026-11-10T10:00:00Z",
      createdAt: "2026-11-10T10:00:00Z",
    } as FitnessProfile;
    const empty = fitnessWeightSnapshots(
      profile,
      [],
      "2026-11-14",
      "UTC",
      true
    );
    assert.equal(empty.latestWeight?.source, "assessment");
    assert.equal(empty.weightProgress?.progressPercent, null);
    assert.equal(empty.weightProgress?.startSource, "initial_assessment");
    assert.equal(
      fitnessWeightSnapshots(profile, [], "2026-11-09", "UTC", true)
        .latestWeight,
      null
    );
  });
});
describe(
  "Fitness targets, due sessions and weight snapshots (PostgreSQL)",
  { skip: !testDatabase },
  () => {
    const user = randomUUID(),
      other = randomUUID(),
      users = [user, other];
    let db: any,
      sql: any,
      schema: any,
      service: any,
      encrypt: any,
      decrypt: any,
      planId: string,
      content: FitnessPlanContent;
    const today = fitnessDateInZone(new Date(), "UTC"),
      created = shiftFitnessDate(today, -4),
      oldDay = shiftFitnessDate(today, -3),
      revised = shiftFitnessDate(today, -1),
      priorWeight = shiftFitnessDate(today, -8),
      started = shiftFitnessDate(today, -14);
    const day = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
    const assessment = {
      dateOfBirth: "1990-01-01",
      heightCm: 175,
      weightKg: 80,
      targetWeightKg: 70,
      goals: ["strength"],
      activityLevel: "light",
      experience: "beginner",
      availableDays: [1, 3, 5],
      equipment: ["none"],
      foodPreferences: ["no preference"],
      disclaimerAccepted: true,
      timezone: "UTC",
    };
    before(async () => {
      const client = await import("../db/client.js");
      db = client.db;
      sql = client.sql;
      schema = await import("../db/schema.js");
      service = (await import("../fitness/FitnessService.js")).fitnessService;
      const privacy = await import("../fitness/privacy.js");
      encrypt = privacy.encryptFitnessData;
      decrypt = privacy.decryptFitnessData;
      await db.insert(schema.mobileUsers).values(
        users.map((id) => ({
          id,
          phone: `comparison-${id}`,
          displayName: "Comparison fixture",
        }))
      );
      await service.saveProfile(user, assessment, true);
      await service.saveProfile(other, assessment, true);
      const plan = await service.generatePlan(user);
      planId = plan.id;
      const { eq } = await import("drizzle-orm");
      const [profile] = await db
        .select()
        .from(schema.fitnessProfiles)
        .where(eq(schema.fitnessProfiles.userId, user));
      const payload = decrypt(user, profile.encryptedData);
      payload.assessmentStart = { date: started, weightKg: 80 };
      await db
        .update(schema.fitnessProfiles)
        .set({ encryptedData: encrypt(user, payload) })
        .where(eq(schema.fitnessProfiles.id, profile.id));
      content = {
        ...plan.content,
        name: "Private fixture plan name",
        workouts: Array.from({ length: 7 }, (_, day) => ({
          day,
          name: `Planned session ${day}`,
          durationMinutes: 20,
          exercises: [{ name: "Loaded squat", sets: 1, reps: 10 }],
        })),
        nutrition: {
          guidance: ["Fixture professional guidance"],
          calories: { min: 1800, max: 2000 },
        },
        baselineTargets: {
          proteinG: { min: 80, max: 100 },
          carbsG: { min: 200, max: 300 },
          fatG: { min: 50, max: 70 },
          fibreG: 25,
          waterMl: 2000,
        },
        habits: [
          {
            key: "steps",
            label: "Chosen steps habit",
            target: 6000,
            unit: "steps",
          },
          {
            key: "sleep",
            label: "Chosen sleep habit",
            target: 7,
            unit: "hours",
          },
        ],
      };
      await db
        .update(schema.fitnessPlans)
        .set({
          createdAt: new Date(`${created}T00:00:00Z`),
          updatedAt: new Date(`${revised}T00:00:00Z`),
          currentVersion: 2,
          title: "Fitness plan",
        })
        .where(eq(schema.fitnessPlans.id, planId));
      await db
        .update(schema.fitnessPlanVersions)
        .set({
          createdAt: new Date(`${created}T00:00:00Z`),
          encryptedData: encrypt(user, content),
        })
        .where(eq(schema.fitnessPlanVersions.planId, planId));
      await db.insert(schema.fitnessPlanVersions).values({
        planId,
        version: 2,
        authorUserId: user,
        createdAt: new Date(`${revised}T00:00:00Z`),
        encryptedData: encrypt(user, {
          ...content,
          nutrition: {
            guidance: ["Revised fixture guidance"],
            calories: { min: 2200, max: 2400 },
            targets: {
              proteinG: { min: 110, max: 130 },
              waterMl: { min: 2500, max: 3000 },
            },
          },
        }),
      });
      await service.createLog(user, "weight", {
        date: priorWeight,
        data: { weightKg: 77 },
      });
      for (let i = 0; i < 2; i++)
        await service.createLog(user, "workout", {
          date: oldDay,
          data: {
            name: `Planned session ${day(oldDay)}`,
            status: "completed",
            planId,
            planVersion: 1,
            planDay: day(oldDay),
            durationMinutes: 20,
            exercises: [
              { name: "Loaded squat", sets: [{ weightKg: 20, reps: 10 }] },
            ],
          },
        });
      await service.createLog(user, "workout", {
        date: today,
        data: {
          name: "Manual alternative",
          status: "completed",
          exercises: [{ name: "Bodyweight push-up", sets: [{ reps: 10 }] }],
        },
      });
      await service.createLog(user, "workout", {
        date: today,
        data: {
          name: `Planned session ${day(today)}`,
          status: "completed",
          planId,
          planVersion: 2,
          planDay: day(today),
          durationMinutes: 20,
          exercises: [
            { name: "Loaded squat", sets: [{ weightKg: 25, reps: 8 }] },
          ],
        },
      });
      for (const date of [oldDay, revised]) {
        await service.createLog(user, "meal", {
          date,
          data: {
            mealType: "dinner",
            foods: [
              {
                name: "Recorded fixture daily meal",
                servings: 1,
                nutrients: {
                  calories: 1900,
                  proteinG: 90,
                  carbsG: 250,
                  fatG: 60,
                  fibreG: 25,
                },
              },
            ],
          },
        });
        await service.createLog(user, "water", {
          date,
          data: { amountMl: date === oldDay ? 2000 : 2500 },
        });
      }
    });
    after(async () => {
      if (!db) return;
      try {
        const { inArray } = await import("drizzle-orm");
        await db
          .delete(schema.mobileUsers)
          .where(inArray(schema.mobileUsers.id, users));
      } finally {
        await sql.end({ timeout: 5 });
      }
    });
    it("shows a real prior-week weight with its source and counts only matching due planned sessions", async () => {
      const result = await service.summary(user, today, "UTC");
      assert.equal(result.today.weightKg, null);
      assert.deepEqual(result.latestWeight, {
        weightKg: 77,
        date: priorWeight,
        source: "measurement",
      });
      assert.equal(result.weightProgress.startWeightKg, 80);
      assert.equal(result.weightProgress.changeKg, -3);
      assert.equal(result.weightProgress.remainingKg, 7);
      assert.equal(result.weightProgress.progressPercent, 30);
      assert.equal(result.targetStatus, "available");
      assert.deepEqual(result.targets.proteinG, { min: 110, max: 130 });
      assert.deepEqual(result.targets.waterMl, { min: 2500, max: 3000 });
      assert.deepEqual(result.targets.steps, { min: 6000, max: 6000 });
      assert.deepEqual(result.targets.sleepMinutes, { min: 420, max: 420 });
      assert.equal(result.weekly.workouts, 4);
      assert.equal(result.weekly.plannedWorkouts, 5);
      assert.equal(result.weekly.completedPlannedWorkouts, 2);
      assert.equal(result.weekly.plannedDays, 5);
      assert.equal(result.weekly.completedPlannedDays, 2);
      assert.equal(result.weekly.completionPercent, 40);
      assert.equal(result.weekly.consistencyPercent, 40);
      assert.deepEqual(result.todayWorkout, {
        planned: 1,
        completed: 1,
        completionPercent: 100,
      });
      assert.ok(
        result.weekly.dueDates.every(
          (date: string) => date >= created && date <= today
        )
      );
      const { eq } = await import("drizzle-orm");
      const [row] = await db
        .select()
        .from(schema.fitnessPlans)
        .where(eq(schema.fitnessPlans.id, planId));
      assert.equal(row.title, "Fitness plan");
      assert.equal(result.plan.title, "Private fixture plan name");
      const isolated = await service.summary(other, today, "UTC");
      assert.equal(isolated.latestWeight.source, "assessment");
      assert.equal(isolated.targetStatus, "no_plan");
      assert.equal(isolated.weekly.completionPercent, null);
    });
    it("uses the applicable saved version and recorded days without filling missing nutrition or future targets", async () => {
      const result = await service.progress(
        user,
        shiftFitnessDate(today, -6),
        shiftFitnessDate(today, 1),
        "UTC"
      );
      const old = result.comparisons.find((d: any) => d.date === oldDay),
        recent = result.comparisons.find((d: any) => d.date === revised),
        missing = result.comparisons.find((d: any) => d.date === today),
        before = result.comparisons.find(
          (d: any) => d.date === shiftFitnessDate(created, -1)
        ),
        future = result.comparisons.at(-1);
      assert.equal(old.version, 1);
      assert.equal(old.basis, "saved_plan_version");
      assert.equal(old.nutrition.calories.inRange, true);
      assert.deepEqual(old.targets.calories, { min: 1800, max: 2000 });
      assert.deepEqual(old.targets.proteinG, { min: 80, max: 100 });
      assert.equal(recent.version, 2);
      assert.equal(recent.nutrition.calories.inRange, false);
      assert.deepEqual(recent.targets.calories, { min: 2200, max: 2400 });
      assert.equal(missing.nutrition, null);
      assert.equal(missing.water, null);
      assert.equal(before.targets, null);
      assert.equal(future.workout, null);
      assert.equal(result.adherence.nutritionRecordedDays, 2);
      assert.equal(result.adherence.nutritionInRangeDays, 1);
      assert.equal(result.adherence.nutritionInRangePercent, 50);
      assert.equal(result.adherence.plannedWorkouts, 5);
      assert.equal(result.adherence.completedPlannedWorkouts, 2);
      assert.match(result.targetBasisNotice, /latest saved version/);
      assert.equal(result.currentWeightProgress.progressPercent, 30);
      const strength = result.strength.find(
        (s: any) => s.exercise === "Loaded squat"
      );
      assert.equal(strength.hasRecordedLoad, true);
      assert.deepEqual(strength.series, [
        { date: oldDay, maxWeightKg: 20, totalReps: 20 },
        { date: today, maxWeightKg: 25, totalReps: 8 },
      ]);
      assert.equal(strength.weightChangeKg, 5);
      const bodyweight = result.strength.find(
        (s: any) => s.exercise === "Bodyweight push-up"
      );
      assert.equal(bodyweight.hasRecordedLoad, false);
      assert.deepEqual(bodyweight.series, []);
      assert.equal(bodyweight.weightChangeKg, null);
    });
    it("labels baseline fallback as a current-target comparison and withholds risk/needs-review numeric targets", async () => {
      const { eq, and } = await import("drizzle-orm");
      const old = { ...content };
      delete old.baselineTargets;
      await db
        .update(schema.fitnessPlanVersions)
        .set({ encryptedData: encrypt(user, old) })
        .where(
          and(
            eq(schema.fitnessPlanVersions.planId, planId),
            eq(schema.fitnessPlanVersions.version, 1)
          )
        );
      assert.equal(
        (await service.progress(user, oldDay, oldDay, "UTC")).comparisons[0]
          .basis,
        "current_targets"
      );
      await service.saveProfile(user, { pregnant: true });
      const result = await service.summary(user, today, "UTC");
      assert.equal(result.targetStatus, "needs_review");
      assert.equal(result.targets, null);
      assert.equal(result.weightProgress.targetWeightKg, null);
      assert.equal(result.weightProgress.progressPercent, null);
      const progress = await service.progress(user, oldDay, today, "UTC");
      assert.ok(progress.comparisons.every((d: any) => d.targets === null));
      assert.equal(progress.adherence.nutritionInRangePercent, null);
      assert.equal(progress.currentTargets, null);
    });
  }
);
