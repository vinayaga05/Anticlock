import { Hono } from "hono";
import {
  NotificationListQuerySchema,
  RegisterDeviceRequestSchema,
  UnregisterDeviceRequestSchema,
  SendTestNotificationRequestSchema,
} from "@anticlock/contracts";
import { notificationService } from "../notifications/NotificationService.js";
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from "../middleware/auth.js";

function requireMobileAuth(c: {
  get: (k: "auth") => { kind: string; sub: string };
}) {
  const auth = c.get("auth");
  if (auth.kind !== "mobile") {
    throw Object.assign(new Error("Mobile session required"), {
      code: "forbidden",
      status: 403,
    });
  }
  return auth;
}

function httpError(err: unknown) {
  const e = err as { status?: number; code?: string; message?: string };
  return {
    status: (e.status ?? 500) as 400 | 403 | 404 | 500,
    body: {
      error: {
        code: e.code ?? "error",
        message: e.message ?? "Unexpected error",
      },
    },
  };
}

export const notificationsMobileRoutes = new Hono<AppEnv>();
notificationsMobileRoutes.use("*", requireAuth);

notificationsMobileRoutes.get("/", async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const query = {
      limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
      cursor: c.req.query("cursor"),
      unreadOnly: c.req.query("unreadOnly") === "true",
    };
    const validated = NotificationListQuerySchema.parse(query);
    const result = await notificationService.listNotifications(
      auth.sub,
      validated
    );
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

notificationsMobileRoutes.get("/unread-count", async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const count = await notificationService.getUnreadCount(auth.sub);
    return c.json({ unreadCount: count });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

notificationsMobileRoutes.post("/:id/read", async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const success = await notificationService.markRead(
      c.req.param("id"),
      auth.sub
    );
    if (!success) {
      return c.json(
        {
          error: {
            code: "not_found",
            message: "Notification not found or already read",
          },
        },
        404
      );
    }
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

notificationsMobileRoutes.post("/read-all", async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const count = await notificationService.markAllRead(auth.sub);
    return c.json({ count });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

notificationsMobileRoutes.delete("/:id", async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const success = await notificationService.deleteNotification(
      c.req.param("id"),
      auth.sub
    );
    if (!success) {
      return c.json(
        {
          error: {
            code: "not_found",
            message: "Notification not found",
          },
        },
        404
      );
    }
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

export const devicesMobileRoutes = new Hono<AppEnv>();
devicesMobileRoutes.use("*", requireAuth);

devicesMobileRoutes.post("/", async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const body = RegisterDeviceRequestSchema.parse(await c.req.json());
    await notificationService.registerDeviceToken(
      auth.sub,
      body.token,
      body.platform
    );
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

devicesMobileRoutes.delete("/", async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const body = UnregisterDeviceRequestSchema.parse(await c.req.json());
    const success = await notificationService.unregisterDeviceToken(
      auth.sub,
      body.token
    );
    return c.json({ success });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

devicesMobileRoutes.get("/", async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const tokens = await notificationService.getUserDeviceTokens(auth.sub);
    return c.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        mobileUserId: t.mobileUserId,
        token: t.token,
        platform: t.platform,
        lastSeenAt: t.lastSeenAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

export const notificationsAdminRoutes = new Hono<AppEnv>();
notificationsAdminRoutes.use("*", requireAuth);

notificationsAdminRoutes.post(
  "/send-test",
  requirePermission("catalog.read"),
  async (c) => {
    try {
      const body = SendTestNotificationRequestSchema.parse(await c.req.json());
      const result = await notificationService.notifyUser(body.userId, {
        type: body.type ?? "system",
        title: body.title,
        body: body.body,
        data: body.data,
      });
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  }
);

notificationsAdminRoutes.get(
  "/recent",
  requirePermission("catalog.read"),
  async (c) => {
    try {
      const userId = c.req.query("userId");
      if (!userId) {
        return c.json(
          {
            error: {
              code: "validation_error",
              message: "userId query parameter is required",
            },
          },
          400
        );
      }

      const result = await notificationService.listNotifications(userId, {
        limit: 50,
      });
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  }
);
