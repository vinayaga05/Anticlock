import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import {
  FitnessMealEstimateRequestSchema,
  FitnessMediaMetadataSchema,
  FitnessMediaPurposeSchema,
} from "@anticlock/contracts";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import { ApiError } from "../lib/httpError.js";
import {
  fitnessMediaService,
  MAX_FITNESS_VIDEO_BYTES,
} from "../fitness/FitnessMediaService.js";
import { fitnessMealEstimateService } from "../fitness/FitnessMealEstimateService.js";
import { fitnessHttpError } from "../fitness/fitnessHttpError.js";

export const fitnessMediaRoutes = new Hono<AppEnv>();
fitnessMediaRoutes.use("*", requireAuth, async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  c.header("Vary", "Authorization");
  if (c.get("auth").kind !== "mobile")
    return c.json(
      {
        error: {
          code: "forbidden",
          message: "An active mobile account is required.",
        },
      },
      403
    );
  await next();
});
function route(run: (c: Context<AppEnv>) => Promise<Response>) {
  return async (c: Context<AppEnv>) => {
    try {
      return await run(c);
    } catch (error) {
      const mapped = fitnessHttpError(error);
      return c.json(mapped.body, mapped.status);
    }
  };
}
const id = (c: Context<AppEnv>) => z.string().uuid().parse(c.req.param("id"));
const provider = (c: Context<AppEnv>) =>
  z.string().uuid().optional().parse(c.req.query("providerId"));
fitnessMediaRoutes.post(
  "/media/upload",
  bodyLimit({
    maxSize: MAX_FITNESS_VIDEO_BYTES + 64 * 1024,
    onError: (c) =>
      c.json(
        {
          error: {
            code: "file_too_large",
            message: "Choose a photo up to5MB or an MP4 video up to25MB.",
          },
        },
        413
      ),
  }),
  route(async (c) => {
    const input = await c.req.parseBody({ all: true });
    if (!(input.file instanceof File))
      throw new ApiError(400, "invalid_file", "Choose one photo or video.");
    const purpose = FitnessMediaPurposeSchema.parse(input.purpose),
      clientRequestId = z.string().uuid().parse(input.clientRequestId);
    const caption = z.string().trim().max(1000).optional().parse(input.caption);
    if (
      input.comparisonOptIn !== undefined &&
      input.comparisonOptIn !== "true" &&
      input.comparisonOptIn !== "false"
    )
      throw new ApiError(
        400,
        "validation_error",
        "Choose whether to include this photo in your private comparisons."
      );
    const media = await fitnessMediaService.upload(c.get("auth").sub, {
      bytes: Buffer.from(await input.file.arrayBuffer()),
      contentType: input.file.type,
      purpose,
      clientRequestId,
      caption,
      comparisonOptIn: input.comparisonOptIn === "true",
    });
    return c.json({ media }, 201);
  })
);
fitnessMediaRoutes.get(
  "/media",
  route(async (c) =>
    c.json({ media: await fitnessMediaService.list(c.get("auth").sub) })
  )
);
fitnessMediaRoutes.get(
  "/media/:id/content",
  route(async (c) =>
    fitnessMediaService.content(
      c.get("auth").sub,
      id(c),
      provider(c),
      c.req.header("range")
    )
  )
);
fitnessMediaRoutes.get(
  "/media/:id",
  route(async (c) =>
    c.json({
      media: await fitnessMediaService.get(
        c.get("auth").sub,
        id(c),
        provider(c)
      ),
    })
  )
);
fitnessMediaRoutes.patch(
  "/media/:id",
  route(async (c) =>
    c.json({
      media: await fitnessMediaService.update(
        c.get("auth").sub,
        id(c),
        FitnessMediaMetadataSchema.parse(await c.req.json())
      ),
    })
  )
);
fitnessMediaRoutes.delete(
  "/media/:id",
  route(async (c) => {
    await fitnessMediaService.delete(c.get("auth").sub, id(c));
    return c.json({ ok: true });
  })
);
fitnessMediaRoutes.post(
  "/meals/estimate",
  route(async (c) => {
    const body = FitnessMealEstimateRequestSchema.parse(await c.req.json());
    return c.json({
      estimate: await fitnessMealEstimateService.estimate(
        c.get("auth").sub,
        body.mediaId,
        body.consentToAI
      ),
      saved: false,
    });
  })
);
