import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  PROVIDER_APPLICANT_SUBMITTABLE_STATUSES,
  allowedReviewActions,
  type CreateProviderApplicationRequest,
  type ProviderApplicationAdminDetail,
  type ProviderApplicationDetail,
  type ProviderApplicationReviewRequest,
  type ProviderApplicationStatus,
  type ProviderApplicationSummary,
  type ProviderCategoryLabel,
  type ProviderKycUploadRequest,
  type ProviderMediaPreview,
  type SetProviderApplicationServicesRequest,
  type UpdateProviderApplicationRequest,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  mediaAssets,
  mediaUsages,
  mobileUserRoles,
  mobileUsers,
  providerApplicationDocuments,
  providerApplicationServices,
  providerApplications,
  providerMemberships,
  providerServiceOfferings,
  providers,
  serviceCategories,
} from '../db/schema.js';
import type { AuthClaims } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { mediaService } from '../media/MediaService.js';
import { notificationService } from '../notifications/NotificationService.js';
import {
  decryptAadhaar,
  encryptAadhaar,
  maskAadhaar,
  normalizeAadhaar,
} from './kycEncryption.js';
import {
  mapSchemaRow,
  resolveFormSchema,
} from './FormSchemaService.js';
import { computeApplicationReadiness } from './applicationReadiness.js';

type ApplicationRow = typeof providerApplications.$inferSelect;

const PHOTO_DOCUMENT_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const editableStatuses = new Set<string>(['draft', 'more_info_requested']);
const submittableStatuses = new Set<string>(PROVIDER_APPLICANT_SUBMITTABLE_STATUSES);
/** Guards against unbounded draft creation by one account. */
const MAX_OPEN_DRAFTS = 10;
const AADHAAR_KEY = 'identity.aadhaarNumber';

function appError(message: string, code: string, status: 400 | 403 | 404 | 409, details?: unknown) {
  return Object.assign(new Error(message), { code, status, ...(details ? { details } : {}) });
}

function businessNameOf(row: ApplicationRow) {
  const commonPayload = (row.commonPayload ?? {}) as Record<string, unknown>;
  const basic = (commonPayload.basic ?? {}) as Record<string, unknown>;
  return typeof basic.providerName === 'string' && basic.providerName.trim()
    ? basic.providerName.trim()
    : row.providerKind === 'business'
      ? 'New business'
      : 'New professional profile';
}

function toSummary(
  row: ApplicationRow,
  categoryIds: string[],
  categories?: ProviderCategoryLabel[],
): ProviderApplicationSummary {
  return {
    id: row.id,
    businessName: businessNameOf(row),
    providerKind: row.providerKind as ProviderApplicationSummary['providerKind'],
    status: row.status as ProviderApplicationSummary['status'],
    categoryIds,
    ...(categories ? { categories } : {}),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    infoRequestMessage: row.infoRequestMessage ?? null,
    reviewNotes: row.reviewNotes ?? null,
    providerId: row.providerId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getCategoryIds(applicationId: string) {
  const rows = await db
    .select()
    .from(providerApplicationServices)
    .where(eq(providerApplicationServices.applicationId, applicationId));
  return rows.map(r => r.categoryId);
}

async function getCategoryLabels(categoryIds: string[]): Promise<ProviderCategoryLabel[]> {
  if (!categoryIds.length) return [];
  const rows = await db
    .select({ id: serviceCategories.id, name: serviceCategories.name, treeId: serviceCategories.treeId })
    .from(serviceCategories)
    .where(inArray(serviceCategories.id, categoryIds));
  const byId = new Map(rows.map(r => [r.id, r]));
  return categoryIds.map(id => {
    const row = byId.get(id);
    return row ? { id, name: row.name, treeId: row.treeId } : { id, name: id };
  });
}

async function getDocuments(applicationId: string) {
  const rows = await db
    .select({
      fieldKey: providerApplicationDocuments.fieldKey,
      mediaId: providerApplicationDocuments.mediaAssetId,
      createdAt: providerApplicationDocuments.createdAt,
      originalFilename: mediaAssets.originalFilename,
    })
    .from(providerApplicationDocuments)
    .innerJoin(
      mediaAssets,
      eq(providerApplicationDocuments.mediaAssetId, mediaAssets.id),
    )
    .where(eq(providerApplicationDocuments.applicationId, applicationId));

  return rows.map(r => ({
    fieldKey: r.fieldKey,
    mediaId: r.mediaId,
    label: r.originalFilename ?? undefined,
    uploadedAt: r.createdAt.toISOString(),
  }));
}

async function getAadhaarMasked(applicationId: string) {
  const [row] = await db
    .select()
    .from(providerApplicationDocuments)
    .where(
      and(
        eq(providerApplicationDocuments.applicationId, applicationId),
        eq(providerApplicationDocuments.fieldKey, AADHAAR_KEY),
      ),
    )
    .limit(1);
  if (!row?.aadhaarEncrypted) return null;
  try {
    return maskAadhaar(decryptAadhaar(row.aadhaarEncrypted));
  } catch {
    return null;
  }
}

function profileMediaIds(commonPayload: Record<string, unknown>) {
  const profile = (commonPayload.profile ?? {}) as Record<string, unknown>;
  const images = [
    ...(typeof profile.logoMediaId === 'string' ? [profile.logoMediaId] : []),
    ...(Array.isArray(profile.coverMediaIds)
      ? profile.coverMediaIds.filter((v): v is string => typeof v === 'string')
      : []),
  ];
  const videos =
    typeof profile.introVideoMediaId === 'string' ? [profile.introVideoMediaId] : [];
  return { images, videos };
}

async function buildReadiness(row: ApplicationRow, categoryIds: string[]) {
  const docs = await getDocuments(row.id);
  const hasAadhaar = Boolean(await getAadhaarMasked(row.id));
  if (!categoryIds.length) {
    return computeApplicationReadiness({
      schema: { sections: [], fields: [], categoryIds: [] },
      commonPayload: (row.commonPayload ?? {}) as Record<string, unknown>,
      dynamicPayload: (row.dynamicPayload ?? {}) as Record<string, unknown>,
      categoryIds,
      documentFieldKeys: docs.map(d => d.fieldKey),
      hasAadhaar,
    });
  }
  const schema = await resolveFormSchema(
    row.providerKind as 'business' | 'individual',
    categoryIds,
  );
  return computeApplicationReadiness({
    schema,
    commonPayload: (row.commonPayload ?? {}) as Record<string, unknown>,
    dynamicPayload: (row.dynamicPayload ?? {}) as Record<string, unknown>,
    categoryIds,
    documentFieldKeys: docs.map(d => d.fieldKey),
    hasAadhaar,
  });
}

const NOTIFICATION_COPY: Partial<
  Record<ProviderApplicationStatus, (name: string, row: ApplicationRow) => { title: string; body: string }>
> = {
  under_review: name => ({
    title: 'Your application is under review',
    body: `Our team has started reviewing ${name}.`,
  }),
  more_info_requested: (name, row) => ({
    title: 'More information needed',
    body: row.infoRequestMessage
      ? `${name}: ${row.infoRequestMessage}`
      : `We need a few more details to approve ${name}.`,
  }),
  rejected: (name, row) => ({
    title: 'Application not approved',
    body: row.reviewNotes
      ? `${name}: ${row.reviewNotes}`
      : `${name} was not approved. You can update it and resubmit.`,
  }),
  approved: name => ({
    title: `${name} is approved`,
    body: `${name} is now live on Anticlock. Customers can find and book you.`,
  }),
};

export class ProviderApplicationService {
  /** Every business application the user owns, including drafts. */
  async getMyApplications(mobileUserId: string): Promise<ProviderApplicationSummary[]> {
    const rows = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.mobileUserId, mobileUserId))
      .orderBy(desc(providerApplications.updatedAt));

    const services = rows.length
      ? await db
          .select()
          .from(providerApplicationServices)
          .where(inArray(providerApplicationServices.applicationId, rows.map(r => r.id)))
      : [];
    const labels = await getCategoryLabels([...new Set(services.map(s => s.categoryId))]);
    const labelById = new Map(labels.map(l => [l.id, l]));
    return rows.map(row => {
      const ids = services.filter(s => s.applicationId === row.id).map(s => s.categoryId);
      return toSummary(row, ids, ids.map(id => labelById.get(id) ?? { id, name: id }));
    });
  }

  async getMyApplication(mobileUserId: string): Promise<ProviderApplicationDetail | null> {
    const [row] = await db
      .select()
      .from(providerApplications)
      .where(
        and(
          eq(providerApplications.mobileUserId, mobileUserId),
          ne(providerApplications.status, 'rejected'),
        ),
      )
      .orderBy(desc(providerApplications.updatedAt))
      .limit(1);

    if (!row) return null;
    return this.toDetail(row);
  }

  async getApplication(
    mobileUserId: string,
    applicationId: string,
  ): Promise<ProviderApplicationDetail> {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    return this.toDetail(row);
  }

  private async toDetail(row: ApplicationRow): Promise<ProviderApplicationDetail> {
    const categoryIds = await getCategoryIds(row.id);
    const documents = await getDocuments(row.id);
    const commonPayload = (row.commonPayload ?? {}) as Record<string, unknown>;
    let readiness: ProviderApplicationDetail['readiness'];
    try {
      readiness = await buildReadiness(row, categoryIds);
    } catch {
      readiness = undefined;
    }
    return {
      ...toSummary(row, categoryIds, await getCategoryLabels(categoryIds)),
      commonPayload: commonPayload as ProviderApplicationDetail['commonPayload'],
      dynamicPayload: (row.dynamicPayload ?? {}) as Record<string, unknown>,
      documents,
      aadhaarMasked: await getAadhaarMasked(row.id),
      readiness,
      mediaPreviews: await this.mediaPreviews(commonPayload, documents),
    };
  }

  private async mediaPreviews(
    commonPayload: Record<string, unknown>,
    documents: Awaited<ReturnType<typeof getDocuments>>,
  ): Promise<ProviderMediaPreview[]> {
    const { images, videos } = profileMediaIds(commonPayload);
    const out: ProviderMediaPreview[] = [];
    for (const mediaId of [...images, ...videos]) {
      const summary = await mediaService.getAssetSummary(mediaId);
      if (!summary) continue;
      out.push({
        mediaId,
        kind: summary.kind === 'video' ? 'video' : 'image',
        filename: summary.originalFilename,
        url: await mediaService.getPublicMediaUrl(mediaId),
      });
    }
    for (const doc of documents) {
      if (doc.fieldKey === AADHAAR_KEY) continue;
      out.push({ mediaId: doc.mediaId, kind: 'document', filename: doc.label ?? null, url: null });
    }
    return out;
  }

  /**
   * Starts a NEW business application. Existing drafts are never removed:
   * a user can keep several unfinished businesses and resume any of them.
   */
  async createApplication(
    mobileUserId: string,
    body: CreateProviderApplicationRequest,
  ) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(providerApplications)
      .where(
        and(
          eq(providerApplications.mobileUserId, mobileUserId),
          eq(providerApplications.status, 'draft'),
        ),
      );
    if (count >= MAX_OPEN_DRAFTS) {
      throw appError(
        `You already have ${count} unfinished businesses. Finish or delete one first.`,
        'too_many_drafts',
        409,
      );
    }

    const [row] = await db
      .insert(providerApplications)
      .values({
        mobileUserId,
        providerKind: body.providerKind,
        status: 'draft',
        commonPayload: {},
        dynamicPayload: {},
      })
      .returning();

    return toSummary(row!, [], []);
  }

  async updateApplication(
    mobileUserId: string,
    applicationId: string,
    body: UpdateProviderApplicationRequest,
  ) {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    if (!editableStatuses.has(row.status)) {
      throw appError('Application cannot be edited in current status', 'invalid_status', 409);
    }

    // Each section the client sends replaces the stored section (so cleared
    // fields really clear); unsent sections are kept.
    const commonPayload = body.commonPayload
      ? { ...(row.commonPayload ?? {}), ...body.commonPayload }
      : row.commonPayload;
    const dynamicPayload = body.dynamicPayload
      ? { ...(row.dynamicPayload ?? {}), ...body.dynamicPayload }
      : row.dynamicPayload;

    if (body.commonPayload?.profile) {
      const { images, videos } = profileMediaIds(body.commonPayload as Record<string, unknown>);
      await mediaService.requireProviderApplicationMedia([applicationId], images, 'image');
      await mediaService.requireProviderApplicationMedia([applicationId], videos, 'video');
    }

    await db
      .update(providerApplications)
      .set({
        ...(body.providerKind ? { providerKind: body.providerKind } : {}),
        commonPayload,
        dynamicPayload,
        updatedAt: new Date(),
      })
      .where(eq(providerApplications.id, applicationId));

    if (body.aadhaarNumber) {
      const normalized = normalizeAadhaar(body.aadhaarNumber);
      const encrypted = encryptAadhaar(normalized);
      await db
        .insert(providerApplicationDocuments)
        .values({
          applicationId,
          fieldKey: AADHAAR_KEY,
          mediaAssetId: await this.ensurePlaceholderMedia(applicationId),
          aadhaarEncrypted: encrypted,
        })
        .onConflictDoUpdate({
          target: [
            providerApplicationDocuments.applicationId,
            providerApplicationDocuments.fieldKey,
          ],
          set: { aadhaarEncrypted: encrypted },
        });
    }

    return this.getApplication(mobileUserId, applicationId);
  }

  private async ensurePlaceholderMedia(applicationId: string) {
    const [existing] = await db
      .select()
      .from(providerApplicationDocuments)
      .where(
        and(
          eq(providerApplicationDocuments.applicationId, applicationId),
          eq(providerApplicationDocuments.fieldKey, AADHAAR_KEY),
        ),
      );
    if (existing) return existing.mediaAssetId;

    const [asset] = await db
      .insert(mediaAssets)
      .values({
        kind: 'document',
        storageProvider: 'local',
        storageKey: `private/provider-applications/${applicationId}/aadhaar-placeholder`,
        bucket: 'private-documents',
        accessLevel: 'private',
        processingStatus: 'ready',
        moderationStatus: 'not_required',
        originalFilename: 'aadhaar-number',
      })
      .returning();
    return asset!.id;
  }

  async setServices(
    mobileUserId: string,
    applicationId: string,
    body: SetProviderApplicationServicesRequest,
  ) {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    if (!editableStatuses.has(row.status)) {
      throw appError('Application cannot be edited in current status', 'invalid_status', 409);
    }

    await db.transaction(async tx => {
      await tx
        .delete(providerApplicationServices)
        .where(eq(providerApplicationServices.applicationId, applicationId));
      for (const categoryId of body.categoryIds) {
        await tx.insert(providerApplicationServices).values({ applicationId, categoryId });
      }
      await tx
        .update(providerApplications)
        .set({ updatedAt: new Date() })
        .where(eq(providerApplications.id, applicationId));
    });

    return this.getApplication(mobileUserId, applicationId);
  }

  async deleteApplication(mobileUserId: string, applicationId: string) {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    if (row.status === 'approved' || row.providerId) {
      throw appError('An approved business cannot be deleted from the app', 'invalid_status', 409);
    }
    await db.delete(providerApplications).where(eq(providerApplications.id, applicationId));
  }

  async deleteDocument(mobileUserId: string, applicationId: string, fieldKey: string) {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    if (!editableStatuses.has(row.status)) {
      throw appError('Application cannot be edited in current status', 'invalid_status', 409);
    }
    if (fieldKey === AADHAAR_KEY) {
      throw appError('Aadhaar number cannot be removed here', 'validation_error', 400);
    }
    await db
      .delete(providerApplicationDocuments)
      .where(
        and(
          eq(providerApplicationDocuments.applicationId, applicationId),
          eq(providerApplicationDocuments.fieldKey, fieldKey),
        ),
      );
    return this.getApplication(mobileUserId, applicationId);
  }

  /** draft | more_info_requested -> submitted, only when complete. */
  async submitApplication(mobileUserId: string, applicationId: string) {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    if (!submittableStatuses.has(row.status)) {
      throw appError(
        `An application that is ${row.status.replace(/_/g, ' ')} cannot be submitted`,
        'invalid_transition',
        409,
      );
    }

    const categoryIds = await getCategoryIds(applicationId);
    const readiness = await buildReadiness(row, categoryIds);
    if (!readiness.complete) {
      throw appError(
        readiness.missing.map(m => m.message).join('; '),
        'application_incomplete',
        400,
        readiness.missing,
      );
    }

    const updated = await db
      .update(providerApplications)
      .set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(providerApplications.id, applicationId),
          inArray(providerApplications.status, [...submittableStatuses]),
        ),
      )
      .returning({ id: providerApplications.id });
    if (!updated.length) {
      throw appError('Application status changed; refresh and try again', 'invalid_transition', 409);
    }

    return this.getApplication(mobileUserId, applicationId);
  }

  /** rejected -> draft so the applicant can fix it and resubmit. */
  async reopenApplication(mobileUserId: string, applicationId: string) {
    await this.requireOwnedApplication(mobileUserId, applicationId);
    const updated = await db
      .update(providerApplications)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(
        and(
          eq(providerApplications.id, applicationId),
          eq(providerApplications.status, 'rejected'),
        ),
      )
      .returning({ id: providerApplications.id });
    if (!updated.length) {
      throw appError('Only a rejected application can be reopened', 'invalid_transition', 409);
    }
    return this.getApplication(mobileUserId, applicationId);
  }

  async createKycUploadSession(
    mobileUserId: string,
    applicationId: string,
    body: ProviderKycUploadRequest & { durationMs?: number; width?: number; height?: number },
  ) {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    if (!editableStatuses.has(row.status)) {
      throw appError('Application cannot be edited in current status', 'invalid_status', 409);
    }
    // KYC documents may be photographed. The generic media pipeline only
    // accepts PDFs for kind "document", so a JPEG/PNG of a document is stored
    // as kind "image"; it stays private because the bucket follows `purpose`.
    const contentType = body.contentType.trim().toLowerCase().split(';', 1)[0] ?? '';
    const kind =
      body.kind === 'document' && PHOTO_DOCUMENT_MIMES.has(contentType) ? 'image' : body.kind;
    return mediaService.createMobileProviderUploadSession(mobileUserId, applicationId, {
      kind,
      accessLevel: body.purpose === 'profile' ? 'public' : 'private',
      filename: body.filename,
      contentType: body.contentType,
      byteSize: body.byteSize,
      durationMs: body.durationMs,
      width: body.width,
      height: body.height,
      entityHint: `provider-app-${applicationId}`,
      purpose: body.purpose,
    });
  }

  async completeKycUpload(
    mobileUserId: string,
    applicationId: string,
    sessionId: string,
    fieldKey: string,
    purpose: 'document' | 'profile' = 'document',
  ) {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    if (!editableStatuses.has(row.status)) {
      throw appError('Application cannot be edited in current status', 'invalid_status', 409);
    }
    if (!fieldKey || typeof fieldKey !== 'string' || fieldKey.length > 120) {
      throw appError('fieldKey is required', 'validation_error', 400);
    }
    const asset = await mediaService.completeMobileProviderUpload(
      mobileUserId,
      applicationId,
      sessionId,
    );

    // Profile media is referenced from the payload by id (saved by the
    // client's next autosave); it is not an application document.
    if (purpose === 'profile' || asset.accessLevel === 'public') {
      await db
        .insert(mediaUsages)
        .values({
          mediaId: asset.id,
          entityType: 'PROVIDER_APPLICATION',
          entityId: applicationId,
          usageType: 'PROFILE_MEDIA',
          sortOrder: 0,
        })
        .onConflictDoNothing();
      return {
        mediaId: asset.id,
        url: await mediaService.getPublicMediaUrl(asset.id),
      };
    }

    await db
      .insert(providerApplicationDocuments)
      .values({ applicationId, fieldKey, mediaAssetId: asset.id })
      .onConflictDoUpdate({
        target: [
          providerApplicationDocuments.applicationId,
          providerApplicationDocuments.fieldKey,
        ],
        set: { mediaAssetId: asset.id, createdAt: new Date() },
      });

    await db
      .insert(mediaUsages)
      .values({
        mediaId: asset.id,
        entityType: 'PROVIDER_APPLICATION',
        entityId: applicationId,
        usageType:
          fieldKey === 'identity.aadhaarDocument'
            ? 'KYC_AADHAAR'
            : fieldKey === 'identity.idDocument'
              ? 'KYC_IDENTITY'
              : fieldKey === 'identity.businessRegistration'
                ? 'KYC_REGISTRATION'
                : 'ATTACHMENT',
        sortOrder: 0,
      })
      .onConflictDoNothing();

    return { mediaId: asset.id, url: null };
  }

  async uploadKycLocalContent(
    mobileUserId: string,
    applicationId: string,
    sessionId: string,
    body: Buffer,
  ) {
    await this.requireOwnedApplication(mobileUserId, applicationId);
    await mediaService.putMobileProviderLocalContent(
      mobileUserId,
      applicationId,
      sessionId,
      body,
    );
  }

  /** Admin queue. Drafts are the applicant's private work and are hidden. */
  async listApplicationsAdmin(status?: string): Promise<ProviderApplicationSummary[]> {
    const rows = await db
      .select()
      .from(providerApplications)
      .where(
        status
          ? eq(providerApplications.status, status)
          : ne(providerApplications.status, 'draft'),
      )
      .orderBy(desc(providerApplications.submittedAt), desc(providerApplications.updatedAt));

    const out: ProviderApplicationSummary[] = [];
    for (const row of rows) {
      const ids = await getCategoryIds(row.id);
      out.push(toSummary(row, ids, await getCategoryLabels(ids)));
    }
    return out;
  }

  async getApplicationAdmin(applicationId: string): Promise<ProviderApplicationAdminDetail> {
    const [row] = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.id, applicationId));
    if (!row) throw appError('Application not found', 'not_found', 404);

    const [applicant] = await db
      .select()
      .from(mobileUsers)
      .where(eq(mobileUsers.id, row.mobileUserId));

    const detail = await this.toDetail(row);
    const docsWithUrls = await Promise.all(
      detail.documents
        .filter(d => d.fieldKey !== AADHAAR_KEY)
        .map(async d => ({
          ...d,
          downloadUrl: await mediaService.createPrivateDownloadUrl(d.mediaId),
        })),
    );

    return {
      ...detail,
      allowedActions: allowedReviewActions(row.status),
      applicantName: applicant?.displayName ?? 'Unknown',
      applicantPhone: applicant?.phone ?? '',
      documents: docsWithUrls,
      aadhaarMasked: detail.aadhaarMasked ?? null,
    };
  }

  /**
   * Admin review with an enforced state machine (see
   * PROVIDER_REVIEW_TRANSITIONS). The row is locked for the whole decision so
   * two reviewers cannot both act, and approve re-checks completeness.
   */
  async reviewApplication(
    auth: AuthClaims,
    applicationId: string,
    body: ProviderApplicationReviewRequest,
  ) {
    const now = new Date();
    const updatedRow = await db.transaction(async tx => {
      const [row] = await tx
        .select()
        .from(providerApplications)
        .where(eq(providerApplications.id, applicationId))
        .for('update');
      if (!row) throw appError('Application not found', 'not_found', 404);

      if (!allowedReviewActions(row.status).includes(body.action)) {
        throw appError(
          `Cannot ${body.action.replace(/_/g, ' ')} an application that is ${row.status.replace(/_/g, ' ')}`,
          'invalid_transition',
          409,
        );
      }

      if (body.action === 'mark_under_review') {
        const [u] = await tx
          .update(providerApplications)
          .set({ status: 'under_review', updatedAt: now })
          .where(eq(providerApplications.id, applicationId))
          .returning();
        return u!;
      }
      if (body.action === 'request_info') {
        const message = (body.infoRequestMessage ?? body.notes ?? '').trim();
        if (!message) {
          throw appError('Tell the applicant what information is needed', 'validation_error', 400);
        }
        const [u] = await tx
          .update(providerApplications)
          .set({
            status: 'more_info_requested',
            infoRequestMessage: message,
            reviewedAt: now,
            reviewedBy: auth.sub,
            updatedAt: now,
          })
          .where(eq(providerApplications.id, applicationId))
          .returning();
        return u!;
      }
      if (body.action === 'reject') {
        const notes = body.notes?.trim();
        if (!notes) {
          throw appError('Add a reason so the applicant can fix and resubmit', 'validation_error', 400);
        }
        const [u] = await tx
          .update(providerApplications)
          .set({
            status: 'rejected',
            reviewNotes: notes,
            reviewedAt: now,
            reviewedBy: auth.sub,
            updatedAt: now,
          })
          .where(eq(providerApplications.id, applicationId))
          .returning();
        return u!;
      }

      // approve
      const categoryIds = await getCategoryIds(row.id);
      const readiness = await buildReadiness(row, categoryIds);
      if (!readiness.complete) {
        throw appError(
          `Application is incomplete: ${readiness.missing.map(m => m.label).join(', ')}`,
          'application_incomplete',
          400,
          readiness.missing,
        );
      }
      const providerId = await this.createBusinessProfile(tx, row, categoryIds, auth);
      const [u] = await tx
        .update(providerApplications)
        .set({
          status: 'approved',
          providerId,
          reviewNotes: body.notes?.trim() || null,
          reviewedAt: now,
          reviewedBy: auth.sub,
          updatedAt: now,
        })
        .where(eq(providerApplications.id, applicationId))
        .returning();
      return u!;
    });

    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: `provider_application.${body.action}`,
      entityType: 'provider_application',
      entityId: applicationId,
      metadata: { notes: body.notes, infoRequestMessage: body.infoRequestMessage },
    });

    await this.notifyStatusChange(updatedRow);
    return this.getApplicationAdmin(applicationId);
  }

  /** In-app notification (+ push when Firebase is configured). Never throws. */
  private async notifyStatusChange(row: ApplicationRow) {
    const copy = NOTIFICATION_COPY[row.status as ProviderApplicationStatus];
    if (!copy) return;
    const name = businessNameOf(row);
    const { title, body } = copy(name, row);
    try {
      await notificationService.notifyUser(row.mobileUserId, {
        type: 'status_update',
        title,
        body,
        data: {
          kind: 'provider_application',
          applicationId: row.id,
          status: row.status,
          ...(row.providerId ? { providerId: row.providerId } : {}),
          screen: 'ProviderApplicationStatus',
        },
      });
    } catch (err) {
      console.error('[ProviderApplicationService] status notification failed', err);
    }
  }

  /**
   * Creates the NEW business profile for one approved application and links
   * it to the owner (owner membership => it appears in publisher identities).
   * Idempotent per application via providers.source_application_id.
   */
  private async createBusinessProfile(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    row: ApplicationRow,
    categoryIds: string[],
    auth: AuthClaims,
  ) {
    const common = (row.commonPayload ?? {}) as Record<string, unknown>;
    const basic = (common.basic ?? {}) as Record<string, unknown>;
    const services = (common.services ?? {}) as Record<string, unknown>;
    const profile = (common.profile ?? {}) as Record<string, unknown>;
    const providerName =
      typeof basic.providerName === 'string' && basic.providerName.trim()
        ? basic.providerName.trim()
        : 'Provider';
    const avatarUrl =
      typeof profile.logoMediaId === 'string'
        ? await mediaService.getPublicMediaUrl(profile.logoMediaId)
        : null;
    const coverUrls: string[] = [];
    if (Array.isArray(profile.coverMediaIds)) {
      for (const id of profile.coverMediaIds) {
        if (typeof id !== 'string') continue;
        const url = await mediaService.getPublicMediaUrl(id);
        if (url) coverUrls.push(url);
      }
    }

    let providerId = row.providerId;
    if (!providerId) {
      const [created] = await tx
        .insert(providers)
        .values({
          mobileUserId: row.mobileUserId,
          providerKind: row.providerKind,
          name: providerName,
          status: 'active',
          sourceApplicationId: row.id,
          publicProfile: {
            common,
            dynamic: row.dynamicPayload ?? {},
            ...(avatarUrl ? { avatarUrl } : {}),
            ...(coverUrls.length ? { coverUrls } : {}),
          },
        })
        .onConflictDoNothing({
          target: providers.sourceApplicationId,
          where: sql`${providers.sourceApplicationId} IS NOT NULL`,
        })
        .returning();
      if (created) {
        providerId = created.id;
      } else {
        const [existing] = await tx
          .select({ id: providers.id })
          .from(providers)
          .where(eq(providers.sourceApplicationId, row.id));
        providerId = existing!.id;
      }
    }

    await tx
      .insert(providerMemberships)
      .values({ providerId, mobileUserId: row.mobileUserId, role: 'owner' })
      .onConflictDoNothing();

    const pricing =
      typeof services.pricingStartsAt === 'number' ? Math.round(services.pricingStartsAt) : null;
    for (const categoryId of categoryIds) {
      await tx
        .insert(providerServiceOfferings)
        .values({
          providerId: providerId!,
          categoryId,
          pricingStartsAt: pricing,
          metadata: { approvedBy: auth.sub, applicationId: row.id },
        })
        .onConflictDoNothing();
    }

    await tx
      .insert(mobileUserRoles)
      .values({ mobileUserId: row.mobileUserId, roleId: 'service_provider' })
      .onConflictDoNothing();

    return providerId!;
  }

  private async requireOwnedApplication(mobileUserId: string, applicationId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(applicationId)) {
      throw appError('Application not found', 'not_found', 404);
    }
    const [row] = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.id, applicationId));
    if (!row || row.mobileUserId !== mobileUserId) {
      throw appError('Application not found', 'not_found', 404);
    }
    return row;
  }
}

export const providerApplicationService = new ProviderApplicationService();

export { mapSchemaRow, resolveFormSchema };
