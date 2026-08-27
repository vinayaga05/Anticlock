import { z } from 'zod';
import { ContentStatusSchema, RoleSchema } from './rbac.js';

export const ServiceTreeIdSchema = z.enum([
  'health',
  'fitness',
  'sports',
  'wellness',
  'tours_events',
  'beauty_spa',
  'course_training',
  'home_services',
  'ecommerce',
]);
export type ServiceTreeId = z.infer<typeof ServiceTreeIdSchema>;

export const ServiceTreeSchema = z.object({
  id: z.string(),
  slug: ServiceTreeIdSchema,
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  accentColor: z.string().optional(),
  sortOrder: z.number().int().default(0),
  status: ContentStatusSchema,
});
export type ServiceTree = z.infer<typeof ServiceTreeSchema>;

export const ServiceCategorySchema = z.object({
  id: z.string(),
  treeId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  actionType: z.string().optional(),
  sortOrder: z.number().int().default(0),
  status: ContentStatusSchema,
});
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().nullable(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

export const AdminUserListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  roles: z.array(z.string()),
  createdAt: z.string().datetime(),
});
export type AdminUserListItem = z.infer<typeof AdminUserListItemSchema>;

export const AssignRolesRequestSchema = z.object({
  roles: z.array(RoleSchema).min(1),
});
export type AssignRolesRequest = z.infer<typeof AssignRolesRequestSchema>;
