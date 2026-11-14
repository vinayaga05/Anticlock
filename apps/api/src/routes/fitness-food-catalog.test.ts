import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
const testDatabase = process.env.TEST_DATABASE_URL?.trim();
if (testDatabase) process.env.DATABASE_URL = testDatabase;
let FoodCatalogService: typeof import("../fitness/FoodCatalogService.js").FoodCatalogService;
let normalizeCatalogFood: typeof import("../fitness/FoodCatalogService.js").normalizeCatalogFood;
before(async () => {
  const module = await import("../fitness/FoodCatalogService.js");
  FoodCatalogService = module.FoodCatalogService;
  normalizeCatalogFood = module.normalizeCatalogFood;
});

const product = {
  code: "12345678",
  product_name: "Example food",
  nutriments: {
    "energy-kcal_100g": 120,
    proteins_100g: 5,
    carbohydrates_100g: 20,
    fat_100g: 2,
    fiber_100g: 3,
  },
};
function adapter(
  options: {
    deadlineMs?: number;
    claimBudget?: () => Promise<boolean>;
    fetch?: (url: string, init: RequestInit) => Promise<Response>;
  } = {}
) {
  let now = 0,
    calls = 0;
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const service = new FoodCatalogService({
    now: () => now,
    deadlineMs: options.deadlineMs ?? 8000,
    claimBudget: options.claimBudget ?? (async () => true),
    fetch: async (url, init) => {
      calls++;
      requests.push({ url, init });
      return options.fetch
        ? options.fetch(url, init)
        : Response.json(
            url.includes("/product/") ? { product } : { products: [product] }
          );
    },
  });
  return {
    service,
    requests,
    calls: () => calls,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
describe("Fitness real food catalog adapter", () => {
  it("normalizes real source fields into labelled 100g estimates without inventing missing macros", () => {
    const food = normalizeCatalogFood(product);
    assert.ok(food);
    assert.equal(food.servingGrams, 100);
    assert.equal(food.nutrients.calories, 120);
    assert.equal(food.barcode, "12345678");
    assert.equal(food.source, "open_food_facts");
    assert.equal(food.isEstimate, true);
    assert.deepEqual(food.missingNutrients, []);
    const noFibre = normalizeCatalogFood({
      ...product,
      nutriments: { ...product.nutriments, fiber_100g: undefined },
    });
    assert.equal(noFibre?.nutrients.fibreG, 0);
    assert.deepEqual(noFibre?.missingNutrients, ["fibreG"]);
    assert.equal(
      normalizeCatalogFood({
        ...product,
        nutriments: { ...product.nutriments, proteins_100g: undefined },
      }),
      null
    );
    assert.equal(
      normalizeCatalogFood({ ...product, code: "https://attacker.test" }),
      null
    );
    assert.equal(
      normalizeCatalogFood({
        ...product,
        nutriments: { ...product.nutriments, fat_100g: -1 },
      }),
      null
    );
  });
  it("uses encoded fixed upstream endpoints and a custom identity; caches searches and selected barcodes for ten minutes", async () => {
    const a = adapter();
    const result = await a.service.search("  Oats & Milk  ");
    assert.equal(a.calls(), 1);
    const url = new URL(a.requests[0]!.url);
    assert.equal(url.origin, "https://world.openfoodfacts.org");
    assert.equal(url.pathname, "/cgi/search.pl");
    assert.equal(url.searchParams.get("search_terms"), "oats & milk");
    assert.equal(url.searchParams.get("page_size"), "10");
    assert.match(
      (a.requests[0]!.init.headers as Record<string, string>)["User-Agent"]!,
      /AnticlockFitness/
    );
    assert.match(result.notice, /allergens are not verified/);
    await a.service.search("oats & milk");
    assert.equal(a.calls(), 1);
    await a.service.product("12345678");
    assert.equal(a.calls(), 1);
    a.advance(600001);
    await a.service.search("oats & milk");
    assert.equal(a.calls(), 2);
  });
  it("coalesces simultaneous matching searches before consuming the shared upstream budget", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const a = adapter({
      fetch: async () => {
        await gate;
        return Response.json({ products: [product] });
      },
    });
    const requests = Array.from({ length: 6 }, () => a.service.search("oats"));
    release();
    const results = await Promise.all(requests);
    assert.equal(a.calls(), 1);
    assert.equal(results.length, 6);
  });
  it("enforces the shared budget before making an upstream call and keeps manual entry available", async () => {
    let claims = 0;
    const a = adapter({ claimBudget: async () => ++claims <= 8 });
    for (let i = 0; i < 8; i++) await a.service.search(`query${i}`);
    await assert.rejects(
      () => a.service.search("query9"),
      (error: any) => error.status === 429 && error.code === "catalog_busy"
    );
    assert.equal(a.calls(), 8);
    const unavailable = adapter({
      claimBudget: async () => {
        throw new Error("Redis down");
      },
    });
    await assert.rejects(
      () => unavailable.service.search("oats"),
      (error: any) => error.status === 429 && /manually/.test(error.message)
    );
    assert.equal(unavailable.calls(), 0);
  });
  it("times out the whole lookup, including a stalled body, and rejects malformed/oversized/offline responses", async () => {
    const slow = adapter({
      deadlineMs: 5,
      fetch: async () => new Response(new ReadableStream({ start() {} })),
    });
    await assert.rejects(
      () => slow.service.search("oats"),
      (error: any) => error.code === "catalog_timeout"
    );
    for (const fetch of [
      async () => new Response("unavailable", { status: 503 }),
      async () => new Response("{bad"),
      async () => new Response("x".repeat(1000001)),
      async () => {
        throw new Error("Offline private URL must not leak");
      },
    ]) {
      const a = adapter({ fetch });
      await assert.rejects(
        () => a.service.search("oats"),
        (error: any) =>
          error.status === 408 &&
          error.code === "catalog_unavailable" &&
          !error.message.includes("private URL")
      );
    }
  });
  it("rejects invalid queries without requests and imports only the requested verified barcode", async () => {
    const a = adapter();
    await assert.rejects(() => a.service.search("x"));
    await assert.rejects(() => a.service.product("../secret"));
    assert.equal(a.calls(), 0);
    assert.equal((await a.service.product("12345678")).name, "Example food");
    assert.equal(
      new URL(a.requests[0]!.url).pathname,
      "/api/v2/product/12345678.json"
    );
    const mismatch = adapter({
      fetch: async () =>
        Response.json({ product: { ...product, code: "99999999" } }),
    });
    await assert.rejects(
      () => mismatch.service.product("12345678"),
      (error: any) => error.status === 404
    );
  });
});

describe(
  "Fitness catalog shared database budget (PostgreSQL)",
  { skip: !testDatabase },
  () => {
    const budgetId = `test-${randomUUID()}`;
    let db: any, sql: any, schema: any;
    before(async () => {
      const client = await import("../db/client.js");
      db = client.db;
      sql = client.sql;
      schema = await import("../db/schema.js");
    });
    after(async () => {
      if (!db) return;
      try {
        const { eq } = await import("drizzle-orm");
        await db
          .delete(schema.fitnessCatalogLimits)
          .where(eq(schema.fitnessCatalogLimits.id, budgetId));
      } finally {
        await sql.end({ timeout: 5 });
      }
    });
    it("atomically allows only eight parallel requests and resets an expired window without contacting upstream", async () => {
      const { claimFitnessFoodCatalogDatabaseBudget: claim } = await import(
        "../fitness/FoodCatalogService.js"
      );
      const { eq } = await import("drizzle-orm");
      const allowed = await Promise.all(
        Array.from({ length: 12 }, () => claim(budgetId))
      );
      assert.equal(allowed.filter(Boolean).length, 8);
      let [row] = await db
        .select()
        .from(schema.fitnessCatalogLimits)
        .where(eq(schema.fitnessCatalogLimits.id, budgetId));
      assert.equal(row.count, 12);
      await db
        .update(schema.fitnessCatalogLimits)
        .set({ resetAt: new Date(0) })
        .where(eq(schema.fitnessCatalogLimits.id, budgetId));
      assert.equal(await claim(budgetId), true);
      [row] = await db
        .select()
        .from(schema.fitnessCatalogLimits)
        .where(eq(schema.fitnessCatalogLimits.id, budgetId));
      assert.equal(row.count, 1);
    });
  }
);
