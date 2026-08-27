import { z } from 'zod';

export const RoleSchema = z.enum([
  'super_admin',
  'ops',
  'content',
  'support',
  'finance',
]);
export type Role = z.infer<typeof RoleSchema>;

export const PermissionSchema = z.enum([
  'catalog.read',
  'catalog.write',
  'provider.read',
  'provider.write',
  'provider.verify',
  'cms.read',
  'cms.write',
  'cms.publish',
  'orders.manage',
  'bookings.manage',
  'moderation.act',
  'users.read',
  'users.write',
  'settings.write',
  'audit.read',
  'roles.manage',
  'media.read',
  'media.write',
  'media.delete',
]);
export type Permission = z.infer<typeof PermissionSchema>;

export const ContentStatusSchema = z.enum([
  'draft',
  'in_review',
  'scheduled',
  'published',
  'archived',
]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

/** Default role → permissions map (server seed + admin UI). */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'catalog.read',
    'catalog.write',
    'provider.read',
    'provider.write',
    'provider.verify',
    'cms.read',
    'cms.write',
    'cms.publish',
    'orders.manage',
    'bookings.manage',
    'moderation.act',
    'users.read',
    'users.write',
    'settings.write',
    'audit.read',
    'roles.manage',
    'media.read',
    'media.write',
    'media.delete',
  ],
  ops: [
    'catalog.read',
    'catalog.write',
    'provider.read',
    'provider.write',
    'provider.verify',
    'cms.read',
    'orders.manage',
    'bookings.manage',
    'users.read',
    'audit.read',
    'media.read',
    'media.write',
    'media.delete',
  ],
  content: [
    'catalog.read',
    'cms.read',
    'cms.write',
    'cms.publish',
    'provider.read',
    'audit.read',
    'media.read',
    'media.write',
  ],
  support: [
    'catalog.read',
    'provider.read',
    'cms.read',
    'orders.manage',
    'bookings.manage',
    'users.read',
    'moderation.act',
    'audit.read',
    'media.read',
  ],
  finance: [
    'catalog.read',
    'orders.manage',
    'users.read',
    'audit.read',
    'media.read',
  ],
};
