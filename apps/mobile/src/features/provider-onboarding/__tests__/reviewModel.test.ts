import type {
  ProviderApplicationDetail,
  ResolvedProviderFormSchema,
} from '@/features/provider-onboarding/types';
import {
  buildReviewChecklist,
  formatFieldValue,
} from '@/features/provider-onboarding/utils/reviewModel';

const schema = {
  sections: [{ id: 'basic', title: 'Basic', sortOrder: 1 }],
  fields: [
    {
      key: 'basic.providerName',
      type: 'text',
      label: 'Business name',
      required: true,
      sectionId: 'basic',
    },
    {
      key: 'identity.idDocument',
      type: 'document',
      label: 'ID document',
      required: true,
      sectionId: 'identity',
    },
    {
      key: 'services.pricingStartsAt',
      type: 'currency',
      label: 'Starting price',
      sectionId: 'services',
    },
  ],
} as ResolvedProviderFormSchema;

function app(
  over: Partial<ProviderApplicationDetail> = {},
): ProviderApplicationDetail {
  return {
    id: 'app-1',
    businessName: 'Lotus',
    providerKind: 'business',
    status: 'draft',
    categoryIds: ['fitness.yoga'],
    submittedAt: null,
    reviewedAt: null,
    infoRequestMessage: null,
    reviewNotes: null,
    providerId: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    commonPayload: {},
    dynamicPayload: {},
    documents: [],
    ...over,
  };
}

describe('buildReviewChecklist', () => {
  it('uses server readiness and links every missing item to the field that fixes it', () => {
    const checklist = buildReviewChecklist(
      app({
        readiness: {
          complete: false,
          requiredCount: 3,
          completedCount: 1,
          missing: [
            {
              key: 'services.categoryIds',
              label: 'Primary service',
              sectionId: 'services',
              reason: 'services',
              message: 'Select the service you offer',
            },
            {
              key: 'identity.idDocument',
              label: 'ID document',
              sectionId: 'identity',
              reason: 'document',
              message: 'Upload id document',
            },
          ],
        },
      }),
      schema,
    );
    expect(checklist.complete).toBe(false);
    expect(checklist.missing.map(m => m.target)).toEqual([
      {
        screen: 'ProviderApplicationServices',
        params: { applicationId: 'app-1' },
      },
      {
        screen: 'ProviderApplicationForm',
        params: { applicationId: 'app-1', focusField: 'identity.idDocument' },
      },
    ]);
    expect(checklist.documents).toEqual([
      {
        key: 'identity.idDocument',
        label: 'ID document',
        required: true,
        uploaded: false,
      },
    ]);
  });

  it('falls back to client checks offline and only completes when docs and fields are in', () => {
    const incomplete = buildReviewChecklist(app(), schema);
    expect(incomplete.complete).toBe(false);
    expect(incomplete.missing.map(m => m.key)).toEqual([
      'basic.providerName',
      'identity.idDocument',
    ]);

    const complete = buildReviewChecklist(
      app({
        commonPayload: { basic: { providerName: 'Lotus' } } as never,
        documents: [
          {
            fieldKey: 'identity.idDocument',
            mediaId: 'm1',
            uploadedAt: '2026-10-01T00:00:00Z',
          },
        ],
      }),
      schema,
    );
    expect(complete).toMatchObject({ complete: true, missing: [] });
    expect(complete.completedCount).toBe(complete.requiredCount);
  });

  it('is never complete without a selected service', () => {
    const checklist = buildReviewChecklist(app({ categoryIds: [] }), null);
    expect(checklist.complete).toBe(false);
    expect(checklist.missing[0]?.key).toBe('services.categoryIds');
  });
});

describe('formatFieldValue', () => {
  it('renders review-friendly values', () => {
    expect(formatFieldValue(schema.fields[2]!, '1499')).toBe('₹1,499');
    expect(formatFieldValue(schema.fields[0]!, '')).toBeNull();
    expect(
      formatFieldValue(
        {
          key: 'a',
          type: 'dropdown',
          label: 'A',
          sectionId: 'x',
          options: [{ value: 'y', label: 'Yes please' }],
        },
        'y',
      ),
    ).toBe('Yes please');
    const time = { key: 't', type: 'time', label: 'Opens', sectionId: 'x' } as const;
    expect(formatFieldValue(time, '06:00')).toBe('6:00 AM');
    expect(formatFieldValue(time, '20:30')).toBe('8:30 PM');
  });
});
