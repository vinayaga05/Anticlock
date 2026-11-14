import { and, asc, desc, eq, inArray, isNull, lt, notInArray, or, sql, type SQL } from 'drizzle-orm';
import type { BusinessAnalytics, BusinessAvailabilityQuery, BusinessProfile, BusinessReview, BusinessService, CreateBusinessReviewRequest, ServiceMode, UpdateBusinessProfileRequest, UpdateBusinessServicesRequest } from '@anticlock/contracts';
import { db } from '../db/client.js';
import { bookings, businessProfileReports, businessProfileSaves, businessReviews, contentPosts, exploreEventMedia, exploreEvents, mediaAssets, mediaUsages, mobileUsers, products, productImages, providerApplications, providerMemberships, providers, providerServiceOfferings, serviceCategories } from '../db/schema.js';
import { ApiError } from '../lib/httpError.js';
import { mediaService } from '../media/MediaService.js';
import { profileFollowService } from '../social/ProfileFollowService.js';
import { resolveOwnedPublisher, type PublisherRef } from '../publishing/publisher.js';
import { businessSlots, configuredServiceDuration, dayKey, istDate, validBusinessDate, validWorkingDay } from './businessAvailability.js';

type Provider = typeof providers.$inferSelect;
type ReviewRow = typeof businessReviews.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const MANAGE = ['owner', 'admin'];
const PUBLISH = [...MANAGE, 'content_creator'];
const ACTIVE_BOOKINGS = ['pending', 'confirmed', 'reschedule_requested'];
export const objectValue = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const number = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null;
const website = (value: unknown): string | null => {
  try { const url = new URL(typeof value === 'string' ? value : ''); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
};
const strings = (v: unknown) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && Boolean(s.trim())).map(s => s.trim()) : [];
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const notFound = () => new ApiError(404, 'not_found', 'Business not found');
const forbidden = () => new ApiError(403, 'forbidden', 'You cannot manage this business.');
const publicMediaConditions = [eq(mediaAssets.accessLevel, 'public'), eq(mediaAssets.processingStatus, 'ready'), inArray(mediaAssets.moderationStatus, ['approved', 'not_required']), isNull(mediaAssets.deletedAt), isNull(mediaAssets.archivedAt)];

/** Account blocks apply globally; profile blocks use the chosen, owned social identity. */
function unblockedBusiness(providerId: string | SQL, ownerId: string | SQL, userId: string, viewer: PublisherRef) {
  return sql`NOT EXISTS (SELECT 1 FROM mobile_user_blocks b WHERE
    (b.blocker_mobile_user_id = ${userId} AND (b.blocked_provider_id = ${providerId} OR b.blocked_mobile_user_id = ${ownerId}))
    OR (b.blocker_mobile_user_id = ${ownerId} AND (b.blocked_mobile_user_id = ${userId} OR (${viewer.type} = 'business' AND b.blocked_provider_id = ${viewer.id}))))
    AND NOT EXISTS (SELECT 1 FROM profile_blocks b WHERE
      (((b.blocker_profile_id = ${providerId} AND b.blocker_profile_type = 'business') OR (b.blocker_profile_id = ${ownerId} AND b.blocker_profile_type = 'personal')) AND b.blocked_profile_id = ${viewer.id} AND b.blocked_profile_type = ${viewer.type})
      OR (((b.blocked_profile_id = ${providerId} AND b.blocked_profile_type = 'business') OR (b.blocked_profile_id = ${ownerId} AND b.blocked_profile_type = 'personal')) AND b.blocker_profile_id = ${viewer.id} AND b.blocker_profile_type = ${viewer.type})
      OR (b.blocker_profile_id = ${ownerId} AND b.blocker_profile_type = 'personal' AND b.blocked_profile_id = ${userId} AND b.blocked_profile_type = 'personal')
      OR (b.blocked_profile_id = ${ownerId} AND b.blocked_profile_type = 'personal' AND b.blocker_profile_id = ${userId} AND b.blocker_profile_type = 'personal'))`;
}

/** Only named public fields are ever extracted. Application documents/dynamic KYC are never read. */
export function businessPublicFields(provider: Pick<Provider, 'publicProfile'>) {
  const pp = objectValue(provider.publicProfile);
  const common = objectValue(pp.common), basic = objectValue(common.basic), profile = objectValue(common.profile), location = objectValue(common.location), availability = objectValue(common.availability), services = objectValue(common.services);
  const modes: ServiceMode[] = [];
  if (services.atLocation === true) modes.push('center');
  if (services.homeVisit === true) modes.push('home');
  if (services.online === true) modes.push('online');
  return {
    pp, common, basic, profile, location, availability, services, modes,
    description: text(profile.description), tagline: text(profile.tagline), brandAccentColor: /^#[0-9a-f]{6}$/i.test(text(profile.brandAccentColor) ?? '') ? text(profile.brandAccentColor) : null,
    yearsInBusiness: number(Object.prototype.hasOwnProperty.call(profile, 'yearsInBusiness') ? profile.yearsInBusiness : profile.yearsInOperation), certifications: strings(profile.certifications), languages: strings(profile.languages),
    workingDays: strings(availability.workingDays).filter(validWorkingDay), openingTime: text(availability.openingTime), closingTime: text(availability.closingTime), temporarilyUnavailable: availability.temporarilyUnavailable === true,
    logoId: uuid(profile.logoMediaId) ? profile.logoMediaId : null,
    coverIds: strings(profile.coverMediaIds).filter(uuid), galleryIds: strings(profile.galleryMediaIds).filter(uuid), introId: uuid(profile.introVideoMediaId) ? profile.introVideoMediaId : null,
  };
}

export function encodeReviewCursor(row: Pick<ReviewRow, 'id' | 'createdAt'>) { return Buffer.from(JSON.stringify([row.createdAt.toISOString(), row.id])).toString('base64url'); }
export function decodeReviewCursor(cursor: string, kind = 'review') {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || !uuid(value[1])) throw new Error();
    const date = new Date(value[0]);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== value[0]) throw new Error();
    return { createdAt: date, id: value[1] };
  } catch { throw new ApiError(400, 'invalid_cursor', `Invalid ${kind} cursor.`); }
}

export class BusinessProfileService {
  async resolveViewer(userId: string, viewer: PublisherRef) {
    await this.assertActiveUser(userId);
    const owned = await resolveOwnedPublisher(userId, viewer);
    if (owned.ref.type === 'business') {
      const [activeOwner] = await db.select({ id: providers.id }).from(providers).innerJoin(mobileUsers, eq(providers.mobileUserId, mobileUsers.id)).where(and(eq(providers.id, owned.ref.id), eq(mobileUsers.isActive, true))).limit(1);
      if (!activeOwner) throw new ApiError(403, 'forbidden', 'This business profile is unavailable.');
    }
    return owned.ref;
  }
  async assertActiveUser(userId: string, executor: typeof db | Transaction = db) {
    const [user] = await executor.select({ id: mobileUsers.id }).from(mobileUsers).where(and(eq(mobileUsers.id, userId), eq(mobileUsers.isActive, true))).limit(1);
    if (!user) throw new ApiError(403, 'account_inactive', 'An active mobile account is required.');
  }

  /** All public and owner endpoints share exactly the same lifecycle and safety gate. */
  async loadAvailable(providerId: string, viewerId?: string, viewer?: PublisherRef) {
    if (!uuid(providerId)) throw notFound();
    if (viewerId) await this.assertActiveUser(viewerId);
    if (viewer) {
      if (!viewerId) throw new ApiError(401, 'unauthorized', 'Sign in to choose a viewer profile.');
      await this.resolveViewer(viewerId, viewer);
    }
    const [provider] = await db.select({ provider: providers }).from(providers)
      .innerJoin(mobileUsers, eq(providers.mobileUserId, mobileUsers.id))
      .innerJoin(providerApplications, eq(providers.sourceApplicationId, providerApplications.id))
      .where(and(eq(providers.id, providerId), eq(providers.status, 'active'), eq(mobileUsers.isActive, true), eq(providerApplications.status, 'approved'), eq(providerApplications.mobileUserId, providers.mobileUserId))).limit(1);
    if (!provider) throw notFound();
    if (viewerId) await this.assertViewerNotBlocked(provider.provider, viewerId, db, viewer);
    return provider.provider;
  }

  /** Scheduling retains legacy active-provider support, with the same account/block safety. */
  async assertBookingAccess(provider: Provider, viewerId: string, executor: typeof db | Transaction = db) {
    await this.assertActiveUser(viewerId, executor);
    const [owner] = await executor.select({ id: mobileUsers.id }).from(mobileUsers).where(and(eq(mobileUsers.id, provider.mobileUserId), eq(mobileUsers.isActive, true))).limit(1);
    if (!owner || provider.status !== 'active') throw notFound();
    if (provider.sourceApplicationId) {
      const [approved] = await executor.select({ id: providerApplications.id }).from(providerApplications).where(and(eq(providerApplications.id, provider.sourceApplicationId), eq(providerApplications.mobileUserId, provider.mobileUserId), eq(providerApplications.status, 'approved'))).limit(1);
      if (!approved) throw notFound();
    }
    if (await this.role(provider, viewerId, executor)) throw new ApiError(403, 'cannot_book_self', 'Choose another business to make a booking.');
    await this.assertViewerNotBlocked(provider, viewerId, executor);
  }

  private async assertViewerNotBlocked(provider: Provider, viewerId: string, executor: typeof db | Transaction = db, viewer: PublisherRef = { id: viewerId, type: 'personal' }) {
    const providerId = provider.id;
    if (viewerId !== provider.mobileUserId) {
      const rows = await executor.select({ id: providers.id }).from(providers).where(and(eq(providers.id, providerId), unblockedBusiness(providerId, provider.mobileUserId, viewerId, viewer))).limit(1);
      if (!rows.length) throw notFound();
    }
  }

  private async role(provider: Provider, userId?: string, executor: typeof db | Transaction = db) {
    if (!userId) return null;
    if (provider.mobileUserId === userId) return 'owner';
    const [member] = await executor.select({ role: providerMemberships.role }).from(providerMemberships).where(and(eq(providerMemberships.providerId, provider.id), eq(providerMemberships.mobileUserId, userId))).limit(1);
    return member?.role ?? null;
  }

  private async requireManager(providerId: string, userId: string, analytics = false) {
    const provider = await this.loadAvailable(providerId, userId);
    const role = await this.role(provider, userId);
    if (!role || !(analytics ? [...MANAGE, 'analyst'] : MANAGE).includes(role)) throw forbidden();
    return provider;
  }

  private async services(provider: Provider): Promise<BusinessService[]> {
    const fields = businessPublicFields(provider);
    const rows = await db.select({ offering: providerServiceOfferings, name: serviceCategories.name }).from(providerServiceOfferings).innerJoin(serviceCategories, eq(providerServiceOfferings.categoryId, serviceCategories.id)).where(and(eq(providerServiceOfferings.providerId, provider.id), eq(serviceCategories.status, 'published'))).orderBy(asc(providerServiceOfferings.createdAt));
    return rows.map(({ offering, name }) => {
      const metadata = objectValue(offering.metadata);
      const explicitModes = strings(metadata.modes).filter((mode): mode is ServiceMode => ['center', 'home', 'online'].includes(mode));
      return { id: offering.id, categoryId: offering.categoryId, title: name, description: text(metadata.description), price: offering.pricingStartsAt, durationMinutes: configuredServiceDuration(metadata.durationMinutes), modes: Array.isArray(metadata.modes) ? explicitModes : fields.modes, available: metadata.available !== false };
    });
  }

  private async safeMedia(ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(uuid))];
    if (!uniqueIds.length) return [];
    const rows = await db.select({ id: mediaAssets.id, kind: mediaAssets.kind }).from(mediaAssets).where(and(inArray(mediaAssets.id, uniqueIds), ...publicMediaConditions, inArray(mediaAssets.kind, ['image', 'video'])));
    const resolved = await Promise.all(rows.map(async row => ({ id: row.id, kind: row.kind as 'image' | 'video', url: await mediaService.getPublicContentDeliveryUrl(row.id, row.kind as 'image' | 'video') })));
    return uniqueIds.flatMap(id => { const row = resolved.find(item => item.id === id); return row?.url ? [{ id: row.id, kind: row.kind, url: row.url }] : []; });
  }

  private async eligibleBookings(providerId: string, userId?: string) {
    if (!userId) return [];
    const rows = await db.select({ id: bookings.id, startsAt: bookings.startsAt, serviceTitle: serviceCategories.name }).from(bookings).leftJoin(serviceCategories, eq(bookings.categoryId, serviceCategories.id)).where(and(eq(bookings.providerId, providerId), eq(bookings.mobileUserId, userId), eq(bookings.status, 'completed'), sql`NOT EXISTS (SELECT 1 FROM business_reviews r WHERE r.booking_id = ${bookings.id})`)).orderBy(desc(bookings.startsAt)).limit(50);
    return rows.map(row => ({ id: row.id, startsAt: row.startsAt.toISOString(), serviceTitle: row.serviceTitle ?? 'Service' }));
  }

  private async reviewViews(rows: ReviewRow[]): Promise<BusinessReview[]> {
    if (!rows.length) return [];
    const authors = await db.select({ id: mobileUsers.id, displayName: mobileUsers.displayName, avatarUrl: mobileUsers.avatarUrl }).from(mobileUsers).where(inArray(mobileUsers.id, [...new Set(rows.map(row => row.authorId))]));
    const bookingRows = await db.select({ id: bookings.id, title: serviceCategories.name }).from(bookings).leftJoin(serviceCategories, eq(bookings.categoryId, serviceCategories.id)).where(inArray(bookings.id, rows.map(row => row.bookingId)));
    const photos = await this.safeMedia(rows.flatMap(row => row.photoMediaIds));
    return rows.map(row => ({ id: row.id, rating: row.rating, body: row.body, author: { id: row.authorId, displayName: authors.find(a => a.id === row.authorId)?.displayName ?? 'Member', avatarUrl: website(authors.find(a => a.id === row.authorId)?.avatarUrl) }, serviceTitle: bookingRows.find(b => b.id === row.bookingId)?.title ?? 'Service', verifiedBooking: true, photos: row.photoMediaIds.flatMap(id => { const photo = photos.find(p => p.id === id && p.kind === 'image'); return photo ? [{ id, url: photo.url }] : []; }), createdAt: row.createdAt.toISOString() }));
  }

  async listReviews(providerId: string, userId?: string, limit = 10, cursor?: string, viewer?: PublisherRef) {
    const provider = await this.loadAvailable(providerId, userId, viewer);
    const position = cursor ? decodeReviewCursor(cursor) : null;
    const rows = await db.select().from(businessReviews).where(and(eq(businessReviews.providerId, providerId), position ? or(lt(businessReviews.createdAt, position.createdAt), and(eq(businessReviews.createdAt, position.createdAt), lt(businessReviews.id, position.id))) : undefined)).orderBy(desc(businessReviews.createdAt), desc(businessReviews.id)).limit(limit + 1);
    const page = rows.slice(0, limit);
    return { reviews: await this.reviewViews(page), nextCursor: rows.length > limit ? encodeReviewCursor(page[page.length - 1]!) : null, eligibleBookings: await this.role(provider, userId) ? [] : await this.eligibleBookings(providerId, userId) };
  }

  async availability(providerId: string, query: BusinessAvailabilityQuery, userId?: string, now = new Date(), viewer?: PublisherRef) {
    const provider = await this.loadAvailable(providerId, userId, viewer);
    if (!validBusinessDate(query.date)) throw new ApiError(400, 'invalid_date', 'Choose a valid date.');
    const service = (await this.services(provider)).find(row => row.categoryId === query.categoryId);
    if (!service) throw new ApiError(404, 'service_not_found', 'Service not found.');
    if (service.durationMinutes && query.durationMinutes && service.durationMinutes !== query.durationMinutes) throw new ApiError(400, 'invalid_duration', 'Use the duration configured for this service.');
    const fields = businessPublicFields(provider);
    const dayStart = new Date(`${query.date}T00:00:00+05:30`), nextDay = new Date(dayStart.getTime() + 86_400_000);
    const existing = await db.select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt, durationMinutes: bookings.durationMinutes }).from(bookings).where(and(eq(bookings.providerId, providerId), inArray(bookings.status, ACTIVE_BOOKINGS), lt(bookings.startsAt, nextDay), sql`COALESCE(${bookings.endsAt}, ${bookings.startsAt} + COALESCE(${bookings.durationMinutes},60) * interval '1 minute') > ${dayStart.toISOString()}::timestamptz`));
    return businessSlots({ ...query, durationMinutes: query.durationMinutes ?? service.durationMinutes ?? 60, ...fields, serviceAvailable: service.available, allowedModes: service.modes, bookings: existing, now });
  }

  async getProfile(providerId: string, userId?: string, viewer?: PublisherRef): Promise<BusinessProfile> {
    const provider = await this.loadAvailable(providerId, userId, viewer), fields = businessPublicFields(provider);
    const [services, categories, role, saved, ratingRows, reviewPage, productRows, eventRows, followerRows, clipRows] = await Promise.all([
      this.services(provider),
      db.select({ id: serviceCategories.id, name: serviceCategories.name, treeId: serviceCategories.treeId }).from(providerServiceOfferings).innerJoin(serviceCategories, eq(providerServiceOfferings.categoryId, serviceCategories.id)).where(and(eq(providerServiceOfferings.providerId, providerId), eq(serviceCategories.status, 'published'))),
      this.role(provider, userId),
      userId ? db.select({ id: businessProfileSaves.id }).from(businessProfileSaves).where(and(eq(businessProfileSaves.providerId, providerId), eq(businessProfileSaves.mobileUserId, userId))).limit(1) : [],
      db.select({ count: sql<number>`count(*)::int`, average: sql<string | null>`avg(${businessReviews.rating})` }).from(businessReviews).where(eq(businessReviews.providerId, providerId)),
      this.listReviews(providerId, userId, 5, undefined, viewer),
      db.select({ id: products.id, name: products.name, price: products.price, inventory: products.inventory }).from(products).where(and(eq(products.authorProviderId, providerId), eq(products.status, 'published'), eq(products.reviewStatus, 'approved'), eq(products.requestedVisibility, 'public'))).orderBy(desc(products.createdAt)),
      db.select({ id: exploreEvents.id, title: exploreEvents.title, startsAt: exploreEvents.startsAt, endsAt: exploreEvents.endsAt, price: exploreEvents.price, currency: exploreEvents.currency, location: exploreEvents.location }).from(exploreEvents).where(and(eq(exploreEvents.authorProviderId, providerId), eq(exploreEvents.reviewStatus, 'approved'), eq(exploreEvents.requestedVisibility, 'public'), isNull(exploreEvents.deletedAt), isNull(exploreEvents.archivedAt))).orderBy(desc(exploreEvents.startsAt)),
      db.execute(sql`SELECT count(*)::int AS count FROM profile_follows WHERE followed_profile_id = ${providerId} AND followed_profile_type = 'business' AND status = 'accepted'`),
      db.select({ count: sql<number>`count(*)::int` }).from(contentPosts).where(and(eq(contentPosts.authorProviderId, providerId), eq(contentPosts.format, 'clip'), eq(contentPosts.visibility, 'public'), eq(contentPosts.status, 'published'))),
    ]);
    const publicIds = [fields.logoId, ...fields.coverIds, ...fields.galleryIds, fields.introId].filter((id): id is string => Boolean(id));
    const [media, productMedia, eventMedia, relationship] = await Promise.all([
      this.safeMedia(publicIds),
      productRows.length ? db.select().from(productImages).where(inArray(productImages.productId, productRows.map(row => row.id))).orderBy(asc(productImages.sortOrder)) : [],
      eventRows.length ? db.select().from(exploreEventMedia).where(inArray(exploreEventMedia.eventId, eventRows.map(row => row.id))).orderBy(asc(exploreEventMedia.sortOrder)) : [],
      userId ? profileFollowService.relationship(viewer ?? { id: userId, type: 'personal' }, { id: providerId, type: 'business' }) : null,
    ]);
    const cardMedia = await this.safeMedia([...productMedia.map(row => row.mediaAssetId), ...eventMedia.map(row => row.mediaAssetId)]);
    const imageFor = (ids: string[]) => ids.map(id => cardMedia.find(m => m.id === id && m.kind === 'image')?.url).find(Boolean) ?? null;
    const now = new Date(), today = istDate(now);
    const scanStart = new Date(`${today}T00:00:00+05:30`), scanEnd = new Date(scanStart.getTime() + 14 * 86_400_000);
    const occupied = await db.select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt, durationMinutes: bookings.durationMinutes }).from(bookings).where(and(eq(bookings.providerId, providerId), inArray(bookings.status, ACTIVE_BOOKINGS), lt(bookings.startsAt, scanEnd), sql`COALESCE(${bookings.endsAt}, ${bookings.startsAt} + COALESCE(${bookings.durationMinutes},60) * interval '1 minute') > ${scanStart.toISOString()}::timestamptz`));
    const eligible = services.filter(service => service.available && service.modes.length);
    const slotsFor = (date: string, service: BusinessService) => businessSlots({ date, categoryId: service.categoryId, serviceMode: service.modes[0]!, durationMinutes: service.durationMinutes ?? 60, ...fields, serviceAvailable: service.available, allowedModes: service.modes, bookings: occupied, now });
    let nextAvailableAt: string | null = null;
    // A bounded look-ahead for the first bookable service. No per-slot SQL queries.
    if (eligible[0]) for (let day = 0; day < 14 && !nextAvailableAt; day++) {
      const date = istDate(new Date(scanStart.getTime() + day * 86_400_000));
      nextAvailableAt = slotsFor(date, eligible[0]).slots.find(slot => slot.available)?.startsAt ?? null;
    }
    let operatingStatus: BusinessProfile['availability']['operatingStatus'] = fields.temporarilyUnavailable ? 'temporarily_unavailable' : !fields.openingTime || !fields.closingTime || !fields.workingDays.length ? 'unknown' : 'closed';
    const open = new Date(`${today}T${fields.openingTime}:00+05:30`), close = new Date(`${today}T${fields.closingTime}:00+05:30`);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(now);
    if (!fields.temporarilyUnavailable && fields.workingDays.map(dayKey).includes(dayKey(weekday)) && now >= open && now < close) {
      const slots = eligible.map(service => slotsFor(today, service));
      operatingStatus = eligible.length && !slots.some(result => result.slots.some(slot => slot.available)) ? 'fully_booked' : 'open';
    }
    return {
      id: providerId, name: provider.name, providerKind: provider.providerKind, verified: true,
      description: fields.description, tagline: fields.tagline, brandAccentColor: fields.brandAccentColor, yearsInBusiness: fields.yearsInBusiness, certifications: fields.certifications, languages: fields.languages,
      avatarUrl: media.find(m => m.id === fields.logoId && m.kind === 'image')?.url ?? null,
      coverUrl: media.find(m => fields.coverIds.includes(m.id) && m.kind === 'image')?.url ?? null,
      gallery: media.filter(m => m.id !== fields.logoId), services, categories,
      contact: { phone: text(fields.basic.mobile), email: text(fields.basic.email), website: website(fields.basic.website) },
      location: { address: text(fields.location.address), city: text(fields.location.city), area: text(fields.location.area), pincode: text(fields.location.pincode), latitude: number(fields.location.latitude), longitude: number(fields.location.longitude), serviceRadiusKm: number(fields.location.serviceRadiusKm) },
      availability: { timeZone: 'Asia/Kolkata', workingDays: fields.workingDays, openingTime: fields.openingTime, closingTime: fields.closingTime, temporarilyUnavailable: fields.temporarilyUnavailable, operatingStatus, nextAvailableAt },
      rating: { average: ratingRows[0]?.average == null ? null : Number(ratingRows[0].average), count: ratingRows[0]?.count ?? 0 }, reviews: reviewPage.reviews,
      products: productRows.map(row => ({ ...row, imageUrl: imageFor(productMedia.filter(m => m.productId === row.id).map(m => m.mediaAssetId)) })),
      events: eventRows.map(({ location, ...row }) => ({ ...row, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), imageUrl: imageFor(eventMedia.filter(m => m.eventId === row.id).map(m => m.mediaAssetId)), locationLabel: location?.name ?? null })),
      stats: { followers: Number(followerRows[0]?.count ?? 0), clips: clipRows[0]?.count ?? 0, products: productRows.length, events: eventRows.length },
      viewer: { role, isOwner: role === 'owner', canManage: role !== null && MANAGE.includes(role), canPublish: role !== null && PUBLISH.includes(role), canEditServices: role !== null && MANAGE.includes(role), canViewAnalytics: role !== null && [...MANAGE, 'analyst'].includes(role), isSaved: saved.length > 0, canReview: !role && reviewPage.eligibleBookings.length > 0, relationship },
    };
  }

  async save(providerId: string, userId: string, saved: boolean, viewer?: PublisherRef) {
    await this.loadAvailable(providerId, userId, viewer);
    if (saved) await db.insert(businessProfileSaves).values({ providerId, mobileUserId: userId }).onConflictDoNothing();
    else await db.delete(businessProfileSaves).where(and(eq(businessProfileSaves.providerId, providerId), eq(businessProfileSaves.mobileUserId, userId)));
    return { saved };
  }

  async listSaved(userId: string, limit = 20, cursor?: string, viewer?: PublisherRef) {
    await this.assertActiveUser(userId);
    if (viewer) await this.resolveViewer(userId, viewer);
    const position = cursor ? decodeReviewCursor(cursor, 'saved-business') : null;
    // Normalize both ordering and comparison to milliseconds. This also handles
    // pre-existing timestamptz rows with sub-millisecond precision exactly.
    const savedTime = sql<Date>`date_trunc('milliseconds', ${businessProfileSaves.createdAt})`.mapWith(businessProfileSaves.createdAt);
    const rows = await db.select({ id: businessProfileSaves.id, createdAt: savedTime, provider: providers }).from(businessProfileSaves)
      .innerJoin(providers, eq(businessProfileSaves.providerId, providers.id))
      .innerJoin(mobileUsers, eq(providers.mobileUserId, mobileUsers.id))
      .innerJoin(providerApplications, eq(providers.sourceApplicationId, providerApplications.id))
      .where(and(eq(businessProfileSaves.mobileUserId, userId), eq(providers.status, 'active'), eq(mobileUsers.isActive, true), eq(providerApplications.status, 'approved'), eq(providerApplications.mobileUserId, providers.mobileUserId),
        unblockedBusiness(sql`${providers.id}`, sql`${providers.mobileUserId}`, userId, viewer ?? { id: userId, type: 'personal' }),
        position ? or(sql`${savedTime} < ${position.createdAt.toISOString()}::timestamptz`, and(sql`${savedTime} = ${position.createdAt.toISOString()}::timestamptz`, lt(businessProfileSaves.id, position.id))) : undefined,
      )).orderBy(desc(savedTime), desc(businessProfileSaves.id)).limit(limit + 1);
    const page = rows.slice(0, limit);
    const fields = new Map(page.map(row => [row.provider.id, businessPublicFields(row.provider)]));
    const media = await this.safeMedia(page.flatMap(row => { const value = fields.get(row.provider.id)!; return [value.logoId, ...value.coverIds].filter((id): id is string => Boolean(id)); }));
    const categories = page.length ? await db.select({ providerId: providerServiceOfferings.providerId, name: serviceCategories.name }).from(providerServiceOfferings).innerJoin(serviceCategories, eq(providerServiceOfferings.categoryId, serviceCategories.id)).where(and(inArray(providerServiceOfferings.providerId, page.map(row => row.provider.id)), eq(serviceCategories.status, 'published'))).orderBy(asc(providerServiceOfferings.createdAt)) : [];
    return { businesses: page.map(row => {
      const value = fields.get(row.provider.id)!;
      return { id: row.provider.id, name: row.provider.name, avatarUrl: media.find(m => m.id === value.logoId && m.kind === 'image')?.url ?? null, coverUrl: media.find(m => value.coverIds.includes(m.id) && m.kind === 'image')?.url ?? null, categoryLabel: categories.find(c => c.providerId === row.provider.id)?.name ?? null, city: text(value.location.city), area: text(value.location.area), savedAt: row.createdAt.toISOString() };
    }), nextCursor: rows.length > limit ? encodeReviewCursor(page[page.length - 1]!) : null };
  }

  async report(providerId: string, userId: string, request: { reason: string; details?: string }, viewer?: PublisherRef) {
    const provider = await this.loadAvailable(providerId, userId, viewer);
    if (await this.role(provider, userId)) throw new ApiError(400, 'cannot_report_self', 'You cannot report your own business.');
    const [report] = await db.insert(businessProfileReports).values({ providerId, reporterId: userId, reason: request.reason, details: request.details ?? null }).onConflictDoUpdate({ target: [businessProfileReports.reporterId, businessProfileReports.providerId], set: { reason: request.reason, details: request.details ?? null } }).returning({ id: businessProfileReports.id });
    return { reportId: report!.id };
  }

  private async assertOwnedPhotos(ids: string[], userId: string, provider?: Provider, executor: typeof db | Transaction = db) {
    if (!ids.length) return;
    const rows = await executor.select().from(mediaAssets).where(and(inArray(mediaAssets.id, [...new Set(ids)]), ...publicMediaConditions, eq(mediaAssets.kind, 'image'))).for('update');
    if (rows.length !== new Set(ids).size || rows.some(row => !row.storageKey.startsWith(`public/content-${userId}/`) && !row.storageKey.startsWith(`public/avatars/${userId}/`) && !(provider?.sourceApplicationId && row.storageKey.startsWith(`public/provider-app-${provider.sourceApplicationId}/`)))) throw new ApiError(403, 'invalid_media_owner', 'Choose ready public images uploaded by you for this business.');
  }

  async createReview(providerId: string, userId: string, request: CreateBusinessReviewRequest, viewer?: PublisherRef) {
    const provider = await this.loadAvailable(providerId, userId, viewer);
    if (await this.role(provider, userId)) throw new ApiError(403, 'cannot_review_self', 'You cannot review your own business.');
    await this.assertOwnedPhotos(request.photoMediaIds, userId);
    const [row] = await db.transaction(async tx => {
      const [booking] = await tx.select().from(bookings).where(and(eq(bookings.id, request.bookingId), eq(bookings.providerId, providerId), eq(bookings.mobileUserId, userId), eq(bookings.status, 'completed'))).for('update');
      if (!booking) throw new ApiError(403, 'completed_booking_required', 'Only customers with a completed booking can review this business.');
      await this.assertOwnedPhotos(request.photoMediaIds, userId, undefined, tx);
      const existing = await tx.select({ id: businessReviews.id }).from(businessReviews).where(eq(businessReviews.bookingId, booking.id)).limit(1);
      if (existing.length) throw new ApiError(409, 'already_reviewed', 'This booking already has a review.');
      const inserted = await tx.insert(businessReviews).values({ providerId, authorId: userId, bookingId: booking.id, rating: request.rating, body: request.body, photoMediaIds: [...new Set(request.photoMediaIds)] }).returning();
      if (request.photoMediaIds.length) await tx.insert(mediaUsages).values([...new Set(request.photoMediaIds)].map((mediaId, sortOrder) => ({ mediaId, entityType: 'business_review', entityId: inserted[0]!.id, usageType: 'PHOTO', sortOrder }))).onConflictDoNothing();
      return inserted;
    });
    return (await this.reviewViews([row!]))[0]!;
  }

  async updateProfile(providerId: string, userId: string, request: UpdateBusinessProfileRequest) {
    const provider = await this.requireManager(providerId, userId), fields = businessPublicFields(provider);
    const profile = { ...fields.profile }, basic = { ...fields.basic }, location = { ...fields.location }, availability = { ...fields.availability };
    for (const key of ['description', 'tagline', 'brandAccentColor', 'yearsInBusiness', 'certifications', 'languages'] as const) if (request[key] !== undefined) profile[key] = request[key];
    for (const [key, stored] of [['phone', 'mobile'], ['email', 'email'], ['website', 'website']] as const) if (request[key] !== undefined) basic[stored] = request[key];
    for (const key of ['address', 'city', 'area', 'pincode', 'latitude', 'longitude', 'serviceRadiusKm'] as const) if (request[key] !== undefined) location[key] = request[key];
    for (const key of ['workingDays', 'openingTime', 'closingTime', 'temporarilyUnavailable'] as const) if (request[key] !== undefined) availability[key] = request[key];
    if (request.workingDays?.some(day => !validWorkingDay(day))) throw new ApiError(400, 'invalid_hours', 'Choose valid working days.');
    if (typeof availability.openingTime === 'string' && typeof availability.closingTime === 'string' && availability.openingTime >= availability.closingTime) throw new ApiError(400, 'invalid_hours', 'Closing time must be after opening time on the same day.');
    if (request.logoMediaId !== undefined) profile.logoMediaId = request.logoMediaId;
    if (request.coverMediaId !== undefined) profile.coverMediaIds = request.coverMediaId ? [request.coverMediaId] : [];
    if (request.galleryMediaIds !== undefined) profile.galleryMediaIds = [...new Set(request.galleryMediaIds)];
    const changedIds = [request.logoMediaId, request.coverMediaId, ...(request.galleryMediaIds ?? [])].filter((id): id is string => Boolean(id));
    await this.assertOwnedPhotos(changedIds, userId, provider);
    const allIds = [profile.logoMediaId, ...strings(profile.coverMediaIds), ...strings(profile.galleryMediaIds), profile.introVideoMediaId].filter(uuid);
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${providerId}))`);
      // Serialize profile edits and keep referenced media protected from unused-media deletion.
      const [current] = await tx.select().from(providers).where(eq(providers.id, providerId)).for('update');
      if (!current || current.updatedAt.getTime() !== provider.updatedAt.getTime() || current.name !== provider.name || JSON.stringify(current.publicProfile) !== JSON.stringify(provider.publicProfile)) throw new ApiError(409, 'profile_changed', 'This business changed. Refresh before saving.');
      const existingMedia = allIds.length ? await tx.select({ id: mediaAssets.id }).from(mediaAssets).where(and(inArray(mediaAssets.id, [...new Set(allIds)]), ...publicMediaConditions)).for('update') : [];
      await this.assertOwnedPhotos(changedIds, userId, provider, tx);
      await tx.update(providers).set({ name: request.name ?? provider.name, publicProfile: { ...fields.pp, common: { ...fields.common, profile, basic, location, availability } }, updatedAt: new Date() }).where(eq(providers.id, providerId));
      await tx.delete(mediaUsages).where(and(eq(mediaUsages.entityType, 'business_profile'), eq(mediaUsages.entityId, providerId)));
      if (existingMedia.length) await tx.insert(mediaUsages).values(existingMedia.map(({ id: mediaId }, sortOrder) => ({ mediaId, entityType: 'business_profile', entityId: providerId, usageType: 'PROFILE', sortOrder }))).onConflictDoNothing();
    });
    return this.getProfile(providerId, userId);
  }

  async updateServices(providerId: string, userId: string, request: UpdateBusinessServicesRequest) {
    const provider = await this.requireManager(providerId, userId);
    const ids = request.services.map(service => service.categoryId);
    if (new Set(ids).size !== ids.length) throw new ApiError(400, 'duplicate_service', 'Choose each service category once.');
    const categories = await db.select({ id: serviceCategories.id }).from(serviceCategories).where(and(inArray(serviceCategories.id, ids), eq(serviceCategories.status, 'published')));
    if (categories.length !== ids.length) throw new ApiError(400, 'invalid_service', 'Choose published service categories.');
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${providerId}))`);
      const [currentProvider] = await tx.select().from(providers).where(eq(providers.id, providerId)).for('update');
      if (!currentProvider) throw notFound();
      const existing = await tx.select().from(providerServiceOfferings).where(eq(providerServiceOfferings.providerId, providerId));
      await tx.delete(providerServiceOfferings).where(and(eq(providerServiceOfferings.providerId, providerId), notInArray(providerServiceOfferings.categoryId, ids)));
      for (const service of request.services) {
        const metadata = { ...objectValue(existing.find(row => row.categoryId === service.categoryId)?.metadata), description: service.description, durationMinutes: service.durationMinutes, modes: [...new Set(service.modes)], available: service.available };
        await tx.insert(providerServiceOfferings).values({ providerId, categoryId: service.categoryId, pricingStartsAt: service.price, metadata }).onConflictDoUpdate({ target: [providerServiceOfferings.providerId, providerServiceOfferings.categoryId], set: { pricingStartsAt: service.price, metadata } });
      }
      const fields = businessPublicFields(currentProvider);
      const modes = request.services.filter(s => s.available).flatMap(s => s.modes);
      await tx.update(providers).set({ publicProfile: { ...fields.pp, common: { ...fields.common, services: { ...fields.services, atLocation: modes.includes('center'), homeVisit: modes.includes('home'), online: modes.includes('online') } } }, updatedAt: new Date() }).where(eq(providers.id, providerId));
    });
    return this.getProfile(providerId, userId);
  }

  async analytics(providerId: string, userId: string): Promise<BusinessAnalytics> {
    await this.requireManager(providerId, userId, true);
    const [totals] = await db.select({ totalBookings: sql<number>`count(*)::int`, upcomingBookings: sql<number>`count(*) FILTER (WHERE status IN ('pending','confirmed','reschedule_requested') AND starts_at >= now())::int`, completedBookings: sql<number>`count(*) FILTER (WHERE status = 'completed')::int`, paidRevenue: sql<string>`COALESCE(sum(amount) FILTER (WHERE payment_status = 'paid'),0)` }).from(bookings).where(eq(bookings.providerId, providerId));
    const [reviews] = await db.select({ count: sql<number>`count(*)::int`, average: sql<string | null>`avg(${businessReviews.rating})` }).from(businessReviews).where(eq(businessReviews.providerId, providerId));
    return { totalBookings: totals?.totalBookings ?? 0, upcomingBookings: totals?.upcomingBookings ?? 0, completedBookings: totals?.completedBookings ?? 0, paidRevenue: Number(totals?.paidRevenue ?? 0), totalReviews: reviews?.count ?? 0, averageRating: reviews?.average == null ? null : Number(reviews.average), profileViews: null };
  }
}

export const businessProfileService = new BusinessProfileService();
