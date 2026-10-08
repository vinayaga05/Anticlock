import { and, asc, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import type {
  MarketplaceProviderCard,
  MarketplaceProviderListQuery,
  ProviderBusinessDetail,
  ProviderBusinessSummary,
  UpdateProviderBusinessRequest,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  bookings,
  mobileUsers,
  providerMemberships,
  providerServiceOfferings,
  providers,
  serviceCategories,
} from '../db/schema.js';

type ProviderRow = typeof providers.$inferSelect;

const ACTIVE_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'provider_assigned',
  'on_the_way',
  'in_progress',
];
const MANAGE_ROLES = new Set(['owner', 'admin']);

function appError(message: string, code: string, status: 400 | 403 | 404 | 409) {
  return Object.assign(new Error(message), { code, status });
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function httpUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
}

/** Public-safe view of a provider's stored profile (never KYC data). */
export function publicProfileView(row: Pick<ProviderRow, 'publicProfile'>) {
  const pp = obj(row.publicProfile);
  const common = obj(pp.common);
  const basic = obj(common.basic);
  const location = obj(common.location);
  const profile = obj(common.profile);
  const availability = obj(common.availability);
  const services = obj(common.services);
  const modes: Array<'center' | 'home' | 'online'> = [];
  if (services.atLocation === true) modes.push('center');
  if (services.homeVisit === true) modes.push('home');
  if (services.online === true) modes.push('online');
  const coverUrls = Array.isArray(pp.coverUrls) ? pp.coverUrls : [];
  return {
    description: str(profile.description),
    contactPerson: str(basic.contactPerson),
    mobile: str(basic.mobile),
    email: str(basic.email),
    address: str(location.address),
    city: str(location.city),
    area: str(location.area),
    pricingStartsAt: num(services.pricingStartsAt),
    workingDays: Array.isArray(availability.workingDays)
      ? availability.workingDays.filter((d): d is string => typeof d === 'string')
      : [],
    openingTime: str(availability.openingTime),
    closingTime: str(availability.closingTime),
    modes: modes.length ? modes : (['center'] as Array<'center' | 'home' | 'online'>),
    avatarUrl: httpUrl(pp.avatarUrl) ?? httpUrl(basic.logoUrl),
    coverUrl: httpUrl(coverUrls[0]),
  };
}

async function loadOfferings(providerIds: string[]) {
  if (!providerIds.length) return [];
  return db
    .select({
      providerId: providerServiceOfferings.providerId,
      categoryId: providerServiceOfferings.categoryId,
      pricingStartsAt: providerServiceOfferings.pricingStartsAt,
      name: serviceCategories.name,
      treeId: serviceCategories.treeId,
      actionType: serviceCategories.actionType,
    })
    .from(providerServiceOfferings)
    .innerJoin(serviceCategories, eq(providerServiceOfferings.categoryId, serviceCategories.id))
    .where(inArray(providerServiceOfferings.providerId, providerIds))
    .orderBy(asc(providerServiceOfferings.createdAt));
}

function toCard(
  row: ProviderRow,
  offerings: Awaited<ReturnType<typeof loadOfferings>>,
): MarketplaceProviderCard {
  const view = publicProfileView(row);
  const mine = offerings.filter(o => o.providerId === row.id);
  const offeringPrices = mine
    .map(o => o.pricingStartsAt)
    .filter((p): p is number => typeof p === 'number');
  return {
    id: row.id,
    name: row.name,
    providerKind: row.providerKind as MarketplaceProviderCard['providerKind'],
    categoryIds: mine.map(o => o.categoryId),
    categories: mine.map(o => ({
      id: o.categoryId,
      name: o.name,
      treeId: o.treeId,
      actionType: o.actionType ?? null,
    })),
    city: view.city,
    area: view.area,
    description: view.description,
    priceFrom: view.pricingStartsAt ?? (offeringPrices.length ? Math.min(...offeringPrices) : null),
    avatarUrl: view.avatarUrl,
    coverUrl: view.coverUrl,
    modes: view.modes,
    workingDays: view.workingDays,
    openingTime: view.openingTime,
    closingTime: view.closingTime,
    // Business profiles only exist after an approved application.
    verified: true,
    createdAt: row.createdAt.toISOString(),
  };
}

export class ProviderBusinessService {
  /**
   * Approved, active businesses with at least one service, for marketplace
   * search and category listings. Inactive owners are excluded.
   */
  async listMarketplaceProviders(
    query: MarketplaceProviderListQuery,
  ): Promise<{ data: MarketplaceProviderCard[]; nextOffset: number | null }> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const conditions: SQL[] = [
      eq(providers.status, 'active'),
      eq(mobileUsers.isActive, true),
      sql`EXISTS (SELECT 1 FROM provider_service_offerings o WHERE o.provider_id = ${providers.id})`,
    ];
    if (query.categoryId) {
      const prefix = `${query.categoryId}.%`;
      conditions.push(sql`EXISTS (
        SELECT 1 FROM provider_service_offerings o
        WHERE o.provider_id = ${providers.id}
          AND (o.category_id = ${query.categoryId} OR o.category_id LIKE ${prefix})
      )`);
    }
    if (query.treeId) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM provider_service_offerings o
        JOIN service_categories c ON c.id = o.category_id
        WHERE o.provider_id = ${providers.id} AND c.tree_id = ${query.treeId}
      )`);
    }
    if (query.city?.trim()) {
      conditions.push(
        sql`(${providers.publicProfile} -> 'common' -> 'location' ->> 'city') ILIKE ${query.city.trim()}`,
      );
    }
    const q = query.q?.trim();
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`;
      conditions.push(sql`(
        ${providers.name} ILIKE ${like}
        OR (${providers.publicProfile} -> 'common' -> 'location' ->> 'city') ILIKE ${like}
        OR (${providers.publicProfile} -> 'common' -> 'location' ->> 'area') ILIKE ${like}
        OR (${providers.publicProfile} -> 'common' -> 'profile' ->> 'description') ILIKE ${like}
        OR EXISTS (
          SELECT 1 FROM provider_service_offerings o
          JOIN service_categories c ON c.id = o.category_id
          WHERE o.provider_id = ${providers.id} AND (c.name ILIKE ${like} OR c.id ILIKE ${like})
        )
      )`);
    }

    const rows = await db
      .select({ provider: providers })
      .from(providers)
      .innerJoin(mobileUsers, eq(providers.mobileUserId, mobileUsers.id))
      .where(and(...conditions))
      .orderBy(desc(providers.createdAt), asc(providers.id))
      .limit(limit + 1)
      .offset(offset);

    const page = rows.slice(0, limit).map(r => r.provider);
    const offerings = await loadOfferings(page.map(p => p.id));
    return {
      data: page.map(p => toCard(p, offerings)),
      nextOffset: rows.length > limit ? offset + limit : null,
    };
  }

  async getMarketplaceProvider(providerId: string): Promise<MarketplaceProviderCard> {
    if (!/^[0-9a-f-]{36}$/i.test(providerId)) {
      throw appError('Provider not found', 'not_found', 404);
    }
    const [row] = await db
      .select({ provider: providers })
      .from(providers)
      .innerJoin(mobileUsers, eq(providers.mobileUserId, mobileUsers.id))
      .where(
        and(
          eq(providers.id, providerId),
          eq(providers.status, 'active'),
          eq(mobileUsers.isActive, true),
        ),
      )
      .limit(1);
    if (!row) throw appError('Provider not found', 'not_found', 404);
    return toCard(row.provider, await loadOfferings([providerId]));
  }

  /** Throws 404 unless the user is a member of an active business. */
  private async requireMembership(mobileUserId: string, providerId: string, manage = false) {
    if (!/^[0-9a-f-]{36}$/i.test(providerId)) {
      throw appError('Business not found', 'not_found', 404);
    }
    const [row] = await db
      .select({ provider: providers, role: providerMemberships.role })
      .from(providerMemberships)
      .innerJoin(providers, eq(providerMemberships.providerId, providers.id))
      .where(
        and(
          eq(providerMemberships.mobileUserId, mobileUserId),
          eq(providerMemberships.providerId, providerId),
        ),
      )
      .limit(1);
    if (!row) throw appError('Business not found', 'not_found', 404);
    if (manage && !MANAGE_ROLES.has(row.role)) {
      throw appError('Only owners and admins can edit this business', 'forbidden', 403);
    }
    return row;
  }

  private async bookingCounts(providerIds: string[]) {
    if (!providerIds.length) return new Map<string, { total: number; upcoming: number }>();
    const rows = await db
      .select({
        providerId: bookings.providerId,
        total: sql<number>`count(*)::int`,
        upcoming: sql<number>`count(*) FILTER (WHERE ${bookings.startsAt} >= now() AND ${bookings.status} IN ('pending','confirmed','provider_assigned','on_the_way','in_progress'))::int`,
      })
      .from(bookings)
      .where(inArray(bookings.providerId, providerIds))
      .groupBy(bookings.providerId);
    return new Map(rows.map(r => [r.providerId!, { total: r.total, upcoming: r.upcoming }]));
  }

  private toSummary(
    row: ProviderRow,
    role: string,
    offerings: Awaited<ReturnType<typeof loadOfferings>>,
    counts: Map<string, { total: number; upcoming: number }>,
  ): ProviderBusinessSummary {
    const mine = offerings.filter(o => o.providerId === row.id);
    const c = counts.get(row.id) ?? { total: 0, upcoming: 0 };
    return {
      id: row.id,
      name: row.name,
      providerKind: row.providerKind as ProviderBusinessSummary['providerKind'],
      status: row.status,
      role,
      applicationId: row.sourceApplicationId ?? null,
      avatarUrl: publicProfileView(row).avatarUrl,
      categories: mine.map(o => ({ id: o.categoryId, name: o.name, treeId: o.treeId })),
      counts: { services: mine.length, upcomingBookings: c.upcoming, totalBookings: c.total },
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listMyBusinesses(mobileUserId: string): Promise<ProviderBusinessSummary[]> {
    const rows = await db
      .select({ provider: providers, role: providerMemberships.role })
      .from(providerMemberships)
      .innerJoin(providers, eq(providerMemberships.providerId, providers.id))
      .where(eq(providerMemberships.mobileUserId, mobileUserId))
      .orderBy(asc(providers.createdAt));
    const ids = rows.map(r => r.provider.id);
    const [offerings, counts] = await Promise.all([loadOfferings(ids), this.bookingCounts(ids)]);
    return rows.map(r => this.toSummary(r.provider, r.role, offerings, counts));
  }

  async getMyBusiness(mobileUserId: string, providerId: string): Promise<ProviderBusinessDetail> {
    const { provider, role } = await this.requireMembership(mobileUserId, providerId);
    const [offerings, counts] = await Promise.all([
      loadOfferings([providerId]),
      this.bookingCounts([providerId]),
    ]);
    const upcoming = await db
      .select({ booking: bookings, customerName: mobileUsers.displayName })
      .from(bookings)
      .innerJoin(mobileUsers, eq(bookings.mobileUserId, mobileUsers.id))
      .where(
        and(
          eq(bookings.providerId, providerId),
          gte(bookings.startsAt, new Date()),
          inArray(bookings.status, ACTIVE_BOOKING_STATUSES),
        ),
      )
      .orderBy(asc(bookings.startsAt))
      .limit(20);
    const view = publicProfileView(provider);
    return {
      ...this.toSummary(provider, role, offerings, counts),
      profile: {
        description: view.description,
        contactPerson: view.contactPerson,
        mobile: view.mobile,
        email: view.email,
        address: view.address,
        city: view.city,
        area: view.area,
        pricingStartsAt: view.pricingStartsAt,
        workingDays: view.workingDays,
        openingTime: view.openingTime,
        closingTime: view.closingTime,
        modes: view.modes,
      },
      services: offerings.map(o => ({
        categoryId: o.categoryId,
        name: o.name,
        pricingStartsAt: o.pricingStartsAt ?? null,
      })),
      upcomingBookings: upcoming.map(({ booking, customerName }) => ({
        id: booking.id,
        status: booking.status,
        serviceTitle: str(obj(booking.detail).serviceTitle) ?? 'Booking',
        customerName: customerName ?? 'Customer',
        startsAt: booking.startsAt.toISOString(),
        serviceMode: booking.serviceMode,
        amount: booking.amount ?? null,
      })),
    };
  }

  async updateMyBusiness(
    mobileUserId: string,
    providerId: string,
    body: UpdateProviderBusinessRequest,
  ): Promise<ProviderBusinessDetail> {
    const { provider } = await this.requireMembership(mobileUserId, providerId, true);
    const pp = obj(provider.publicProfile);
    const common = obj(pp.common);
    const basic = { ...obj(common.basic) };
    const profile = { ...obj(common.profile) };
    const services = { ...obj(common.services) };
    const availability = { ...obj(common.availability) };
    if (body.description !== undefined) profile.description = body.description;
    if (body.contactPerson !== undefined) basic.contactPerson = body.contactPerson;
    if (body.mobile !== undefined) basic.mobile = body.mobile;
    if (body.email !== undefined) basic.email = body.email;
    if (body.pricingStartsAt !== undefined) services.pricingStartsAt = body.pricingStartsAt;
    if (body.openingTime !== undefined) availability.openingTime = body.openingTime;
    if (body.closingTime !== undefined) availability.closingTime = body.closingTime;

    await db
      .update(providers)
      .set({
        publicProfile: { ...pp, common: { ...common, basic, profile, services, availability } },
        updatedAt: new Date(),
      })
      .where(eq(providers.id, providerId));
    if (body.pricingStartsAt !== undefined) {
      await db
        .update(providerServiceOfferings)
        .set({ pricingStartsAt: Math.round(body.pricingStartsAt) })
        .where(eq(providerServiceOfferings.providerId, providerId));
    }
    return this.getMyBusiness(mobileUserId, providerId);
  }
}

export const providerBusinessService = new ProviderBusinessService();
