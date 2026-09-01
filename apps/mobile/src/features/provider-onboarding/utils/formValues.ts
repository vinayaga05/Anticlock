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
