import { createHash } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import {
  CompleteFitnessAssessmentSchema,
  FitnessAssessmentSchema,
  FitnessAssessmentPatchSchema,
  FitnessCreateLogSchema,
  FitnessDateSchema,
  FitnessFoodInputSchema,
  FitnessLogDataSchemas,
  FitnessLogKindSchema,
  FitnessRecipeInputSchema,
  FitnessWorkoutActionSchema,
  type FitnessAssessment,
  type FitnessBaseline,
  type FitnessFood,
  type FitnessLog,
  type FitnessLogData,
  type FitnessLogKind,
  type FitnessPlan,
  type FitnessPlanContent,
  type FitnessPlanVersion,
  type FitnessProgress,
  type FitnessProfile,
  type FitnessRecipe,
  type FitnessSummary,
} from "@anticlock/contracts";
import { db } from "../db/client.js";
import { foodCatalogService } from "./FoodCatalogService.js";
import {
  applicableFitnessPlan,
  currentFitnessTargets,
  fitnessDayComparisons,
  fitnessTargetStatus,
  fitnessWeightSnapshots,
  summarizeFitnessComparisons,
  FITNESS_TARGET_BASIS_NOTICE,
  type FitnessPlanTimelineEntry,
} from "./comparisons.js";
import {
  bodyMeasurements,
  exerciseLogs,
  fitnessConsultations,
  fitnessGoals,
  fitnessPlans,
  fitnessPlanVersions,
  fitnessProfiles,
  fitnessRecipes,
  foodItems,
  habitLogs,
  healthConsents,
  mealLogs,
  mobileUsers,
  progressMedia,
  providerClientRelationships,
  sleepLogs,
  stepLogs,
  waterLogs,
  workoutLogs,
  workoutTemplates,
} from "../db/schema.js";
import { ApiError } from "../lib/httpError.js";
import {
  buildFitnessBaseline,
  buildFitnessStarterPlan,
} from "./FitnessEngine.js";
import { decryptFitnessData, encryptFitnessData } from "./privacy.js";
import {
  addNutrients,
  aggregateFitnessDays,
  calculateFitnessProgress,
  emptyNutrients,
  fitnessDateInZone,
  fitnessStreak,
  shiftFitnessDate,
  validateFitnessRange,
} from "./aggregates.js";

const logTables = {
  workout: workoutLogs,
  meal: mealLogs,
  water: waterLogs,
  habit: habitLogs,
  sleep: sleepLogs,
  steps: stepLogs,
  weight: bodyMeasurements,
};
type LogRow = typeof workoutLogs.$inferSelect;
type ProfilePayload = {
  assessmentStart?: { date: string; weightKg: number };
  assessment: FitnessAssessment;
  baseline: FitnessBaseline | null;
};
export type FitnessTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];
export type FitnessDeleteHooks = {
  deleteMedia?: (userId: string, tx?: FitnessTransaction) => Promise<void>;
};
const missing = () =>
  new ApiError(404, "not_found", "Fitness record not found.");
const id = (value: string) => z.string().uuid().parse(value);
function presentLog(kind: FitnessLogKind, row: LogRow): FitnessLog {
  return {
    id: row.id,
    kind,
    date: row.date,
    data: decryptFitnessData<FitnessLogData>(row.userId, row.encryptedData),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function presentProfile(
  row: typeof fitnessProfiles.$inferSelect
): FitnessProfile {
  const payload = decryptFitnessData<ProfilePayload>(
    row.userId,
    row.encryptedData
  );
  return {
    id: row.id,
    ...payload,
    status: row.status === "complete" ? "complete" : "draft",
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export function applyFitnessWorkoutAction(
  data: z.infer<typeof FitnessLogDataSchemas.workout>,
  input: unknown,
  now = new Date()
): z.infer<typeof FitnessLogDataSchemas.workout> {
  const action = FitnessWorkoutActionSchema.parse(input);
  const transitions: Record<string, { from: string[]; to: string }> = {
    pause: { from: ["in_progress"], to: "paused" },
    resume: { from: ["paused"], to: "in_progress" },
    complete: { from: ["in_progress", "paused"], to: "completed" },
    skip: { from: ["in_progress", "paused"], to: "skipped" },
  };
  if (action.action === "request_help")
    return {
      ...data,
      helpRequested: true,
      ...(action.painNote ? { painNote: action.painNote } : {}),
    };
  const transition = transitions[action.action]!;
  if (transition.to === data.status) return data;
  if (!transition.from.includes(data.status))
    throw new ApiError(
      409,
      "invalid_workout_state",
      "This action is unavailable for the current workout state."
    );
  return {
    ...data,
    status: transition.to as typeof data.status,
    ...(action.action === "complete" ? { completedAt: now.toISOString() } : {}),
    ...(action.painNote
      ? { painNote: action.painNote, helpRequested: true }
      : {}),
  };
}

export class FitnessService {
  private deleteHooks: FitnessDeleteHooks = {};
  configureDeleteHooks(hooks: FitnessDeleteHooks): void {
    this.deleteHooks = hooks;
  }
  setMediaPurger(
    purger: (userId: string, tx?: FitnessTransaction) => Promise<void>
  ): void {
    this.deleteHooks.deleteMedia = purger;
  }
  async activeUser(userId: string): Promise<void> {
    id(userId);
    const [user] = await db
      .select({ id: mobileUsers.id })
      .from(mobileUsers)
      .where(and(eq(mobileUsers.id, userId), eq(mobileUsers.isActive, true)))
      .limit(1);
    if (!user)
      throw new ApiError(
        403,
        "forbidden",
        "An active mobile account is required."
      );
  }
  private async lockOwner(
    tx: FitnessTransaction,
    userId: string
  ): Promise<void> {
    const [owner] = await tx
      .select({ id: mobileUsers.id })
      .from(mobileUsers)
      .where(and(eq(mobileUsers.id, userId), eq(mobileUsers.isActive, true)))
      .for("update");
    if (!owner)
      throw new ApiError(
        403,
        "forbidden",
        "An active mobile account is required."
      );
  }
  async getProfile(userId: string): Promise<FitnessProfile | null> {
    await this.activeUser(userId);
    const [row] = await db
      .select()
      .from(fitnessProfiles)
      .where(eq(fitnessProfiles.userId, userId))
      .limit(1);
    return row ? presentProfile(row) : null;
  }
  private validateAssessmentDates(assessment: FitnessAssessment): void {
    const today = fitnessDateInZone(new Date(), assessment.timezone ?? "UTC");
    if (assessment.dateOfBirth) {
      const year =
        Number(today.slice(0, 4)) - Number(assessment.dateOfBirth.slice(0, 4));
      if (assessment.dateOfBirth >= today || year > 130)
        throw new ApiError(
          400,
          "invalid_birth_date",
          "Enter a valid date of birth."
        );
    }
    if (assessment.targetDate && assessment.targetDate <= today)
      throw new ApiError(
        400,
        "invalid_target_date",
        "Choose a future target date."
      );
    if (
      assessment.availableDays &&
      new Set(assessment.availableDays).size !== assessment.availableDays.length
    )
      throw new ApiError(
        400,
        "validation_error",
        "Available days must be unique."
      );
  }
  async saveProfile(
    userId: string,
    input: unknown,
    complete = false
  ): Promise<FitnessProfile> {
    await this.activeUser(userId);
    const patch = FitnessAssessmentPatchSchema.parse(input);
    return db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      await tx
        .insert(fitnessProfiles)
        .values({
          userId,
          encryptedData: encryptFitnessData(userId, {
            assessment: {},
            baseline: null,
          }),
        })
        .onConflictDoNothing({ target: fitnessProfiles.userId });
      const [row] = await tx
        .select()
        .from(fitnessProfiles)
        .where(eq(fitnessProfiles.userId, userId))
        .for("update");
      const previous = decryptFitnessData<ProfilePayload>(
        userId,
        row!.encryptedData
      );
      const merged: Record<string, unknown> = { ...previous.assessment };
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete merged[key];
        else if (value !== undefined) merged[key] = value;
      }
      const assessment = FitnessAssessmentSchema.parse(merged);
      this.validateAssessmentDates(assessment);
      if (
        JSON.stringify(previous.assessment) === JSON.stringify(assessment) &&
        (!complete || row!.status === "complete")
      )
        return presentProfile(row!);
      // Editing a completed assessment always requires review/recompletion before generating a new plan.
      const schedulingOnly = Object.keys(patch).every(
        (key) => key === "reminders" || key === "timezone"
      );
      const status = complete
        ? "complete"
        : schedulingOnly
        ? row!.status
        : "draft";
      let baseline: FitnessBaseline | null = schedulingOnly
        ? previous.baseline
        : null;
      if (complete) {
        CompleteFitnessAssessmentSchema.parse(assessment);
        baseline = buildFitnessBaseline(assessment);
      }
      const now = new Date();
      const assessmentStart =
        previous.assessmentStart ??
        (complete
          ? {
              date: fitnessDateInZone(now, assessment.timezone ?? "UTC"),
              weightKg: assessment.weightKg!,
            }
          : undefined);
      const [saved] = await tx
        .update(fitnessProfiles)
        .set({
          status,
          encryptedData: encryptFitnessData(userId, {
            assessment,
            baseline,
            ...(assessmentStart ? { assessmentStart } : {}),
          }),
          remindersEnabled: assessment.reminders?.enabled === true,
          completedAt: complete
            ? now
            : schedulingOnly
            ? row!.completedAt
            : null,
          updatedAt: now,
        })
        .where(eq(fitnessProfiles.id, row!.id))
        .returning();
      if (!schedulingOnly)
        await tx
          .update(fitnessPlans)
          .set({ status: "needs_review" })
          .where(
            and(
              eq(fitnessPlans.userId, userId),
              eq(fitnessPlans.status, "active")
            )
          );
      if (complete) {
        await tx.delete(fitnessGoals).where(eq(fitnessGoals.userId, userId));
        await tx.insert(fitnessGoals).values({
          userId,
          date: fitnessDateInZone(now, assessment.timezone ?? "UTC"),
          encryptedData: encryptFitnessData(userId, {
            goals: assessment.goals,
            targetWeightKg: assessment.targetWeightKg,
            targetDate: assessment.targetDate,
          }),
        });
      }
      return presentProfile(saved!);
    });
  }
  async generatePlan(userId: string): Promise<FitnessPlan> {
    await this.activeUser(userId);
    const plan = await db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      // The assessment row is the per-owner lock: retries reuse the same persisted version,
      // while a changed completed assessment creates the next starter revision.
      const [assessmentRow] = await tx
        .select()
        .from(fitnessProfiles)
        .where(eq(fitnessProfiles.userId, userId))
        .for("update");
      if (!assessmentRow)
        throw new ApiError(
          409,
          "assessment_incomplete",
          "Complete the assessment before creating your starter plan."
        );
      const profile = presentProfile(assessmentRow);
      if (profile.status !== "complete" || !profile.baseline)
        throw new ApiError(
          409,
          "assessment_incomplete",
          "Complete the assessment before creating your starter plan."
        );
      if (
        !CompleteFitnessAssessmentSchema.safeParse(profile.assessment).success
      )
        throw new ApiError(
          409,
          "assessment_incomplete",
          "Review and complete the assessment before creating a starter plan."
        );
      // Imported or stale cache metadata cannot override the current private assessment's risk.
      const derivedBaseline = buildFitnessBaseline(profile.assessment);
      const reviewRequired =
        profile.baseline.requiresProfessionalReview ||
        derivedBaseline.requiresProfessionalReview;
      const effectiveBaseline: FitnessBaseline = reviewRequired
        ? {
            ...(derivedBaseline.requiresProfessionalReview
              ? derivedBaseline
              : profile.baseline),
            requiresProfessionalReview: true,
            calories: null,
            proteinG: null,
            carbsG: null,
            fatG: null,
            fibreG: null,
            waterMl: null,
          }
        : profile.baseline;
      const baselineRefreshed =
        reviewRequired &&
        JSON.stringify(effectiveBaseline) !== JSON.stringify(profile.baseline);
      if (baselineRefreshed)
        await tx
          .update(fitnessProfiles)
          .set({
            encryptedData: encryptFitnessData(userId, {
              assessment: profile.assessment,
              baseline: effectiveBaseline,
              ...(profile.assessmentStart
                ? { assessmentStart: profile.assessmentStart }
                : {}),
            }),
            updatedAt: new Date(),
          })
          .where(eq(fitnessProfiles.id, assessmentRow.id));
      const [existing] = await tx
        .select()
        .from(fitnessPlans)
        .where(
          and(
            eq(fitnessPlans.userId, userId),
            inArray(fitnessPlans.status, ["active", "needs_review"]),
            isNull(fitnessPlans.providerId)
          )
        )
        .orderBy(desc(fitnessPlans.createdAt))
        .limit(1);
      let cachedRiskSafe = true;
      if (existing && reviewRequired) {
        const [version] = await tx
          .select()
          .from(fitnessPlanVersions)
          .where(
            and(
              eq(fitnessPlanVersions.planId, existing.id),
              eq(fitnessPlanVersions.version, existing.currentVersion)
            )
          )
          .limit(1);
        const content = version
          ? decryptFitnessData<FitnessPlanContent>(
              userId,
              version.encryptedData
            )
          : null;
        cachedRiskSafe =
          !!content?.requiresProfessionalReview &&
          content.workouts.length === 0 &&
          content.nutrition.calories === null &&
          !Object.values(content.nutrition.targets ?? {}).some(
            (value) => value !== undefined
          ) &&
          !Object.values(content.baselineTargets ?? {}).some(
            (value) => value !== null && value !== undefined
          );
      }
      if (
        existing &&
        !baselineRefreshed &&
        cachedRiskSafe &&
        existing.status === "active" &&
        existing.updatedAt >= assessmentRow.updatedAt
      )
        return existing;
      const content = buildFitnessStarterPlan(
        profile.assessment,
        effectiveBaseline
      );
      if (existing) {
        const version = existing.currentVersion + 1;
        await tx.insert(fitnessPlanVersions).values({
          planId: existing.id,
          version,
          authorUserId: userId,
          encryptedData: encryptFitnessData(userId, content),
        });
        const [updated] = await tx
          .update(fitnessPlans)
          .set({
            currentVersion: version,
            title: "Fitness plan",
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(fitnessPlans.id, existing.id))
          .returning();
        return updated!;
      }
      const [created] = await tx
        .insert(fitnessPlans)
        .values({ userId, title: "Fitness plan" })
        .returning();
      await tx.insert(fitnessPlanVersions).values({
        planId: created!.id,
        version: 1,
        authorUserId: userId,
        encryptedData: encryptFitnessData(userId, content),
      });
      return created!;
    });
    return this.presentPlan(plan);
  }
  private async presentPlan(
    row: typeof fitnessPlans.$inferSelect
  ): Promise<FitnessPlan> {
    const [version] = await db
      .select()
      .from(fitnessPlanVersions)
      .where(
        and(
          eq(fitnessPlanVersions.planId, row.id),
          eq(fitnessPlanVersions.version, row.currentVersion)
        )
      )
      .limit(1);
    if (!version) throw missing();
    const content = decryptFitnessData<FitnessPlanContent>(
      row.userId,
      version.encryptedData
    );
    return {
      id: row.id,
      title: content.name,
      status: row.status,
      currentVersion: row.currentVersion,
      providerId: row.providerId,
      content,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  async listPlans(userId: string): Promise<FitnessPlan[]> {
    await this.activeUser(userId);
    const rows = await db
      .select()
      .from(fitnessPlans)
      .where(eq(fitnessPlans.userId, userId))
      .orderBy(desc(fitnessPlans.updatedAt));
    return Promise.all(rows.map((row) => this.presentPlan(row)));
  }
  async planVersions(
    userId: string,
    planId: string
  ): Promise<FitnessPlanVersion[]> {
    await this.activeUser(userId);
    id(planId);
    const [plan] = await db
      .select()
      .from(fitnessPlans)
      .where(and(eq(fitnessPlans.id, planId), eq(fitnessPlans.userId, userId)))
      .limit(1);
    if (!plan) throw missing();
    const rows = await db
      .select()
      .from(fitnessPlanVersions)
      .where(eq(fitnessPlanVersions.planId, planId))
      .orderBy(desc(fitnessPlanVersions.version));
    return rows.map((row) => ({
      id: row.id,
      planId,
      version: row.version,
      authorProviderId: row.authorProviderId,
      content: decryptFitnessData<FitnessPlanContent>(
        userId,
        row.encryptedData
      ),
      createdAt: row.createdAt.toISOString(),
    }));
  }
  async listLogs(
    userId: string,
    kind: FitnessLogKind,
    from?: string,
    to?: string
  ): Promise<FitnessLog[]> {
    await this.activeUser(userId);
    FitnessLogKindSchema.parse(kind);
    const table = logTables[kind];
    if (from) FitnessDateSchema.parse(from);
    if (to) FitnessDateSchema.parse(to);
    if (from && to) validateFitnessRange(from, to);
    const rows = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.userId, userId),
          from ? gte(table.date, from) : undefined,
          to ? lte(table.date, to) : undefined
        )
      )
      .orderBy(desc(table.date), desc(table.createdAt));
    return rows.map((row) => presentLog(kind, row));
  }
  async getLog(
    userId: string,
    kind: FitnessLogKind,
    logId: string
  ): Promise<FitnessLog> {
    await this.activeUser(userId);
    FitnessLogKindSchema.parse(kind);
    id(logId);
    const table = logTables[kind];
    const [row] = await db
      .select()
      .from(table)
      .where(and(eq(table.userId, userId), eq(table.id, logId)))
      .limit(1);
    if (!row) throw missing();
    return presentLog(kind, row);
  }
  private async validateLogMedia(
    userId: string,
    data: FitnessLogData
  ): Promise<void> {
    if ("planId" in data && data.planId) {
      const [plan] = await db
        .select({ id: fitnessPlans.id })
        .from(fitnessPlans)
        .where(
          and(eq(fitnessPlans.id, data.planId), eq(fitnessPlans.userId, userId))
        )
        .limit(1);
      if (!plan)
        throw new ApiError(
          403,
          "forbidden",
          "Only your own saved fitness plan can be linked."
        );
    }
    if ("planVersion" in data && data.planVersion !== undefined) {
      if (!("planId" in data) || !data.planId)
        throw new ApiError(
          400,
          "validation_error",
          "Link a saved plan before its version."
        );
      const [version] = await db
        .select({ id: fitnessPlanVersions.id })
        .from(fitnessPlanVersions)
        .where(
          and(
            eq(fitnessPlanVersions.planId, data.planId),
            eq(fitnessPlanVersions.version, data.planVersion)
          )
        )
        .limit(1);
      if (!version)
        throw new ApiError(
          403,
          "forbidden",
          "Only a saved version of your own plan can be linked."
        );
    }
    if (!("mediaIds" in data) || !data.mediaIds?.length) return;
    const rows = await db
      .select({ id: progressMedia.id })
      .from(progressMedia)
      .where(
        and(
          eq(progressMedia.userId, userId),
          eq(progressMedia.status, "ready"),
          isNull(progressMedia.deletedAt),
          inArray(progressMedia.id, data.mediaIds)
        )
      );
    if (new Set(rows.map((row) => row.id)).size !== new Set(data.mediaIds).size)
      throw new ApiError(
        403,
        "forbidden",
        "Only your ready private fitness media can be attached."
      );
  }
  private async canonicalMeal(
    userId: string,
    data: FitnessLogData,
    kind: FitnessLogKind
  ): Promise<FitnessLogData> {
    if (kind !== "meal") return data;
    const meal = data as z.infer<typeof FitnessLogDataSchemas.meal>;
    const foods = await Promise.all(
      meal.foods.map(async (food) => {
        if (!food.foodId) return food;
        const item = await this.getFood(userId, food.foodId);
        return {
          ...food,
          name: item.name,
          nutrients:
            item.source === "open_food_facts" ? food.nutrients : item.nutrients,
        };
      })
    );
    return { ...meal, foods };
  }
  async createLog(
    userId: string,
    kind: FitnessLogKind,
    input: unknown
  ): Promise<FitnessLog> {
    await this.activeUser(userId);
    FitnessLogKindSchema.parse(kind);
    const request = FitnessCreateLogSchema.parse(input);
    const table = logTables[kind];
    let data = FitnessLogDataSchemas[kind].parse(
      request.data
    ) as FitnessLogData;
    data = await this.canonicalMeal(userId, data, kind);
    const profile = await this.getProfile(userId);
    if (
      request.date >
      fitnessDateInZone(new Date(), profile?.assessment.timezone ?? "UTC")
    )
      throw new ApiError(
        400,
        "future_log",
        "Actual records cannot be dated in the future."
      );
    return db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      await this.validateLogMedia(userId, data);
      data = await this.canonicalMeal(userId, data, kind);
      const encryptedData = encryptFitnessData(userId, data);
      const [created] = await tx
        .insert(table)
        .values({
          userId,
          date: request.date,
          encryptedData,
          clientRequestId: request.clientRequestId ?? null,
        })
        .onConflictDoNothing({ target: [table.userId, table.clientRequestId] })
        .returning();
      if (created) {
        if (kind === "workout") {
          const workout = data as z.infer<typeof FitnessLogDataSchemas.workout>;
          for (const exercise of workout.exercises)
            await tx.insert(exerciseLogs).values({
              userId,
              workoutLogId: created.id,
              encryptedData: encryptFitnessData(userId, exercise),
            });
        }
        return presentLog(kind, created);
      }
      await this.validateLogMedia(userId, data);
      const [existing] = await tx
        .select()
        .from(table)
        .where(
          and(
            eq(table.userId, userId),
            eq(table.clientRequestId, request.clientRequestId!)
          )
        )
        .limit(1);
      if (
        !existing ||
        existing.date !== request.date ||
        JSON.stringify(decryptFitnessData(userId, existing.encryptedData)) !==
          JSON.stringify(data)
      )
        throw new ApiError(
          409,
          "idempotency_conflict",
          "This request was already used for another record."
        );
      return presentLog(kind, existing);
    });
  }
  async updateLog(
    userId: string,
    kind: FitnessLogKind,
    logId: string,
    input: unknown
  ): Promise<FitnessLog> {
    await this.activeUser(userId);
    FitnessLogKindSchema.parse(kind);
    id(logId);
    const request = z.object({ data: z.unknown() }).strict().parse(input);
    let data = FitnessLogDataSchemas[kind].parse(
      request.data
    ) as FitnessLogData;
    data = await this.canonicalMeal(userId, data, kind);
    const table = logTables[kind];
    return db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      await this.validateLogMedia(userId, data);
      const [existing] = await tx
        .select()
        .from(table)
        .where(and(eq(table.id, logId), eq(table.userId, userId)))
        .for("update");
      if (!existing) throw missing();
      if (
        kind === "workout" &&
        (data as { status: string }).status !==
          decryptFitnessData<{ status: string }>(userId, existing.encryptedData)
            .status
      )
        throw new ApiError(
          409,
          "use_workout_action",
          "Change workout state using the workout action."
        );
      if (kind === "workout") {
        const original = decryptFitnessData<
          z.infer<typeof FitnessLogDataSchemas.workout>
        >(userId, existing.encryptedData);
        const edited = data as z.infer<typeof FitnessLogDataSchemas.workout>;
        const {
          startedAt: _started,
          completedAt: _completed,
          ...editable
        } = edited;
        data = {
          ...editable,
          ...(original.startedAt ? { startedAt: original.startedAt } : {}),
          ...(original.completedAt
            ? { completedAt: original.completedAt }
            : {}),
        };
      }
      const [saved] = await tx
        .update(table)
        .set({
          encryptedData: encryptFitnessData(userId, data),
          updatedAt: new Date(),
        })
        .where(and(eq(table.id, logId), eq(table.userId, userId)))
        .returning();
      if (kind === "workout") {
        await tx
          .delete(exerciseLogs)
          .where(
            and(
              eq(exerciseLogs.workoutLogId, logId),
              eq(exerciseLogs.userId, userId)
            )
          );
        for (const exercise of (
          data as z.infer<typeof FitnessLogDataSchemas.workout>
        ).exercises)
          await tx.insert(exerciseLogs).values({
            userId,
            workoutLogId: logId,
            encryptedData: encryptFitnessData(userId, exercise),
          });
      }
      return presentLog(kind, saved!);
    });
  }
  async workoutAction(
    userId: string,
    workoutId: string,
    input: unknown
  ): Promise<FitnessLog> {
    await this.activeUser(userId);
    id(workoutId);
    FitnessWorkoutActionSchema.parse(input);
    return db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const [row] = await tx
        .select()
        .from(workoutLogs)
        .where(
          and(eq(workoutLogs.id, workoutId), eq(workoutLogs.userId, userId))
        )
        .for("update");
      if (!row) throw missing();
      const data = applyFitnessWorkoutAction(
        decryptFitnessData(userId, row.encryptedData),
        input
      );
      const [saved] = await tx
        .update(workoutLogs)
        .set({
          encryptedData: encryptFitnessData(userId, data),
          updatedAt: new Date(),
        })
        .where(
          and(eq(workoutLogs.id, workoutId), eq(workoutLogs.userId, userId))
        )
        .returning();
      return presentLog("workout", saved!);
    });
  }
  async deleteLog(
    userId: string,
    kind: FitnessLogKind,
    logId: string
  ): Promise<void> {
    await this.activeUser(userId);
    FitnessLogKindSchema.parse(kind);
    id(logId);
    const table = logTables[kind];
    await db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const rows = await tx
        .delete(table)
        .where(and(eq(table.userId, userId), eq(table.id, logId)))
        .returning({ id: table.id });
      if (!rows.length) throw missing();
    });
  }
  private async allLogs(
    userId: string,
    from?: string,
    to?: string
  ): Promise<FitnessLog[]> {
    return (
      await Promise.all(
        (Object.keys(logTables) as FitnessLogKind[]).map((kind) =>
          this.listLogs(userId, kind, from, to)
        )
      )
    ).flat();
  }
  private async planTimeline(
    userId: string
  ): Promise<FitnessPlanTimelineEntry[]> {
    await this.activeUser(userId);
    const rows = await db
      .select({ plan: fitnessPlans, version: fitnessPlanVersions })
      .from(fitnessPlans)
      .innerJoin(
        fitnessPlanVersions,
        eq(fitnessPlanVersions.planId, fitnessPlans.id)
      )
      .where(eq(fitnessPlans.userId, userId))
      .orderBy(
        asc(fitnessPlanVersions.createdAt),
        asc(fitnessPlanVersions.version)
      );
    return rows.map(({ plan, version }) => ({
      planId: plan.id,
      status: plan.status,
      planCreatedAt: plan.createdAt.toISOString(),
      version: version.version,
      versionCreatedAt: version.createdAt.toISOString(),
      content: decryptFitnessData<FitnessPlanContent>(
        userId,
        version.encryptedData
      ),
    }));
  }
  async summary(
    userId: string,
    date?: string,
    timezone = "UTC"
  ): Promise<FitnessSummary> {
    const now = new Date(),
      today = date ?? fitnessDateInZone(now, timezone);
    FitnessDateSchema.parse(today);
    fitnessDateInZone(now, timezone);
    const from = shiftFitnessDate(today, -6);
    const [profile, plans, logs, weights, history] = await Promise.all([
      this.getProfile(userId),
      this.listPlans(userId),
      this.allLogs(userId, from, today),
      this.listLogs(userId, "weight", undefined, today),
      this.planTimeline(userId),
    ]);
    const days = aggregateFitnessDays(logs, from, today),
      comparisons = fitnessDayComparisons(
        profile,
        history,
        days,
        logs,
        timezone,
        now
      ),
      stats = summarizeFitnessComparisons(comparisons, days),
      plan = plans.find((p) => p.status === "active") ?? null,
      datePlan = applicableFitnessPlan(history, today, timezone);
    const status = fitnessTargetStatus(
        profile,
        datePlan ?? plans.find((p) => p.status === "needs_review") ?? null,
        now
      ),
      targets = currentFitnessTargets(profile, datePlan, now),
      weight = fitnessWeightSnapshots(
        profile,
        weights,
        today,
        timezone,
        status === "available"
      );
    return {
      date: today,
      timezone,
      profile,
      plan,
      today: days.at(-1)!,
      latestWeight: weight.latestWeight,
      weightProgress: weight.weightProgress,
      targets,
      targetStatus: status,
      todayWorkout: comparisons.at(-1)?.workout ?? null,
      weekly: {
        activeDays: days.filter((d) => d.active).length,
        workouts: days.reduce((n, d) => n + d.workouts, 0),
        workoutMinutes: days.reduce((n, d) => n + d.workoutMinutes, 0),
        streak: fitnessStreak(days, today === fitnessDateInZone(now, timezone)),
        days,
        ...stats.weekly,
      },
      logs: logs.filter((log) => log.date === today),
    };
  }
  async progress(
    userId: string,
    from: string,
    to: string,
    timezone = "UTC"
  ): Promise<FitnessProgress> {
    validateFitnessRange(from, to);
    const now = new Date(),
      today = fitnessDateInZone(now, timezone);
    const [profile, plans, logs, weights, history] = await Promise.all([
      this.getProfile(userId),
      this.listPlans(userId),
      this.allLogs(userId, from, to),
      this.listLogs(userId, "weight", undefined, today),
      this.planTimeline(userId),
    ]);
    const base = calculateFitnessProgress(logs, from, to, timezone, now),
      comparisons = fitnessDayComparisons(
        profile,
        history,
        base.days,
        logs,
        timezone,
        now
      ),
      stats = summarizeFitnessComparisons(comparisons, base.days),
      currentPlan = applicableFitnessPlan(history, today, timezone),
      status = fitnessTargetStatus(
        profile,
        currentPlan ?? plans.find((p) => p.status === "needs_review") ?? null,
        now
      ),
      weight = fitnessWeightSnapshots(
        profile,
        weights,
        today,
        timezone,
        status === "available"
      );
    const insights = [...base.insights];
    if (stats.adherence.nutritionRecordedDays)
      insights.push(
        `${stats.adherence.nutritionInRangeDays} of ${stats.adherence.nutritionRecordedDays} recorded meal days were within the compared calorie range.`
      );
    if (stats.adherence.recordedDays && stats.weekly.plannedWorkouts)
      insights.push(
        `${stats.weekly.completedPlannedWorkouts} matching planned sessions recorded for ${stats.weekly.plannedWorkouts} sessions due in this period.`
      );
    return {
      ...base,
      comparisons,
      adherence: stats.adherence,
      targetBasisNotice: FITNESS_TARGET_BASIS_NOTICE,
      targetStatus: status,
      currentTargets: currentFitnessTargets(profile, currentPlan, now),
      latestWeight: weight.latestWeight,
      currentWeightProgress: weight.weightProgress,
      insights,
    };
  }
  private presentFood(row: typeof foodItems.$inferSelect): FitnessFood {
    return {
      id: row.id,
      ...decryptFitnessData<z.infer<typeof FitnessFoodInputSchema>>(
        row.userId ?? "curated",
        row.encryptedData
      ),
      source: row.source as FitnessFood["source"],
    };
  }
  async getFood(userId: string, foodId: string): Promise<FitnessFood> {
    id(foodId);
    const [row] = await db
      .select()
      .from(foodItems)
      .where(
        and(
          eq(foodItems.id, foodId),
          or(eq(foodItems.userId, userId), isNull(foodItems.userId))
        )
      )
      .limit(1);
    if (!row) throw missing();
    return this.presentFood(row);
  }
  async listFoods(userId: string, query = ""): Promise<FitnessFood[]> {
    await this.activeUser(userId);
    const q = z.string().max(150).parse(query).toLowerCase().trim();
    const rows = await db
      .select()
      .from(foodItems)
      .where(or(eq(foodItems.userId, userId), isNull(foodItems.userId)))
      .orderBy(desc(foodItems.createdAt));
    return rows
      .map((row) => this.presentFood(row))
      .filter((food) => !q || food.name.toLowerCase().includes(q))
      .slice(0, 100);
  }
  async importCatalogFood(
    userId: string,
    barcode: string
  ): Promise<FitnessFood> {
    await this.activeUser(userId);
    const digest = createHash("sha256")
      .update(`fitness-food:${userId}:${barcode}`)
      .digest();
    digest[6] = (digest[6]! & 15) | 80;
    digest[8] = (digest[8]! & 63) | 128;
    const hex = digest.toString("hex").slice(0, 32),
      foodId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
        12,
        16
      )}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    return db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const [existing] = await tx
        .select()
        .from(foodItems)
        .where(and(eq(foodItems.id, foodId), eq(foodItems.userId, userId)))
        .limit(1);
      if (existing) return this.presentFood(existing);
      const catalogFood = await foodCatalogService.product(barcode);
      const [created] = await tx
        .insert(foodItems)
        .values({
          id: foodId,
          userId,
          source: "open_food_facts",
          encryptedData: encryptFitnessData(userId, catalogFood),
        })
        .onConflictDoNothing({ target: foodItems.id })
        .returning();
      if (created) return this.presentFood(created);
      return this.getFood(userId, foodId);
    });
  }
  async createFood(userId: string, input: unknown): Promise<FitnessFood> {
    await this.activeUser(userId);
    const data = FitnessFoodInputSchema.parse(input);
    return db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const [row] = await tx
        .insert(foodItems)
        .values({
          userId,
          source: "custom",
          clientRequestId: data.clientRequestId ?? null,
          encryptedData: encryptFitnessData(userId, data),
        })
        .onConflictDoNothing({
          target: [foodItems.userId, foodItems.clientRequestId],
        })
        .returning();
      if (row) return this.presentFood(row);
      const [existing] = await tx
        .select()
        .from(foodItems)
        .where(
          and(
            eq(foodItems.userId, userId),
            eq(foodItems.clientRequestId, data.clientRequestId!)
          )
        )
        .limit(1);
      if (
        !existing ||
        JSON.stringify(decryptFitnessData(userId, existing.encryptedData)) !==
          JSON.stringify(data)
      )
        throw new ApiError(
          409,
          "idempotency_conflict",
          "This request was already used for another food."
        );
      return this.presentFood(existing);
    });
  }
  async listRecipes(userId: string): Promise<FitnessRecipe[]> {
    await this.activeUser(userId);
    const rows = await db
      .select()
      .from(fitnessRecipes)
      .where(eq(fitnessRecipes.userId, userId))
      .orderBy(desc(fitnessRecipes.createdAt));
    return rows.map((row) => ({
      id: row.id,
      ...decryptFitnessData<Omit<FitnessRecipe, "id">>(
        userId,
        row.encryptedData
      ),
    }));
  }
  async createRecipe(userId: string, input: unknown): Promise<FitnessRecipe> {
    await this.activeUser(userId);
    const recipe = FitnessRecipeInputSchema.parse(input);
    return db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const nutrients = emptyNutrients();
      for (const ingredient of recipe.ingredients) {
        const food = await this.getFood(userId, ingredient.foodId);
        addNutrients(
          nutrients,
          food.nutrients,
          ingredient.servings / recipe.servings
        );
      }
      const data = { ...recipe, nutrients };
      const [row] = await tx
        .insert(fitnessRecipes)
        .values({
          userId,
          clientRequestId: recipe.clientRequestId ?? null,
          encryptedData: encryptFitnessData(userId, data),
        })
        .onConflictDoNothing({
          target: [fitnessRecipes.userId, fitnessRecipes.clientRequestId],
        })
        .returning();
      if (row) return { id: row.id, ...data };
      const [existing] = await tx
        .select()
        .from(fitnessRecipes)
        .where(
          and(
            eq(fitnessRecipes.userId, userId),
            eq(fitnessRecipes.clientRequestId, recipe.clientRequestId!)
          )
        )
        .limit(1);
      if (
        !existing ||
        JSON.stringify(decryptFitnessData(userId, existing.encryptedData)) !==
          JSON.stringify(data)
      )
        throw new ApiError(
          409,
          "idempotency_conflict",
          "This request was already used for another recipe."
        );
      return { id: existing.id, ...data };
    });
  }
  async listTemplates(userId: string) {
    await this.activeUser(userId);
    const rows = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.status, "published"));
    return {
      templates: rows.map((row) => ({
        id: row.id,
        name: row.name,
        content: row.content,
      })),
    };
  }
  async listSharedResourceChoices(userId: string): Promise<
    Array<{
      id: string;
      scope: "workouts" | "meals" | "progress" | "media";
      label: string;
      date: string;
    }>
  > {
    const logs = await this.allLogs(userId);
    const media = await db
      .select({
        id: progressMedia.id,
        purpose: progressMedia.purpose,
        createdAt: progressMedia.createdAt,
      })
      .from(progressMedia)
      .where(
        and(
          eq(progressMedia.userId, userId),
          eq(progressMedia.status, "ready"),
          isNull(progressMedia.deletedAt)
        )
      );
    return [
      ...logs.map((log) => ({
        id: log.id,
        scope: (log.kind === "workout"
          ? "workouts"
          : log.kind === "meal"
          ? "meals"
          : "progress") as "workouts" | "meals" | "progress",
        label: `${log.kind} record`,
        date: log.date,
      })),
      ...media.map((row) => ({
        id: row.id,
        scope: "media" as const,
        label: `Private ${row.purpose} media`,
        date: row.createdAt.toISOString().slice(0, 10),
      })),
    ];
  }
  /** Internal owner-data accessor. Caller MUST verify current provider eligibility, relationship and matching scoped consent. */
  async readSharedResource(
    userId: string,
    scope: string,
    resourceId?: string
  ): Promise<unknown> {
    if (scope === "profile") return this.getProfile(userId);
    if (!resourceId) throw missing();
    id(resourceId);
    const kinds: FitnessLogKind[] =
      scope === "workouts"
        ? ["workout"]
        : scope === "meals"
        ? ["meal"]
        : scope === "progress"
        ? ["weight", "water", "habit", "sleep", "steps"]
        : [];
    await this.activeUser(userId);
    for (const kind of kinds) {
      const table = logTables[kind];
      const [row] = await db
        .select()
        .from(table)
        .where(and(eq(table.id, resourceId), eq(table.userId, userId)))
        .limit(1);
      if (row) return presentLog(kind, row);
    }
    throw missing();
  }
  async exportData(userId: string) {
    const [
      profile,
      plans,
      logs,
      foods,
      recipes,
      consents,
      relationships,
      consultations,
      media,
    ] = await Promise.all([
      this.getProfile(userId),
      this.listPlans(userId),
      this.allLogs(userId),
      db
        .select()
        .from(foodItems)
        .where(eq(foodItems.userId, userId))
        .then((rows) => rows.map((row) => this.presentFood(row))),
      this.listRecipes(userId),
      db.select().from(healthConsents).where(eq(healthConsents.userId, userId)),
      db
        .select()
        .from(providerClientRelationships)
        .where(eq(providerClientRelationships.userId, userId)),
      db
        .select()
        .from(fitnessConsultations)
        .where(eq(fitnessConsultations.userId, userId)),
      db
        .select({
          id: progressMedia.id,
          purpose: progressMedia.purpose,
          kind: progressMedia.kind,
          contentType: progressMedia.contentType,
          byteSize: progressMedia.byteSize,
          createdAt: progressMedia.createdAt,
          encryptedData: progressMedia.encryptedData,
        })
        .from(progressMedia)
        .where(
          and(eq(progressMedia.userId, userId), isNull(progressMedia.deletedAt))
        ),
    ]);
    const versions = (
      await Promise.all(plans.map((plan) => this.planVersions(userId, plan.id)))
    ).flat();
    return {
      exportedAt: new Date().toISOString(),
      profile,
      plans,
      versions,
      logs,
      foods,
      recipes,
      consents,
      relationships,
      consultations: consultations.map(({ encryptedData, ...row }) => ({
        ...row,
        ...(encryptedData
          ? { details: decryptFitnessData(userId, encryptedData) }
          : {}),
      })),
      media: media.map(({ encryptedData, ...row }) => {
        const metadata = encryptedData
          ? decryptFitnessData<{ caption?: string; comparisonOptIn?: boolean }>(
              userId,
              encryptedData
            )
          : {};
        return {
          ...row,
          ...(metadata.caption ? { caption: metadata.caption } : {}),
          comparisonOptIn: metadata.comparisonOptIn === true,
        };
      }),
    };
  }
  async deleteData(
    userId: string,
    options: { deactivateAccount?: boolean } = {}
  ): Promise<void> {
    await this.activeUser(userId);
    await db.transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      if (this.deleteHooks.deleteMedia)
        await this.deleteHooks.deleteMedia(userId, tx);
      else {
        const [media] = await tx
          .select({ id: progressMedia.id })
          .from(progressMedia)
          .where(eq(progressMedia.userId, userId))
          .limit(1);
        if (media)
          throw new ApiError(
            409,
            "media_cleanup_required",
            "Private media cleanup is required before deleting fitness data."
          );
      }
      for (const table of [
        healthConsents,
        providerClientRelationships,
        fitnessConsultations,
        fitnessPlans,
        fitnessGoals,
        fitnessProfiles,
        fitnessRecipes,
        foodItems,
        workoutLogs,
        mealLogs,
        waterLogs,
        habitLogs,
        sleepLogs,
        stepLogs,
        bodyMeasurements,
        exerciseLogs,
        progressMedia,
      ])
        await tx.delete(table).where(eq(table.userId, userId));
      if (options.deactivateAccount)
        await tx
          .update(mobileUsers)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(mobileUsers.id, userId));
    });
  }
}
export const fitnessService = new FitnessService();
