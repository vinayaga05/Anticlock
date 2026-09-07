import { z } from 'zod';

export const INTEREST_MIN_SELECTIONS = 3;

export const InterestOptionSchema = z.object({
  id: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(80),
  imageUrl: z.string().url().max(2_000).optional(),
  sortOrder: z.number().int().min(0).max(10_000),
  isActive: z.boolean(),
});
export type InterestOption = z.infer<typeof InterestOptionSchema>;

export const CreateInterestOptionSchema = InterestOptionSchema;
export type CreateInterestOption = z.infer<typeof CreateInterestOptionSchema>;

export const UpdateInterestOptionSchema = InterestOptionSchema.omit({ id: true });
export type UpdateInterestOption = z.infer<typeof UpdateInterestOptionSchema>;

export const UpdateMyInterestsRequestSchema = z.object({
  interestIds: z
    .array(z.string().min(2).max(64))
    .min(INTEREST_MIN_SELECTIONS)
    .max(24)
    .refine(ids => new Set(ids).size === ids.length, {
      message: 'Choose each interest only once.',
    }),
});
export type UpdateMyInterestsRequest = z.infer<
  typeof UpdateMyInterestsRequestSchema
>;

export const MyInterestsResponseSchema = z.object({
  options: z.array(InterestOptionSchema),
  selectedInterestIds: z.array(z.string()),
  minSelections: z.number().int().positive(),
  needsOnboarding: z.boolean(),
});
export type MyInterestsResponse = z.infer<typeof MyInterestsResponseSchema>;
