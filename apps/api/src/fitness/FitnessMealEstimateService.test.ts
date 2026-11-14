import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { FitnessMealEstimateService } from "./FitnessMealEstimateService.js";
import { fitnessMediaService } from "./FitnessMediaService.js";

const estimate = {
  label: "Visible meal",
  calories: 420,
  proteinG: 22,
  carbsG: 50,
  fatG: 15,
  fibreG: 8,
  notes: "Estimate",
  isEstimate: true,
};
describe("optional private meal estimation", () => {
  const previous = process.env.FITNESS_VISION_ENABLED;
  beforeEach(() => {
    process.env.FITNESS_VISION_ENABLED = "false";
  });
  afterEach(() => {
    mock.restoreAll();
    if (previous === undefined) delete process.env.FITNESS_VISION_ENABLED;
    else process.env.FITNESS_VISION_ENABLED = previous;
  });
  it("requires explicit consent before reading or sending a photo", async () => {
    const read = mock.method(
      fitnessMediaService,
      "ownedMealImage",
      async () => {
        throw new Error("must not read");
      }
    );
    const send = mock.fn(async () => estimate);
    await assert.rejects(
      new FitnessMealEstimateService(send).estimate("owner", "media", false),
      { code: "ai_consent_required" }
    );
    assert.equal(read.mock.callCount(), 0);
    assert.equal(send.mock.callCount(), 0);
  });
  it("enforces ownership before calling the estimator", async () => {
    mock.method(fitnessMediaService, "ownedMealImage", async () => {
      throw new Error("not the owner");
    });
    const send = mock.fn(async () => estimate);
    await assert.rejects(
      new FitnessMealEstimateService(send).estimate("other", "media", true),
      /not the owner/
    );
    assert.equal(send.mock.callCount(), 0);
  });
  it("sends only the selected bytes and returns editable estimates with controlled wording", async () => {
    const bytes = Buffer.from("selected-image");
    mock.method(
      fitnessMediaService,
      "ownedMealImage",
      async (userId: string, id: string) => {
        assert.equal(userId, "owner");
        assert.equal(id, "selected");
        return { bytes, contentType: "image/png" };
      }
    );
    const send = mock.fn(async (input: unknown) => {
      assert.deepEqual(Object.keys(input as object).sort(), [
        "bytes",
        "contentType",
        "signal",
      ]);
      return {
        ...estimate,
        label: "Medical suitability claim",
        notes: "Unsafe exact claim",
      };
    });
    const actual = await new FitnessMealEstimateService(send).estimate(
      "owner",
      "selected",
      true
    );
    assert.equal(actual.label, "Photo meal estimate");
    assert.equal(actual.isEstimate, true);
    assert.equal(actual.calories, 420);
    assert.match(actual.notes, /Approximate/);
    assert.match(
      actual.notes,
      /cannot establish allergens or medical suitability/
    );
  });
  it("fails closed when optional vision is disabled", async () => {
    mock.method(fitnessMediaService, "ownedMealImage", async () => ({
      bytes: Buffer.from("image"),
      contentType: "image/png",
    }));
    await assert.rejects(
      new FitnessMealEstimateService().estimate("owner", "photo", true),
      { code: "meal_estimate_unavailable" }
    );
  });
  for (const invalid of [
    { ...estimate, calories: -1 },
    { ...estimate, proteinG: Infinity },
    { ...estimate, isEstimate: false },
    { ...estimate, privateData: "unexpected" },
    { unavailable: true },
  ]) {
    it("rejects invalid estimates without persisting a meal", async () => {
      mock.method(fitnessMediaService, "ownedMealImage", async () => ({
        bytes: Buffer.from("image"),
        contentType: "image/png",
      }));
      await assert.rejects(
        new FitnessMealEstimateService(async () => invalid).estimate(
          "owner",
          "photo",
          true
        ),
        { code: "meal_estimate_unavailable" }
      );
    });
  }
  it("replaces provider errors with a private manual-entry fallback", async () => {
    mock.method(fitnessMediaService, "ownedMealImage", async () => ({
      bytes: Buffer.from("image"),
      contentType: "image/png",
    }));
    await assert.rejects(
      new FitnessMealEstimateService(async () => {
        throw new Error("provider secret or response");
      }).estimate("owner", "photo", true),
      (error) =>
        error instanceof Error &&
        !error.message.includes("secret") &&
        /manually/.test(error.message)
    );
  });
});
