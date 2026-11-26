import type { MiddlewareHandler } from "hono";
import {
  PERSONAL_PLAY_EDITION,
  PLAY_EDITION_HEADER,
  isPlayHealthCategory,
  isPlayHealthRecord,
  containsDirectPlayHealthRecord,
  filterPersonalPlayResponse,
} from "@anticlock/contracts";

/** Exclude health data before it is transmitted to the personal-account Play app. */
export const personalPlayEdition: MiddlewareHandler = async (c, next) => {
  c.header("Vary", PLAY_EDITION_HEADER, { append: true });
  if (c.req.header(PLAY_EDITION_HEADER) !== PERSONAL_PLAY_EDITION)
    return next();
  c.header("Cache-Control", "private, no-store");
  const unavailable = () =>
    c.json(
      {
        error: {
          code: "feature_unavailable",
          message: "This service is not available in this version of Knock.",
        },
      },
      403
    );
  if (
    /^\/v1\/(?:fitness|health|doctors|labs)(?:\/|$)/.test(c.req.path) ||
    c.req.path === "/v1/assistant/chat"
  )
    return unavailable();
  if (
    ["treeId", "categoryId"].some((key) =>
      isPlayHealthCategory(c.req.query(key))
    )
  )
    return unavailable();
  if (
    /^(POST|PUT|PATCH)$/.test(c.req.method) &&
    c.req.header("content-type")?.includes("application/json")
  ) {
    const body: unknown = await c.req.json().catch(() => null);
    if (isPlayHealthRecord(body)) return unavailable();
  }
  await next();
  c.header("Cache-Control", "private, no-store");
  if (
    !c.res.ok ||
    !c.res.headers.get("content-type")?.includes("application/json")
  )
    return;
  const data: unknown = await c.res.clone().json();
  if (containsDirectPlayHealthRecord(data)) {
    c.res = unavailable();
    return;
  }
  const headers = new Headers(c.res.headers);
  headers.delete("content-length");
  headers.delete("etag");
  c.res = new Response(JSON.stringify(filterPersonalPlayResponse(data)), {
    status: c.res.status,
    headers,
  });
};
