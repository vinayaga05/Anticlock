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
  uniqueIndex,
  index,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const roles = pgTable("roles", {
  id: text("id").primaryKey(), // super_admin, ops, ...
  name: text("name").notNull(),
  description: text("description"),
});

export const permissions = pgTable("permissions", {
  id: text("id").primaryKey(), // catalog.read, ...
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })]
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })]
);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id"),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const serviceTrees = pgTable("service_trees", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  accentColor: text("accent_color"),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("published"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const serviceCategories = pgTable("service_categories", {
  id: text("id").primaryKey(),
  treeId: text("tree_id")
    .notNull()
    .references(() => serviceTrees.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  actionType: text("action_type"),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("published"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mobileDevices = pgTable("mobile_devices", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull().default("Guest"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mobileUsers = pgTable("mobile_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: text("phone").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  location: text("location"),
  website: text("website"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  interestsCompletedAt: timestamp("interests_completed_at", {
    withTimezone: true,
  }),
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(), // image | document | video
  storageProvider: text("storage_provider").notNull(), // r2 | local | stream | external
  storageKey: text("storage_key").notNull(),
  bucket: text("bucket").notNull(),
  mimeType: text("mime_type"),
  byteSize: integer("byte_size"),
  width: integer("width"),
  height: integer("height"),
  checksumSha256: text("checksum_sha256"),
  originalFilename: text("original_filename"),
  accessLevel: text("access_level").notNull().default("public"),
  processingStatus: text("processing_status").notNull().default("initiated"),
  moderationStatus: text("moderation_status").notNull().default("not_required"),
  /** Cloudflare Stream UID (or null for object/external storage) */
  externalId: text("external_id"),
  durationMs: integer("duration_ms"),
  thumbnailUrl: text("thumbnail_url"),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const mediaUsages = pgTable(
  "media_usages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    usageType: text("usage_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("media_usages_slot_uid").on(
      t.mediaId,
      t.entityType,
      t.entityId,
      t.usageType
    ),
  ]
);

export const uploadSessions = pgTable("upload_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  mediaId: uuid("media_id")
    .notNull()
    .references(() => mediaAssets.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("open"),
  expectedMime: text("expected_mime").notNull(),
  maxBytes: integer("max_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Stub domain entities for Media Library vertical slice. */
export const stubProviders = pgTable("stub_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stubProducts = pgTable("stub_products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stubBanners = pgTable("stub_banners", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Clips / Reels — publish state lives here; video bytes live in R2, Stream, or an external URL. */
export const reels = pgTable("reels", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  caption: text("caption"),
  creatorName: text("creator_name").notNull(),
  category: text("category"),
  /** Draft → review → published lifecycle. */
  status: text("status").notNull().default("draft"), // draft | in_review | published | archived
  /** Editorial label. `test` content never enters the public feed. */
  contentMode: text("content_mode").notNull().default("standard"), // standard | test | sample
  /** Content safety outcome, separate from lifecycle status. */
  moderationStatus: text("moderation_status").notNull().default("clear"), // clear | under_review | restricted | removed
  isSample: boolean("is_sample").notNull().default(true),
  likeCount: integer("like_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  saveCount: integer("save_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  completionCount: integer("completion_count").notNull().default(0),
  reportCount: integer("report_count").notNull().default(0),
  displayOrder: integer("display_order").notNull().default(0),
  mediaId: uuid("media_id").references(() => mediaAssets.id, {
    onDelete: "set null",
  }),
  thumbnailMediaId: uuid("thumbnail_media_id").references(
    () => mediaAssets.id,
    {
      onDelete: "set null",
    }
  ),
  ctaEntityType: text("cta_entity_type"),
  ctaEntityId: text("cta_entity_id"),
  ctaLabel: text("cta_label"),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  submittedForReviewAt: timestamp("submitted_for_review_at", {
    withTimezone: true,
  }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

/** One immutable, idempotent playback-session measurement from a mobile client. */
export const reelViewEvents = pgTable("reel_view_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Client-generated UUID; unique so retries cannot inflate analytics. */
  eventId: uuid("event_id").notNull().unique(),
  reelId: uuid("reel_id")
    .notNull()
    .references(() => reels.id, { onDelete: "cascade" }),
  viewerKey: text("viewer_key").notNull(),
  viewerKind: text("viewer_kind").notNull(), // mobile_user | device
  sessionId: text("session_id"),
  watchedMs: integer("watched_ms").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Current like state per mobile account/device, not an unbounded event log. */
export const reelLikes = pgTable(
  "reel_likes",
  {
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    actorKey: text("actor_key").notNull(),
    actorKind: text("actor_kind").notNull(), // mobile_user | device
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reelId, t.actorKey] })]
);

export const reelComments = pgTable("reel_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  reelId: uuid("reel_id")
    .notNull()
    .references(() => reels.id, { onDelete: "cascade" }),
  actorKey: text("actor_key").notNull(),
  actorKind: text("actor_kind").notNull(), // mobile_user | device
  body: text("body").notNull(),
  status: text("status").notNull().default("visible"), // visible | removed
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
});

/** Report queue owned by moderation; a reporter can have one report per Reel. */
export const reelReports = pgTable(
  "reel_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    reporterKey: text("reporter_key").notNull(),
    reporterKind: text("reporter_kind").notNull(), // mobile_user | device
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"), // open | resolved | dismissed
    resolutionAction: text("resolution_action"),
    resolutionNote: text("resolution_note"),
    resolvedBy: uuid("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [unique("reel_reports_reporter_uid").on(t.reelId, t.reporterKey)]
);

export const mobileUserRoles = pgTable(
  "mobile_user_roles",
  {
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.mobileUserId, t.roleId] })]
);

export const providerFormSchemas = pgTable("provider_form_schemas", {
  id: uuid("id").defaultRandom().primaryKey(),
  scope: text("scope").notNull(),
  categoryId: text("category_id").references(() => serviceCategories.id, {
    onDelete: "cascade",
  }),
  providerKinds: jsonb("provider_kinds").$type<string[]>().notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("published"),
  sections: jsonb("sections").$type<unknown[]>().notNull(),
  fields: jsonb("fields").$type<unknown[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  mobileUserId: uuid("mobile_user_id")
    .notNull()
    .references(() => mobileUsers.id, { onDelete: "cascade" }),
  providerKind: text("provider_kind").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  publicProfile: jsonb("public_profile").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A viewer-controlled safety boundary. A personal-account block and a
 * business-profile block are intentionally separate: blocking a business
 * hides that business only, while blocking a user hides that user's posts.
 */
export const mobileUserBlocks = pgTable(
  "mobile_user_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockerMobileUserId: uuid("blocker_mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    blockedMobileUserId: uuid("blocked_mobile_user_id").references(
      () => mobileUsers.id,
      { onDelete: "cascade" }
    ),
    blockedProviderId: uuid("blocked_provider_id").references(
      () => providers.id,
      { onDelete: "cascade" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // PostgreSQL treats NULLs as distinct in a normal unique index, so use
    // two partial unique indexes to make each target idempotent.
    uniqueIndex("mobile_user_blocks_user_target_uidx")
      .on(table.blockerMobileUserId, table.blockedMobileUserId)
      .where(sql`${table.blockedMobileUserId} IS NOT NULL`),
    uniqueIndex("mobile_user_blocks_provider_target_uidx")
      .on(table.blockerMobileUserId, table.blockedProviderId)
      .where(sql`${table.blockedProviderId} IS NOT NULL`),
    index("mobile_user_blocks_blocker_created_idx").on(
      table.blockerMobileUserId,
      table.createdAt
    ),
  ]
);

/** Users who can act on behalf of an approved provider/business. */
export const providerMemberships = pgTable(
  "provider_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("provider_memberships_member_uid").on(
      table.providerId,
      table.mobileUserId
    ),
    index("provider_memberships_user_idx").on(table.mobileUserId),
  ]
);

/** A pre-publication request. It retains intent and target identity safely. */
export const contentContainers = pgTable(
  "content_containers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdByMobileUserId: uuid("created_by_mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    authorMobileUserId: uuid("author_mobile_user_id").references(
      () => mobileUsers.id,
      { onDelete: "cascade" }
    ),
    authorProviderId: uuid("author_provider_id").references(
      () => providers.id,
      {
        onDelete: "cascade",
      }
    ),
    format: text("format").notNull(),
    mediaType: text("media_type").notNull(),
    caption: text("caption").notNull().default(""),
    mediaIds: jsonb("media_ids").$type<string[]>().notNull().default([]),
    thumbnailMediaId: uuid("thumbnail_media_id").references(
      () => mediaAssets.id,
      { onDelete: "set null" }
    ),
    hashtags: jsonb("hashtags").$type<string[]>().notNull().default([]),
    taggedMobileUserIds: jsonb("tagged_mobile_user_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    location: jsonb("location").$type<{
      name: string;
      latitude?: number;
      longitude?: number;
    }>(),
    visibility: text("visibility").notNull().default("public"),
    status: text("status").notNull().default("ready_to_publish"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("content_containers_creator_idx").on(table.createdByMobileUserId),
  ]
);

/** Published, format-neutral post record used by Flash, Stories, and Clips. */
export const contentPosts = pgTable(
  "content_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    containerId: uuid("container_id").references(() => contentContainers.id, {
      onDelete: "set null",
    }),
    createdByMobileUserId: uuid("created_by_mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    authorMobileUserId: uuid("author_mobile_user_id").references(
      () => mobileUsers.id,
      { onDelete: "cascade" }
    ),
    authorProviderId: uuid("author_provider_id").references(
      () => providers.id,
      {
        onDelete: "cascade",
      }
    ),
    format: text("format").notNull(),
    mediaType: text("media_type").notNull(),
    caption: text("caption").notNull().default(""),
    mediaIds: jsonb("media_ids").$type<string[]>().notNull().default([]),
    thumbnailMediaId: uuid("thumbnail_media_id").references(
      () => mediaAssets.id,
      { onDelete: "set null" }
    ),
    hashtags: jsonb("hashtags").$type<string[]>().notNull().default([]),
    taggedMobileUserIds: jsonb("tagged_mobile_user_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    location: jsonb("location").$type<{
      name: string;
      latitude?: number;
      longitude?: number;
    }>(),
    /** Exact-media checksum (or media id when no checksum exists) used for feed de-duplication. */
    duplicateClusterId: text("duplicate_cluster_id").notNull(),
    visibility: text("visibility").notNull().default("public"),
    status: text("status").notNull().default("published"),
    viewCount: integer("view_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    shareCount: integer("share_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("content_posts_feed_idx").on(table.format, table.publishedAt),
    index("content_posts_expiry_idx").on(table.expiresAt),
    index("content_posts_cluster_idx").on(table.duplicateClusterId),
  ]
);

/** Durable per-viewer post claims prevent the same post from returning for 90 days. */
export const contentPostDeliveries = pgTable(
  "content_post_deliveries",
  {
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    contentPostId: uuid("content_post_id")
      .notNull()
      .references(() => contentPosts.id, { onDelete: "cascade" }),
    claimedAt: timestamp("claimed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.mobileUserId, table.contentPostId] }),
    index("content_post_deliveries_expiry_idx").on(
      table.mobileUserId,
      table.expiresAt
    ),
  ]
);

/** Separate short-lived claims ensure variants of one media item do not repeat together. */
export const contentClusterDeliveries = pgTable(
  "content_cluster_deliveries",
  {
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    duplicateClusterId: text("duplicate_cluster_id").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.mobileUserId, table.duplicateClusterId] }),
    index("content_cluster_deliveries_expiry_idx").on(
      table.mobileUserId,
      table.expiresAt
    ),
  ]
);

/** Idempotent viewer events back the aggregate view count used for ranking. */
export const contentPostViewEvents = pgTable(
  "content_post_view_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentPostId: uuid("content_post_id")
      .notNull()
      .references(() => contentPosts.id, { onDelete: "cascade" }),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").notNull(),
    watchedMs: integer("watched_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("content_post_view_events_event_uid").on(
      table.contentPostId,
      table.mobileUserId,
      table.eventId
    ),
    index("content_post_view_events_post_created_idx").on(
      table.contentPostId,
      table.createdAt
    ),
    // Used by the per-viewer view window before the aggregate is incremented.
    index("content_post_view_events_viewer_idx").on(
      table.contentPostId,
      table.mobileUserId,
      table.createdAt
    ),
  ]
);

/** A unique row per viewer keeps like/unlike state and counters race-safe. */
export const contentPostLikes = pgTable(
  "content_post_likes",
  {
    contentPostId: uuid("content_post_id")
      .notNull()
      .references(() => contentPosts.id, { onDelete: "cascade" }),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.contentPostId, table.mobileUserId] }),
    index("content_post_likes_user_created_idx").on(
      table.mobileUserId,
      table.createdAt
    ),
  ]
);

/** Moderation queue for user- and business-published content, including Clips. */
export const contentPostReports = pgTable(
  "content_post_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentPostId: uuid("content_post_id")
      .notNull()
      .references(() => contentPosts.id, { onDelete: "cascade" }),
    reporterMobileUserId: uuid("reporter_mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("content_post_reports_reporter_uid").on(
      table.contentPostId,
      table.reporterMobileUserId
    ),
    index("content_post_reports_status_created_idx").on(
      table.status,
      table.createdAt
    ),
  ]
);

export const providerServiceOfferings = pgTable(
  "provider_service_offerings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "cascade" }),
    pricingStartsAt: integer("pricing_starts_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("provider_service_offerings_uid").on(t.providerId, t.categoryId),
  ]
);

export const providerApplications = pgTable("provider_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  mobileUserId: uuid("mobile_user_id")
    .notNull()
    .references(() => mobileUsers.id, { onDelete: "cascade" }),
  providerKind: text("provider_kind").notNull(),
  status: text("status").notNull().default("draft"),
  commonPayload: jsonb("common_payload").$type<Record<string, unknown>>(),
  dynamicPayload: jsonb("dynamic_payload").$type<Record<string, unknown>>(),
  reviewNotes: text("review_notes"),
  infoRequestMessage: text("info_request_message"),
  providerId: uuid("provider_id").references(() => providers.id, {
    onDelete: "set null",
  }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const providerApplicationServices = pgTable(
  "provider_application_services",
  {
    applicationId: uuid("application_id")
      .notNull()
      .references(() => providerApplications.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.applicationId, t.categoryId] })]
);

export const providerApplicationDocuments = pgTable(
  "provider_application_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => providerApplications.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    aadhaarEncrypted: text("aadhaar_encrypted"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("provider_application_documents_field_uid").on(
      t.applicationId,
      t.fieldKey
    ),
  ]
);

export const assistantConversations = pgTable("assistant_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  mobileUserId: uuid("mobile_user_id")
    .notNull()
    .references(() => mobileUsers.id, { onDelete: "cascade" }),
  title: text("title"),
  personaVersion: text("persona_version").notNull().default("1"),
  status: text("status").notNull().default("active"),
  lastResponseId: text("last_response_id"),
  currentScreen: text("current_screen"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const assistantMessages = pgTable("assistant_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => assistantConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content"),
  toolCalls: jsonb("tool_calls").$type<unknown[]>(),
  toolResults: jsonb("tool_results").$type<unknown[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const assistantAnalyticsEvents = pgTable("assistant_analytics_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  mobileUserId: uuid("mobile_user_id")
    .notNull()
    .references(() => mobileUsers.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(
    () => assistantConversations.id,
    { onDelete: "set null" }
  ),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Raw per-user behavior events for Genie personalization (isolated by user). */
export const userBehaviorEvents = pgTable(
  "user_behavior_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_behavior_events_idempotency_idx").on(
      table.mobileUserId,
      table.idempotencyKey
    ),
    index("user_behavior_events_user_created_idx").on(
      table.mobileUserId,
      table.createdAt
    ),
  ]
);

export const userPreferenceSettings = pgTable("user_preference_settings", {
  mobileUserId: uuid("mobile_user_id")
    .primaryKey()
    .references(() => mobileUsers.id, { onDelete: "cascade" }),
  personalizationEnabled: boolean("personalization_enabled")
    .notNull()
    .default(true),
  explicitPrefs: jsonb("explicit_prefs")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userPreferenceScores = pgTable(
  "user_preference_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    score: doublePrecision("score").notNull().default(0),
    confidence: doublePrecision("confidence").notNull().default(0),
    evidenceCount: integer("evidence_count").notNull().default(0),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_preference_scores_user_entity_uidx").on(
      table.mobileUserId,
      table.entityType,
      table.entityId
    ),
    index("user_preference_scores_user_score_idx").on(
      table.mobileUserId,
      table.score
    ),
  ]
);

/** Server-managed interest choices shown in mobile onboarding and settings. */
export const interestOptions = pgTable(
  "interest_options",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("interest_options_active_order_idx").on(
      table.isActive,
      table.sortOrder
    ),
  ]
);

/** Explicit user choices; separate from inferred Genie preference scores. */
export const mobileUserInterests = pgTable(
  "mobile_user_interests",
  {
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    interestId: text("interest_id")
      .notNull()
      .references(() => interestOptions.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.mobileUserId, table.interestId] }),
    index("mobile_user_interests_interest_idx").on(table.interestId),
  ]
);

<<<<<<< HEAD
/** Push notifications for mobile users */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
=======
<<<<<<< HEAD
/** Communities for user-created groups with posts and membership */
export const communities = pgTable(
  "communities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    imageUrl: text("image_url"),
    coverUrl: text("cover_url"),
    memberCount: integer("member_count").notNull().default(1),
    postCount: integer("post_count").notNull().default(0),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("published"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  },
  (table) => [
    index("communities_status_created_idx").on(table.status, table.createdAt),
    index("communities_slug_idx").on(table.slug),
  ]
);

/** Community membership with roles */
export const communityMembers = pgTable(
  "community_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("community_members_uid").on(table.communityId, table.mobileUserId),
    index("community_members_user_idx").on(table.mobileUserId),
    index("community_members_community_joined_idx").on(
      table.communityId,
      table.joinedAt
    ),
  ]
);

/** Community posts */
export const communityPosts = pgTable(
  "community_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    status: text("status").notNull().default("visible"),
=======
<<<<<<< HEAD
/** Courses feature - append-only block to minimize merge conflicts */
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description").notNull(),
    difficulty: text("difficulty").notNull(),
    durationHours: integer("duration_hours").notNull(),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    imageId: uuid("image_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    instructorName: text("instructor_name").notNull(),
    instructorBio: text("instructor_bio"),
    learningOutcomes: jsonb("learning_outcomes").$type<string[]>().notNull().default([]),
    prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
=======
/** Shop and Orders tables - append-only block to minimize merge conflicts */
export const productCategories = pgTable("product_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("published"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: text("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    inventory: integer("inventory"),
    status: text("status").notNull().default("draft"),
    imageIds: jsonb("image_ids").$type<string[]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
>>>>>>> origin/main
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
<<<<<<< HEAD
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => [
    index("community_posts_community_created_idx").on(
      table.communityId,
      table.createdAt
    ),
    index("community_posts_author_idx").on(table.authorId),
  ]
);

/** Community post likes */
export const communityPostLikes = pgTable(
  "community_post_likes",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
>>>>>>> origin/main
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
<<<<<<< HEAD
    index("notifications_user_created_idx").on(
      table.mobileUserId,
      table.createdAt
    ),
    index("notifications_user_unread_idx").on(table.mobileUserId, table.readAt)
      .where(sql`${table.readAt} IS NULL`),
  ]
);

/** FCM device tokens for push notifications */
export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
=======
    primaryKey({ columns: [table.postId, table.mobileUserId] }),
    index("community_post_likes_user_created_idx").on(
      table.mobileUserId,
      table.createdAt
    ),
  ]
);

/** Community post comments */
export const communityPostComments = pgTable(
  "community_post_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
>>>>>>> origin/main
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
<<<<<<< HEAD
    unique("device_tokens_token_uid").on(table.token),
    index("device_tokens_user_idx").on(table.mobileUserId),
=======
    index("community_post_comments_post_created_idx").on(
      table.postId,
      table.createdAt
    ),
  ]
);

/** Community post reports for moderation */
export const communityPostReports = pgTable(
  "community_post_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    reporterMobileUserId: uuid("reporter_mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    unique("community_post_reports_reporter_uid").on(
      table.postId,
      table.reporterMobileUserId
    ),
    index("community_post_reports_status_created_idx").on(
      table.status,
      table.createdAt
    ),
=======
  },
  (table) => [
    uniqueIndex("products_slug_uidx").on(table.slug),
    index("products_category_status_idx").on(table.categoryId, table.status),
    index("products_status_created_idx").on(table.status, table.createdAt),
  ]
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    items: jsonb("items").$type<unknown[]>().notNull(),
    subtotal: integer("subtotal").notNull(),
    shippingCost: integer("shipping_cost").notNull(),
    tax: integer("tax").notNull(),
    total: integer("total").notNull(),
    shippingAddress: jsonb("shipping_address")
      .$type<Record<string, unknown>>()
      .notNull(),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [
    index("orders_user_created_idx").on(table.mobileUserId, table.createdAt),
    index("orders_status_created_idx").on(table.status, table.createdAt),
    index("orders_number_idx").on(table.orderNumber),
  ]
);

/** Trips and Trip Bookings tables - append-only block to minimize merge conflicts */
export const trips = pgTable(
  "trips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    destination: text("destination").notNull(),
    durationDays: integer("duration_days").notNull(),
    basePrice: integer("base_price").notNull(),
    maxGroupSize: integer("max_group_size").notNull(),
    itinerary: jsonb("itinerary").$type<unknown[]>().notNull(),
    inclusions: jsonb("inclusions").$type<string[]>().notNull().default([]),
    exclusions: jsonb("exclusions").$type<string[]>().notNull().default([]),
    difficulty: text("difficulty").notNull(),
    imageIds: jsonb("image_ids").$type<string[]>().notNull().default([]),
>>>>>>> origin/main
    status: text("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
<<<<<<< HEAD
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("courses_slug_uidx").on(table.slug),
    index("courses_status_created_idx").on(table.status, table.createdAt),
    index("courses_difficulty_status_idx").on(table.difficulty, table.status),
  ]
);

export const courseLessons = pgTable(
  "course_lessons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    moduleNumber: integer("module_number").notNull(),
    moduleName: text("module_name").notNull(),
    lessonNumber: integer("lesson_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").notNull(),
    durationMinutes: integer("duration_minutes"),
    contentUrl: text("content_url"),
    contentText: text("content_text"),
    mediaId: uuid("media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    isFree: boolean("is_free").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("course_lessons_course_sort_idx").on(table.courseId, table.sortOrder),
    index("course_lessons_course_module_idx").on(
      table.courseId,
      table.moduleNumber,
      table.lessonNumber
    ),
  ]
);

export const courseEnrollments = pgTable(
  "course_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    paymentAmount: integer("payment_amount").notNull(),
    progress: jsonb("progress").$type<unknown[]>().notNull().default([]),
    completedLessonsCount: integer("completed_lessons_count").notNull().default(0),
    totalLessonsCount: integer("total_lessons_count").notNull().default(0),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
=======
  },
  (table) => [
    uniqueIndex("trips_slug_uidx").on(table.slug),
    index("trips_destination_status_idx").on(table.destination, table.status),
    index("trips_status_created_idx").on(table.status, table.createdAt),
  ]
);

export const tripBookings = pgTable(
  "trip_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingNumber: text("booking_number").notNull().unique(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    mobileUserId: uuid("mobile_user_id")
      .notNull()
      .references(() => mobileUsers.id, { onDelete: "cascade" }),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    numberOfTravelers: integer("number_of_travelers").notNull(),
    totalPrice: integer("total_price").notNull(),
    status: text("status").notNull().default("pending"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    travelerDetails: jsonb("traveler_details").$type<unknown[]>().notNull(),
    specialRequests: text("special_requests"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
>>>>>>> origin/main
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
<<<<<<< HEAD
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("course_enrollments_user_course_uidx").on(
      table.mobileUserId,
      table.courseId
    ),
    index("course_enrollments_user_created_idx").on(
      table.mobileUserId,
      table.createdAt
    ),
    index("course_enrollments_course_status_idx").on(
      table.courseId,
      table.status
    ),
=======
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("trip_bookings_trip_start_idx").on(table.tripId, table.startDate),
    index("trip_bookings_user_created_idx").on(
      table.mobileUserId,
      table.createdAt
    ),
    index("trip_bookings_status_created_idx").on(
      table.status,
      table.createdAt
    ),
    index("trip_bookings_number_idx").on(table.bookingNumber),
>>>>>>> origin/main
>>>>>>> origin/main
>>>>>>> origin/main
  ]
);
