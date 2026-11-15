import { linking } from "./linking";
const id = "f8421f64-d302-43a0-924f-b71a73eb0d77";
const parse = (path: string) =>
  linking.getStateFromPath!(path, linking.config)?.routes.at(-1);
test.each(["settings/fitness", "fitness"])(
  "opens the personal Fitness module from %s",
  (path) => {
    expect(parse(path)).toMatchObject({ name: "FitnessHome" });
  }
);
test("preserves exact plan versions and dates from private deep links", () => {
  expect(parse(`needs/fitness/plan/${id}?version=2`)).toMatchObject({
    name: "FitnessPlan",
    params: { planId: id, version: 2 },
  });
  expect(parse("needs/fitness/log/water?date=2026-11-14")).toMatchObject({
    name: "FitnessLog",
    params: { kind: "water", date: "2026-11-14" },
  });
});
test("keeps Knock primary tabs unchanged", () => {
  expect(parse("knock/chat")).toMatchObject({
    name: "Main",
    state: { routes: [{ name: "Knock", params: { initialTab: "chat" } }] },
  });
});

test.each(["needs/fitness", "services/fitness"])(
  "restores service browsing for %s",
  (path) => {
    expect(parse(path)).toMatchObject({
      name: "ServiceTree",
      params: { treeId: "fitness" },
    });
  }
);
test("preserves all nine fitness service categories and images", () => {
  const {
    getCategoriesByTree,
    categoryImages,
  } = require("@/shared/data/services");
  const categories = getCategoriesByTree("fitness");
  expect(categories).toHaveLength(9);
  expect(categories.map((c: any) => c.id)).toEqual([
    "fitness.gym",
    "fitness.personal_trainer",
    "fitness.aerobics_zumba",
    "fitness.yoga",
    "fitness.womens",
    "fitness.sports_fitness",
    "fitness.bodybuilding",
    "fitness.crossfit",
    "fitness.geriatric",
  ]);
  for (const category of categories)
    expect(categoryImages[category.id]).toBeDefined();
});
test("uses Settings for new personal plan links while preserving old notification links", () => {
  for (const prefix of ["settings/fitness", "needs/fitness"]) {
    expect(parse(`${prefix}/plan/${id}?version=2`)).toMatchObject({
      name: "FitnessPlan",
      params: { planId: id, version: 2 },
    });
  }
});
