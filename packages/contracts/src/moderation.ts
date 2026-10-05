import { z } from 'zod';

export const ReportStatusSchema = z.enum(['open', 'resolved', 'dismissed']);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const ContentTypeSchema = z.enum(['reel', 'content_post']);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ReportReasonSchema = z.enum([
  'harmful_content',
  'bullying',
  'harassment',
  'violent_or_assault_content',
  'adult_or_pornographic_material',
  'hate_speech',
  'misinformation',
  'illegal_activity',
  'child_exploitation',
  'privacy_violation',
  'spam_or_scams',
]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const ModerationActionSchema = z.enum([
  'dismiss',
  'remove_content',
  'warn_user',
  'suspend_user',
]);
export type ModerationAction = z.infer<typeof ModerationActionSchema>;

export const ModerationActionRequestSchema = z.object({
  action: ModerationActionSchema,
  note: z.string().trim().min(1).max(1000),
});
export type ModerationActionRequest = z.infer<typeof ModerationActionRequestSchema>;

export const ModerationReportSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string().uuid(),
  contentType: ContentTypeSchema,
  contentTitle: z.string().nullable(),
  contentCaption: z.string().nullable(),
  contentCreatorName: z.string().nullable(),
  contentStatus: z.string(),
  reporterName: z.string(),
  reason: z.string(),
  details: z.string().nullable(),
  status: ReportStatusSchema,
  resolutionAction: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  resolvedByName: z.string().nullable(),
  reportCount: z.number(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});
export type ModerationReport = z.infer<typeof ModerationReportSchema>;

export const ModerationReportDetailSchema = ModerationReportSchema.extend({
  allReports: z.array(
    z.object({
      id: z.string().uuid(),
      reporterKey: z.string().optional(),
      reporterMobileUserId: z.string().uuid().optional(),
      reason: z.string(),
      status: ReportStatusSchema,
      createdAt: z.string().datetime(),
    })
  ),
});
export type ModerationReportDetail = z.infer<typeof ModerationReportDetailSchema>;
