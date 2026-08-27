import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  primaryKey,
  boolean,
  unique,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable('roles', {
  id: text('id').primaryKey(), // super_admin, ops, ...
  name: text('name').notNull(),
  description: text('description'),
});

export const permissions = pgTable('permissions', {
  id: text('id').primaryKey(), // catalog.read, ...
  description: text('description'),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  t => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  t => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id'),
  actorEmail: text('actor_email'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const serviceTrees = pgTable('service_trees', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  accentColor: text('accent_color'),
  sortOrder: integer('sort_order').notNull().default(0),
  status: text('status').notNull().default('published'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const serviceCategories = pgTable('service_categories', {
  id: text('id').primaryKey(),
  treeId: text('tree_id')
    .notNull()
    .references(() => serviceTrees.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  actionType: text('action_type'),
  sortOrder: integer('sort_order').notNull().default(0),
  status: text('status').notNull().default('published'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mobileDevices = pgTable('mobile_devices', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull().default('Guest'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: text('kind').notNull(), // image | document | video
  storageProvider: text('storage_provider').notNull(), // r2 | local | stream | external
  storageKey: text('storage_key').notNull(),
  bucket: text('bucket').notNull(),
  mimeType: text('mime_type'),
  byteSize: integer('byte_size'),
  width: integer('width'),
  height: integer('height'),
  checksumSha256: text('checksum_sha256'),
  originalFilename: text('original_filename'),
  accessLevel: text('access_level').notNull().default('public'),
  processingStatus: text('processing_status').notNull().default('initiated'),
  moderationStatus: text('moderation_status').notNull().default('not_required'),
  /** Cloudflare Stream UID (or null for object/external storage) */
  externalId: text('external_id'),
  durationMs: integer('duration_ms'),
  thumbnailUrl: text('thumbnail_url'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const mediaUsages = pgTable(
  'media_usages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    usageType: text('usage_type').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    unique('media_usages_slot_uid').on(
      t.mediaId,
      t.entityType,
      t.entityId,
      t.usageType,
    ),
  ],
);

export const uploadSessions = pgTable('upload_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  mediaId: uuid('media_id')
    .notNull()
    .references(() => mediaAssets.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('open'),
  expectedMime: text('expected_mime').notNull(),
  maxBytes: integer('max_bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Stub domain entities for Media Library vertical slice. */
export const stubProviders = pgTable('stub_providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stubProducts = pgTable('stub_products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stubBanners = pgTable('stub_banners', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Clips / Reels — publish state lives here; video bytes live in Stream (or external URL). */
export const reels = pgTable('reels', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  caption: text('caption'),
  creatorName: text('creator_name').notNull(),
  category: text('category'),
  status: text('status').notNull().default('draft'), // draft | published | archived
  isSample: boolean('is_sample').notNull().default(true),
  likeCount: integer('like_count').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  saveCount: integer('save_count').notNull().default(0),
  displayOrder: integer('display_order').notNull().default(0),
  mediaId: uuid('media_id').references(() => mediaAssets.id, {
    onDelete: 'set null',
  }),
  thumbnailMediaId: uuid('thumbnail_media_id').references(() => mediaAssets.id, {
    onDelete: 'set null',
  }),
  ctaEntityType: text('cta_entity_type'),
  ctaEntityId: text('cta_entity_id'),
  ctaLabel: text('cta_label'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});
