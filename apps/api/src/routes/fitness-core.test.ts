import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, describe, it, mock } from "node:test";
import { Hono } from "hono";
import {
  CompleteFitnessAssessmentSchema,
  FitnessAssessmentSchema,
  FitnessDateSchema,
  FitnessLogDataSchemas,
  type FitnessLog,
} from "@anticlock/contracts";
import {
  calculateFitnessProgress,
  fitnessDateInZone,
  shiftFitnessDate,
  aggregateFitnessDays,
} from "../fitness/aggregates.js";
import { decryptFitnessData, encryptFitnessData } from "../fitness/privacy.js";
import {
  fitnessService,
  applyFitnessWorkoutAction,
} from "../fitness/FitnessService.js";
import { fitnessMobileRoutes } from "./fitness.js";
import { signToken } from "../lib/auth.js";
import type { AppEnv } from "../middleware/auth.js";

const user = randomUUID();
const nutrients = {
  calories: 100,
  proteinG: 10,
  carbsG: 10,
  fatG: 2,
  fibreG: 3,
};
const log = (
  kind: FitnessLog["kind"],
  date: string,
  data: FitnessLog["data"]
): FitnessLog => ({
  id: randomUUID(),
  kind,
  date,
  data,
  createdAt: `${date}T12:00:00Z`,
  updatedAt: `${date}T12:00:00Z`,
});
afterEach(() => mock.restoreAll());
describe("fitness privacy and calendar aggregates", () => {
  it("binds encrypted data to its owner, uses fresh nonces and rejects tampering", () => {
    const value = { medicalConditions: "private condition", weightKg: 73 };
    const first = encryptFitnessData(user, value);
    const second = encryptFitnessData(user, value);
    assert.notEqual(first, second);
    assert.ok(!first.includes(value.medicalConditions));
    assert.deepEqual(decryptFitnessData(user, first), value);
    assert.throws(() => decryptFitnessData(randomUUID(), first));
    const pieces = first.split(".");
    pieces[2] = Buffer.alloc(16).toString("base64url");
    assert.throws(() => decryptFitnessData(user, pieces.join(".")));
  });
  it("requires a separate valid production encryption key", () => {
    const oldEnv = process.env.NODE_ENV,
      oldKey = process.env.FITNESS_DATA_ENCRYPTION_KEY;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.FITNESS_DATA_ENCRYPTION_KEY;
      assert.throws(
        () => encryptFitnessData(user, {}),
        /required in production/
      );
      process.env.FITNESS_DATA_ENCRYPTION_KEY = "invalid";
      assert.throws(() => encryptFitnessData(user, {}), /32 random bytes/);
      process.env.FITNESS_DATA_ENCRYPTION_KEY = "a".repeat(64);
      assert.deepEqual(
        decryptFitnessData(user, encryptFitnessData(user, { ok: true })),
        { ok: true }
      );
    } finally {
      if (oldEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = oldEnv;
      if (oldKey === undefined) delete process.env.FITNESS_DATA_ENCRYPTION_KEY;
      else process.env.FITNESS_DATA_ENCRYPTION_KEY = oldKey;
    }
  });
  it("validates calendar dates, partial assessment and impossible values", () => {
    assert.equal(FitnessDateSchema.safeParse("2026-02-30").success, false);
    assert.equal(FitnessDateSchema.safeParse("2024-02-29").success, true);
    assert.equal(
      FitnessAssessmentSchema.safeParse({ gender: "nonbinary" }).success,
      true
    );
    assert.equal(
      CompleteFitnessAssessmentSchema.safeParse({ gender: "nonbinary" })
        .success,
      false
    );
    for (const input of [
      { weightKg: -1 },
      { heightCm: 300 },
      { sleepHours: 25 },
      { calculationSex: "nonbinary" },
    ])
      assert.equal(FitnessAssessmentSchema.safeParse(input).success, false);
    assert.equal(
      FitnessLogDataSchemas.water.safeParse({ amountMl: -10 }).success,
      false
    );
    assert.equal(
      FitnessLogDataSchemas.steps.safeParse({ count: 2.5 }).success,
      false
    );
    assert.equal(
      FitnessLogDataSchemas.sleep.safeParse({ durationMinutes: 1441 }).success,
      false
    );
  });
  it("uses explicit local dates across midnight, leap days and DST", () => {
    assert.equal(
      fitnessDateInZone(new Date("2026-11-13T20:00:00Z"), "Asia/Kolkata"),
      "2026-11-14"
    );
    assert.equal(shiftFitnessDate("2024-02-28", 1), "2024-02-29");
    assert.equal(shiftFitnessDate("2026-03-08", 1), "2026-03-09");
    assert.throws(() => fitnessDateInZone(new Date(), "invalid/timezone"));
  });
  it("computes real totals, servings, latest weight, habit toggles and completed strength only", () => {
    const logs = [
      log("meal", "2026-11-12", {
        mealType: "lunch",
        foods: [{ name: "Custom serving", servings: 2, nutrients }],
      }),
      log("water", "2026-11-12", { amountMl: 250 }),
      log("water", "2026-11-12", { amountMl: 350 }),
      log("workout", "2026-11-12", {
        name: "Strength",
        status: "completed",
        durationMinutes: 30,
        exercises: [
          {
            name: "Squat",
            sets: [
              { reps: 8, weightKg: 20 },
              { reps: 6, weightKg: 25 },
            ],
          },
        ],
      }),
      log("workout", "2026-11-12", {
        name: "Unfinished",
        status: "paused",
        durationMinutes: 99,
        exercises: [{ name: "Squat", sets: [{ reps: 100, weightKg: 200 }] }],
      }),
      log("sleep", "2026-11-13", { durationMinutes: 420 }),
      log("steps", "2026-11-13", { count: 4500 }),
      log("weight", "2026-11-12", { weightKg: 70 }),
      log("weight", "2026-11-13", { weightKg: 69.5 }),
      log("habit", "2026-11-13", { key: "stretch", completed: true }),
    ];
    const result = calculateFitnessProgress(
      logs,
      "2026-11-12",
      "2026-11-14",
      "Asia/Kolkata",
      new Date("2026-11-14T10:00:00Z")
    );
    assert.equal(result.totals.workouts, 1);
    assert.equal(result.totals.workoutMinutes, 30);
    assert.equal(result.totals.nutrients.calories, 200);
    assert.equal(result.totals.waterMl, 600);
    assert.equal(result.totals.sleepMinutes, 420);
    assert.equal(result.totals.steps, 4500);
    assert.equal(result.streak, 2);
    assert.equal(result.currentStreak, 2);
    assert.equal(result.longestStreak, 2);
    assert.ok(result.days[0]!.recordedKinds!.includes("meal"));
    assert.deepEqual(result.days[2]!.recordedKinds, []);
    assert.equal(result.weightChangeKg, -0.5);
    assert.deepEqual(result.strength, [
      {
        exercise: "Squat",
        maxWeightKg: 25,
        totalReps: 14,
        hasRecordedLoad: true,
        series: [{ date: "2026-11-12", maxWeightKg: 25, totalReps: 14 }],
        weightChangeKg: null,
      },
    ]);
    assert.equal(result.days[2]!.weightKg, null);
    const check = log("habit", "2026-11-13", { key: "walk", completed: true });
    const uncheck = {
      ...log("habit", "2026-11-13", { key: "walk", completed: false }),
      createdAt: "2026-11-13T13:00:00Z",
    };
    assert.equal(
      aggregateFitnessDays([check, uncheck], "2026-11-13", "2026-11-13")[0]!
        .habitsCompleted,
      0
    );
  });
  it("returns empty statistics without manufacturing history and rejects unbounded ranges", () => {
    const result = calculateFitnessProgress(
      [],
      "2026-11-01",
      "2026-11-14",
      "UTC"
    );
    assert.equal(result.totals.workouts, 0);
    assert.equal(result.weightChangeKg, null);
    assert.deepEqual(result.strength, []);
    assert.deepEqual(result.insights, []);
    assert.equal(result.streak, 0);
    assert.ok(result.days.every((day) => day.recordedKinds?.length === 0));
    assert.throws(() =>
      calculateFitnessProgress([], "2024-01-01", "2026-11-14", "UTC")
    );
    assert.throws(() =>
      calculateFitnessProgress([], "2026-11-14", "2026-11-01", "UTC")
    );
  });
  it("does not extend a historical streak across a completed unlogged end date", () => {
    const rows = [
      log("steps", "2026-11-10", { count: 100 }),
      log("steps", "2026-11-11", { count: 200 }),
    ];
    const historical = calculateFitnessProgress(
      rows,
      "2026-11-10",
      "2026-11-12",
      "UTC",
      new Date("2026-11-14T12:00Z")
    );
    assert.equal(historical.currentStreak, 0);
    assert.equal(historical.longestStreak, 2);
  });
  it("enforces workout transitions and persists help without silently completing exercise", () => {
    const initial = {
      name: "Walk",
      status: "in_progress" as const,
      exercises: [],
    };
    const paused = applyFitnessWorkoutAction(initial, { action: "pause" });
    assert.equal(paused.status, "paused");
    assert.deepEqual(
      applyFitnessWorkoutAction(paused, { action: "pause" }),
      paused
    );
    const help = applyFitnessWorkoutAction(paused, {
      action: "request_help",
      painNote: "Knee discomfort",
    });
    assert.equal(help.helpRequested, true);
    assert.equal(help.status, "paused");
    const completed = applyFitnessWorkoutAction(
      help,
      { action: "complete" },
      new Date("2026-11-14T10:00:00Z")
    );
    assert.equal(completed.completedAt, "2026-11-14T10:00:00.000Z");
    assert.throws(() =>
      applyFitnessWorkoutAction(completed, { action: "resume" })
    );
  });
});
describe("fitness authenticated routes", () => {
  const app = () =>
    new Hono<AppEnv>().route("/v1/fitness", fitnessMobileRoutes);
  async function headers(kind: "mobile" | "admin" = "mobile") {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await signToken({
        kind,
        sub: user,
        email: "",
        name: "Member",
        roles: [],
      })}`,
    };
  }
  it("requires mobile authentication before profile or export access", async () => {
    const read = mock.method(fitnessService, "getProfile", async () => null);
    const exportData = mock.method(
      fitnessService,
      "exportData",
      async () => ({} as any)
    );
    for (const path of ["/profile", "/export"]) {
      assert.equal((await app().request(`/v1/fitness${path}`)).status, 401);
      assert.equal(
        (
          await app().request(`/v1/fitness${path}`, {
            headers: await headers("admin"),
          })
        ).status,
        403
      );
    }
    assert.equal(read.mock.callCount(), 0);
    assert.equal(exportData.mock.callCount(), 0);
  });
  it("uses authenticated ownership, no-store headers and typed draft parsing", async () => {
    const save = mock.method(
      fitnessService,
      "saveProfile",
      async () => ({ id: randomUUID() } as any)
    );
    const response = await app().request("/v1/fitness/profile", {
      method: "PATCH",
      headers: await headers(),
      body: JSON.stringify({ heightCm: 175 }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(save.mock.calls[0]!.arguments, [user, { heightCm: 175 }]);
    const forged = await app().request("/v1/fitness/profile", {
      method: "PATCH",
      headers: await headers(),
      body: JSON.stringify({ userId: randomUUID(), heightCm: 175 }),
    });
    assert.equal(forged.status, 400);
    assert.equal(save.mock.callCount(), 1);
  });
  it("rejects malformed JSON, invalid log kinds and impossible quantities before service calls", async () => {
    const create = mock.method(
      fitnessService,
      "createLog",
      async () => ({} as any)
    );
    for (const [kind, body] of [
      ["water", "{bad"],
      ["water", JSON.stringify({ date: "2026-11-14", data: { amountMl: -3 } })],
      ["blood", JSON.stringify({ date: "2026-11-14", data: {} })],
    ]) {
      const response = await app().request(`/v1/fitness/logs/${kind}`, {
        method: "POST",
        headers: await headers(),
        body,
      });
      assert.equal(response.status, 400);
    }
    assert.equal(create.mock.callCount(), 0);
  });
});
