import { Hono } from "hono";
import { asc, desc, eq } from "drizzle-orm";
import {
  AssignRolesRequestSchema,
  CreateInterestOptionSchema,
  ManageServiceCategorySchema,
  UpdateInterestOptionSchema,
} from "@anticlock/contracts";
import { db } from "../db/client.js";
import {
  auditLogs,
  roles,
  serviceCategories,
  serviceTrees,
  userRoles,
  users,
  mobileUsers,
} from "../db/schema.js";
import { writeAudit } from "../lib/audit.js";
import { searchService } from "../assistant/SearchService.js";
import { interestService } from "../interests/InterestService.js";
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from "../middleware/auth.js";

export const catalogRoutes = new Hono<AppEnv>();

catalogRoutes.get("/trees", async (c) => {
  const rows = await db
    .select()
    .from(serviceTrees)
    .where(eq(serviceTrees.status, "published"))
    .orderBy(asc(serviceTrees.sortOrder));

  return c.json({
    data: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description ?? undefined,
      icon: r.icon ?? undefined,
      accentColor: r.accentColor ?? undefined,
      sortOrder: r.sortOrder,
      status: r.status,
    })),
    meta: { nextCursor: null },
  });
});

catalogRoutes.get("/categories", async (c) => {
  const treeId = c.req.query("treeId");
  const rows = treeId
    ? await db
        .select()
        .from(serviceCategories)
        .where(eq(serviceCategories.treeId, treeId))
        .orderBy(asc(serviceCategories.sortOrder))
    : await db
        .select()
        .from(serviceCategories)
        .orderBy(asc(serviceCategories.sortOrder));

  return c.json({
    data: rows
      .filter((r) => r.status === "published")
      .map((r) => ({
        id: r.id,
        treeId: r.treeId,
        parentId: r.parentId ?? undefined,
        name: r.name,
        description: r.description ?? undefined,
        icon: r.icon ?? undefined,
        actionType: r.actionType ?? undefined,
        sortOrder: r.sortOrder,
        status: r.status,
      })),
    meta: { nextCursor: null },
  });
});

catalogRoutes.get("/search", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) {
    return c.json({ data: [], meta: { query: q } });
  }
  const data = await searchService.searchCatalog(q, 20);
  return c.json({ data, meta: { query: q } });
});

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", requireAuth);

adminRoutes.get("/users", requirePermission("users.read"), async (c) => {
  const allUsers = await db.select().from(users).orderBy(asc(users.createdAt));
  const allUserRoles = await db.select().from(userRoles);
  const data = allUsers.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    roles: allUserRoles.filter((r) => r.userId === u.id).map((r) => r.roleId),
    createdAt: u.createdAt.toISOString(),
  }));
  return c.json({ data, meta: { nextCursor: null } });
});

adminRoutes.get("/users/mobile", requirePermission("catalog.read"), async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  const limit = Math.min(Number(c.req.query("limit")) || 20, 100);

  let query = db.select().from(mobileUsers).where(eq(mobileUsers.isActive, true));

  if (q) {
    const { ilike, or } = await import("drizzle-orm");
    query = query.where(
      or(
        ilike(mobileUsers.phone, `%${q}%`),
        ilike(mobileUsers.displayName, `%${q}%`)
      )
    );
  }

  const rows = await query.orderBy(desc(mobileUsers.createdAt)).limit(limit);

  return c.json({
    data: rows.map((u) => ({
      id: u.id,
      phone: u.phone,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl ?? undefined,
      createdAt: u.createdAt.toISOString(),
    })),
  });
});

adminRoutes.get("/roles", requirePermission("roles.manage"), async (c) => {
  const rows = await db.select().from(roles);
  return c.json({ data: rows });
});

adminRoutes.put(
  "/users/:id/roles",
  requirePermission("roles.manage"),
  async (c) => {
    const userId = c.req.param("id");
    const body = AssignRolesRequestSchema.parse(await c.req.json());
    const auth = c.get("auth");

    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    for (const roleId of body.roles) {
      await db.insert(userRoles).values({ userId, roleId });
    }

    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: "roles.assign",
      entityType: "user",
      entityId: userId,
      metadata: { roles: body.roles },
    });

    return c.json({ ok: true });
  }
);

adminRoutes.post(
  "/catalog/categories",
  requirePermission("catalog.write"),
  async (c) => {
    const category = ManageServiceCategorySchema.parse(await c.req.json());
    if (category.parentId && category.treeId !== "health") {
      return c.json(
        {
          error: {
            code: "invalid_parent",
            message: "Only Health categories can have specialties.",
          },
        },
        400
      );
    }
    await db.insert(serviceCategories).values({
      id: category.id,
      treeId: category.treeId,
      parentId: category.parentId ?? null,
      name: category.name,
      description: category.description ?? null,
      icon: category.icon ?? null,
      actionType: category.actionType ?? null,
      sortOrder: category.sortOrder,
      status: category.status ?? "published",
    });
    return c.json({ ok: true }, 201);
  }
);

adminRoutes.put(
  "/catalog/categories/:id",
  requirePermission("catalog.write"),
  async (c) => {
    const category = ManageServiceCategorySchema.parse(await c.req.json());
    if (category.parentId && category.treeId !== "health") {
      return c.json(
        {
          error: {
            code: "invalid_parent",
            message: "Only Health categories can have specialties.",
          },
        },
        400
      );
    }
    await db
      .update(serviceCategories)
      .set({
        treeId: category.treeId,
        parentId: category.parentId ?? null,
        name: category.name,
        description: category.description ?? null,
        icon: category.icon ?? null,
        actionType: category.actionType ?? null,
        sortOrder: category.sortOrder,
        status: category.status ?? "published",
        updatedAt: new Date(),
      })
      .where(eq(serviceCategories.id, c.req.param("id")));
    return c.json({ ok: true });
  }
);

adminRoutes.delete(
  "/catalog/categories/:id",
  requirePermission("catalog.write"),
  async (c) => {
    await db
      .delete(serviceCategories)
      .where(eq(serviceCategories.id, c.req.param("id")));
    return c.body(null, 204);
  }
);

adminRoutes.get(
  "/interests",
  requirePermission("catalog.read"),
  async c => c.json({ data: await interestService.listForAdmin() }),
);

adminRoutes.post(
  "/interests",
  requirePermission("catalog.write"),
  async c => {
    const option = CreateInterestOptionSchema.parse(await c.req.json());
    const created = await interestService.createOption(option);
    const auth = c.get("auth");
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: "interest_option.created",
      entityType: "interest_option",
      entityId: created.id,
    });
    return c.json({ data: created }, 201);
  },
);

adminRoutes.put(
  "/interests/:id",
  requirePermission("catalog.write"),
  async c => {
    const option = UpdateInterestOptionSchema.parse(await c.req.json());
    const updated = await interestService.updateOption(c.req.param("id"), option);
    const auth = c.get("auth");
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: "interest_option.updated",
      entityType: "interest_option",
      entityId: updated.id,
    });
    return c.json({ data: updated });
  },
);

adminRoutes.delete(
  "/interests/:id",
  requirePermission("catalog.write"),
  async c => {
    const id = c.req.param("id");
    await interestService.deleteOption(id);
    const auth = c.get("auth");
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: "interest_option.deleted",
      entityType: "interest_option",
      entityId: id,
    });
    return c.body(null, 204);
  },
);

adminRoutes.get("/audit-logs", requirePermission("audit.read"), async (c) => {
  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);
  const data = rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    actorEmail: r.actorEmail,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: r.metadata ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
  return c.json({ data, meta: { nextCursor: null } });
});

adminRoutes.get(
  "/catalog/trees",
  requirePermission("catalog.read"),
  async (c) => {
    const rows = await db
      .select()
      .from(serviceTrees)
      .orderBy(asc(serviceTrees.sortOrder));
    return c.json({
      data: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description ?? undefined,
        icon: r.icon ?? undefined,
        accentColor: r.accentColor ?? undefined,
        sortOrder: r.sortOrder,
        status: r.status,
      })),
      meta: { nextCursor: null },
    });
  }
);

adminRoutes.get(
  "/catalog/categories",
  requirePermission("catalog.read"),
  async (c) => {
    const treeId = c.req.query("treeId");
    const rows = treeId
      ? await db
          .select()
          .from(serviceCategories)
          .where(eq(serviceCategories.treeId, treeId))
          .orderBy(asc(serviceCategories.sortOrder))
      : await db
          .select()
          .from(serviceCategories)
          .orderBy(asc(serviceCategories.sortOrder));

    return c.json({
      data: rows.map((r) => ({
        id: r.id,
        treeId: r.treeId,
        parentId: r.parentId ?? undefined,
        name: r.name,
        description: r.description ?? undefined,
        icon: r.icon ?? undefined,
        actionType: r.actionType ?? undefined,
        sortOrder: r.sortOrder,
        status: r.status,
      })),
      meta: { nextCursor: null },
    });
  }
);
