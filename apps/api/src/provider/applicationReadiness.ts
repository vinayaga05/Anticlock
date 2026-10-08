import {
  PROVIDER_FORM_FIELD_ALIASES,
  ProviderApplicationCommonPayloadSchema,
  type FormFieldDefinition,
  type ProviderApplicationMissingItem,
  type ProviderApplicationReadiness,
  type ResolvedProviderFormSchema,
} from '@anticlock/contracts';

/**
 * Pure completeness check shared by GET (review screen), submit and approve.
 * It never touches the database so it can be unit tested directly.
 */
export type ReadinessInput = {
  schema: ResolvedProviderFormSchema;
  commonPayload: Record<string, unknown>;
  dynamicPayload: Record<string, unknown>;
  categoryIds: string[];
  documentFieldKeys: string[];
  hasAadhaar: boolean;
};

const DOCUMENT_TYPES = new Set(['document', 'aadhaar']);

export function flattenPayload(
  payload: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload ?? {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenPayload(value as Record<string, unknown>, fullKey));
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

function isEmpty(value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/[,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Reads a form field's value from the flattened payload, honouring aliases. */
export function readFieldValue(
  field: Pick<FormFieldDefinition, 'key' | 'type'>,
  flat: Record<string, unknown>,
  dynamicPayload: Record<string, unknown>,
): unknown {
  if (field.type === 'location') {
    const direct = dynamicPayload[field.key] ?? flat[field.key];
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      const loc = direct as Record<string, unknown>;
      return finiteNumber(loc.latitude) !== null && finiteNumber(loc.longitude) !== null
        ? loc
        : undefined;
    }
    const section = field.key.split('.')[0];
    const lat = flat[`${section}.latitude`] ?? flat[`${field.key}.latitude`];
    const lng = flat[`${section}.longitude`] ?? flat[`${field.key}.longitude`];
    return finiteNumber(lat) !== null && finiteNumber(lng) !== null
      ? { latitude: lat, longitude: lng }
      : undefined;
  }
  const alias = PROVIDER_FORM_FIELD_ALIASES[field.key];
  if (alias && !isEmpty(flat[alias])) return flat[alias];
  if (field.key in dynamicPayload) return dynamicPayload[field.key];
  return flat[field.key];
}

/** Returns an error message when a present value has the wrong shape. */
export function validateFieldValue(
  field: FormFieldDefinition,
  value: unknown,
): string | null {
  if (isEmpty(value)) return null;
  const v = field.validation ?? {};
  switch (field.type) {
    case 'number':
    case 'currency': {
      const n = finiteNumber(value);
      if (n === null) return `${field.label} must be a number`;
      if (n < 0) return `${field.label} cannot be negative`;
      if (v.min !== undefined && n < v.min) return `${field.label} must be at least ${v.min}`;
      if (v.max !== undefined && n > v.max) return `${field.label} must be at most ${v.max}`;
      return null;
    }
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
        ? null
        : `${field.label} must be a valid email`;
    case 'phone':
      return typeof value === 'string' && value.replace(/\D/g, '').length >= 8
        ? null
        : `${field.label} must be a valid phone number`;
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? null
        : `${field.label} must be a date`;
    case 'time':
      return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
        ? null
        : `${field.label} must be a time (HH:MM)`;
    default:
      break;
  }
  if (typeof value === 'string') {
    if (v.minLength !== undefined && value.trim().length < v.minLength) {
      return `${field.label} must be at least ${v.minLength} characters`;
    }
    if (v.maxLength !== undefined && value.length > v.maxLength) {
      return `${field.label} must be at most ${v.maxLength} characters`;
    }
    if (v.pattern) {
      try {
        if (!new RegExp(v.pattern).test(value.trim())) return `${field.label} is not valid`;
      } catch {
        /* an invalid admin-authored pattern must not block applicants */
      }
    }
  }
  return null;
}

function humanize(key: string) {
  const last = key.split('.').pop() ?? key;
  return last
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());
}

export function computeApplicationReadiness(
  input: ReadinessInput,
): ProviderApplicationReadiness {
  const flat = flattenPayload(input.commonPayload);
  const missing: ProviderApplicationMissingItem[] = [];
  const seen = new Set<string>();
  const push = (item: ProviderApplicationMissingItem) => {
    if (seen.has(item.key)) return;
    seen.add(item.key);
    missing.push(item);
  };
  const docs = new Set(input.documentFieldKeys);

  let requiredCount = 1; // at least one service
  if (!input.categoryIds.length) {
    push({
      key: 'services.categoryIds',
      label: 'Primary service',
      sectionId: 'services',
      reason: 'services',
      message: 'Select the service you offer',
    });
  }

  for (const field of input.schema.fields) {
    if (field.required) requiredCount += 1;
    if (DOCUMENT_TYPES.has(field.type)) {
      if (!field.required) continue;
      const present =
        field.type === 'aadhaar' || field.key === 'identity.aadhaarNumber'
          ? input.hasAadhaar
          : docs.has(field.key);
      if (!present) {
        push({
          key: field.key,
          label: field.label,
          sectionId: field.sectionId,
          reason: 'document',
          message:
            field.type === 'aadhaar'
              ? `${field.label} is required`
              : `Upload ${field.label.toLowerCase()}`,
        });
      }
      continue;
    }
    const value = readFieldValue(field, flat, input.dynamicPayload);
    if (field.required && isEmpty(value)) {
      push({
        key: field.key,
        label: field.label,
        sectionId: field.sectionId,
        reason: 'required',
        message: `${field.label} is required`,
      });
      continue;
    }
    const error = validateFieldValue(field, value);
    if (error) {
      push({
        key: field.key,
        label: field.label,
        sectionId: field.sectionId,
        reason: 'invalid',
        message: error,
      });
    }
  }

  // The common payload must also satisfy the full contract, because that is
  // what becomes the public business profile on approval.
  const parsed = ProviderApplicationCommonPayloadSchema.safeParse({
    profile: {},
    services: {},
    ...input.commonPayload,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      const field =
        input.schema.fields.find(f => f.key === key) ??
        input.schema.fields.find(f => PROVIDER_FORM_FIELD_ALIASES[f.key] === key);
      const fieldKey = field?.key ?? key;
      if (seen.has(fieldKey)) continue;
      const label = field?.label ?? humanize(key);
      const empty = issue.code === 'invalid_type' && issue.received === 'undefined';
      push({
        key: fieldKey,
        label,
        sectionId: field?.sectionId ?? String(issue.path[0] ?? 'basic'),
        reason: empty ? 'required' : 'invalid',
        message: empty ? `${label} is required` : `${label} is not valid`,
      });
    }
  }

  const requiredMissing = missing.filter(m => m.reason !== 'invalid').length;
  return {
    complete: missing.length === 0,
    requiredCount,
    completedCount: Math.max(0, requiredCount - requiredMissing),
    missing,
  };
}
