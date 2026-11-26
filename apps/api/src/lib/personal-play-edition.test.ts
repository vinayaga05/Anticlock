import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { personalPlayEdition } from "./personal-play-edition.js";

const headers = { "X-Knock-Edition": "personal-play" };
const medical = { id: "provider-1", categoryIds: ["health.doctors"] };
const plumber = { id: "provider-2", categoryIds: ["home.plumber"] };
function app() {
  const server = new Hono();
  server.use("/v1/*", personalPlayEdition);
  server.get("/v1/marketplace/providers", (c) =>
    c.json({ data: [medical, plumber], nextCursor: "page2" })
  );
  server.get("/v1/businesses/medical", (c) => c.json({ profile: medical }));
  server.get("/v1/fitness/assessment", (c) =>
    c.json({ assessment: { weight: 75 } })
  );
  server.post("/v1/bookings", async (c) => c.json(await c.req.json()));
  return server;
}
test("personal Play responses exclude medical services before transmission", async () => {
  const server = app();
  const result = await server.request("/v1/marketplace/providers", { headers });
  assert.deepEqual(await result.json(), {
    data: [plumber],
    nextCursor: "page2",
  });
  assert.match(result.headers.get("vary") ?? "", /X-Knock-Edition/i);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.equal(
    (await server.request("/v1/businesses/medical", { headers })).status,
    403
  );
  assert.equal(
    (await server.request("/v1/fitness/assessment", { headers })).status,
    403
  );
});
test("other clients retain their existing response", async () => {
  const result = await app().request("/v1/marketplace/providers");
  assert.deepEqual(await result.json(), {
    data: [medical, plumber],
    nextCursor: "page2",
  });
});
test("health mutations are rejected and nonhealth request bodies remain readable", async () => {
  const server = app();
  for (const categoryId of ["health.doctors", "home.plumber"]) {
    const result = await server.request("/v1/bookings", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    assert.equal(result.status, categoryId.startsWith("health") ? 403 : 200);
    if (!categoryId.startsWith("health"))
      assert.deepEqual(await result.json(), { categoryId });
  }
});
