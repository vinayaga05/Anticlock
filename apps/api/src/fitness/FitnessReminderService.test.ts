import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, describe, it, mock } from "node:test";
import type { FitnessAssessment, FitnessSummary } from "@anticlock/contracts";
import { encryptFitnessData } from "./privacy.js";

const testDatabase = process.env.TEST_DATABASE_URL?.trim();
if (testDatabase) process.env.DATABASE_URL = testDatabase;
let collect: typeof import("./FitnessReminderService.js").collectFitnessReminders;
let ReminderService: typeof import("./FitnessReminderService.js").FitnessReminderService;
before(async () => {
  const module = await import("./FitnessReminderService.js");
  collect = module.collectFitnessReminders;
  ReminderService = module.FitnessReminderService;
});
afterEach(() => mock.restoreAll());
const USER = randomUUID(),
  PLAN = randomUUID();
const config = {
  enabled: true,
  workouts: false,
  meals: false,
  water: false,
  habits: false,
  weeklySummary: false,
};
const assessment = (
  overrides: Partial<FitnessAssessment> = {}
): FitnessAssessment => ({
  timezone: "UTC",
  reminders: { ...config, workouts: true },
  ...overrides,
});
function summary(a = assessment(), day = 1): FitnessSummary {
  const now = "2026-11-16T11:00:00Z",
    today = {
      date: "2026-11-16",
      workouts: 0,
      workoutMinutes: 0,
      nutrients: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fibreG: 0 },
      waterMl: 0,
      steps: 0,
      sleepMinutes: 0,
      habitsCompleted: 0,
      weightKg: null,
      active: false,
      recordedKinds: [],
    };
  return {
    date: today.date,
    timezone: a.timezone ?? "UTC",
    profile: {
      id: randomUUID(),
      assessment: a,
      status: "complete",
      baseline: null,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    plan: {
      id: PLAN,
      title: "Private plan title",
      status: "active",
      currentVersion: 1,
      providerId: null,
      createdAt: now,
      updatedAt: now,
      content: {
        name: "Private name",
        description: "Private description",
        requiresProfessionalReview: false,
        workouts: [
          { day, name: "Private session", durationMinutes: 20, exercises: [] },
        ],
        nutrition: { guidance: [], calories: null },
        habits: [],
        assumptions: [],
      },
    },
    today,
    weekly: {
      activeDays: 0,
      workouts: 0,
      workoutMinutes: 0,
      streak: 0,
      days: [today],
    },
    logs: [],
  };
}
describe("Fitness opt-in reminder clock and privacy rules", () => {
  it("defaults every reminder off and requires a completed saved profile", () => {
    const now = new Date("2026-11-16T18:05:00Z");
    assert.deepEqual(collect({}, summary(), now), []);
    assert.deepEqual(
      collect(
        assessment({
          reminders: { ...config, enabled: false, workouts: true },
        }),
        summary(),
        now
      ),
      []
    );
    const draft = summary();
    draft.profile!.status = "draft";
    assert.deepEqual(collect(assessment(), draft, now), []);
  });
  it("uses local wall time and actual plan weekday with a bounded ten-minute catch-up", () => {
    const a = assessment({ timezone: "Asia/Kolkata" }),
      s = summary(a);
    const due = collect(a, s, new Date("2026-11-16T12:35:00Z"));
    assert.equal(due.length, 1);
    assert.equal(due[0]!.type, "fitness_workout_reminder");
    assert.deepEqual(due[0]!.data, {
      kind: "fitness",
      screen: "FitnessWorkout",
      date: "2026-11-16",
      planId: PLAN,
      day: 1,
    });
    assert.deepEqual(collect(a, s, new Date("2026-11-16T12:29:59Z")), []);
    assert.deepEqual(collect(a, s, new Date("2026-11-16T12:40:00Z")), []);
    assert.deepEqual(collect(a, s, new Date("2026-11-17T12:35:00Z")), []);
    assert.equal(
      collect(a, s, new Date("2026-11-16T12:35:00Z"))[0]!.idempotencyKey,
      due[0]!.idempotencyKey
    );
  });
  it("does not create workout reminders without a current eligible plan or after a completed daily session", () => {
    const now = new Date("2026-11-16T18:01:00Z");
    for (const change of [
      (s: FitnessSummary) => {
        s.plan = null;
      },
      (s: FitnessSummary) => {
        s.plan!.status = "needs_review";
      },
      (s: FitnessSummary) => {
        s.plan!.content.requiresProfessionalReview = true;
      },
      (s: FitnessSummary) => {
        s.weekly.days[0]!.workouts = 1;
      },
    ]) {
      const s = summary();
      change(s);
      assert.deepEqual(collect(assessment(), s, now), []);
    }
  });
  it("handles a Sunday reminder across local midnight with exact weekly range and generic payloads", () => {
    const a = assessment({
      medicalConditions: "DO NOT PUT THIS IN A PUSH",
      reminders: {
        ...config,
        workouts: true,
        meals: true,
        water: true,
        habits: true,
        weeklySummary: true,
        workoutTime: "23:58",
        mealTime: "23:58",
        waterTime: "23:58",
        habitTime: "23:58",
        weeklySummaryTime: "23:58",
      },
    });
    const s = summary(a, 0);
    const events = collect(a, s, new Date("2026-11-16T00:03:00Z"));
    assert.equal(events.length, 5);
    const weekly = events.find((e) => e.type === "fitness_weekly_summary")!;
    assert.equal(weekly.data.date, "2026-11-15");
    assert.equal(weekly.data.from, "2026-11-09");
    assert.equal(weekly.data.to, "2026-11-15");
    const payload = JSON.stringify(events);
    for (const secret of [
      "DO NOT PUT THIS",
      "Private plan title",
      "Private name",
      "Private session",
      "medicalConditions",
      "weightKg",
      "calories",
    ])
      assert.ok(!payload.includes(secret));
  });
  it("coalesces a running job and isolates failures without logging health or ciphertext", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let pages = 0;
    const service = new ReminderService({
      profiles: async () => {
        pages++;
        await gate;
        return [];
      },
      dueBookings: async () => [],
      now: () => new Date("2026-11-16T18:01Z"),
    });
    const running = service.runOnce();
    assert.equal((await service.runOnce()).skipped, true);
    release();
    await running;
    assert.equal(pages, 1);
    const a = assessment(),
      s = summary(a),
      notify = mock.fn(async () => {}),
      error = mock.method(console, "error", () => {});
    const good = {
      id: randomUUID(),
      userId: USER,
      encryptedData: encryptFitnessData(USER, { assessment: a }),
    };
    const isolated = new ReminderService({
      profiles: async () => [
        { ...good, id: randomUUID(), encryptedData: "private-ciphertext" },
        good,
      ],
      summary: async () => s,
      notify,
      dueBookings: async () => [],
      now: () => new Date("2026-11-16T18:01Z"),
    });
    assert.equal((await isolated.runOnce()).reminders, 1);
    assert.equal(notify.mock.callCount(), 1);
    assert.deepEqual(error.mock.calls[0]!.arguments, [
      "[fitness-reminders] user_failed",
    ]);
  });
  it("rechecks current opt-out and verifies both real consultation participants before sending", async () => {
    const a = assessment(),
      s = summary(a);
    s.profile!.assessment = { ...a, reminders: { ...config, enabled: false } };
    const notify = mock.fn(async () => {});
    const row = {
      id: randomUUID(),
      userId: USER,
      encryptedData: encryptFitnessData(USER, { assessment: a }),
    };
    const booked = {
      id: randomUUID(),
      userId: USER,
      providerId: randomUUID(),
      providerOwnerId: randomUUID(),
      startsAt: new Date("2026-11-16T18:05Z"),
    };
    const service = new ReminderService({
      now: () => new Date("2026-11-16T18:01Z"),
      profiles: async () => [row],
      summary: async () => s,
      notify,
      dueBookings: async () => [booked],
      eligibleConsultations: async () => [
        { bookingId: booked.id, canJoin: true },
      ],
    });
    const result = await service.runOnce();
    assert.equal(result.reminders, 0);
    assert.equal(result.consultations, 2);
    assert.equal(notify.mock.callCount(), 2);
    assert.equal(
      (notify.mock.calls[0]!.arguments as any[])[1].type,
      "fitness_consultation_starting"
    );
    const denied = new ReminderService({
      profiles: async () => [],
      notify,
      dueBookings: async () => [booked],
      eligibleConsultations: async (_user, providerView) => [
        { bookingId: booked.id, canJoin: !providerView },
      ],
    });
    assert.equal((await denied.runOnce()).consultations, 0);
    assert.equal(notify.mock.callCount(), 2);
  });
});
describe(
  "Fitness reminder opt-in and idempotency (PostgreSQL)",
  { skip: !testDatabase },
  () => {
    const users = [randomUUID(), randomUUID(), randomUUID()];
    let db: any, sql: any, schema: any;
    before(async () => {
      const client = await import("../db/client.js");
      db = client.db;
      sql = client.sql;
      schema = await import("../db/schema.js");
      await db.insert(schema.mobileUsers).values(
        users.map((id, index) => ({
          id,
          phone: `reminders-${id}`,
          displayName: "Reminder test fixture",
          isActive: index !== 2,
        }))
      );
      await db.insert(schema.fitnessProfiles).values(
        users.map((userId, index) => ({
          userId,
          status: "complete",
          remindersEnabled: index !== 1,
          encryptedData:
            index === 0
              ? encryptFitnessData(userId, {
                  assessment: assessment({
                    reminders: { ...config, water: true },
                  }),
                  baseline: null,
                })
              : "not-decrypted-without-active-opt-in",
        }))
      );
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
    it("notifies only the explicitly opted active account and persists one row across repeated runs", async () => {
      const errors = mock.method(console, "error", () => {});
      const service = new ReminderService({
        now: () => new Date("2026-11-16T11:05Z"),
        dueBookings: async () => [],
      });
      await service.runOnce();
      await service.runOnce();
      const { inArray } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(schema.notifications)
        .where(inArray(schema.notifications.mobileUserId, users));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].mobileUserId, users[0]);
      assert.equal(rows[0].type, "fitness_water_reminder");
      assert.equal(errors.mock.callCount(), 0);
      assert.ok(!JSON.stringify(rows).includes("weightKg"));
    });
  }
);
