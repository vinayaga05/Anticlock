import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  FitnessFoodImportSchema,
  FitnessFoodInputSchema,
  type FitnessCatalogFood,
  type FitnessFoodSearchResponse,
  type FitnessNutrients,
} from "@anticlock/contracts";
import { db } from "../db/client.js";
import { fitnessCatalogLimits } from "../db/schema.js";
import { ApiError } from "../lib/httpError.js";
import { getRedis } from "../lib/redis.js";

export const FOOD_CATALOG_NOTICE =
  "Estimates from Open Food Facts (ODbL). Verify the package label and edit before logging. Missing fibre is shown as 0. Ingredients and allergens are not verified.";
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
type CacheEntry = { expiresAt: number; foods: FitnessCatalogFood[] };
export type FoodCatalogDependencies = {
  fetch: Fetcher;
  now: () => number;
  claimBudget: () => Promise<boolean>;
  deadlineMs: number;
};
async function sharedBudget(): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60000),
    key = `fitness:foodcatalog:requests:${minute}`;
  if (process.env.REDIS_URL?.trim()) {
    // Atomically expire and increment so all API workers share the same upstream limit.
    const result = await getRedis().eval(
      "local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],120) end;return n",
      1,
      key
    );
    return typeof result === "number" && result <= 8;
  }
  return claimFitnessFoodCatalogDatabaseBudget();
}
export async function claimFitnessFoodCatalogDatabaseBudget(
  budgetId = "open_food_facts"
): Promise<boolean> {
  // A shared database budget also protects multi-process deployments without Redis.
  const resetAt = new Date(Date.now() + 60000);
  const [row] = await db
    .insert(fitnessCatalogLimits)
    .values({ id: budgetId, count: 1, resetAt })
    .onConflictDoUpdate({
      target: fitnessCatalogLimits.id,
      set: {
        count: sql`CASE WHEN ${fitnessCatalogLimits.resetAt} <= now() THEN 1 ELSE ${fitnessCatalogLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${
          fitnessCatalogLimits.resetAt
        } <= now() THEN ${resetAt.toISOString()}::timestamptz ELSE ${
          fitnessCatalogLimits.resetAt
        } END`,
      },
    })
    .returning({ count: fitnessCatalogLimits.count });
  return !!row && row.count <= 8;
}
export function normalizeCatalogFood(
  product: unknown
): FitnessCatalogFood | null {
  if (!product || typeof product !== "object") return null;
  const value = product as Record<string, unknown>;
  if (
    typeof value.code !== "string" ||
    !/^\d{8,14}$/.test(value.code) ||
    typeof value.product_name !== "string" ||
    !value.product_name.trim() ||
    !value.nutriments ||
    typeof value.nutriments !== "object"
  )
    return null;
  const source = value.nutriments as Record<string, unknown>,
    missingNutrients: Array<keyof FitnessNutrients> = [];
  const nutrient = (key: string): number | null => {
    const result = source[key];
    if (
      (typeof result !== "number" && typeof result !== "string") ||
      result === ""
    )
      return null;
    const numeric = Number(result);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
  };
  const calories = nutrient("energy-kcal_100g"),
    proteinG = nutrient("proteins_100g"),
    carbsG = nutrient("carbohydrates_100g"),
    fatG = nutrient("fat_100g"),
    fibre = nutrient("fiber_100g");
  if (
    calories === null ||
    proteinG === null ||
    carbsG === null ||
    fatG === null
  )
    return null;
  if (fibre === null) missingNutrients.push("fibreG");
  const parsed = FitnessFoodInputSchema.safeParse({
    name: value.product_name.trim().slice(0, 150),
    servingName: "100 g",
    servingGrams: 100,
    nutrients: { calories, proteinG, carbsG, fatG, fibreG: fibre ?? 0 },
  });
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    source: "open_food_facts",
    barcode: value.code,
    isEstimate: true,
    missingNutrients,
  };
}
export class FoodCatalogService {
  private queries = new Map<string, CacheEntry>();
  private products = new Map<
    string,
    { expiresAt: number; food: FitnessCatalogFood }
  >();
  private pending = new Map<string, Promise<FitnessCatalogFood[]>>();
  constructor(
    private readonly dependencies: FoodCatalogDependencies = {
      fetch: globalThis.fetch,
      now: () => Date.now(),
      claimBudget: sharedBudget,
      deadlineMs: 8000,
    }
  ) {}
  private prune() {
    const now = this.dependencies.now();
    for (const [key, value] of this.queries)
      if (value.expiresAt <= now) this.queries.delete(key);
    for (const [key, value] of this.products)
      if (value.expiresAt <= now) this.products.delete(key);
    while (this.queries.size > 250)
      this.queries.delete(this.queries.keys().next().value!);
    while (this.products.size > 2500)
      this.products.delete(this.products.keys().next().value!);
  }
  private async upstream(url: string): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          let claimed = false;
          try {
            claimed = await this.dependencies.claimBudget();
          } catch {
            throw new ApiError(
              429,
              "catalog_unavailable",
              "Food search is unavailable. You can add food manually."
            );
          }
          if (!claimed)
            throw new ApiError(
              429,
              "catalog_busy",
              "Food search is busy. Try again in a minute or add food manually."
            );
          if (controller.signal.aborted)
            throw new Error("Catalog lookup cancelled.");
          const response = await this.dependencies.fetch(url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "AnticlockFitness/1.0 (https://knock.org.in)",
              Accept: "application/json",
            },
            redirect: "error",
          });
          if (!response.ok)
            throw new ApiError(
              408,
              "catalog_unavailable",
              "Food search is unavailable. You can add food manually."
            );
          const reader = response.body?.getReader();
          if (!reader) throw new Error("Missing catalog response.");
          let length = 0;
          const chunks: Uint8Array[] = [];
          for (;;) {
            const result = await reader.read();
            if (result.done) break;
            length += result.value.byteLength;
            if (length > 1000000) {
              await reader.cancel();
              throw new Error("Catalog response too large.");
            }
            chunks.push(result.value);
          }
          return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
        })(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(
              new ApiError(
                408,
                "catalog_timeout",
                "Food search timed out. You can add food manually."
              )
            );
          }, this.dependencies.deadlineMs);
        }),
      ]);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        408,
        "catalog_unavailable",
        "Food search is unavailable. You can add food manually."
      );
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
    }
  }
  private async searchFoods(query: string): Promise<FitnessCatalogFood[]> {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.search = new URLSearchParams({
      search_terms: query,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "10",
      fields: "code,product_name,nutriments,serving_size",
    }).toString();
    const raw = await this.upstream(url.toString());
    if (
      !raw ||
      typeof raw !== "object" ||
      !Array.isArray((raw as { products?: unknown }).products)
    )
      throw new ApiError(
        408,
        "catalog_unavailable",
        "Food search is unavailable. You can add food manually."
      );
    const foods = (raw as { products: unknown[] }).products
      .map(normalizeCatalogFood)
      .filter((value): value is FitnessCatalogFood => value !== null)
      .slice(0, 10);
    const expiresAt = this.dependencies.now() + 600000;
    this.queries.set(createHash("sha256").update(query).digest("hex"), {
      expiresAt,
      foods,
    });
    for (const food of foods)
      this.products.set(food.barcode, { expiresAt, food });
    this.prune();
    return foods;
  }
  async search(input: string): Promise<FitnessFoodSearchResponse> {
    const query = input.trim().toLowerCase();
    if (query.length < 2 || query.length > 100)
      throw new ApiError(
        400,
        "validation_error",
        "Use between 2 and 100 characters for food search."
      );
    this.prune();
    const key = createHash("sha256").update(query).digest("hex");
    const cached = this.queries.get(key);
    if (cached)
      return {
        foods: cached.foods,
        source: "open_food_facts",
        notice: FOOD_CATALOG_NOTICE,
      };
    let request = this.pending.get(key);
    if (!request) {
      request = this.searchFoods(query);
      this.pending.set(key, request);
    }
    try {
      return {
        foods: await request,
        source: "open_food_facts",
        notice: FOOD_CATALOG_NOTICE,
      };
    } finally {
      if (this.pending.get(key) === request) this.pending.delete(key);
    }
  }
  async product(barcode: string): Promise<FitnessCatalogFood> {
    FitnessFoodImportSchema.parse({ barcode });
    this.prune();
    const cached = this.products.get(barcode);
    if (cached) return cached.food;
    const raw = await this.upstream(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,nutriments,serving_size`
    );
    const food = normalizeCatalogFood(
      raw && typeof raw === "object"
        ? (raw as { product?: unknown }).product
        : null
    );
    if (!food || food.barcode !== barcode)
      throw new ApiError(
        404,
        "catalog_not_found",
        "That food is unavailable. You can add it manually."
      );
    this.products.set(barcode, {
      food,
      expiresAt: this.dependencies.now() + 600000,
    });
    return food;
  }
}
export const foodCatalogService = new FoodCatalogService();

export { sharedBudget as claimFitnessFoodCatalogBudget };
