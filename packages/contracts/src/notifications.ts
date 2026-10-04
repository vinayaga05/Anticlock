import { z } from 'zod';

export const NotificationTypeSchema = z.enum([
  'booking_confirmed',
  'booking_cancelled',
  'booking_reminder',
  'provider_assigned',
  'status_update',
  'new_message',
  'community_post_comment',
  'community_post_like',
  'order_confirmed',
  'order_shipped',
  'order_delivered',
  'system',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const PlatformSchema = z.enum(['android', 'ios']);
export type Platform = z.infer<typeof PlatformSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  mobileUserId: z.string().uuid(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).optional().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const DeviceTokenSchema = z.object({
  id: z.string().uuid(),
  mobileUserId: z.string().uuid(),
  token: z.string(),
  platform: PlatformSchema,
  lastSeenAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type DeviceToken = z.infer<typeof DeviceTokenSchema>;

export const RegisterDeviceRequestSchema = z.object({
  token: z.string().min(1),
  platform: PlatformSchema,
});
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceRequestSchema>;

export const UnregisterDeviceRequestSchema = z.object({
  token: z.string().min(1),
});
export type UnregisterDeviceRequest = z.infer<typeof UnregisterDeviceRequestSchema>;

export const NotificationListQuerySchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
  unreadOnly: z.boolean().optional(),
});
export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

export const NotificationListResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

export const MarkNotificationReadRequestSchema = z.object({
  notificationId: z.string().uuid(),
});
export type MarkNotificationReadRequest = z.infer<typeof MarkNotificationReadRequestSchema>;

export const SendTestNotificationRequestSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  type: NotificationTypeSchema.optional(),
  data: z.record(z.unknown()).optional(),
});
export type SendTestNotificationRequest = z.infer<typeof SendTestNotificationRequestSchema>;
