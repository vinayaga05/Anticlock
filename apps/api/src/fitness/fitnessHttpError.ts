import { ZodError } from "zod";
import { ApiError, httpError } from "../lib/httpError.js";

/** Private health payloads/ciphertext must not reach generic SQL error logs. */
export function fitnessHttpError(error: unknown) {
  if (error instanceof ApiError || error instanceof ZodError)
    return httpError(error, "fitness");
  console.error("[fitness] request_failed");
  return {
    status: 503 as const,
    body: {
      error: {
        code: "fitness_unavailable",
        message:
          "Fitness is temporarily unavailable. Your changes have not been confirmed; please retry.",
      },
    },
  };
}
