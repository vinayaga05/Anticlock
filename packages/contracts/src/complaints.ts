import { z } from 'zod';

export const ComplaintSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  author: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  createdAt: z.string().datetime(),
});
export type Complaint = z.infer<typeof ComplaintSchema>;

export const CreateComplaintRequestSchema = z.object({
  title: z.string().trim().min(3).max(120)
    .refine(value => [...value].length >= 3, 'Use at least 3 characters.'),
  description: z.string().trim().min(10).max(3000)
    .refine(value => [...value].length >= 10, 'Use at least 10 characters.'),
  clientRequestId: z.string().trim().min(8).max(100)
    .refine(value => [...value].length >= 8, 'Use at least 8 characters.').optional(),
});
export type CreateComplaintRequest = z.infer<typeof CreateComplaintRequestSchema>;

export const ComplaintListQuerySchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(300).optional(),
});
export type ComplaintListQuery = z.infer<typeof ComplaintListQuerySchema>;

export const ListComplaintsResponseSchema = z.object({
  complaints: z.array(ComplaintSchema),
  nextCursor: z.string().nullable(),
});
export type ListComplaintsResponse = z.infer<typeof ListComplaintsResponseSchema>;

export const CreateComplaintResponseSchema = z.object({
  complaint: ComplaintSchema,
});
export type CreateComplaintResponse = z.infer<typeof CreateComplaintResponseSchema>;
