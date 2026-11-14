import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoryFormSchema,
  GLOBAL_PROVIDER_FORM_SCHEMA,
} from "../seed/providerFormSchemas.js";
import { mergeFormSchemas } from "./FormSchemaService.js";
import { computeApplicationReadiness } from "./applicationReadiness.js";

const common = {
  basic: {
    providerName: "Qualified nutrition professional",
    contactPerson: "Professional",
    mobile: "9876543210",
    email: "nutrition@example.test",
  },
  location: {
    address: "1 Clinic Road",
    city: "Chennai",
    pincode: "600020",
    latitude: 13,
    longitude: 80,
  },
  availability: {
    workingDays: ["mon"],
    openingTime: "09:00",
    closingTime: "18:00",
  },
  services: { pricingStartsAt: 500, online: true },
  profile: {
    description: "Professional nutrition consultations",
    introVideoMediaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  },
};
describe("Nutrition professional qualification readiness", () => {
  for (const categoryId of [
    "wellness.nutrition_clinical",
    "wellness.nutrition_sports",
  ])
    it(`${categoryId} requires qualification, private evidence and valid experience before review`, () => {
      const category = categoryFormSchema(categoryId)!;
      assert(category);
      const schema = mergeFormSchemas(
        GLOBAL_PROVIDER_FORM_SCHEMA,
        [category],
        "individual",
        [categoryId]
      );
      const input = {
        schema,
        commonPayload: common,
        dynamicPayload: {},
        categoryIds: [categoryId],
        documentFieldKeys: ["identity.aadhaarDocument", "identity.idDocument"],
        hasAadhaar: true,
      };
      const empty = computeApplicationReadiness(input);
      assert(empty.missing.some((m) => m.key === "nutrition.qualification"));
      assert(
        empty.missing.some((m) => m.key === "nutrition.qualificationDocument")
      );
      assert(empty.missing.some((m) => m.key === "nutrition.experienceYears"));
      const completed = computeApplicationReadiness({
        ...input,
        dynamicPayload: {
          "nutrition.qualification": "BSc Nutrition",
          "nutrition.experienceYears": 0,
        },
        documentFieldKeys: [
          ...input.documentFieldKeys,
          "nutrition.qualificationDocument",
        ],
      });
      assert.equal(completed.complete, true, JSON.stringify(completed.missing));
      const invalid = computeApplicationReadiness({
        ...input,
        dynamicPayload: {
          "nutrition.qualification": "BSc Nutrition",
          "nutrition.experienceYears": -1,
        },
        documentFieldKeys: [
          ...input.documentFieldKeys,
          "nutrition.qualificationDocument",
        ],
      });
      assert.equal(invalid.complete, false);
      assert(
        invalid.missing.some((m) => m.key === "nutrition.experienceYears")
      );
      assert.equal(
        category.fields.find((f) => f.key === "nutrition.qualificationDocument")
          ?.type,
        "document"
      );
    });
});
