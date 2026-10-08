import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { notifications, deviceTokens } from "../db/schema.js";
import type { NotificationType } from "@anticlock/contracts";
import type { Message } from "firebase-admin/messaging";
import { parseCursorIso } from '../lib/cursor.js';

interface FirebaseAdmin {
  messaging: () => {
    send: (message: Message) => Promise<string>;
    sendEach: (messages: Message[]) => Promise<{ successCount: number; failureCount: number; responses: Array<{ success: boolean; error?: Error }> }>;
  };
}

let firebaseAdmin: FirebaseAdmin | null = null;
let firebaseInitError: string | null = null;

function initializeFirebase(): FirebaseAdmin | null {
  if (firebaseAdmin !== null || firebaseInitError !== null) {
    return firebaseAdmin;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson || !serviceAccountJson.trim()) {
    firebaseInitError = "FIREBASE_SERVICE_ACCOUNT_JSON environment variable not set";
    console.warn(
      `[NotificationService] ${firebaseInitError}. Push notifications will be logged only.`
    );
    return null;
  }

  try {
    // Dynamic import to avoid hard dependency on firebase-admin
    const admin = require("firebase-admin");
    const serviceAccount = JSON.parse(serviceAccountJson);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    firebaseAdmin = admin as FirebaseAdmin;
    console.log("[NotificationService] Firebase Admin SDK initialized successfully");
    return firebaseAdmin;
  } catch (err) {
    firebaseInitError = `Failed to initialize Firebase: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[NotificationService] ${firebaseInitError}`);
    return null;
  }
}

export interface NotifyUserPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

class NotificationService {
  /**
   * Send a notification to a user. Creates a notification record and sends push
   * notifications to all registered devices via Firebase Cloud Messaging.
   * Invalid tokens are automatically removed.
   */
  async notifyUser(
    userId: string,
    payload: NotifyUserPayload
  ): Promise<{ notificationId: string; pushSent: boolean }> {
    // Create notification record
    const [notification] = await db
      .insert(notifications)
      .values({
        mobileUserId: userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? null,
      })
      .returning({ id: notifications.id });

    if (!notification) {
      throw new Error("Failed to create notification record");
    }

    // Get user's device tokens
    const tokens = await db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.mobileUserId, userId));

    if (tokens.length === 0) {
      console.log(
        `[NotificationService] No device tokens for user ${userId}, notification ${notification.id} created but not sent`
      );
      return { notificationId: notification.id, pushSent: false };
    }

    // Initialize Firebase if not already done
    const admin = initializeFirebase();
    if (!admin) {
      console.warn(
        `[NotificationService] Firebase not configured. Would send to ${tokens.length} device(s) for user ${userId}:`,
        { title: payload.title, body: payload.body, type: payload.type }
      );
      return { notificationId: notification.id, pushSent: false };
    }

    // Prepare FCM messages
    const messages: Message[] = tokens.map((token) => ({
      token: token.token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        notificationId: notification.id,
        type: payload.type,
        ...(payload.data
          ? Object.fromEntries(
              Object.entries(payload.data).map(([k, v]) => [
                k,
                typeof v === "string" ? v : JSON.stringify(v),
              ])
            )
          : {}),
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    }));

    try {
      const batchResponse = await admin.messaging().sendEach(messages);

      // Remove invalid tokens
      const invalidTokenIds: string[] = [];
      batchResponse.responses.forEach((response, idx) => {
        if (!response.success && response.error) {
          const errorCode = (response.error as any).code;
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            invalidTokenIds.push(tokens[idx].id);
          }
        }
      });

      if (invalidTokenIds.length > 0) {
        await db
          .delete(deviceTokens)
          .where(sql`${deviceTokens.id} = ANY(${invalidTokenIds})`);
        console.log(
          `[NotificationService] Removed ${invalidTokenIds.length} invalid token(s) for user ${userId}`
        );
      }

      console.log(
        `[NotificationService] Sent notification ${notification.id} to user ${userId}: ${batchResponse.successCount}/${tokens.length} devices`
      );

      return {
        notificationId: notification.id,
        pushSent: batchResponse.successCount > 0,
      };
    } catch (err) {
      console.error(
        `[NotificationService] Failed to send push for notification ${notification.id}:`,
        err
      );
      return { notificationId: notification.id, pushSent: false };
    }
  }

  async listNotifications(
    userId: string,
    options: { limit?: number; cursor?: string; unreadOnly?: boolean } = {}
  ) {
    const limit = Math.min(options.limit ?? 20, 100);
    const conditions = [eq(notifications.mobileUserId, userId)];

    if (options.cursor) {
      conditions.push(sql`${notifications.createdAt} < ${parseCursorIso(options.cursor)}`);
    }

    if (options.unreadOnly) {
      conditions.push(isNull(notifications.readAt));
    }

    const items = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1);

    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? results[results.length - 1].createdAt.toISOString() : null;

    // Get unread count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.mobileUserId, userId),
          isNull(notifications.readAt)
        )
      );

    return {
      notifications: results.map((n) => ({
        id: n.id,
        mobileUserId: n.mobileUserId,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor,
      unreadCount: count,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.mobileUserId, userId),
          isNull(notifications.readAt)
        )
      );
    return count;
  }

  async markRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.mobileUserId, userId),
          isNull(notifications.readAt)
        )
      )
      .returning({ id: notifications.id });

    return result.length > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.mobileUserId, userId),
          isNull(notifications.readAt)
        )
      )
      .returning({ id: notifications.id });

    return result.length;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.mobileUserId, userId)
        )
      )
      .returning({ id: notifications.id });

    return result.length > 0;
  }

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: "android" | "ios"
  ): Promise<void> {
    await db
      .insert(deviceTokens)
      .values({
        mobileUserId: userId,
        token,
        platform,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: {
          mobileUserId: userId,
          platform,
          lastSeenAt: new Date(),
        },
      });
  }

  async unregisterDeviceToken(userId: string, token: string): Promise<boolean> {
    const result = await db
      .delete(deviceTokens)
      .where(
        and(
          eq(deviceTokens.token, token),
          eq(deviceTokens.mobileUserId, userId)
        )
      )
      .returning({ id: deviceTokens.id });

    return result.length > 0;
  }

  async getUserDeviceTokens(userId: string) {
    return db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.mobileUserId, userId));
  }
}

export const notificationService = new NotificationService();
