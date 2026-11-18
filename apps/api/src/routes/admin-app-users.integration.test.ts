import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, describe, it } from "node:test";
const database = process.env.TEST_DATABASE_URL;
if (database) process.env.DATABASE_URL = database;
describe("Admin app user directory", { skip: !database }, () => {
  const ids = Array.from({ length: 4 }, () => randomUUID());
  const prefix = `directory-${randomUUID()}`;
  let app: any, db: any, sql: any, schema: any;
  const tokens: Record<string, string> = {};
  const createdAt = new Date("2026-11-01T10:00:00Z");
  async function get(query = "", token: string | undefined = tokens.admin) {
    const response = await app.request(
      `/admin/app-users${query ? `?${query}` : ""}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    return { status: response.status, body: await response.json() };
  }
  before(async () => {
    const { Hono } = await import("hono");
    const { adminRoutes } = await import("./admin.js");
    const { signToken } = await import("../lib/auth.js");
    const client = await import("../db/client.js");
    db = client.db;
    sql = client.sql;
    schema = await import("../db/schema.js");
    app = new Hono().route("/admin", adminRoutes);
    tokens.admin = await signToken({
      kind: "admin",
      sub: randomUUID(),
      name: "Directory reader",
      email: "test@example.test",
      roles: [],
      permissions: ["users.read"],
    });
    tokens.catalog = await signToken({
      kind: "admin",
      sub: randomUUID(),
      name: "Catalog reader",
      email: "test@example.test",
      roles: [],
      permissions: ["catalog.read"],
    });
    tokens.mobile = await signToken({
      kind: "mobile",
      sub: ids[0]!,
      name: "Mobile",
      email: "",
      roles: [],
      permissions: ["users.read"],
    });
    await db
      .insert(schema.mobileUsers)
      .values(
        ids.map((id, index) => ({
          id,
          displayName: `${prefix}${index === 0 ? "%" : " "}${index}`,
          phone: `+91000000010${index}`,
          createdAt,
          isActive: index !== 2,
          location: index === 0 ? "Chennai" : null,
          bio: index === 0 ? "Runner" : null,
          website: index === 0 ? "https://example.test" : null,
          isPrivate: index === 0,
          allowMessages: index !== 0,
        }))
      );
  });
  after(async () => {
    if (!db) return;
    const { inArray } = await import("drizzle-orm");
    await db
      .delete(schema.mobileUsers)
      .where(inArray(schema.mobileUsers.id, ids));
    await sql.end({ timeout: 5 });
  });
  it("requires a users.read admin session, not catalog permissions or a mobile session", async () => {
    assert.equal((await get("", "")).status, 401);
    assert.equal((await get("", tokens.catalog)).status, 403);
    assert.equal((await get("", tokens.mobile)).status, 403);
    assert.equal((await get(`q=${prefix}`)).status, 200);
  });
  it("lists active and inactive mobile accounts, with explicit safe details and ISO timestamps", async () => {
    const result = await get(`q=${prefix}`);
    assert.equal(result.body.meta.total, 4);
    const user = result.body.data.find((row: any) => row.id === ids[0]);
    assert.equal(user.phone, "+910000000100");
    assert.equal(user.location, "Chennai");
    assert.equal(user.isPrivate, true);
    assert.equal(user.allowMessages, false);
    assert.equal(user.createdAt, createdAt.toISOString());
    assert.deepEqual(
      Object.keys(user).sort(),
      [
        "id",
        "displayName",
        "phone",
        "avatarUrl",
        "bio",
        "location",
        "website",
        "isActive",
        "isPrivate",
        "allowMessages",
        "allowFollowRequests",
        "showFollowerLists",
        "interestsCompletedAt",
        "createdAt",
        "updatedAt",
      ].sort()
    );
    const inactive = await get(`q=${prefix}&status=inactive`);
    assert.equal(inactive.body.meta.total, 1);
    assert.equal(inactive.body.data[0].id, ids[2]);
    const active = await get(`q=${prefix}&status=active`);
    assert.equal(active.body.meta.total, 3);
  });
  it("searches names case-insensitively, phone, ID and treats SQL wildcards literally", async () => {
    assert.equal((await get(`q=${prefix.toUpperCase()}`)).body.meta.total, 4);
    assert.equal((await get("q=%2B910000000100")).body.data[0].id, ids[0]);
    assert.equal((await get(`q=${ids[1]}`)).body.data[0].id, ids[1]);
    const literal = await get(`q=${encodeURIComponent(prefix + "%")}`);
    assert.equal(literal.body.meta.total, 1);
    assert.equal(literal.body.data[0].id, ids[0]);
    const empty = await get(`q=not-found-${randomUUID()}`);
    assert.deepEqual(empty.body.data, []);
    assert.equal(empty.body.meta.total, 0);
  });
  it("paginates deterministically even for users created at the same time", async () => {
    const one = await get(`q=${prefix}&page=1&limit=2`);
    const two = await get(`q=${prefix}&page=2&limit=2`);
    assert.equal(one.body.meta.totalPages, 2);
    assert.equal(one.body.data.length, 2);
    assert.equal(two.body.data.length, 2);
    assert.equal(
      new Set([...one.body.data, ...two.body.data].map((row) => row.id)).size,
      4
    );
    assert.deepEqual(
      (await get(`q=${prefix}&page=1&limit=2`)).body.data.map(
        (row: any) => row.id
      ),
      one.body.data.map((row: any) => row.id)
    );
    assert.deepEqual((await get(`q=${prefix}&page=3&limit=2`)).body.data, []);
  });
  it("rejects malformed or unbounded query parameters", async () => {
    for (const query of [
      "page=0",
      "page=-1",
      "page=1.5",
      "limit=101",
      "limit=0",
      "status=unknown",
      `q=${"a".repeat(101)}`,
    ])
      assert.equal((await get(query)).status, 400, query);
  });
});
