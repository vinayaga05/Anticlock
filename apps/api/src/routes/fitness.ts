import { Hono, type Context } from "hono";
import {
  FitnessAssessmentPatchSchema,
  FitnessCreateLogSchema,
  FitnessFoodInputSchema,
  FitnessFoodImportSchema,
  FitnessLogDataSchemas,
  FitnessLogKindSchema,
  FitnessRecipeInputSchema,
  FitnessWorkoutActionSchema,
} from "@anticlock/contracts";
import { z } from "zod";
import { fitnessService } from "../fitness/FitnessService.js";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import { ApiError } from "../lib/httpError.js";
import { fitnessHttpError } from "../fitness/fitnessHttpError.js";
import { foodCatalogService } from "../fitness/FoodCatalogService.js";

export const fitnessMobileRoutes = new Hono<AppEnv>();
fitnessMobileRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});
fitnessMobileRoutes.use("*", requireAuth, async (c, next) => {
  if (c.get("auth").kind !== "mobile")
    return c.json(
      { error: { code: "forbidden", message: "Mobile session required." } },
      403
    );
  await next();
});
async function body(c: Context<AppEnv>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError(
      400,
      "validation_error",
      "A valid JSON body is required."
    );
  }
}
function route(run: (c: Context<AppEnv>) => Promise<Response>) {
  return async (c: Context<AppEnv>) => {
    try {
      return await run(c);
    } catch (error) {
      const result = fitnessHttpError(error);
      return c.json(result.body, result.status);
    }
  };
}
const user = (c: Context<AppEnv>) => c.get("auth").sub;
fitnessMobileRoutes.get(
  "/profile",
  route(async (c) =>
    c.json({ profile: await fitnessService.getProfile(user(c)) })
  )
);
fitnessMobileRoutes.patch(
  "/profile",
  route(async (c) =>
    c.json({
      profile: await fitnessService.saveProfile(
        user(c),
        FitnessAssessmentPatchSchema.parse(await body(c))
      ),
    })
  )
);
fitnessMobileRoutes.post(
  "/profile/complete",
  route(async (c) =>
    c.json({
      profile: await fitnessService.saveProfile(
        user(c),
        FitnessAssessmentPatchSchema.parse(await body(c)),
        true
      ),
    })
  )
);
fitnessMobileRoutes.get(
  "/plans",
  route(async (c) => c.json({ plans: await fitnessService.listPlans(user(c)) }))
);
fitnessMobileRoutes.post(
  "/plans/generate",
  route(async (c) =>
    c.json({ plan: await fitnessService.generatePlan(user(c)) }, 201)
  )
);
fitnessMobileRoutes.get(
  "/plans/:id/versions",
  route(async (c) =>
    c.json({
      versions: await fitnessService.planVersions(
        user(c),
        z.string().uuid().parse(c.req.param("id"))
      ),
    })
  )
);
fitnessMobileRoutes.get(
  "/templates",
  route(async (c) => c.json(await fitnessService.listTemplates(user(c))))
);
fitnessMobileRoutes.get(
  "/summary",
  route(async (c) =>
    c.json(
      await fitnessService.summary(
        user(c),
        c.req.query("date"),
        c.req.query("timezone") ?? "UTC"
      )
    )
  )
);
fitnessMobileRoutes.get(
  "/progress",
  route(async (c) =>
    c.json(
      await fitnessService.progress(
        user(c),
        c.req.query("from") ?? "",
        c.req.query("to") ?? "",
        c.req.query("timezone") ?? "UTC"
      )
    )
  )
);
fitnessMobileRoutes.get(
  "/logs/:kind",
  route(async (c) =>
    c.json({
      logs: await fitnessService.listLogs(
        user(c),
        FitnessLogKindSchema.parse(c.req.param("kind")),
        c.req.query("from"),
        c.req.query("to")
      ),
    })
  )
);
fitnessMobileRoutes.get(
  "/logs/:kind/:id",
  route(async (c) =>
    c.json({
      log: await fitnessService.getLog(
        user(c),
        FitnessLogKindSchema.parse(c.req.param("kind")),
        z.string().uuid().parse(c.req.param("id"))
      ),
    })
  )
);
fitnessMobileRoutes.post(
  "/logs/:kind",
  route(async (c) => {
    const kind = FitnessLogKindSchema.parse(c.req.param("kind"));
    const input = FitnessCreateLogSchema.parse(await body(c));
    FitnessLogDataSchemas[kind].parse(input.data);
    return c.json(
      { log: await fitnessService.createLog(user(c), kind, input) },
      201
    );
  })
);
fitnessMobileRoutes.patch(
  "/logs/:kind/:id",
  route(async (c) => {
    const kind = FitnessLogKindSchema.parse(c.req.param("kind"));
    const input = z
      .object({ data: z.unknown() })
      .strict()
      .parse(await body(c));
    FitnessLogDataSchemas[kind].parse(input.data);
    return c.json({
      log: await fitnessService.updateLog(
        user(c),
        kind,
        z.string().uuid().parse(c.req.param("id")),
        input
      ),
    });
  })
);
fitnessMobileRoutes.delete(
  "/logs/:kind/:id",
  route(async (c) => {
    await fitnessService.deleteLog(
      user(c),
      FitnessLogKindSchema.parse(c.req.param("kind")),
      z.string().uuid().parse(c.req.param("id"))
    );
    return c.json({ deleted: true });
  })
);
fitnessMobileRoutes.post(
  "/workouts/:id/actions",
  route(async (c) =>
    c.json({
      log: await fitnessService.workoutAction(
        user(c),
        z.string().uuid().parse(c.req.param("id")),
        FitnessWorkoutActionSchema.parse(await body(c))
      ),
    })
  )
);
fitnessMobileRoutes.get(
  "/foods/search",
  route(async (c) => {
    await fitnessService.activeUser(user(c));
    return c.json(await foodCatalogService.search(c.req.query("q") ?? ""));
  })
);
fitnessMobileRoutes.post(
  "/foods/import",
  route(async (c) => {
    const input = FitnessFoodImportSchema.parse(await body(c));
    return c.json(
      { food: await fitnessService.importCatalogFood(user(c), input.barcode) },
      201
    );
  })
);
fitnessMobileRoutes.get(
  "/foods",
  route(async (c) =>
    c.json({
      foods: await fitnessService.listFoods(user(c), c.req.query("q") ?? ""),
    })
  )
);
fitnessMobileRoutes.post(
  "/foods",
  route(async (c) =>
    c.json(
      {
        food: await fitnessService.createFood(
          user(c),
          FitnessFoodInputSchema.parse(await body(c))
        ),
      },
      201
    )
  )
);
fitnessMobileRoutes.get(
  "/recipes",
  route(async (c) =>
    c.json({ recipes: await fitnessService.listRecipes(user(c)) })
  )
);
fitnessMobileRoutes.post(
  "/recipes",
  route(async (c) =>
    c.json(
      {
        recipe: await fitnessService.createRecipe(
          user(c),
          FitnessRecipeInputSchema.parse(await body(c))
        ),
      },
      201
    )
  )
);
fitnessMobileRoutes.get(
  "/export",
  route(async (c) => {
    c.header(
      "Content-Disposition",
      'attachment; filename="fitness-export.json"'
    );
    c.header("Cache-Control", "no-store");
    return c.json(await fitnessService.exportData(user(c)));
  })
);
fitnessMobileRoutes.delete(
  "/data",
  route(async (c) => {
    await fitnessService.deleteData(user(c));
    return c.json({ deleted: true });
  })
);
