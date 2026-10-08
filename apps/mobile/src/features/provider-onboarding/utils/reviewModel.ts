import type {
  FormFieldDefinition,
  ProviderApplicationDetail,
  ProviderApplicationMissingItem,
  ResolvedProviderFormSchema,
} from '@/features/provider-onboarding/types';
import {
  computeCompletion,
  hydrateFormValues,
  isEmptyValue,
  parseLocationValue,
  parseNumberInput,
} from '@/features/provider-onboarding/utils/formValues';

export type ReviewFixTarget =
  | { screen: 'ProviderApplicationServices'; params: { applicationId: string } }
  | {
      screen: 'ProviderApplicationForm';
      params: { applicationId: string; focusField: string };
    };

export type ReviewChecklist = {
  complete: boolean;
  requiredCount: number;
  completedCount: number;
  missing: Array<ProviderApplicationMissingItem & { target: ReviewFixTarget }>;
  documents: Array<{
    key: string;
    label: string;
    required: boolean;
    uploaded: boolean;
  }>;
};

function fixTarget(applicationId: string, key: string): ReviewFixTarget {
  return key === 'services.categoryIds'
    ? { screen: 'ProviderApplicationServices', params: { applicationId } }
    : {
        screen: 'ProviderApplicationForm',
        params: { applicationId, focusField: key },
      };
}

/**
 * What the review screen shows and whether Submit is allowed. The server's
 * readiness (same rules as POST /submit) wins; the client check is only a
 * fallback for the offline demo store.
 */
export function buildReviewChecklist(
  app: ProviderApplicationDetail,
  schema: ResolvedProviderFormSchema | null | undefined,
): ReviewChecklist {
  const uploaded = new Set(app.documents.map(d => d.fieldKey));
  const documents = (schema?.fields ?? [])
    .filter(f => f.type === 'document' || f.type === 'aadhaar')
    .map(f => ({
      key: f.key,
      label: f.label,
      required: Boolean(f.required),
      uploaded:
        f.type === 'aadhaar' ? Boolean(app.aadhaarMasked) : uploaded.has(f.key),
    }));

  if (app.readiness) {
    return {
      complete: app.readiness.complete,
      requiredCount: app.readiness.requiredCount,
      completedCount: app.readiness.completedCount,
      missing: app.readiness.missing.map(m => ({
        ...m,
        target: fixTarget(app.id, m.key),
      })),
      documents,
    };
  }

  const missing: ReviewChecklist['missing'] = [];
  if (!app.categoryIds.length) {
    missing.push({
      key: 'services.categoryIds',
      label: 'Primary service',
      sectionId: 'services',
      reason: 'services',
      message: 'Select the service you offer',
      target: fixTarget(app.id, 'services.categoryIds'),
    });
  }
  if (!schema) {
    return {
      complete: false,
      requiredCount: 1,
      completedCount: 0,
      missing,
      documents,
    };
  }
  const values = hydrateFormValues(app, schema);
  const { required, done, errors } = computeCompletion(schema, values, {
    documentKeys: uploaded,
    aadhaarSaved: Boolean(app.aadhaarMasked),
  });
  for (const field of schema.fields) {
    const message = errors[field.key];
    if (!message) continue;
    missing.push({
      key: field.key,
      label: field.label,
      sectionId: field.sectionId,
      reason:
        field.type === 'document' || field.type === 'aadhaar'
          ? 'document'
          : isEmptyValue(values[field.key])
          ? 'required'
          : 'invalid',
      message,
      target: fixTarget(app.id, field.key),
    });
  }
  return {
    complete: missing.length === 0,
    requiredCount: required + 1,
    completedCount: done + (app.categoryIds.length ? 1 : 0),
    missing,
    documents,
  };
}

/** Human-readable value for the review summary (null = not provided). */
export function formatFieldValue(
  field: FormFieldDefinition,
  value: unknown,
): string | null {
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'location') {
    const loc = parseLocationValue(value);
    return loc
      ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`
      : null;
  }
  if (isEmptyValue(value)) return null;
  if (field.type === 'currency') {
    const n = parseNumberInput(value);
    return n === null ? String(value) : `₹${n.toLocaleString('en-IN')}`;
  }
  if (field.type === 'image') {
    const count = Array.isArray(value) ? value.length : 1;
    return count === 1 ? '1 photo' : `${count} photos`;
  }
  if (field.type === 'video') return 'Video added';
  const options = new Map((field.options ?? []).map(o => [o.value, o.label]));
  if (Array.isArray(value)) {
    return value.map(v => options.get(String(v)) ?? String(v)).join(', ');
  }
  return options.get(String(value)) ?? String(value);
}
