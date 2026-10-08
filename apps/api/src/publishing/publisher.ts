import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import type {
  ContentPublisher,
  ProviderMembershipRole,
  PublisherProfileType,
} from "@anticlock/contracts";
import { db } from "../db/client.js";
import {
  contentPosts,
  mobileUserBlocks,
  mobileUsers,
  providerMemberships,
  providerServiceOfferings,
  providers,
  serviceCategories,
} from "../db/schema.js";

/**
 * The one place that knows how a piece of content is attributed.
 *
 *  - ownerUserId        = the authenticated account that created/manages it
 *                         (`created_by_mobile_user_id`). Never shown publicly.
 *  - publisherProfileId = the profile it was published AS: the personal
 *                         profile (the mobile user id) or a business profile
 *                         (a provider id). Stored as the author column pair
 *                         and exposed as generated `publisher_profile_*`
 *                         columns.
 *
 * Display fields (name/avatar/handle/category) are always derived here from
 * the publisher profile id and never accepted from clients.
 */

export type PublisherRef = { type: PublisherProfileType; id: string };

export type AuthorColumns = {
  authorMobileUserId: string | null;
  authorProviderId: string | null;
};

export type ViewerContext = {
  userId: string;
  /** Businesses the viewer is a member of (they manage that content). */
  managedProviderIds: string[];
};

export const PUBLISHING_ROLES = new Set<ProviderMembershipRole>([
  "owner",
  "admin",
  "content_creator",
]);

function appError(
  message: string,
  code: string,
  status: 400 | 403 | 404 | 409
) {
  return Object.assign(new Error(message), { code, status });
}

export function publisherKey(ref: PublisherRef) {
  return `${ref.type}:${ref.id}`;
}

export function publisherRefFromAuthor(row: AuthorColumns): PublisherRef | null {
  if (row.authorProviderId) return { type: "business", id: row.authorProviderId };
  if (row.authorMobileUserId)
    return { type: "personal", id: row.authorMobileUserId };
  return null;
}

export function authorColumnsFor(ref: PublisherRef): AuthorColumns {
  return ref.type === "business"
    ? { authorMobileUserId: null, authorProviderId: ref.id }
    : { authorMobileUserId: ref.id, authorProviderId: null };
}

/** Accepts both the canonical (`personal`/`business`) and legacy names. */
export function normalizePublisherType(
  value: string | undefined | null
): PublisherProfileType | undefined {
  if (value === "personal" || value === "user") return "personal";
  if (value === "business" || value === "provider") return "business";
  return undefined;
}

/** Legacy `author` payload kept for older mobile builds. */
export function legacyAuthor(publisher: ContentPublisher) {
  return {
    type: publisher.type === "business" ? ("provider" as const) : ("user" as const),
    id: publisher.id,
    name: publisher.displayName,
    avatarUrl: publisher.avatarUrl,
  };
}

/**
 * Review is opt-in. Moderation in Anticlock is report-based (post-hoc), so
 * requiring review by default would make nothing visible. Setting
 * CONTENT_REQUIRE_REVIEW=true sends every new post to `pending_review` until
 * an admin approves it.
 */
export function contentRequiresReview() {
  return process.env.CONTENT_REQUIRE_REVIEW?.trim().toLowerCase() === "true";
}

function httpUrl(value: unknown): string | null {
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function businessProfileFields(publicProfile: Record<string, unknown> | null) {
  const common = (publicProfile?.common ?? {}) as Record<string, unknown>;
  const basic = (common.basic ?? {}) as Record<string, unknown>;
  return {
    avatarUrl:
      httpUrl(basic.logoUrl) ??
      httpUrl(basic.avatarUrl) ??
      httpUrl(basic.profileImageUrl) ??
      httpUrl(publicProfile?.avatarUrl) ??
      null,
    handle: stringField(basic.handle) ?? stringField(publicProfile?.handle),
  };
}

/**
 * Batch-loads public publisher cards. Inactive users and non-active
 * businesses are omitted, so callers naturally drop their content.
 */
export async function loadPublishers(
  refs: PublisherRef[]
): Promise<Map<string, ContentPublisher>> {
  const result = new Map<string, ContentPublisher>();
  const userIds = [
    ...new Set(refs.filter((r) => r.type === "personal").map((r) => r.id)),
  ];
  const providerIds = [
    ...new Set(refs.filter((r) => r.type === "business").map((r) => r.id)),
  ];

  const [users, businesses, categories] = await Promise.all([
    userIds.length
      ? db
          .select({
            id: mobileUsers.id,
            displayName: mobileUsers.displayName,
            avatarUrl: mobileUsers.avatarUrl,
          })
          .from(mobileUsers)
          .where(
            and(inArray(mobileUsers.id, userIds), eq(mobileUsers.isActive, true))
          )
      : Promise.resolve([]),
    providerIds.length
      ? db
          .select({
            id: providers.id,
            name: providers.name,
            publicProfile: providers.publicProfile,
          })
          .from(providers)
          .where(
            and(inArray(providers.id, providerIds), eq(providers.status, "active"))
          )
      : Promise.resolve([]),
    providerIds.length
      ? db
          .select({
            providerId: providerServiceOfferings.providerId,
            name: serviceCategories.name,
          })
          .from(providerServiceOfferings)
          .innerJoin(
            serviceCategories,
            eq(providerServiceOfferings.categoryId, serviceCategories.id)
          )
          .where(inArray(providerServiceOfferings.providerId, providerIds))
          .orderBy(providerServiceOfferings.createdAt)
      : Promise.resolve([]),
  ]);

  const categoryByProvider = new Map<string, string>();
  for (const row of categories) {
    if (!categoryByProvider.has(row.providerId)) {
      categoryByProvider.set(row.providerId, row.name);
    }
  }

  for (const user of users) {
    result.set(publisherKey({ type: "personal", id: user.id }), {
      id: user.id,
      type: "personal",
      displayName: user.displayName,
      handle: null,
      avatarUrl: httpUrl(user.avatarUrl),
      verified: false,
      businessCategory: null,
    });
  }
  for (const business of businesses) {
    const fields = businessProfileFields(business.publicProfile ?? null);
    result.set(publisherKey({ type: "business", id: business.id }), {
      id: business.id,
      type: "business",
      displayName: business.name,
      handle: fields.handle,
      avatarUrl: fields.avatarUrl,
      // Business profiles only exist after an approved provider application.
      verified: true,
      businessCategory: categoryByProvider.get(business.id) ?? null,
    });
  }
  return result;
}

export async function loadPublisher(ref: PublisherRef) {
  return (await loadPublishers([ref])).get(publisherKey(ref)) ?? null;
}

export type OwnedPublisher = {
  ref: PublisherRef;
  publisher: ContentPublisher;
  role?: ProviderMembershipRole;
};

/**
 * Validates that `ownerUserId` may publish as the requested profile. The
 * personal profile is the account itself; a business requires an active
 * provider and an owner/admin/content_creator membership. Anything else is
 * a 403 so a client can never publish as another user's profile.
 */
export async function resolveOwnedPublisher(
  ownerUserId: string,
  input: { id?: string | null; type?: string | null } = {}
): Promise<OwnedPublisher> {
  const id = input.id ?? ownerUserId;
  const type =
    normalizePublisherType(input.type) ??
    (id === ownerUserId ? "personal" : "business");

  if (type === "personal") {
    if (id !== ownerUserId) {
      throw appError("You can only publish as yourself", "forbidden", 403);
    }
    const publisher = await loadPublisher({ type, id });
    if (!publisher) {
      throw appError("Active mobile account required", "forbidden", 403);
    }
    return { ref: { type, id }, publisher };
  }

  const [membership] = await db
    .select({ role: providerMemberships.role })
    .from(providerMemberships)
    .innerJoin(providers, eq(providerMemberships.providerId, providers.id))
    .where(
      and(
        eq(providerMemberships.mobileUserId, ownerUserId),
        eq(providerMemberships.providerId, id),
        eq(providers.status, "active")
      )
    )
    .limit(1);
  const role = membership?.role as ProviderMembershipRole | undefined;
  if (!role || !PUBLISHING_ROLES.has(role)) {
    throw appError(
      "You do not have permission to publish for this business",
      "forbidden",
      403
    );
  }
  const publisher = await loadPublisher({ type, id });
  if (!publisher) {
    throw appError(
      "You do not have permission to publish for this business",
      "forbidden",
      403
    );
  }
  return { ref: { type, id }, publisher, role };
}

/** Personal profile first, then every business the user can publish for. */
export async function listOwnedPublishers(
  ownerUserId: string
): Promise<OwnedPublisher[]> {
  const personal = await resolveOwnedPublisher(ownerUserId, {
    id: ownerUserId,
    type: "personal",
  });
  const memberships = await db
    .select({ providerId: providerMemberships.providerId, role: providerMemberships.role })
    .from(providerMemberships)
    .innerJoin(providers, eq(providerMemberships.providerId, providers.id))
    .where(
      and(
        eq(providerMemberships.mobileUserId, ownerUserId),
        eq(providers.status, "active")
      )
    )
    .orderBy(providers.createdAt);
  const eligible = memberships.filter((m) =>
    PUBLISHING_ROLES.has(m.role as ProviderMembershipRole)
  );
  const cards = await loadPublishers(
    eligible.map((m) => ({ type: "business" as const, id: m.providerId }))
  );
  const businesses: OwnedPublisher[] = [];
  for (const m of eligible) {
    const ref = { type: "business" as const, id: m.providerId };
    const publisher = cards.get(publisherKey(ref));
    if (publisher) {
      businesses.push({ ref, publisher, role: m.role as ProviderMembershipRole });
    }
  }
  return [personal, ...businesses];
}

export async function loadViewerContext(userId: string): Promise<ViewerContext> {
  const rows = await db
    .select({ providerId: providerMemberships.providerId })
    .from(providerMemberships)
    .innerJoin(providers, eq(providerMemberships.providerId, providers.id))
    .where(
      and(
        eq(providerMemberships.mobileUserId, userId),
        eq(providers.status, "active")
      )
    );
  return { userId, managedProviderIds: rows.map((r) => r.providerId) };
}

type VisibilityRow = AuthorColumns & {
  createdByMobileUserId: string;
  visibility: string;
};

/** The viewer owns the content or manages the publishing profile. */
export function viewerCanManage(viewer: ViewerContext, row: VisibilityRow) {
  return (
    row.createdByMobileUserId === viewer.userId ||
    row.authorMobileUserId === viewer.userId ||
    (row.authorProviderId !== null &&
      viewer.managedProviderIds.includes(row.authorProviderId))
  );
}

/**
 * Audience check for a published row. `public` is visible to every signed-in
 * viewer (no follow needed). The API has no follower/friend/community graph
 * yet, so those audiences — and `only_me` — currently resolve to the owner
 * and members of the publishing business only. Content is never hidden
 * merely because the viewer is not the owner.
 */
export function canViewerSee(viewer: ViewerContext, row: VisibilityRow) {
  return row.visibility === "public" || viewerCanManage(viewer, row);
}

/** SQL twin of `canViewerSee` for `content_posts`. */
export function postVisibleToViewer(viewer: ViewerContext): SQL {
  const conditions: SQL[] = [
    eq(contentPosts.visibility, "public"),
    eq(contentPosts.createdByMobileUserId, viewer.userId),
    eq(contentPosts.authorMobileUserId, viewer.userId),
  ];
  if (viewer.managedProviderIds.length) {
    conditions.push(inArray(contentPosts.authorProviderId, viewer.managedProviderIds));
  }
  return or(...conditions)!;
}

/** Publisher keys the viewer has blocked (personal or business). */
export async function loadBlockedPublisherKeys(viewerUserId: string) {
  const rows = await db
    .select({
      blockedMobileUserId: mobileUserBlocks.blockedMobileUserId,
      blockedProviderId: mobileUserBlocks.blockedProviderId,
    })
    .from(mobileUserBlocks)
    .where(eq(mobileUserBlocks.blockerMobileUserId, viewerUserId));
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.blockedMobileUserId)
      keys.add(publisherKey({ type: "personal", id: row.blockedMobileUserId }));
    if (row.blockedProviderId)
      keys.add(publisherKey({ type: "business", id: row.blockedProviderId }));
  }
  return keys;
}
