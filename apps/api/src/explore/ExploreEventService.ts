import {
  and,
  desc,
  eq,
  gt,
  ilike,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import type {
  CreateExploreEventRequest,
  ExploreAdminListQuerySchema,
  ExploreEvent,
  ExploreEventListQuerySchema,
  ExploreReviewRequest,
  UpdateExploreEventRequest,
} from '@anticlock/contracts';
import { CreateExploreEventRequestSchema } from '@anticlock/contracts';
import type { z } from 'zod';
import { db } from '../db/client.js';
import {
  exploreEventMedia,
  exploreEventRegistrations,
  exploreEvents,
  exploreSaves,
  mediaAssets,
} from '../db/schema.js';
import { mediaService } from '../media/MediaService.js';
import {
  authorColumnsFor,
  loadPublisher,
  publisherRefFromAuthor,
  resolveOwnedPublisher,
  type PublisherRef,
} from '../publishing/publisher.js';
import {
  hasAcceptedFollow,
  profilesAreBlocked,
} from '../social/ProfileFollowService.js';
import { notificationService } from '../notifications/NotificationService.js';
import { writeAudit } from '../lib/audit.js';

type EventRow = typeof exploreEvents.$inferSelect;
type EventListQuery = z.infer<typeof ExploreEventListQuerySchema>;
type AdminListQuery = z.infer<typeof ExploreAdminListQuerySchema>;

function appError(
  message: string,
  code: string,
  status: 400 | 403 | 404 | 409,
) {
  return Object.assign(new Error(message), { code, status });
}

function eventRef(row: EventRow): PublisherRef {
  const ref = publisherRefFromAuthor(row);
  if (!ref) throw appError('Event has no publisher', 'invalid_event', 409);
  return ref;
}

function assertValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
  } catch {
    throw appError('Invalid timezone', 'invalid_timezone', 400);
  }
}

const EDITABLE_STATUSES = new Set([
  'draft',
  'changes_requested',
  'rejected',
]);

const ACTION_STATUS = {
  approve: 'approved',
  request_changes: 'changes_requested',
  reject: 'rejected',
  suspend: 'suspended',
  restore: 'approved',
  archive: 'archived',
} as const;

const ACTION_ALLOWED: Record<ExploreReviewRequest['action'], string[]> = {
  approve: ['pending_review', 'suspended'],
  request_changes: ['pending_review'],
  reject: ['pending_review'],
  suspend: ['approved'],
  restore: ['suspended'],
  archive: ['approved', 'suspended'],
};

function notificationFor(action: ExploreReviewRequest['action']) {
  switch (action) {
    case 'approve':
    case 'restore':
      return { type: 'explore_approved' as const, title: 'Event approved' };
    case 'request_changes':
      return {
        type: 'explore_changes_requested' as const,
        title: 'Event changes requested',
      };
    case 'reject':
      return { type: 'explore_rejected' as const, title: 'Event rejected' };
    case 'suspend':
      return { type: 'explore_suspended' as const, title: 'Event suspended' };
    case 'archive':
      return { type: 'status_update' as const, title: 'Event archived' };
  }
}

export class ExploreEventService {
  private async row(id: string) {
    const [row] = await db
      .select()
      .from(exploreEvents)
      .where(and(eq(exploreEvents.id, id), sql`${exploreEvents.deletedAt} IS NULL`))
      .limit(1);
    return row ?? null;
  }

  private async canView(
    row: EventRow,
    userId: string,
    viewer: PublisherRef,
  ) {
    if (row.ownerMobileUserId === userId) return true;
    const publisher = eventRef(row);
    if (await profilesAreBlocked(viewer, publisher)) return false;
    if (row.reviewStatus === 'approved' && row.requestedVisibility === 'public') {
      return true;
    }
    if (
      row.requestedVisibility === 'followers_only' &&
      ['pending_review', 'approved'].includes(row.reviewStatus)
    ) {
      return hasAcceptedFollow(viewer, publisher);
    }
    return false;
  }

  private async media(eventId: string) {
    const rows = await db
      .select({
        id: mediaAssets.id,
        kind: mediaAssets.kind,
        thumbnailUrl: mediaAssets.thumbnailUrl,
        sortOrder: exploreEventMedia.sortOrder,
      })
      .from(exploreEventMedia)
      .innerJoin(mediaAssets, eq(exploreEventMedia.mediaAssetId, mediaAssets.id))
      .where(eq(exploreEventMedia.eventId, eventId))
      .orderBy(exploreEventMedia.sortOrder);
    const result = await Promise.all(
      rows.map(async row => {
        const url = await mediaService.getAuthorizedContentDeliveryUrl(
          row.id,
          row.kind === 'video' ? 'video' : 'image',
        );
        return url
          ? {
              id: row.id,
              kind: row.kind === 'video' ? ('video' as const) : ('image' as const),
              url,
              thumbnailUrl: row.thumbnailUrl,
              sortOrder: row.sortOrder,
            }
          : null;
      }),
    );
    return result.filter((item): item is NonNullable<typeof item> => item !== null);
  }

  private async serialize(
    row: EventRow,
    viewerUserId: string,
  ): Promise<ExploreEvent> {
    const ref = eventRef(row);
    const [publisher, media, registration, saves] = await Promise.all([
      loadPublisher(ref),
      this.media(row.id),
      db
        .select({ status: exploreEventRegistrations.status })
        .from(exploreEventRegistrations)
        .where(
          and(
            eq(exploreEventRegistrations.eventId, row.id),
            eq(exploreEventRegistrations.mobileUserId, viewerUserId),
          ),
        )
        .limit(1),
      db.select({ id: exploreSaves.id }).from(exploreSaves).where(and(
        eq(exploreSaves.mobileUserId, viewerUserId),
        eq(exploreSaves.entityType, 'event'),
        eq(exploreSaves.entityId, row.id),
      )).limit(1),
    ]);
    if (!publisher) throw appError('Event publisher unavailable', 'not_found', 404);
    return {
      id: row.id,
      ownerMobileUserId: row.ownerMobileUserId,
      publisherProfileId: ref.id,
      publisherProfileType: ref.type,
      publisher,
      title: row.title,
      description: row.description,
      categoryId: row.categoryId,
      tags: row.tags,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      timezone: row.timezone,
      venueType: row.venueType as ExploreEvent['venueType'],
      location: row.location ?? null,
      onlineUrl: row.onlineUrl,
      ticketType: row.ticketType as ExploreEvent['ticketType'],
      capacity: row.capacity,
      registrationCount: row.registrationCount,
      availableCapacity: Math.max(0, row.capacity - row.registrationCount),
      price: row.price,
      currency: row.currency,
      contact: row.contact,
      requestedVisibility: row.requestedVisibility as ExploreEvent['requestedVisibility'],
      reviewStatus: row.reviewStatus as ExploreEvent['reviewStatus'],
      reviewReason: row.reviewReason,
      reviewVersion: row.reviewVersion,
      media,
      viewerCanManage: row.ownerMobileUserId === viewerUserId,
      viewerIsRegistered: registration[0]?.status === 'registered',
      viewerHasSaved: saves.length > 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
    };
  }

  async create(ownerUserId: string, input: CreateExploreEventRequest) {
    assertValidTimezone(input.timezone);
    const owned = await resolveOwnedPublisher(ownerUserId, {
      id: input.publisherProfileId,
      type: input.publisherProfileType,
    });
    await mediaService.requireMobileContentAssets(ownerUserId, input.mediaIds);
    const [duplicate] = await db.select({ id: exploreEvents.id }).from(exploreEvents).where(and(
      eq(exploreEvents.ownerMobileUserId, ownerUserId),
      sql`lower(${exploreEvents.title}) = lower(${input.title})`,
      eq(exploreEvents.startsAt, new Date(input.startsAt)),
      sql`${exploreEvents.reviewStatus} <> 'archived'`,
      sql`${exploreEvents.deletedAt} IS NULL`,
    )).limit(1);
    if (duplicate) {
      throw appError('A matching event already exists', 'duplicate_event', 409);
    }
    const now = new Date();
    const [row] = await db.transaction(async tx => {
      const inserted = await tx
        .insert(exploreEvents)
        .values({
          ownerMobileUserId: ownerUserId,
          ...authorColumnsFor(owned.ref),
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          tags: [...new Set(input.tags)],
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          timezone: input.timezone,
          venueType: input.venueType,
          location: input.location ?? null,
          onlineUrl: input.onlineUrl ?? null,
          ticketType: input.ticketType,
          capacity: input.capacity,
          price: input.price,
          currency: input.currency,
          contact: input.contact,
          requestedVisibility: input.requestedVisibility,
          reviewStatus: 'draft',
          challengeId: input.challengeId ?? null,
          updatedAt: now,
        })
        .returning();
      await tx.insert(exploreEventMedia).values(
        input.mediaIds.map((mediaAssetId, index) => ({
          eventId: inserted[0]!.id,
          mediaAssetId,
          sortOrder: index,
        })),
      );
      return inserted;
    });
    return this.serialize(row!, ownerUserId);
  }

  async update(ownerUserId: string, id: string, input: UpdateExploreEventRequest) {
    const existing = await this.row(id);
    if (!existing || existing.ownerMobileUserId !== ownerUserId) {
      throw appError('Event not found', 'not_found', 404);
    }
    if (!EDITABLE_STATUSES.has(existing.reviewStatus)) {
      throw appError(
        'This event cannot be edited in its current state',
        'invalid_status',
        409,
      );
    }
    if (input.timezone) assertValidTimezone(input.timezone);
    if (input.mediaIds) {
      await mediaService.requireMobileContentAssets(ownerUserId, input.mediaIds);
    }
    const existingMedia = input.mediaIds ?? (await db
      .select({ id: exploreEventMedia.mediaAssetId })
      .from(exploreEventMedia)
      .where(eq(exploreEventMedia.eventId, id)))
      .map(item => item.id);
    const ref = eventRef(existing);
    const candidate = CreateExploreEventRequestSchema.safeParse({
      publisherProfileId: ref.id,
      publisherProfileType: ref.type,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      categoryId: input.categoryId ?? existing.categoryId,
      tags: input.tags ?? existing.tags,
      startsAt: input.startsAt ?? existing.startsAt.toISOString(),
      endsAt: input.endsAt ?? existing.endsAt.toISOString(),
      timezone: input.timezone ?? existing.timezone,
      venueType: input.venueType ?? existing.venueType,
      location: input.location !== undefined ? input.location : existing.location,
      onlineUrl: input.onlineUrl !== undefined ? input.onlineUrl : existing.onlineUrl,
      ticketType: input.ticketType ?? existing.ticketType,
      capacity: input.capacity ?? existing.capacity,
      price: input.price ?? existing.price,
      currency: input.currency ?? existing.currency,
      contact: input.contact ?? existing.contact,
      requestedVisibility: input.requestedVisibility ?? existing.requestedVisibility,
      mediaIds: existingMedia,
      challengeId: input.challengeId !== undefined ? input.challengeId : existing.challengeId,
    });
    if (!candidate.success) {
      throw appError(candidate.error.issues[0]?.message ?? 'Invalid event', 'invalid_event', 400);
    }
    const values: Record<string, unknown> = { updatedAt: new Date() };
    const direct = [
      'title', 'description', 'categoryId', 'tags', 'timezone', 'venueType',
      'location', 'onlineUrl', 'ticketType', 'capacity', 'price', 'currency',
      'contact', 'requestedVisibility', 'challengeId',
    ] as const;
    for (const key of direct) {
      if (input[key] !== undefined) values[key] = input[key];
    }
    if (input.startsAt) values.startsAt = new Date(input.startsAt);
    if (input.endsAt) values.endsAt = new Date(input.endsAt);
    const [updated] = await db.transaction(async tx => {
      const rows = await tx
        .update(exploreEvents)
        .set(values)
        .where(eq(exploreEvents.id, id))
        .returning();
      if (input.mediaIds) {
        await tx.delete(exploreEventMedia).where(eq(exploreEventMedia.eventId, id));
        await tx.insert(exploreEventMedia).values(
          input.mediaIds.map((mediaAssetId, index) => ({
            eventId: id,
            mediaAssetId,
            sortOrder: index,
          })),
        );
      }
      return rows;
    });
    return this.serialize(updated!, ownerUserId);
  }

  async submit(ownerUserId: string, id: string) {
    const existing = await this.row(id);
    if (!existing || existing.ownerMobileUserId !== ownerUserId) {
      throw appError('Event not found', 'not_found', 404);
    }
    if (!EDITABLE_STATUSES.has(existing.reviewStatus)) {
      throw appError('Event is already submitted', 'invalid_status', 409);
    }
    if (existing.startsAt.getTime() <= Date.now()) {
      throw appError('Event must start in the future', 'event_in_past', 400);
    }
    const media = await db
      .select({ id: exploreEventMedia.mediaAssetId })
      .from(exploreEventMedia)
      .where(eq(exploreEventMedia.eventId, id));
    if (!media.length) throw appError('Add a cover image or video', 'media_required', 400);
    await mediaService.requireMobileContentAssets(
      ownerUserId,
      media.map(item => item.id),
    );
    const [updated] = await db
      .update(exploreEvents)
      .set({
        reviewStatus: 'pending_review',
        reviewReason: null,
        reviewVersion: existing.reviewVersion + (existing.submittedAt ? 1 : 0),
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(exploreEvents.id, id))
      .returning();
    await notificationService.notifyUser(ownerUserId, {
      type: 'explore_submission_received',
      title: 'Event submitted',
      body: `${existing.title} is now in review.`,
      data: { entityType: 'event', entityId: id, status: 'pending_review' },
    }).catch(() => undefined);
    return this.serialize(updated!, ownerUserId);
  }

  async archive(ownerUserId: string, id: string) {
    const existing = await this.row(id);
    if (!existing || existing.ownerMobileUserId !== ownerUserId) {
      throw appError('Event not found', 'not_found', 404);
    }
    if (!['approved', 'suspended'].includes(existing.reviewStatus)) {
      throw appError('Only an approved or suspended event can be archived', 'invalid_status', 409);
    }
    const [updated] = await db.update(exploreEvents).set({
      reviewStatus: 'archived',
      archivedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(exploreEvents.id, id)).returning();
    return this.serialize(updated!, ownerUserId);
  }

  async remove(ownerUserId: string, id: string) {
    const existing = await this.row(id);
    if (!existing || existing.ownerMobileUserId !== ownerUserId) {
      throw appError('Event not found', 'not_found', 404);
    }
    if (['pending_review', 'approved'].includes(existing.reviewStatus)) {
      throw appError('Archive or withdraw this event before deleting it', 'invalid_status', 409);
    }
    await db.transaction(async tx => {
      await tx.update(exploreEvents).set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(exploreEvents.id, id));
      await tx.delete(exploreSaves).where(and(
        eq(exploreSaves.entityType, 'event'), eq(exploreSaves.entityId, id),
      ));
    });
    return { success: true };
  }

  async mine(ownerUserId: string, limit = 50) {
    const rows = await db
      .select()
      .from(exploreEvents)
      .where(and(eq(exploreEvents.ownerMobileUserId, ownerUserId), sql`${exploreEvents.deletedAt} IS NULL`))
      .orderBy(desc(exploreEvents.updatedAt))
      .limit(Math.min(limit, 100));
    return Promise.all(rows.map(row => this.serialize(row, ownerUserId)));
  }

  async list(userId: string, viewer: PublisherRef, query: EventListQuery) {
    const conditions = [sql`${exploreEvents.deletedAt} IS NULL`];
    if (query.categoryId) conditions.push(eq(exploreEvents.categoryId, query.categoryId));
    if (query.search) {
      conditions.push(or(
        ilike(exploreEvents.title, `%${query.search}%`),
        ilike(exploreEvents.description, `%${query.search}%`),
      )!);
    }
    if (query.startsAfter) conditions.push(gt(exploreEvents.startsAt, new Date(query.startsAfter)));
    if (query.startsBefore) conditions.push(lt(exploreEvents.startsAt, new Date(query.startsBefore)));
    if (query.freeOnly) conditions.push(eq(exploreEvents.price, 0));
    if (query.cursor) conditions.push(lt(exploreEvents.createdAt, new Date(query.cursor)));
    const limit = Math.min(query.limit ?? 20, 100);
    const rows = await db
      .select()
      .from(exploreEvents)
      .where(and(...conditions))
      .orderBy(desc(exploreEvents.createdAt))
      .limit(limit * 4 + 1);
    const visible: EventRow[] = [];
    for (const row of rows) {
      const publisher = eventRef(row);
      if (query.following && !(await hasAcceptedFollow(viewer, publisher))) continue;
      if (await this.canView(row, userId, viewer)) visible.push(row);
      if (visible.length > limit) break;
    }
    const hasMore = visible.length > limit;
    const page = hasMore ? visible.slice(0, limit) : visible;
    return {
      events: await Promise.all(page.map(row => this.serialize(row, userId))),
      nextCursor: hasMore ? page[page.length - 1]!.createdAt.toISOString() : null,
    };
  }

  async get(userId: string, viewer: PublisherRef, id: string) {
    const row = await this.row(id);
    if (!row || !(await this.canView(row, userId, viewer))) {
      throw appError('Event not found', 'not_found', 404);
    }
    return this.serialize(row, userId);
  }

  async adminList(query: AdminListQuery) {
    const conditions = [sql`${exploreEvents.deletedAt} IS NULL`];
    if (query.status) conditions.push(eq(exploreEvents.reviewStatus, query.status));
    if (query.search) conditions.push(ilike(exploreEvents.title, `%${query.search}%`));
    if (query.cursor) conditions.push(lt(exploreEvents.createdAt, new Date(query.cursor)));
    const limit = Math.min(query.limit ?? 50, 100);
    const rows = await db.select().from(exploreEvents).where(and(...conditions))
      .orderBy(desc(exploreEvents.createdAt)).limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      events: await Promise.all(page.map(row => this.serialize(row, row.ownerMobileUserId))),
      nextCursor: hasMore ? page[page.length - 1]!.createdAt.toISOString() : null,
    };
  }

  async review(
    id: string,
    input: ExploreReviewRequest,
    actor: { id: string; email: string },
  ) {
    const existing = await this.row(id);
    if (!existing) throw appError('Event not found', 'not_found', 404);
    if (!ACTION_ALLOWED[input.action].includes(existing.reviewStatus)) {
      throw appError('Review action is not allowed from this status', 'invalid_status', 409);
    }
    const next = ACTION_STATUS[input.action];
    const now = new Date();
    const [updated] = await db.update(exploreEvents).set({
      reviewStatus: next,
      reviewReason: input.reason ?? null,
      approvedAt: next === 'approved' ? now : existing.approvedAt,
      archivedAt: next === 'archived' ? now : null,
      updatedAt: now,
    }).where(eq(exploreEvents.id, id)).returning();
    await writeAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: `explore.event.${input.action}`,
      entityType: 'explore_event',
      entityId: id,
      metadata: {
        previousStatus: existing.reviewStatus,
        newStatus: next,
        reviewVersion: existing.reviewVersion,
        reason: input.reason ?? null,
      },
    });
    const notification = notificationFor(input.action);
    await notificationService.notifyUser(existing.ownerMobileUserId, {
      ...notification,
      body: input.reason ? `${existing.title}: ${input.reason}` : existing.title,
      data: { entityType: 'event', entityId: id, status: next },
    }).catch(() => undefined);
    return this.serialize(updated!, existing.ownerMobileUserId);
  }

  async register(userId: string, viewer: PublisherRef, id: string) {
    const existing = await this.row(id);
    if (!existing || !(await this.canView(existing, userId, viewer))) {
      throw appError('Event not found', 'not_found', 404);
    }
    if (existing.startsAt.getTime() <= Date.now()) {
      throw appError('Registration has closed', 'registration_closed', 409);
    }
    if (existing.ticketType === 'paid') {
      throw appError('Paid event checkout is not enabled yet', 'payment_required', 409);
    }
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT id FROM explore_events WHERE id = ${id} FOR UPDATE`);
      const [locked] = await tx.select().from(exploreEvents).where(eq(exploreEvents.id, id));
      if (!locked || locked.registrationCount >= locked.capacity) {
        throw appError('Event is full', 'event_full', 409);
      }
      const [previous] = await tx.select().from(exploreEventRegistrations).where(and(
        eq(exploreEventRegistrations.eventId, id),
        eq(exploreEventRegistrations.mobileUserId, userId),
      ));
      if (previous?.status === 'registered') return;
      await tx.insert(exploreEventRegistrations).values({ eventId: id, mobileUserId: userId })
        .onConflictDoUpdate({
          target: [exploreEventRegistrations.eventId, exploreEventRegistrations.mobileUserId],
          set: { status: 'registered', cancelledAt: null },
        });
      await tx.update(exploreEvents).set({
        registrationCount: locked.registrationCount + 1,
        updatedAt: new Date(),
      }).where(eq(exploreEvents.id, id));
    });
    await notificationService.notifyUser(existing.ownerMobileUserId, {
      type: 'event_registration',
      title: 'New event registration',
      body: `Someone registered for ${existing.title}.`,
      data: { entityType: 'event', entityId: id },
    }).catch(() => undefined);
    return this.get(userId, viewer, id);
  }

  async unregister(userId: string, viewer: PublisherRef, id: string) {
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT id FROM explore_events WHERE id = ${id} FOR UPDATE`);
      const [registration] = await tx.select().from(exploreEventRegistrations).where(and(
        eq(exploreEventRegistrations.eventId, id),
        eq(exploreEventRegistrations.mobileUserId, userId),
        eq(exploreEventRegistrations.status, 'registered'),
      ));
      if (!registration) return;
      await tx.update(exploreEventRegistrations).set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(exploreEventRegistrations.id, registration.id));
      await tx.update(exploreEvents).set({
        registrationCount: sql`GREATEST(0, ${exploreEvents.registrationCount} - 1)`,
        updatedAt: new Date(),
      }).where(eq(exploreEvents.id, id));
    });
    return this.get(userId, viewer, id);
  }

  async setSaved(userId: string, viewer: PublisherRef, id: string, saved: boolean) {
    const existing = await this.row(id);
    if (!existing || !(await this.canView(existing, userId, viewer))) {
      throw appError('Event not found', 'not_found', 404);
    }
    if (saved) {
      await db.insert(exploreSaves).values({
        mobileUserId: userId, entityType: 'event', entityId: id,
      }).onConflictDoNothing();
    } else {
      await db.delete(exploreSaves).where(and(
        eq(exploreSaves.mobileUserId, userId),
        eq(exploreSaves.entityType, 'event'),
        eq(exploreSaves.entityId, id),
      ));
    }
    return this.serialize(existing, userId);
  }

  async saved(userId: string, viewer: PublisherRef) {
    const saves = await db.select({ id: exploreSaves.entityId }).from(exploreSaves).where(and(
      eq(exploreSaves.mobileUserId, userId),
      eq(exploreSaves.entityType, 'event'),
    )).orderBy(desc(exploreSaves.createdAt));
    const result: ExploreEvent[] = [];
    for (const save of saves) {
      const row = await this.row(save.id);
      if (row && await this.canView(row, userId, viewer)) {
        result.push(await this.serialize(row, userId));
      }
    }
    return result;
  }
}

export const exploreEventService = new ExploreEventService();
