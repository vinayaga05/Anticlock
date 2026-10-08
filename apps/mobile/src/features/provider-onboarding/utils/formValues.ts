import type {
  FormFieldDefinition,
  ProviderApplicationDetail,
  ResolvedProviderFormSchema,
} from '@/features/provider-onboarding/types';

export function setNestedValue(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  const parts = key.split('.');
  let current = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]!;
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

export function splitFormValues(
  values: Record<string, unknown>,
  commonPrefixes: string[],
) {
  const commonPayload: Record<string, unknown> = {};
  const dynamicPayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    const prefix = key.split('.')[0] ?? key;
    if (commonPrefixes.includes(prefix)) {
      setNestedValue(commonPayload, key, value);
    } else {
      dynamicPayload[key] = value;
    }
  }

  return { commonPayload, dynamicPayload };
}

export const COMMON_SECTION_PREFIXES = [
  'basic',
  'location',
  'profile',
  'identity',
  'availability',
  'services',
];

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Form field keys whose stored payload key differs (media fields hold media
 * IDs). Mirrors PROVIDER_FORM_FIELD_ALIASES in @anticlock/contracts.
 */
export const FORM_FIELD_ALIASES: Record<string, string> = {
  'profile.logo': 'profile.logoMediaId',
  'profile.coverImages': 'profile.coverMediaIds',
  'profile.introVideo': 'profile.introVideoMediaId',
};

export const AADHAAR_FIELD_KEY = 'identity.aadhaarNumber';

/** Field types that are stored as documents, never in the payload. */
const DOCUMENT_TYPES = new Set(['document', 'aadhaar']);
const NUMERIC_TYPES = new Set(['number', 'currency']);

export type LocationValue = { latitude: number; longitude: number };

export function isEmptyValue(value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** "1,200" / " 450 " / 450 -> number; anything else -> null. */
export function parseNumberInput(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[,\s₹]/g, '');
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseLocationValue(value: unknown): LocationValue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const loc = value as Record<string, unknown>;
  const latitude = parseNumberInput(loc.latitude);
  const longitude = parseNumberInput(loc.longitude);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

function flatten(
  obj: Record<string, unknown>,
  prefix = '',
  out: Record<string, unknown> = {},
) {
  for (const [key, value] of Object.entries(obj ?? {})) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Record<string, unknown>, full, out);
    } else {
      out[full] = value;
    }
  }
  return out;
}

/**
 * Turns a saved application back into form values keyed by field key
 * (reverse of buildApplicationPayload).
 */
export function hydrateFormValues(
  app: Pick<ProviderApplicationDetail, 'commonPayload' | 'dynamicPayload'>,
  schema?: ResolvedProviderFormSchema | null,
): Record<string, unknown> {
  const flat = flatten((app.commonPayload ?? {}) as Record<string, unknown>);
  const values: Record<string, unknown> = {};
  const reverseAliases = Object.fromEntries(
    Object.entries(FORM_FIELD_ALIASES).map(([field, stored]) => [
      stored,
      field,
    ]),
  );
  for (const [key, value] of Object.entries(flat)) {
    values[reverseAliases[key] ?? key] = value;
  }
  Object.assign(values, app.dynamicPayload ?? {});

  for (const field of schema?.fields ?? []) {
    if (field.type === 'location') {
      const section = field.key.split('.')[0];
      const lat = flat[`${section}.latitude`];
      const lng = flat[`${section}.longitude`];
      if (lat !== undefined && lng !== undefined) {
        values[field.key] = { latitude: String(lat), longitude: String(lng) };
      }
    } else if (
      NUMERIC_TYPES.has(field.type) &&
      typeof values[field.key] === 'number'
    ) {
      // Inputs edit strings; the payload builder parses them back.
      values[field.key] = String(values[field.key]);
    }
  }
  delete values[AADHAAR_FIELD_KEY];
  return values;
}

function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  let current: unknown = obj;
  for (const part of key.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isEmptyLocation(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
  return Object.values(value as Record<string, unknown>).every(isEmptyValue);
}

function savedLocation(
  savedCommon: Record<string, unknown>,
  section: string,
): LocationValue | null {
  const stored = (savedCommon[section] ?? {}) as Record<string, unknown>;
  return parseLocationValue({
    latitude: stored.latitude,
    longitude: stored.longitude,
  });
}

export type BuiltApplicationPayload = {
  commonPayload: Record<string, unknown>;
  dynamicPayload: Record<string, unknown>;
  aadhaarNumber?: string;
};

/**
 * Builds the PATCH body from form values: numbers are parsed, media fields
 * are written to their *MediaId keys, a map location becomes
 * location.latitude/longitude, documents and Aadhaar never enter the
 * payload. A value that fails to parse (a half-typed number) never fails the
 * autosave: the field shows an error and the last saved value (`saved`) is
 * sent instead, because the API replaces each common section wholesale.
 */
export function buildApplicationPayload(
  values: Record<string, unknown>,
  schema?: ResolvedProviderFormSchema | null,
  saved?: Pick<ProviderApplicationDetail, 'commonPayload'> | null,
): BuiltApplicationPayload {
  const savedCommon = (saved?.commonPayload ?? {}) as Record<string, unknown>;
  const fieldsByKey = new Map((schema?.fields ?? []).map(f => [f.key, f]));
  const commonPayload: Record<string, unknown> = {};
  const dynamicPayload: Record<string, unknown> = {};
  let aadhaarNumber: string | undefined;

  for (const [key, raw] of Object.entries(values)) {
    const field = fieldsByKey.get(key);
    if (key === AADHAAR_FIELD_KEY || field?.type === 'aadhaar') {
      const digits = typeof raw === 'string' ? raw.replace(/\D/g, '') : '';
      if (digits.length === 12) aadhaarNumber = digits;
      continue;
    }
    if (field && DOCUMENT_TYPES.has(field.type)) continue;

    let value: unknown = raw;
    const targetKey = FORM_FIELD_ALIASES[key] ?? key;
    const prefix = key.split('.')[0] ?? key;
    const isCommon = COMMON_SECTION_PREFIXES.includes(prefix);

    if (field?.type === 'location') {
      const loc = parseLocationValue(raw);
      const typed = !isEmptyLocation(raw);
      if (isCommon) {
        const keep = loc ?? (typed ? savedLocation(savedCommon, prefix) : null);
        if (keep) {
          setNestedValue(commonPayload, `${prefix}.latitude`, keep.latitude);
          setNestedValue(commonPayload, `${prefix}.longitude`, keep.longitude);
        }
        continue;
      }
      // Dynamic keys merge one by one on the API: skipping keeps the saved value.
      if (!loc && typed) continue;
      value = loc ?? undefined;
    } else if (field && NUMERIC_TYPES.has(field.type)) {
      if (isEmptyValue(raw)) {
        value = undefined;
      } else {
        const n = parseNumberInput(raw);
        if (n === null) {
          if (isCommon) {
            const previous = getNestedValue(savedCommon, targetKey);
            if (typeof previous === 'number') {
              setNestedValue(commonPayload, targetKey, previous);
            }
          }
          continue;
        }
        value = n;
      }
    } else if (typeof raw === 'string') {
      value = raw.trim() ? raw.trim() : undefined;
    }
    if (value === undefined) {
      if (!isCommon) dynamicPayload[key] = null;
      continue;
    }
    if (isCommon) {
      setNestedValue(commonPayload, targetKey, value);
    } else {
      dynamicPayload[key] = value;
    }
  }
  // Send every common section the form owns, even when emptied, so the
  // server's per-section replace really clears removed values.
  for (const field of schema?.fields ?? []) {
    const prefix = field.key.split('.')[0] ?? field.key;
    if (
      prefix !== 'identity' &&
      COMMON_SECTION_PREFIXES.includes(prefix) &&
      !commonPayload[prefix]
    ) {
      commonPayload[prefix] = {};
    }
  }
  return { commonPayload, dynamicPayload, aadhaarNumber };
}

/** Client-side field validation; keep in sync with the API's readiness check. */
export function validateField(
  field: FormFieldDefinition,
  value: unknown,
  opts: { hasDocument?: boolean; aadhaarSaved?: boolean } = {},
): string | null {
  if (field.type === 'document') {
    return field.required && !opts.hasDocument
      ? `Upload ${field.label.toLowerCase()}`
      : null;
  }
  if (field.type === 'aadhaar' || field.key === AADHAAR_FIELD_KEY) {
    const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
    if (!digits) {
      return field.required && !opts.aadhaarSaved
        ? `${field.label} is required`
        : null;
    }
    return digits.length === 12 ? null : `${field.label} must be 12 digits`;
  }
  if (field.type === 'location') {
    const hasAny =
      value &&
      typeof value === 'object' &&
      Object.values(value as Record<string, unknown>).some(
        v => !isEmptyValue(v),
      );
    if (!hasAny) return field.required ? `${field.label} is required` : null;
    return parseLocationValue(value)
      ? null
      : 'Enter a valid latitude and longitude';
  }
  if (isEmptyValue(value)) {
    return field.required ? `${field.label} is required` : null;
  }
  const v = field.validation ?? {};
  switch (field.type) {
    case 'number':
    case 'currency': {
      const n = parseNumberInput(value);
      if (n === null) return `${field.label} must be a number`;
      if (n < 0) return `${field.label} cannot be negative`;
      if (v.min !== undefined && n < v.min)
        return `${field.label} must be at least ${v.min}`;
      if (v.max !== undefined && n > v.max)
        return `${field.label} must be at most ${v.max}`;
      return null;
    }
    case 'email':
      return typeof value === 'string' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
        ? null
        : 'Enter a valid email address';
    case 'phone':
      return typeof value === 'string' && value.replace(/\D/g, '').length >= 8
        ? null
        : 'Enter a valid phone number';
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? null
        : 'Pick a date';
    case 'time':
      return typeof value === 'string' &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
        ? null
        : 'Pick a time';
    default:
      break;
  }
  if (typeof value === 'string') {
    if (v.minLength !== undefined && value.trim().length < v.minLength) {
      return `Must be at least ${v.minLength} characters`;
    }
    if (v.maxLength !== undefined && value.length > v.maxLength) {
      return `Must be at most ${v.maxLength} characters`;
    }
    if (v.pattern) {
      try {
        if (!new RegExp(v.pattern).test(value.trim())) {
          return `Enter a valid ${field.label.toLowerCase()}`;
        }
      } catch {
        // An invalid admin-authored pattern must not block applicants.
      }
    }
  }
  return null;
}

export function validateFormValues(
  schema: ResolvedProviderFormSchema,
  values: Record<string, unknown>,
  opts: { documentKeys?: Iterable<string>; aadhaarSaved?: boolean } = {},
): Record<string, string> {
  const docs = new Set(opts.documentKeys ?? []);
  const errors: Record<string, string> = {};
  for (const field of schema.fields) {
    const error = validateField(field, values[field.key], {
      hasDocument: docs.has(field.key),
      aadhaarSaved: opts.aadhaarSaved,
    });
    if (error) errors[field.key] = error;
  }
  return errors;
}

/** Required-field completion for progress display. */
export function computeCompletion(
  schema: ResolvedProviderFormSchema,
  values: Record<string, unknown>,
  opts: { documentKeys?: Iterable<string>; aadhaarSaved?: boolean } = {},
) {
  const errors = validateFormValues(schema, values, opts);
  const required = schema.fields.filter(f => f.required);
  const done = required.filter(f => !errors[f.key]).length;
  return { required: required.length, done, errors };
}

/** "HH:mm" -> "h:mm AM/PM"; anything else is returned unchanged. */
export function formatTimeLabel(value: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
