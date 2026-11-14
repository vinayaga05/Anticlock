import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FitnessAssessment } from "@anticlock/contracts";
import {
  buildFitnessBaseline,
  buildFitnessStarterPlan,
  fitnessAge,
} from "./FitnessEngine.js";

const now = new Date("2026-11-14T12:00:00Z");
const assessment: FitnessAssessment = {
  dateOfBirth: "1996-11-14",
  heightCm: 170,
  weightKg: 70,
  goals: ["strength"],
  activityLevel: "light",
  experience: "beginner",
  equipment: ["none"],
  availableDays: [1, 3, 5],
  sessionMinutes: 20,
  foodPreferences: ["vegetarian"],
  disclaimerAccepted: true,
};
describe("private wellness starter estimates", () => {
  it("uses real saved measurements and the published resting energy regression", () => {
    const result = buildFitnessBaseline(
      { ...assessment, calculationSex: "female" },
      now
    );
    assert.equal(result.age, 30);
    assert.equal(result.bmi, 24.2);
    const expected =
      Math.round((9.99 * 70 + 6.25 * 170 - 4.92 * 30 - 161) / 5) * 5;
    assert.deepEqual(result.bmr, { min: expected, max: expected });
    assert.equal(result.requiresProfessionalReview, false);
  });
  it("never infers an equation constant from optional gender identity", () => {
    const one = buildFitnessBaseline({ ...assessment, gender: "female" }, now);
    const two = buildFitnessBaseline({ ...assessment, gender: "male" }, now);
    assert.deepEqual(one.bmr, two.bmr);
    assert.ok(one.bmr!.max > one.bmr!.min);
  });
  it("handles birthday and leap-day boundaries in the chosen time zone", () => {
    assert.equal(
      fitnessAge("2000-02-29", new Date("2025-02-28T12:00:00Z")),
      24
    );
    assert.equal(
      fitnessAge("2000-02-29", new Date("2025-03-01T12:00:00Z")),
      25
    );
    assert.equal(
      fitnessAge(
        "2000-11-15",
        new Date("2026-11-14T20:00:00Z"),
        "Asia/Kolkata"
      ),
      26
    );
    assert.throws(() => fitnessAge("2026-12-01", now));
  });
  for (const risk of [
    { dateOfBirth: "2012-01-01" },
    { pregnant: true },
    { breastfeeding: true },
    { eatingDisorderRisk: true },
    { clinicalReviewRequired: true },
    { injuries: "Recent injury" },
    { mobility: "Needs assistance" },
    { medicalConditions: "Condition shared privately" },
    { medications: "Prescribed medication" },
    { goals: ["rehabilitation_support"] },
  ]) {
    it(
      "withholds automated prescriptions for " + Object.keys(risk).join(","),
      () => {
        const data = { ...assessment, ...risk } as FitnessAssessment;
        const baseline = buildFitnessBaseline(data, now),
          plan = buildFitnessStarterPlan(data, baseline, now);
        assert.equal(baseline.requiresProfessionalReview, true);
        assert.equal(baseline.calories, null);
        assert.equal(baseline.proteinG, null);
        assert.equal(plan.workouts.length, 0);
        assert.equal(plan.nutrition.calories, null);
        assert.ok(plan.baselineTargets);
        assert.ok(
          Object.values(plan.baselineTargets).every((value) => value === null)
        );
      }
    );
  }
  it("uses unrounded BMI for the review gate even when the displayed value rounds to18.5", () => {
    const data = {
      ...assessment,
      weightKg: 53.4,
      goals: ["weight_loss"],
    } as FitnessAssessment;
    const baseline = buildFitnessBaseline(data, now),
      plan = buildFitnessStarterPlan(data, baseline, now);
    assert.equal(baseline.bmi, 18.5);
    assert.equal(baseline.requiresProfessionalReview, true);
    assert.equal(baseline.calories, null);
    assert.equal(baseline.proteinG, null);
    assert.equal(plan.requiresProfessionalReview, true);
    assert.deepEqual(plan.workouts, []);
    assert.equal(plan.nutrition.calories, null);
  });
  it("rechecks risk flags when a healthy cached baseline is paired with a changed assessment", () => {
    const cached = buildFitnessBaseline(assessment, now);
    assert.equal(cached.requiresProfessionalReview, false);
    for (const risk of [
      { pregnant: true },
      { breastfeeding: true },
      { eatingDisorderRisk: true },
      { clinicalReviewRequired: true },
      { injuries: "New injury" },
      { medicalConditions: "New condition" },
      { medications: "New medication" },
      { dateOfBirth: "2012-01-01" },
    ]) {
      const plan = buildFitnessStarterPlan(
        { ...assessment, ...risk },
        cached,
        now
      );
      assert.equal(plan.requiresProfessionalReview, true);
      assert.deepEqual(plan.workouts, []);
      assert.equal(plan.nutrition.calories, null);
    }
    const sticky = buildFitnessStarterPlan(
      assessment,
      { ...cached, requiresProfessionalReview: true },
      now
    );
    assert.equal(sticky.requiresProfessionalReview, true);
  });
  it("rejects invalid dates, past targets, aggressive targets and low-BMI adult goals", () => {
    assert.throws(() =>
      buildFitnessBaseline({ ...assessment, dateOfBirth: "2000-02-30" }, now)
    );
    assert.throws(() =>
      buildFitnessBaseline({ ...assessment, targetDate: "2026-11-13" }, now)
    );
    assert.throws(() =>
      buildFitnessBaseline(
        { ...assessment, targetWeightKg: 60, targetDate: "2026-11-28" },
        now
      )
    );
    assert.throws(() =>
      buildFitnessBaseline({ ...assessment, targetWeightKg: 45 }, now)
    );
  });
  it("generates only available days and changes exercises for real equipment and preferences", () => {
    const baseline = buildFitnessBaseline(assessment, now);
    const noEquipment = buildFitnessStarterPlan(assessment, baseline, now);
    assert.deepEqual(
      noEquipment.workouts.map((day) => day.day),
      [1, 3, 5]
    );
    assert.equal(
      noEquipment.workouts.some((day) =>
        day.exercises.some((ex) => ex.name.includes("resistance"))
      ),
      false
    );
    const equipped = buildFitnessStarterPlan(
      { ...assessment, equipment: ["dumbbells"] },
      baseline,
      now
    );
    assert.equal(
      equipped.workouts.some((day) =>
        day.exercises.some((ex) => ex.name.includes("resistance"))
      ),
      true
    );
    const mobility = buildFitnessStarterPlan(
      { ...assessment, goals: ["flexibility"] },
      baseline,
      now
    );
    assert.ok(mobility.workouts.every((day) => day.name === "Move & restore"));
  });
  it("adds instructions, rest and substitutions without inventing exercise media", () => {
    const plan = buildFitnessStarterPlan(
      assessment,
      buildFitnessBaseline(assessment, now),
      now
    );
    for (const workout of plan.workouts)
      for (const exercise of workout.exercises) {
        assert.ok(exercise.instructions);
        assert.equal(exercise.restSeconds, 60);
        assert.ok(exercise.substitutions?.length);
        assert.equal("mediaUrl" in exercise, false);
      }
  });
});
