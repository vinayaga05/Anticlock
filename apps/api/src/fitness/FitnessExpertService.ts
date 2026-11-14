import {
  CompleteFitnessAssessmentSchema,
  type FitnessBaseline,
} from "@anticlock/contracts";
import { buildFitnessBaseline } from "./FitnessEngine.js";
import {
  approvedFitnessQualifications,
  consultationCanJoin,
  fitnessCategoryKind,
  sharedFitnessProfile,
} from "./fitnessExpertPolicy.js";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import type {
  FitnessConsent,
  FitnessConsentRequest,
  FitnessConsultation,
  FitnessExpert,
  FitnessExpertKind,
  FitnessExpertQuery,
  FitnessPlanContent,
  FitnessPlanRevision,
  FitnessSharingScope,
  FitnessWorkspace,
  FitnessWorkspaceClient,
} from "@anticlock/contracts";
import { db } from "../db/client.js";
import {
  auditLogs,
  bookings,
  fitnessConsultations,
  fitnessPlans,
  fitnessPlanVersions,
  fitnessProfiles,
  progressMedia,
  healthConsents,
  mobileUsers,
  mobileUserBlocks,
  providerApplications,
  providerApplicationServices,
  providerClientRelationships,
  providerMemberships,
  providers,
  providerServiceOfferings,
  serviceCategories,
} from "../db/schema.js";
import { notificationService } from "../notifications/NotificationService.js";
import { profilesAreBlocked } from "../social/ProfileFollowService.js";
import {
  businessProfileService,
  businessPublicFields,
  objectValue,
} from "../provider/BusinessProfileService.js";
import { ApiError } from "../lib/httpError.js";
import { decryptFitnessData, encryptFitnessData } from "./privacy.js";
import { fitnessService } from "./FitnessService.js";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
const ACTIVE_BOOKINGS = ["confirmed", "pending", "reschedule_requested"];
const MANAGERS = ["owner", "admin"];
const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const list = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
        .map((s) => s.trim())
    : text(v)
    ? [text(v)!]
    : [];
function field(data: Record<string, unknown>, key: string) {
  return (
    data[key] ??
    key.split(".").reduce<unknown>((v, k) => objectValue(v)[k], data)
  );
}
const denied = () =>
  new ApiError(
    403,
    "fitness_access_denied",
    "This fitness information is not shared with this expert."
  );

export class FitnessExpertService {
  private async activeUser(userId: string) {
    await businessProfileService.assertActiveUser(userId);
  }
  private async lockClient(userId: string, executor: Executor) {
    const [owner] = await executor
      .select({ id: mobileUsers.id })
      .from(mobileUsers)
      .where(and(eq(mobileUsers.id, userId), eq(mobileUsers.isActive, true)))
      .for("update")
      .limit(1);
    if (!owner)
      throw new ApiError(
        403,
        "account_inactive",
        "An active client account is required."
      );
  }
  private async eligibility(providerId: string, viewerId: string) {
    const provider = await businessProfileService.loadAvailable(
      providerId,
      viewerId
    );
    const [application] = await db
      .select()
      .from(providerApplications)
      .where(
        and(
          eq(providerApplications.id, provider.sourceApplicationId!),
          eq(providerApplications.status, "approved"),
          eq(providerApplications.mobileUserId, provider.mobileUserId),
          eq(providerApplications.providerId, providerId)
        )
      )
      .limit(1);
    const offerings = await db
      .select({ categoryId: providerServiceOfferings.categoryId })
      .from(providerServiceOfferings)
      .innerJoin(
        serviceCategories,
        eq(serviceCategories.id, providerServiceOfferings.categoryId)
      )
      .innerJoin(
        providerApplicationServices,
        and(
          eq(
            providerApplicationServices.applicationId,
            provider.sourceApplicationId!
          ),
          eq(
            providerApplicationServices.categoryId,
            providerServiceOfferings.categoryId
          )
        )
      )
      .where(
        and(
          eq(providerServiceOfferings.providerId, providerId),
          eq(serviceCategories.status, "published")
        )
      );
    const eligible = offerings
      .map((o) => ({
        categoryId: o.categoryId,
        kind: fitnessCategoryKind(o.categoryId),
      }))
      .find(
        (o) =>
          o.kind &&
          approvedFitnessQualifications(o.kind, application?.dynamicPayload)
            .length
      );
    if (!application || !eligible?.kind)
      throw new ApiError(
        404,
        "expert_not_found",
        "Approved fitness expert not found."
      );
    return { provider, kind: eligible.kind, application };
  }
  private async manager(userId: string, providerId: string) {
    const result = await this.eligibility(providerId, userId);
    if (result.provider.mobileUserId !== userId) {
      const [member] = await db
        .select()
        .from(providerMemberships)
        .where(
          and(
            eq(providerMemberships.providerId, providerId),
            eq(providerMemberships.mobileUserId, userId),
            inArray(providerMemberships.role, MANAGERS)
          )
        )
        .limit(1);
      if (!member) throw denied();
    }
    return result;
  }
  private async relationship(
    userId: string,
    providerId: string,
    executor: Executor = db
  ) {
    const [relationship] = await executor
      .select()
      .from(providerClientRelationships)
      .where(
        and(
          eq(providerClientRelationships.userId, userId),
          eq(providerClientRelationships.providerId, providerId),
          eq(providerClientRelationships.status, "active")
        )
      )
      .limit(1);
    // Revoked relationship suppresses stale bookings until the client explicitly shares again.
    const [revoked] = await executor
      .select({ id: providerClientRelationships.id })
      .from(providerClientRelationships)
      .where(
        and(
          eq(providerClientRelationships.userId, userId),
          eq(providerClientRelationships.providerId, providerId),
          eq(providerClientRelationships.status, "revoked")
        )
      )
      .limit(1);
    if (revoked && !relationship) throw denied();
    if (relationship && !relationship.bookingId) return relationship;
    const [booking] = await executor
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.mobileUserId, userId),
          eq(bookings.providerId, providerId),
          inArray(bookings.status, ACTIVE_BOOKINGS)
        )
      )
      .orderBy(desc(bookings.createdAt))
      .limit(1);
    if (!booking) throw denied();
    return relationship ?? { bookingId: booking.id };
  }
  async listExperts(userId: string, query: FitnessExpertQuery) {
    await this.activeUser(userId);
    // All filter predicates execute before pagination. Do not broaden to unapproved legacy providers.
    const rows = await db
      .select({
        provider: providers,
        application: providerApplications,
        category: serviceCategories,
        offering: providerServiceOfferings,
      })
      .from(providers)
      .innerJoin(mobileUsers, eq(providers.mobileUserId, mobileUsers.id))
      .innerJoin(
        providerApplications,
        and(
          eq(providers.sourceApplicationId, providerApplications.id),
          eq(providerApplications.mobileUserId, providers.mobileUserId),
          eq(providerApplications.providerId, providers.id)
        )
      )
      .innerJoin(
        providerServiceOfferings,
        eq(providerServiceOfferings.providerId, providers.id)
      )
      .innerJoin(
        serviceCategories,
        eq(providerServiceOfferings.categoryId, serviceCategories.id)
      )
      .innerJoin(
        providerApplicationServices,
        and(
          eq(
            providerApplicationServices.applicationId,
            providerApplications.id
          ),
          eq(
            providerApplicationServices.categoryId,
            providerServiceOfferings.categoryId
          )
        )
      )
      .where(
        and(
          eq(providers.status, "active"),
          eq(mobileUsers.isActive, true),
          eq(providerApplications.status, "approved"),
          eq(serviceCategories.status, "published")
        )
      )
      .orderBy(asc(providers.name), asc(providers.id));
    const cards: FitnessExpert[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.provider.id)) continue;
      const kind = fitnessCategoryKind(row.category.id);
      if (!kind || (query.kind && query.kind !== kind)) continue;
      const qualifications = approvedFitnessQualifications(
        kind,
        row.application.dynamicPayload
      );
      if (!qualifications.length) continue;
      const fields = businessPublicFields(row.provider),
        dynamic = objectValue(row.application.dynamicPayload);
      const specialities = [
        ...new Set([
          ...list(
            field(
              dynamic,
              kind === "trainer" ? "trainer.expertise" : "nutrition.speciality"
            )
          ),
          ...list(field(dynamic, "medical.speciality")),
          row.category.name,
        ]),
      ];
      const location = [text(fields.location.city), text(fields.location.area)]
        .filter(Boolean)
        .join(" ");
      const price = row.offering.pricingStartsAt;
      if (
        query.speciality &&
        !specialities.some((s) =>
          s.toLowerCase().includes(query.speciality!.toLowerCase())
        )
      )
        continue;
      if (
        query.language &&
        !fields.languages.some(
          (s) => s.toLowerCase() === query.language!.toLowerCase()
        )
      )
        continue;
      if (query.mode && !fields.modes.includes(query.mode)) continue;
      if (
        query.location &&
        !location.toLowerCase().includes(query.location.toLowerCase())
      )
        continue;
      if (
        query.maxPrice !== undefined &&
        (price === null || price > query.maxPrice)
      )
        continue;
      try {
        const business = await businessProfileService.getProfile(
          row.provider.id,
          userId
        );
        if (
          query.minRating !== undefined &&
          (business.rating.average === null ||
            business.rating.average < query.minRating)
        )
          continue;
        let available =
          !fields.temporarilyUnavailable &&
          business.services.some((s) => s.available);
        let nextAvailableAt = business.availability.nextAvailableAt;
        if (query.date) {
          const service = business.services.find(
              (s) => s.categoryId === row.category.id && s.available
            ),
            mode = query.mode ?? service?.modes[0];
          if (!service || !mode) available = false;
          else {
            const result = await businessProfileService.availability(
              row.provider.id,
              {
                date: query.date,
                categoryId: row.category.id,
                serviceMode: mode,
              },
              userId
            );
            const slot = result.slots.find((s) => s.available);
            available = Boolean(slot);
            nextAvailableAt = slot?.startsAt ?? null;
          }
        }
        if (
          (query.available === "true" && !available) ||
          (query.available === "false" && available)
        )
          continue;
        cards.push({
          id: row.provider.id,
          name: row.provider.name,
          kind,
          categoryId: row.category.id,
          categoryLabel: row.category.name,
          qualifications,
          qualificationSource: "approved_application",
          approvedAt: row.application.reviewedAt?.toISOString() ?? null,
          specialities,
          languages: fields.languages,
          modes: fields.modes,
          priceFrom: price,
          rating: business.rating.average,
          reviewCount: business.rating.count,
          city: text(fields.location.city),
          area: text(fields.location.area),
          avatarUrl: business.avatarUrl,
          available,
          nextAvailableAt,
        });
        seen.add(row.provider.id);
      } catch (error) {
        if (!(error instanceof ApiError && [403, 404].includes(error.status)))
          throw error;
      }
    }
    return {
      experts: cards.slice(query.offset, query.offset + query.limit),
      nextOffset:
        cards.length > query.offset + query.limit
          ? query.offset + query.limit
          : null,
    };
  }
  async listConsents(userId: string): Promise<{ consents: FitnessConsent[] }> {
    await this.activeUser(userId);
    const rows = await db
      .select({ consent: healthConsents, name: providers.name })
      .from(healthConsents)
      .innerJoin(providers, eq(healthConsents.providerId, providers.id))
      .where(eq(healthConsents.userId, userId))
      .orderBy(desc(healthConsents.updatedAt));
    return {
      consents: rows.map(({ consent: c, name }) => ({
        id: c.id,
        providerId: c.providerId,
        providerName: name,
        scopes: c.scopes as FitnessSharingScope[],
        resourceIds: c.resourceIds,
        status: c.status as "active" | "revoked",
        grantedAt: c.grantedAt.toISOString(),
        revokedAt: c.revokedAt?.toISOString() ?? null,
      })),
    };
  }
  async shareChoices(userId: string) {
    await this.activeUser(userId);
    return { choices: await fitnessService.listSharedResourceChoices(userId) };
  }
  async setConsent(
    userId: string,
    providerId: string,
    input: FitnessConsentRequest
  ) {
    const { provider } = await this.eligibility(providerId, userId);
    if (provider.mobileUserId === userId)
      throw new ApiError(400, "self_consent", "Choose another expert.");
    // Explicit consent can establish an assignment only for a real active booking.
    const [booking] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.mobileUserId, userId),
          eq(bookings.providerId, providerId),
          inArray(bookings.status, ACTIVE_BOOKINGS)
        )
      )
      .orderBy(desc(bookings.createdAt))
      .limit(1);
    if (!booking)
      throw new ApiError(
        403,
        "booking_required",
        "Book this expert before sharing fitness information."
      );
    const choices = await fitnessService.listSharedResourceChoices(userId);
    for (const id of input.resourceIds)
      if (
        !choices.some(
          (choice) =>
            choice.id === id &&
            input.scopes.includes(choice.scope as FitnessSharingScope)
        )
      )
        throw new ApiError(
          400,
          "invalid_shared_resource",
          "Choose only your own saved logs or media for the selected permissions."
        );
    const now = new Date();
    await db.transaction(async (tx) => {
      await this.lockClient(userId, tx);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${providerId}))`
      );
      await tx
        .update(healthConsents)
        .set({ status: "revoked", revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(healthConsents.userId, userId),
            eq(healthConsents.providerId, providerId),
            eq(healthConsents.status, "active")
          )
        );
      await tx
        .insert(healthConsents)
        .values({
          userId,
          providerId,
          scopes: [...new Set(input.scopes)],
          resourceIds: [...new Set(input.resourceIds)],
          status: "active",
          grantedAt: now,
          updatedAt: now,
        });
      const [existing] = await tx
        .select()
        .from(providerClientRelationships)
        .where(
          and(
            eq(providerClientRelationships.userId, userId),
            eq(providerClientRelationships.providerId, providerId)
          )
        )
        .limit(1);
      if (existing)
        await tx
          .update(providerClientRelationships)
          .set({ status: "active", bookingId: booking.id, updatedAt: now })
          .where(eq(providerClientRelationships.id, existing.id));
      else
        await tx
          .insert(providerClientRelationships)
          .values({
            userId,
            providerId,
            bookingId: booking.id,
            status: "active",
          });
      await tx
        .insert(auditLogs)
        .values({
          actorId: userId,
          action: "fitness.consent.granted",
          entityType: "fitness_provider",
          entityId: providerId,
          metadata: {
            scopes: input.scopes,
            resourceCount: input.resourceIds.length,
          },
        });
    });
    await notificationService
      .notifyUser(provider.mobileUserId, {
        type: "fitness_support_requested",
        title: "Fitness update shared",
        body: "A client chose to share an update with you. Open your workspace to review it.",
        data: {
          kind: "fitness",
          screen: "FitnessWorkspace",
          providerId,
          clientId: userId,
          resourceType: input.scopes[0],
          resourceId: input.resourceIds[0] ?? null,
        },
      })
      .catch(() => undefined);
    return this.listConsents(userId);
  }
  async revokeConsent(userId: string, providerId: string) {
    await this.activeUser(userId);
    const now = new Date();
    await db.transaction(async (tx) => {
      await this.lockClient(userId, tx);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${providerId}))`
      );
      await tx
        .update(healthConsents)
        .set({ status: "revoked", revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(healthConsents.userId, userId),
            eq(healthConsents.providerId, providerId)
          )
        );
      await tx
        .update(providerClientRelationships)
        .set({ status: "revoked", updatedAt: now })
        .where(
          and(
            eq(providerClientRelationships.userId, userId),
            eq(providerClientRelationships.providerId, providerId)
          )
        );
      await tx
        .insert(auditLogs)
        .values({
          actorId: userId,
          action: "fitness.consent.revoked",
          entityType: "fitness_provider",
          entityId: providerId,
        });
    });
    return { ok: true };
  }
  private async assertClientNotBlocked(actorId: string, clientId: string) {
    if (
      await profilesAreBlocked(
        { id: actorId, type: "personal" },
        { id: clientId, type: "personal" }
      )
    )
      throw denied();
    const [block] = await db
      .select({ id: mobileUserBlocks.id })
      .from(mobileUserBlocks)
      .where(
        sql`(${mobileUserBlocks.blockerMobileUserId}=${actorId} AND ${mobileUserBlocks.blockedMobileUserId}=${clientId}) OR (${mobileUserBlocks.blockerMobileUserId}=${clientId} AND ${mobileUserBlocks.blockedMobileUserId}=${actorId})`
      )
      .limit(1);
    if (block) throw denied();
  }
  async assertResourceAccess(
    actorUserId: string,
    ownerUserId: string,
    scope: FitnessSharingScope,
    resourceId?: string,
    providerId?: string
  ) {
    await this.activeUser(actorUserId);
    if (actorUserId === ownerUserId) return;
    await this.assertClientNotBlocked(actorUserId, ownerUserId);
    const owned = providerId
      ? [{ id: providerId }]
      : await this.ownedProviderIds(actorUserId);
    for (const p of owned) {
      try {
        await this.manager(actorUserId, p.id);
        await this.eligibility(p.id, ownerUserId);
        await this.relationship(ownerUserId, p.id);
        const consent = await this.activeConsent(ownerUserId, p.id);
        if (
          consent.scopes.includes(scope) &&
          (["profile", "goals", "health", "plan_write"].includes(scope) ||
            (resourceId && consent.resourceIds.includes(resourceId)))
        )
          return;
      } catch (error) {
        if (!(error instanceof ApiError && [403, 404].includes(error.status)))
          throw error;
      }
    }
    throw denied();
  }
  private async activeConsent(
    userId: string,
    providerId: string,
    executor: Executor = db
  ) {
    const [consent] = await executor
      .select()
      .from(healthConsents)
      .where(
        and(
          eq(healthConsents.userId, userId),
          eq(healthConsents.providerId, providerId),
          eq(healthConsents.status, "active")
        )
      )
      .orderBy(desc(healthConsents.grantedAt))
      .limit(1);
    if (!consent || consent.revokedAt) throw denied();
    return consent;
  }
  private ownedProviderIds(userId: string) {
    return db
      .select({ id: providers.id })
      .from(providers)
      .where(
        sql`${providers.mobileUserId} = ${userId} OR EXISTS (SELECT 1 FROM provider_memberships m WHERE m.provider_id=${providers.id} AND m.mobile_user_id=${userId} AND m.role IN ('owner','admin'))`
      );
  }
  async workspace(userId: string): Promise<FitnessWorkspace> {
    await this.activeUser(userId);
    const result: FitnessWorkspace = {
      providers: [],
      clients: [],
      consultations: [],
    };
    for (const owned of await this.ownedProviderIds(userId)) {
      let eligible;
      try {
        eligible = await this.manager(userId, owned.id);
      } catch (error) {
        if (error instanceof ApiError && [403, 404].includes(error.status))
          continue;
        throw error;
      }
      result.providers.push({
        id: owned.id,
        name: eligible.provider.name,
        kind: eligible.kind,
        canPublish: true,
      });
      const clientIds = await db
        .select({ id: healthConsents.userId })
        .from(healthConsents)
        .where(
          and(
            eq(healthConsents.providerId, owned.id),
            eq(healthConsents.status, "active")
          )
        );
      for (const row of clientIds) {
        try {
          const detail = await this.client(userId, owned.id, row.id);
          result.clients.push({
            ...detail.client,
            providerId: owned.id,
          } as FitnessWorkspaceClient);
        } catch (error) {
          if (!(error instanceof ApiError && [403, 404].includes(error.status)))
            throw error;
        }
      }
    }
    result.consultations = await this.consultations(userId, true);
    return result;
  }
  async client(actorId: string, providerId: string, clientId: string) {
    await this.manager(actorId, providerId);
    await this.assertClientNotBlocked(actorId, clientId);
    await this.eligibility(providerId, clientId);
    await this.relationship(clientId, providerId);
    const consent = await this.activeConsent(clientId, providerId);
    const [user] = await db
      .select({ displayName: mobileUsers.displayName })
      .from(mobileUsers)
      .where(and(eq(mobileUsers.id, clientId), eq(mobileUsers.isActive, true)))
      .limit(1);
    if (!user) throw denied();
    const scopes = consent.scopes as FitnessSharingScope[];
    const shared: Array<{
      scope: FitnessSharingScope;
      id: string | null;
      data: unknown;
    }> = [];
    for (const scope of ["profile", "goals", "health"] as FitnessSharingScope[])
      if (scopes.includes(scope))
        shared.push({
          scope,
          id: null,
          data: sharedFitnessProfile(
            await fitnessService.readSharedResource(clientId, "profile"),
            scope
          ),
        });
    const choices = await fitnessService.listSharedResourceChoices(clientId);
    for (const choice of choices)
      if (
        consent.resourceIds.includes(choice.id) &&
        scopes.includes(choice.scope as FitnessSharingScope)
      )
        shared.push({
          scope: choice.scope as FitnessSharingScope,
          id: choice.id,
          data:
            choice.scope === "media"
              ? { id: choice.id, label: choice.label, date: choice.date }
              : await fitnessService.readSharedResource(
                  clientId,
                  choice.scope,
                  choice.id
                ),
        });
    // Plan content is returned only with the explicit plan-write permission.
    const [plan] = scopes.includes("plan_write")
      ? await db
          .select()
          .from(fitnessPlans)
          .where(
            and(
              eq(fitnessPlans.userId, clientId),
              eq(fitnessPlans.status, "active")
            )
          )
          .orderBy(desc(fitnessPlans.updatedAt))
          .limit(1)
      : [];
    let content: FitnessPlanContent | null = null;
    if (plan) {
      const [version] = await db
        .select()
        .from(fitnessPlanVersions)
        .where(
          and(
            eq(fitnessPlanVersions.planId, plan.id),
            eq(fitnessPlanVersions.version, plan.currentVersion)
          )
        )
        .limit(1);
      if (version)
        content = decryptFitnessData<FitnessPlanContent>(
          clientId,
          version.encryptedData
        );
    }
    return {
      client: {
        providerId,
        userId: clientId,
        displayName: user.displayName,
        scopes,
        resourceIds: consent.resourceIds,
        plan: plan
          ? {
              id: plan.id,
              title: content?.name ?? "Fitness plan",
              version: plan.currentVersion,
            }
          : null,
      },
      shared,
      plan: content,
    };
  }
  async revisePlan(
    actorId: string,
    providerId: string,
    clientId: string,
    planId: string,
    input: FitnessPlanRevision
  ) {
    const expert = await this.manager(actorId, providerId);
    await this.assertClientNotBlocked(actorId, clientId);
    await this.eligibility(providerId, clientId);
    // Training and nutrition roles are distinct; neither gains the other's professional permissions.
    if (expert.kind === "trainer" && input.nutrition)
      throw new ApiError(
        403,
        "nutritionist_required",
        "A nutritionist must revise nutrition guidance."
      );
    if (expert.kind === "nutritionist" && input.workouts)
      throw new ApiError(
        403,
        "trainer_required",
        "A trainer must revise workouts."
      );
    let savedVersion = 0;
    await db.transaction(async (tx) => {
      await this.lockClient(clientId, tx);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${clientId}), hashtext(${providerId}))`
      );
      await this.relationship(clientId, providerId, tx);
      const consent = await this.activeConsent(clientId, providerId, tx);
      if (!consent.scopes.includes("plan_write")) throw denied();
      const [plan] = await tx
        .select()
        .from(fitnessPlans)
        .where(
          and(
            eq(fitnessPlans.id, planId),
            eq(fitnessPlans.userId, clientId),
            eq(fitnessPlans.status, "active")
          )
        )
        .for("update")
        .limit(1);
      if (!plan)
        throw new ApiError(
          404,
          "plan_not_found",
          "Active client plan not found."
        );
      if (plan.currentVersion !== input.expectedVersion)
        throw new ApiError(
          409,
          "plan_version_conflict",
          "This plan changed. Reload the latest version before saving."
        );
      const [prior] = await tx
        .select()
        .from(fitnessPlanVersions)
        .where(
          and(
            eq(fitnessPlanVersions.planId, planId),
            eq(fitnessPlanVersions.version, plan.currentVersion)
          )
        )
        .limit(1);
      if (!prior)
        throw new ApiError(
          409,
          "plan_version_missing",
          "The current plan version is unavailable."
        );
      const previous = decryptFitnessData<FitnessPlanContent>(
        clientId,
        prior.encryptedData
      );
      const [profile] = await tx
        .select()
        .from(fitnessProfiles)
        .where(eq(fitnessProfiles.userId, clientId))
        .limit(1);
      if (!profile || profile.status !== "complete")
        throw new ApiError(
          409,
          "assessment_review_required",
          "Your client needs to complete or review their assessment before plan revisions."
        );
      const payload = decryptFitnessData<{
        assessment: unknown;
        baseline: FitnessBaseline | null;
      }>(clientId, profile.encryptedData);
      const assessment = CompleteFitnessAssessmentSchema.safeParse(
        payload.assessment
      );
      if (!assessment.success)
        throw new ApiError(
          409,
          "assessment_review_required",
          "Your client needs to complete or review their assessment before plan revisions."
        );
      let currentBaseline: FitnessBaseline;
      try {
        currentBaseline = buildFitnessBaseline(assessment.data);
      } catch (error) {
        if (error instanceof ApiError && error.code === "invalid_target_date")
          throw new ApiError(
            409,
            "assessment_update_required",
            "Your client needs to review their assessment before further plan revisions."
          );
        throw error;
      }
      const requiresProfessionalReview =
        previous.requiresProfessionalReview ||
        currentBaseline.requiresProfessionalReview ||
        payload.baseline?.requiresProfessionalReview === true;
      if (
        requiresProfessionalReview &&
        (!previous.requiresProfessionalReview ||
          previous.workouts.length > 0 ||
          previous.nutrition.calories !== null ||
          Object.keys(previous.nutrition.targets ?? {}).length > 0)
      )
        throw new ApiError(
          409,
          "fresh_plan_required",
          "Your client needs to review their assessment and save a fresh wellness plan before further revisions."
        );
      if (
        requiresProfessionalReview &&
        (input.nutrition?.calories ||
          Object.keys(input.nutrition?.targets ?? {}).length > 0 ||
          input.workouts)
      )
        throw new ApiError(
          422,
          "clinical_review_required",
          "This assessment needs a clinical review. Calorie and exercise prescriptions remain unavailable."
        );
      if (input.workouts) {
        const refs = [
          ...new Set(
            input.workouts.flatMap((day) =>
              day.exercises.flatMap((exercise) =>
                exercise.mediaId ? [exercise.mediaId] : []
              )
            )
          ),
        ];
        if (refs.length) {
          const owned = await tx
            .select({ id: progressMedia.id })
            .from(progressMedia)
            .where(
              and(
                eq(progressMedia.userId, clientId),
                eq(progressMedia.status, "ready"),
                isNull(progressMedia.deletedAt),
                inArray(progressMedia.id, refs)
              )
            );
          const existingRefs = new Set(
            previous.workouts.flatMap((day) =>
              day.exercises.flatMap((exercise) =>
                exercise.mediaId ? [exercise.mediaId] : []
              )
            )
          );
          if (
            owned.length !== refs.length ||
            refs.some(
              (id) =>
                !existingRefs.has(id) &&
                (!consent.scopes.includes("media") ||
                  !consent.resourceIds.includes(id))
            )
          )
            throw new ApiError(
              403,
              "exercise_media_unavailable",
              "Use only existing client-owned instruction media that was explicitly shared for this plan."
            );
        }
      }
      const nextTargets = {
        ...previous.nutrition.targets,
        ...input.nutrition?.targets,
      };
      for (const key of input.nutrition?.clearTargets ?? [])
        delete nextTargets[key];
      const nutrition: FitnessPlanContent["nutrition"] = input.nutrition
        ? {
            ...previous.nutrition,
            guidance: input.nutrition.guidance,
            calories: input.nutrition.calories,
            ...(Object.keys(nextTargets).length
              ? { targets: nextTargets }
              : {}),
          }
        : previous.nutrition;
      if (input.nutrition && !Object.keys(nextTargets).length)
        delete nutrition.targets;
      const content: FitnessPlanContent = {
        ...previous,
        requiresProfessionalReview,
        expertFeedback: {
          note: input.note,
          providerId,
          createdAt: new Date().toISOString(),
          version: plan.currentVersion + 1,
        },
        ...(input.title ? { name: input.title } : {}),
        ...(input.workouts ? { workouts: input.workouts } : {}),
        ...(input.nutrition ? { nutrition } : {}),
        ...(input.habits ? { habits: input.habits } : {}),
      };
      const version = plan.currentVersion + 1,
        now = new Date();
      savedVersion = version;
      await tx
        .insert(fitnessPlanVersions)
        .values({
          planId,
          version,
          authorUserId: actorId,
          authorProviderId: providerId,
          encryptedData: encryptFitnessData(clientId, content),
        });
      await tx
        .update(fitnessPlans)
        .set({
          currentVersion: version,
          providerId,
          title: "Fitness plan",
          updatedAt: now,
        })
        .where(eq(fitnessPlans.id, planId));
      await tx
        .insert(auditLogs)
        .values({
          actorId,
          action: "fitness.plan.revised",
          entityType: "fitness_plan",
          entityId: planId,
          metadata: {
            providerId,
            version,
            changedSections: ["workouts", "nutrition", "habits"].filter(
              (key) => key in input
            ),
          },
        });
    });
    await notificationService
      .notifyUser(clientId, {
        type: "fitness_plan_updated",
        title: "Your wellness plan was updated",
        body: "Open Fitness to review the latest guidance from your expert.",
        idempotencyKey: `fitness-plan:${planId}:${savedVersion}`,
        data: {
          kind: "fitness",
          screen: "FitnessPlan",
          planId,
          version: savedVersion,
        },
      })
      .catch(() => undefined);
    return this.client(actorId, providerId, clientId);
  }
  async registerConsultation(
    userId: string,
    bookingId: string,
    mode: "audio" | "video"
  ) {
    await this.activeUser(userId);
    const [booking] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.mobileUserId, userId),
          inArray(bookings.status, ACTIVE_BOOKINGS)
        )
      )
      .limit(1);
    if (!booking?.providerId)
      throw new ApiError(404, "booking_not_found", "Active booking not found.");
    await this.eligibility(booking.providerId, userId);
    await db.transaction(async (tx) => {
      await this.lockClient(userId, tx);
      const [current] = await tx
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.mobileUserId, userId),
            eq(bookings.providerId, booking.providerId!),
            inArray(bookings.status, ACTIVE_BOOKINGS)
          )
        )
        .limit(1);
      if (!current)
        throw new ApiError(
          404,
          "booking_not_found",
          "Active booking not found."
        );
      await tx
        .insert(fitnessConsultations)
        .values({
          userId,
          providerId: booking.providerId!,
          bookingId,
          status: current.status,
          startsAt: current.startsAt,
          endsAt: current.endsAt,
          mode,
        })
        .onConflictDoUpdate({
          target: fitnessConsultations.bookingId,
          set: { mode, updatedAt: new Date() },
        });
    });
    return { consultations: await this.consultations(userId) };
  }
  async consultations(
    userId: string,
    providerView = false
  ): Promise<FitnessConsultation[]> {
    await this.activeUser(userId);
    const conditions: SQL[] = [];
    if (providerView) {
      const ids = await this.ownedProviderIds(userId);
      if (!ids.length) return [];
      conditions.push(
        inArray(
          bookings.providerId,
          ids.map((p) => p.id)
        )
      );
    } else conditions.push(eq(bookings.mobileUserId, userId));
    const rows = await db
      .select({
        booking: bookings,
        consultation: fitnessConsultations,
        client: mobileUsers.displayName,
      })
      .from(bookings)
      .innerJoin(mobileUsers, eq(bookings.mobileUserId, mobileUsers.id))
      .leftJoin(
        fitnessConsultations,
        eq(fitnessConsultations.bookingId, bookings.id)
      )
      .where(and(...conditions, eq(mobileUsers.isActive, true)))
      .orderBy(desc(bookings.startsAt))
      .limit(100);
    const result: FitnessConsultation[] = [];
    for (const { booking, consultation, client } of rows) {
      if (!booking.providerId) continue;
      try {
        const expert = providerView
          ? await this.manager(userId, booking.providerId)
          : await this.eligibility(booking.providerId, userId);
        if (providerView)
          await this.eligibility(booking.providerId, booking.mobileUserId);
        result.push({
          id: consultation?.id ?? booking.id,
          bookingId: booking.id,
          providerId: booking.providerId,
          providerName: expert.provider.name,
          userId: booking.mobileUserId,
          clientName: client,
          status: booking.status,
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt?.toISOString() ?? null,
          mode: consultation?.mode === "audio" ? "audio" : "video",
          serviceMode: booking.serviceMode,
          canJoin: consultationCanJoin(booking),
        });
      } catch (error) {
        if (!(error instanceof ApiError && [403, 404].includes(error.status)))
          throw error;
      }
    }
    return result;
  }
}
export const fitnessExpertService = new FitnessExpertService();
