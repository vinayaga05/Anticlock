import { z } from 'zod';
import { PermissionSchema, RoleSchema } from './rbac.js';

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PaginatedMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  total: z.number().int().optional(),
});

export function paginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: PaginatedMetaSchema,
  });
}

export const AdminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  roles: z.array(RoleSchema),
  permissions: z.array(PermissionSchema),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;

export const AdminLoginResponseSchema = z.object({
  user: AdminUserSchema,
  token: z.string(),
});
export type AdminLoginResponse = z.infer<typeof AdminLoginResponseSchema>;

export const MobileSessionSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  token: z.string(),
  expiresAt: z.string().datetime(),
});
export type MobileSession = z.infer<typeof MobileSessionSchema>;

export const MobileTokenRequestSchema = z.object({
  deviceId: z.string().min(1),
  displayName: z.string().optional(),
});
export type MobileTokenRequest = z.infer<typeof MobileTokenRequestSchema>;

export const MobileUserSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().min(8),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
});
export type MobileUser = z.infer<typeof MobileUserSchema>;

export const MobileOtpSendRequestSchema = z.object({
  phone: z.string().min(8),
});
export type MobileOtpSendRequest = z.infer<typeof MobileOtpSendRequestSchema>;

export const MobileOtpSendResponseSchema = z.object({
  requestId: z.string().uuid(),
  expiresInSeconds: z.number().int().positive(),
});
export type MobileOtpSendResponse = z.infer<typeof MobileOtpSendResponseSchema>;

export const MobileOtpVerifyRequestSchema = z.object({
  phone: z.string().min(8),
  code: z.string().length(6),
  requestId: z.string().uuid(),
});
export type MobileOtpVerifyRequest = z.infer<typeof MobileOtpVerifyRequestSchema>;

export const MobileLoginResponseSchema = z.object({
  user: MobileUserSchema,
  token: z.string(),
  expiresAt: z.string().datetime(),
});
export type MobileLoginResponse = z.infer<typeof MobileLoginResponseSchema>;
