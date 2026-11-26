import {
  isPlayHealthCategory as isHealthCategory,
  isPlayHealthRecord as isHealthRecord,
  filterPersonalPlayResponse,
} from '@anticlock/contracts/play-edition';
import { Platform } from 'react-native';

// The personal-account Play distribution excludes health services and records.
// This is fixed in the Android binary, not controlled by server flags or __DEV__.
export const healthFeaturesEnabled = Platform.OS !== 'android';

export {
  isPlayHealthCategory as isHealthCategory,
  isPlayHealthRecord as isHealthRecord,
} from '@anticlock/contracts/play-edition';

export function releaseRecords<T>(rows: T[]): T[] {
  return healthFeaturesEnabled
    ? rows
    : rows.filter(row => !isHealthRecord(row));
}

/** Filter server catalogues and nested provider results as well as local fixtures. */
export function releaseResponse(value: unknown): unknown {
  return healthFeaturesEnabled ? value : filterPersonalPlayResponse(value);
}

export function isHealthRoute(name: string, params?: object): boolean {
  if (healthFeaturesEnabled) return false;
  return (
    /^(?:Fitness|Doctor|Diagnostics|Lab|Physio|ClassDetail|Schedule|BookingConfirm)/.test(name) ||
    isHealthRecord(params) ||
    Boolean(
      params &&
        Object.values(params).some(
          value => value && typeof value === 'object' && isHealthRecord(value),
        ),
    )
  );
}

export function isHealthRequest(path: string, body?: unknown): boolean {
  if (healthFeaturesEnabled) return false;
  const [pathname, query = ''] = path.split('?');
  return (
    pathname === '/v1/assistant/chat' ||
    /^\/v1\/(?:fitness|health|doctors|labs)(?:\/|$)/.test(pathname) ||
    [...new URLSearchParams(query).entries()].some(
      ([key, value]) =>
        ['categoryId', 'treeId'].includes(key) && isHealthCategory(value),
    ) ||
    isHealthRecord(body)
  );
}
