import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import type {
  CreateProviderApplicationRequest,
  ProviderApplicationAdminDetail,
  ProviderApplicationDetail,
  ProviderApplicationReviewRequest,
  ProviderApplicationSummary,
  ProviderKycUploadRequest,
  SetProviderApplicationServicesRequest,
  UpdateProviderApplicationRequest,
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
} from '../db/schema.js';
import type { AuthClaims } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { mediaService } from '../media/MediaService.js';
import {
  decryptAadhaar,
  encryptAadhaar,
  maskAadhaar,
  normalizeAadhaar,
} from './kycEncryption.js';
import {
  mapSchemaRow,
  resolveFormSchema,
  validateDynamicPayload,
} from './FormSchemaService.js';

const editableStatuses = new Set(['draft', 'more_info_requested']);

function toSummary(
  row: typeof providerApplications.$inferSelect,
  categoryIds: string[],
): ProviderApplicationSummary {
  const commonPayload = (row.commonPayload ?? {}) as Record<string, unknown>;
  const basic = (commonPayload.basic ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    businessName:
      typeof basic.providerName === 'string' && basic.providerName.trim()
        ? basic.providerName.trim()
        : row.providerKind === 'business'
          ? 'New business'
          : 'New professional profile',
    providerKind: row.providerKind as ProviderApplicationSummary['providerKind'],
    status: row.status as ProviderApplicationSummary['status'],
    categoryIds,
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
        eq(providerApplicationDocuments.fieldKey, 'identity.aadhaarNumber'),
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

export class ProviderApplicationService {
  async getMyApplications(mobileUserId: string): Promise<ProviderApplicationSummary[]> {
    const rows = await db
      .select()
      .from(providerApplications)
      .where(
        and(
          eq(providerApplications.mobileUserId, mobileUserId),
          inArray(providerApplications.status, [
            'submitted',
            'under_review',
            'more_info_requested',
            'approved',
          ]),
        ),
      )
      .orderBy(desc(providerApplications.updatedAt));

    return Promise.all(
      rows.map(async row => toSummary(row, await getCategoryIds(row.id))),
    );
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
    const categoryIds = await getCategoryIds(row.id);
    const documents = await getDocuments(row.id);

    return {
      ...toSummary(row, categoryIds),
      commonPayload: (row.commonPayload ?? {}) as ProviderApplicationDetail['commonPayload'],
      dynamicPayload: (row.dynamicPayload ?? {}) as Record<string, unknown>,
      documents,
      aadhaarMasked: await getAadhaarMasked(row.id),
    };
  }

  async getApplication(
    mobileUserId: string,
    applicationId: string,
  ): Promise<ProviderApplicationDetail> {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    const categoryIds = await getCategoryIds(row.id);
    const documents = await getDocuments(row.id);
    return {
      ...toSummary(row, categoryIds),
      commonPayload: (row.commonPayload ?? {}) as ProviderApplicationDetail['commonPayload'],
      dynamicPayload: (row.dynamicPayload ?? {}) as Record<string, unknown>,
      documents,
      aadhaarMasked: await getAadhaarMasked(row.id),
    };
  }

  async createApplication(
    mobileUserId: string,
    body: CreateProviderApplicationRequest,
  ) {
    // Drafts are only temporary onboarding state, not user-visible businesses.
    // Starting a new listing replaces an abandoned unfinished draft.
    await db
      .delete(providerApplications)
      .where(
        and(
          eq(providerApplications.mobileUserId, mobileUserId),
          eq(providerApplications.status, 'draft'),
        ),
      );

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

    return toSummary(row!, []);
  }

  async updateApplication(
    mobileUserId: string,
    applicationId: string,
    body: UpdateProviderApplicationRequest,
  ) {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    if (!editableStatuses.has(row.status)) {
      throw Object.assign(new Error('Application cannot be edited in current status'), {
        code: 'invalid_status',
        status: 400,
      });
    }

    const commonPayload = body.commonPayload
      ? { ...(row.commonPayload ?? {}), ...body.commonPayload }
      : row.commonPayload;
    const dynamicPayload = body.dynamicPayload
      ? { ...(row.dynamicPayload ?? {}), ...body.dynamicPayload }
      : row.dynamicPayload;

    await db
      .update(providerApplications)
      .set({
        ...(body.providerKind ? { providerKind: body.providerKind } : {}),
        commonPayload,
        dynamicPayload,
        updatedAt: new Date(),
        ...(row.status === 'more_info_requested' ? { status: 'draft' } : {}),
      })
      .where(eq(providerApplications.id, applicationId));

    if (body.aadhaarNumber) {
      const normalized = normalizeAadhaar(body.aadhaarNumber);
      const encrypted = encryptAadhaar(normalized);
      await db
        .insert(providerApplicationDocuments)
        .values({
          applicationId,
          fieldKey: 'identity.aadhaarNumber',
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
          eq(providerApplicationDocuments.fieldKey, 'identity.aadhaarNumber'),
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
      throw Object.assign(new Error('Application cannot be edited in current status'), {
        code: 'invalid_status',
        status: 400,
      });
    }

    await db
      .delete(providerApplicationServices)
      .where(eq(providerApplicationServices.applicationId, applicationId));

    for (const categoryId of body.categoryIds) {
      await db.insert(providerApplicationServices).values({
        applicationId,
        categoryId,
      });
    }

    await db
      .update(providerApplications)
      .set({ updatedAt: new Date() })
      .where(eq(providerApplications.id, applicationId));

    return this.getApplication(mobileUserId, applicationId);
  }

  async deleteApplication(mobileUserId: string, applicationId: string) {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    if (row.status === 'approved' || row.providerId) {
      throw Object.assign(
        new Error('An approved business cannot be deleted from the app'),
        {
          code: 'invalid_status',
          status: 400,
        },
      );
    }

    await db
      .delete(providerApplications)
      .where(eq(providerApplications.id, applicationId));
  }

  async submitApplication(mobileUserId: string, applicationId: string) {
    const row = await this.requireOwnedApplication(mobileUserId, applicationId);
    if (!editableStatuses.has(row.status)) {
      throw Object.assign(new Error('Application cannot be submitted in current status'), {
        code: 'invalid_status',
        status: 400,
      });
    }

    const categoryIds = await getCategoryIds(applicationId);
    if (!categoryIds.length) {
      throw Object.assign(new Error('Select at least one service'), {
        code: 'services_required',
        status: 400,
      });
    }

    const schema = await resolveFormSchema(
      row.providerKind as 'business' | 'individual',
      categoryIds,
    );
    validateDynamicPayload(
      schema,
      (row.dynamicPayload ?? {}) as Record<string, unknown>,
      (row.commonPayload ?? {}) as Record<string, unknown>,
    );

    const docs = await getDocuments(applicationId);
    const requiredDocFields = schema.fields
      .filter(f => f.required && (f.type === 'document' || f.type === 'aadhaar'))
      .map(f => f.key)
      .filter(k => k !== 'identity.aadhaarNumber');

    for (const fieldKey of requiredDocFields) {
      if (!docs.some(d => d.fieldKey === fieldKey)) {
        throw Object.assign(new Error(`Missing required document: ${fieldKey}`), {
          code: 'document_required',
          status: 400,
        });
      }
    }

    const aadhaarDoc = await getAadhaarMasked(applicationId);
    if (!aadhaarDoc) {
      throw Object.assign(new Error('Aadhaar number is required'), {
        code: 'aadhaar_required',
        status: 400,
      });
    }

    await db
      .update(providerApplications)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(providerApplications.id, applicationId));

    return this.getApplication(mobileUserId, applicationId);
  }

  async createKycUploadSession(
    mobileUserId: string,
    applicationId: string,
    body: ProviderKycUploadRequest,
  ) {
    await this.requireOwnedApplication(mobileUserId, applicationId);
    return mediaService.createMobileProviderUploadSession(mobileUserId, applicationId, {
      kind: body.kind,
      accessLevel: 'private',
      filename: body.filename,
      contentType: body.contentType,
      byteSize: body.byteSize,
      entityHint: `provider-app-${applicationId}`,
    });
  }

  async completeKycUpload(
    mobileUserId: string,
    applicationId: string,
    sessionId: string,
    fieldKey: string,
  ) {
    await this.requireOwnedApplication(mobileUserId, applicationId);
    const asset = await mediaService.completeMobileProviderUpload(
      mobileUserId,
      applicationId,
      sessionId,
    );

    await db
      .insert(providerApplicationDocuments)
      .values({
        applicationId,
        fieldKey,
        mediaAssetId: asset.id,
      })
      .onConflictDoUpdate({
        target: [
          providerApplicationDocuments.applicationId,
          providerApplicationDocuments.fieldKey,
        ],
        set: { mediaAssetId: asset.id },
      });

    await db.insert(mediaUsages).values({
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
    }).onConflictDoNothing();

    return { mediaId: asset.id };
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

  async listApplicationsAdmin(): Promise<ProviderApplicationSummary[]> {
    const rows = await db
      .select()
      .from(providerApplications)
      .orderBy(desc(providerApplications.submittedAt), desc(providerApplications.updatedAt));

    const out: ProviderApplicationSummary[] = [];
    for (const row of rows) {
      out.push(toSummary(row, await getCategoryIds(row.id)));
    }
    return out;
  }

  async getApplicationAdmin(applicationId: string): Promise<ProviderApplicationAdminDetail> {
    const [row] = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.id, applicationId));
    if (!row) {
      throw Object.assign(new Error('Application not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    const [applicant] = await db
      .select()
      .from(mobileUsers)
      .where(eq(mobileUsers.id, row.mobileUserId));

    const categoryIds = await getCategoryIds(applicationId);
    const documents = await getDocuments(applicationId);
    const docsWithUrls = await Promise.all(
      documents
        .filter(d => d.fieldKey !== 'identity.aadhaarNumber')
        .map(async d => ({
          ...d,
          downloadUrl: await mediaService.createPrivateDownloadUrl(d.mediaId),
        })),
    );

    return {
      ...toSummary(row, categoryIds),
      applicantName: applicant?.displayName ?? 'Unknown',
      applicantPhone: applicant?.phone ?? '',
      commonPayload: (row.commonPayload ?? {}) as ProviderApplicationAdminDetail['commonPayload'],
      dynamicPayload: (row.dynamicPayload ?? {}) as Record<string, unknown>,
      documents: docsWithUrls,
      aadhaarMasked: await getAadhaarMasked(applicationId),
    };
  }

  async reviewApplication(
    auth: AuthClaims,
    applicationId: string,
    body: ProviderApplicationReviewRequest,
  ) {
    const [row] = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.id, applicationId));
    if (!row) {
      throw Object.assign(new Error('Application not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    const now = new Date();

    if (body.action === 'mark_under_review') {
      await db
        .update(providerApplications)
        .set({ status: 'under_review', updatedAt: now })
        .where(eq(providerApplications.id, applicationId));
    } else if (body.action === 'request_info') {
      await db
        .update(providerApplications)
        .set({
          status: 'more_info_requested',
          infoRequestMessage: body.infoRequestMessage ?? body.notes ?? null,
          reviewedAt: now,
          reviewedBy: auth.sub,
          updatedAt: now,
        })
        .where(eq(providerApplications.id, applicationId));
    } else if (body.action === 'reject') {
      await db
        .update(providerApplications)
        .set({
          status: 'rejected',
          reviewNotes: body.notes ?? null,
          reviewedAt: now,
          reviewedBy: auth.sub,
          updatedAt: now,
        })
        .where(eq(providerApplications.id, applicationId));
    } else if (body.action === 'approve') {
      const providerId = await this.approveApplication(row, auth);
      await db
        .update(providerApplications)
        .set({
          status: 'approved',
          providerId,
          reviewNotes: body.notes ?? null,
          reviewedAt: now,
          reviewedBy: auth.sub,
          updatedAt: now,
        })
        .where(eq(providerApplications.id, applicationId));
    }

    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: `provider_application.${body.action}`,
      entityType: 'provider_application',
      entityId: applicationId,
      metadata: { notes: body.notes, infoRequestMessage: body.infoRequestMessage },
    });

    return this.getApplicationAdmin(applicationId);
  }

  private async approveApplication(
    row: typeof providerApplications.$inferSelect,
    auth: AuthClaims,
  ) {
    const common = (row.commonPayload ?? {}) as Record<string, unknown>;
    const basic = (common.basic ?? {}) as Record<string, string>;
    const providerName = basic.providerName ?? 'Provider';

    let providerId = row.providerId;
    if (!providerId) {
      const [created] = await db
        .insert(providers)
        .values({
          mobileUserId: row.mobileUserId,
          providerKind: row.providerKind,
          name: providerName,
          status: 'active',
          publicProfile: {
            common,
            dynamic: row.dynamicPayload ?? {},
          },
        })
        .returning();
      providerId = created!.id;
    }

    await db
      .insert(providerMemberships)
      .values({
        providerId,
        mobileUserId: row.mobileUserId,
        role: 'owner',
      })
      .onConflictDoNothing();

    const categoryIds = await getCategoryIds(row.id);
    const servicesSummary = (common.services ?? {}) as Record<string, unknown>;
    for (const categoryId of categoryIds) {
      await db
        .insert(providerServiceOfferings)
        .values({
          providerId: providerId!,
          categoryId,
          pricingStartsAt:
            typeof servicesSummary.pricingStartsAt === 'number'
              ? servicesSummary.pricingStartsAt
              : null,
          metadata: { approvedBy: auth.sub },
        })
        .onConflictDoNothing();
    }

    await db
      .insert(mobileUserRoles)
      .values({ mobileUserId: row.mobileUserId, roleId: 'service_provider' })
      .onConflictDoNothing();

    return providerId!;
  }

  private async requireOwnedApplication(mobileUserId: string, applicationId: string) {
    const [row] = await db
      .select()
      .from(providerApplications)
      .where(eq(providerApplications.id, applicationId));
    if (!row || row.mobileUserId !== mobileUserId) {
      throw Object.assign(new Error('Application not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    return row;
  }
}

export const providerApplicationService = new ProviderApplicationService();

export { mapSchemaRow, resolveFormSchema };
