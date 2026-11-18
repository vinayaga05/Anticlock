import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { before, after, describe, it } from "node:test";
const database = process.env.TEST_DATABASE_URL;
const mediaDirectory = path.join(tmpdir(), `knock-shop-${randomUUID()}`);
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==",
  "base64"
);
if (database) {
  process.env.DATABASE_URL = database;
  process.env.MEDIA_STORAGE = "local";
  process.env.MEDIA_LOCAL_DIR = mediaDirectory;
  process.env.API_PUBLIC_URL = "http://localhost:4000";
}
describe("Admin Shop catalog to mobile", { skip: !database }, () => {
  let app: any, db: any, sql: any, schema: any;
  const categoryIds: string[] = [],
    productIds: string[] = [];
  const mobileId = randomUUID();
  const imageId = randomUUID();
  let admin = "",
    mobile = "",
    reader = "";
  async function call(
    token: string,
    method: string,
    url: string,
    value?: unknown
  ) {
    const response = await app.request(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: value === undefined ? undefined : JSON.stringify(value),
    });
    return { status: response.status, body: await response.json() };
  }
  before(async () => {
    const { Hono } = await import("hono");
    const { shopAdminRoutes, shopMobileRoutes } = await import("./shop.js");
    const { signToken } = await import("../lib/auth.js");
    const client = await import("../db/client.js");
    db = client.db;
    sql = client.sql;
    schema = await import("../db/schema.js");
    const { mediaPublicRoutes } = await import("./media.js");
    app = new Hono()
      .route("/admin/shop", shopAdminRoutes)
      .route("/v1/shop", shopMobileRoutes)
      .route("/v1/media", mediaPublicRoutes);
    const { LocalObjectStorageProvider } = await import(
      "../media/LocalObjectStorageProvider.js"
    );
    await new LocalObjectStorageProvider(mediaDirectory).putObject({
      bucket: "public-media",
      key: `public/shop-test/${imageId}.png`,
      body: imageBytes,
      contentType: "image/png",
    });
    admin = await signToken({
      kind: "admin",
      sub: randomUUID(),
      email: "test@example.test",
      name: "Shop admin",
      roles: [],
      permissions: ["catalog.read", "catalog.write"],
    });
    reader = await signToken({
      kind: "admin",
      sub: randomUUID(),
      email: "reader@example.test",
      name: "Reader",
      roles: [],
      permissions: ["catalog.read"],
    });
    await db
      .insert(schema.mobileUsers)
      .values({
        id: mobileId,
        phone: `shop-test-${mobileId}`,
        displayName: "Shop viewer",
      });
    mobile = await signToken({
      kind: "mobile",
      sub: mobileId,
      email: "",
      name: "Shop viewer",
      roles: [],
      permissions: [],
    });
    await db
      .insert(schema.mediaAssets)
      .values({
        id: imageId,
        kind: "image",
        storageProvider: "local",
        storageKey: `public/shop-test/${imageId}.png`,
        bucket: "public-media",
        mimeType: "image/png",
        byteSize: 100,
        width: 1,
        height: 1,
        accessLevel: "public",
        processingStatus: "ready",
        moderationStatus: "approved",
        checksumSha256: imageId,
      });
  });
  after(async () => {
    if (!db) return;
    const { inArray, eq } = await import("drizzle-orm");
    if (productIds.length) {
      await db
        .delete(schema.productImages)
        .where(inArray(schema.productImages.productId, productIds));
      await db
        .delete(schema.products)
        .where(inArray(schema.products.id, productIds));
    }
    if (categoryIds.length)
      await db
        .delete(schema.productCategories)
        .where(inArray(schema.productCategories.id, categoryIds));
    await db
      .delete(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, imageId));
    await db
      .delete(schema.mobileUsers)
      .where(eq(schema.mobileUsers.id, mobileId));
    await sql.end({ timeout: 5 });
    await rm(mediaDirectory, { recursive: true, force: true });
  });
  it("allows category/product creation only with catalog write permission", async () => {
    assert.equal(
      (
        await call(reader, "POST", "/admin/shop/categories", {
          name: "Blocked",
          slug: "blocked",
        })
      ).status,
      403
    );
    assert.equal(
      (await call(mobile, "POST", "/admin/shop/products", {})).status,
      403
    );
  });
  it("publishes categories, then products; drafts stay hidden; publishing and unpublishing update mobile listing/detail", async () => {
    const created = await call(admin, "POST", "/admin/shop/categories", {
      name: "Fitness shop test",
      slug: `fitness-test-${randomUUID()}`,
      status: "draft",
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((await call(admin, 'POST', '/admin/shop/categories', {name:'Duplicate',slug:created.body.category.slug})).status,409);
    const categoryId = created.body.category.id;
    categoryIds.push(categoryId);
    let categories = await call(mobile, "GET", "/v1/shop/categories");
    assert.equal(categories.status, 200);
    assert.ok(
      !categories.body.categories.some((c: any) => c.id === categoryId)
    );
    assert.equal(
      (
        await call(admin, "PATCH", `/admin/shop/categories/${categoryId}`, {
          status: "published",
        })
      ).status,
      200
    );
    categories = await call(mobile, "GET", "/v1/shop/categories");
    assert.ok(categories.body.categories.some((c: any) => c.id === categoryId));
    const input = {
      name: "Resistance band test",
      slug: `band-${randomUUID()}`,
      categoryId,
      price: 99900,
      inventory: 3,
      imageIds: [imageId],
      status: "draft",
    };
    const made = await call(admin, "POST", "/admin/shop/products", input);
    assert.equal(made.status, 201, JSON.stringify(made.body));
    const id = made.body.product.id;
    productIds.push(id);
    let listing = await call(
      mobile,
      "GET",
      `/v1/shop/products?categoryId=${categoryId}`
    );
    assert.deepEqual(listing.body.products, []);
    assert.equal(
      (await call(mobile, "GET", `/v1/shop/products/${id}`)).status,
      404
    );
    const published = await call(admin, "PATCH", `/admin/shop/products/${id}`, {
      status: "published",
    });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal(published.body.product.reviewStatus, "approved");
    listing = await call(
      mobile,
      "GET",
      `/v1/shop/products?categoryId=${categoryId}`
    );
    assert.equal(listing.body.products.length, 1);
    assert.equal(listing.body.products[0].price, 99900);
    assert.equal(listing.body.products[0].images[0].id, imageId);
    assert.match(listing.body.products[0].images[0].url, /v1\/media\/file/);
    const imageResponse = await app.request(
      new URL(listing.body.products[0].images[0].url).pathname
    );
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get("content-type"), "image/png");
    assert.deepEqual(
      Buffer.from(await imageResponse.arrayBuffer()),
      imageBytes
    );
    const detail = await call(mobile, "GET", `/v1/shop/products/${id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.product.name, input.name);
    assert.equal(
      (
        await call(admin, "PATCH", `/admin/shop/products/${id}`, {
          status: "draft",
        })
      ).status,
      200
    );
    listing = await call(
      mobile,
      "GET",
      `/v1/shop/products?categoryId=${categoryId}`
    );
    assert.deepEqual(listing.body.products, []);
  });
  it("rejects missing categories and unusable product images before creating rows", async () => {
    const countBefore = await db.select().from(schema.products);
    const invalid = await call(admin, "POST", "/admin/shop/products", {
      name: "Invalid",
      slug: randomUUID(),
      categoryId: randomUUID(),
      price: 100,
      inventory: 0,
      status: "published",
    });
    assert.equal(invalid.status, 400);
    const category = await call(admin, "POST", "/admin/shop/categories", {
      name: "Image validation",
      slug: randomUUID(),
      status: "published",
    });
    categoryIds.push(category.body.category.id);
    const missingImage = await call(admin, "POST", "/admin/shop/products", {
      name: "Invalid",
      slug: randomUUID(),
      categoryId: category.body.category.id,
      price: 100,
      inventory: 0,
      status: "published",
      imageIds: [randomUUID()],
    });
    assert.equal(missingImage.status, 400);
    assert.equal(
      (await db.select().from(schema.products)).length,
      countBefore.length
    );
  });
});
