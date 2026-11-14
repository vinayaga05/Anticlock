import { Hono } from "hono";
import { z } from "zod";
import {
  FitnessConsentRequestSchema,
  FitnessConsultationRequestSchema,
  FitnessExpertQuerySchema,
  FitnessPlanRevisionSchema,
} from "@anticlock/contracts";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import { ApiError } from "../lib/httpError.js";
import { fitnessHttpError as httpError } from "../fitness/fitnessHttpError.js";
import { fitnessExpertService } from "../fitness/FitnessExpertService.js";

export const fitnessExpertRoutes = new Hono<AppEnv>();
fitnessExpertRoutes.use("*", requireAuth, async (c, next) => {
  c.header("Cache-Control", "no-store, private");
  if (c.get("auth").kind !== "mobile")
    return c.json(
      { error: { code: "forbidden", message: "Mobile session required." } },
      403
    );
  await next();
});
const id = (value: string) => z.string().uuid().parse(value);
async function json(c: { req: { json(): Promise<unknown> } }) {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError(
      400,
      "validation_error",
      "A valid JSON request is required."
    );
  }
}
fitnessExpertRoutes.get("/experts", async (c) => {
  try {
    return c.json(
      await fitnessExpertService.listExperts(
        c.get("auth").sub,
        FitnessExpertQuerySchema.parse(c.req.query())
      )
    );
  } catch (e) {
    const m = httpError(e);
    return c.json(m.body, m.status);
  }
});
fitnessExpertRoutes.get("/consents", async (c) => {
  try {
    return c.json(await fitnessExpertService.listConsents(c.get("auth").sub));
  } catch (e) {
    const m = httpError(e);
    return c.json(m.body, m.status);
  }
});
fitnessExpertRoutes.put("/consents/:providerId", async (c) => {
  try {
    return c.json(
      await fitnessExpertService.setConsent(
        c.get("auth").sub,
        id(c.req.param("providerId")),
        FitnessConsentRequestSchema.parse(await json(c))
      )
    );
  } catch (e) {
    const m = httpError(e);
    return c.json(m.body, m.status);
  }
});
fitnessExpertRoutes.delete("/consents/:providerId", async (c) => {
  try {
    return c.json(
      await fitnessExpertService.revokeConsent(
        c.get("auth").sub,
        id(c.req.param("providerId"))
      )
    );
  } catch (e) {
    const m = httpError(e);
    return c.json(m.body, m.status);
  }
});
fitnessExpertRoutes.get("/share-choices", async (c) => {
  try {
    return c.json(await fitnessExpertService.shareChoices(c.get("auth").sub));
  } catch (e) {
    const m = httpError(e);
    return c.json(m.body, m.status);
  }
});
fitnessExpertRoutes.get("/consultations", async (c) => {
  try {
    return c.json({
      consultations: await fitnessExpertService.consultations(
        c.get("auth").sub
      ),
    });
  } catch (e) {
    const m = httpError(e);
    return c.json(m.body, m.status);
  }
});
fitnessExpertRoutes.post("/consultations", async (c) => {
  try {
    const r = FitnessConsultationRequestSchema.parse(await json(c));
    return c.json(
      await fitnessExpertService.registerConsultation(
        c.get("auth").sub,
        r.bookingId,
        r.mode
      ),
      201
    );
  } catch (e) {
    const m = httpError(e);
    return c.json(m.body, m.status);
  }
});
fitnessExpertRoutes.get("/workspace", async (c) => {
  try {
    return c.json(await fitnessExpertService.workspace(c.get("auth").sub));
  } catch (e) {
    const m = httpError(e);
    return c.json(m.body, m.status);
  }
});
fitnessExpertRoutes.get(
  "/workspace/:providerId/clients/:clientId",
  async (c) => {
    try {
      return c.json(
        await fitnessExpertService.client(
          c.get("auth").sub,
          id(c.req.param("providerId")),
          id(c.req.param("clientId"))
        )
      );
    } catch (e) {
      const m = httpError(e);
      return c.json(m.body, m.status);
    }
  }
);
fitnessExpertRoutes.put(
  "/workspace/:providerId/clients/:clientId/plans/:planId",
  async (c) => {
    try {
      return c.json(
        await fitnessExpertService.revisePlan(
          c.get("auth").sub,
          id(c.req.param("providerId")),
          id(c.req.param("clientId")),
          id(c.req.param("planId")),
          FitnessPlanRevisionSchema.parse(await json(c))
        )
      );
    } catch (e) {
      const m = httpError(e);
      return c.json(m.body, m.status);
    }
  }
);
