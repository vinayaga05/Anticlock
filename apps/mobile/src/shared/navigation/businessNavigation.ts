import type { RootStackParamList } from './types';

type Navigator = { navigate: (screen: string, params?: object) => unknown };
type ProfileRef = { id: string; type: 'business' | 'provider' | 'personal' | 'user' };
export type BusinessProfileDestination = { screen: 'BusinessProfile'; params: RootStackParamList['BusinessProfile'] };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const API_PROVIDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function businessProfileDestination(providerId: string, categoryId?: string): BusinessProfileDestination {
  const category = text(categoryId);
  return { screen: 'BusinessProfile', params: { providerId: text(providerId), ...(category ? { categoryId: category } : {}) } };
}

/** Publisher type is authoritative; a business never uses the personal page. */
export function profileDestination(profile: ProfileRef): BusinessProfileDestination | { screen: 'Profile'; params: NonNullable<RootStackParamList['Profile']> } {
  return profile.type === 'business' || profile.type === 'provider'
    ? businessProfileDestination(profile.id)
    : { screen: 'Profile', params: { profileType: 'personal', profileId: text(profile.id) } };
}

/** UUID marketplace providers are live businesses; demo catalog IDs retain Details. */
export function providerDestination(providerId: string, categoryId?: string): BusinessProfileDestination | { screen: 'UniversalDetail'; params: RootStackParamList['UniversalDetail'] } {
  return API_PROVIDER_ID.test(text(providerId))
    ? businessProfileDestination(providerId, categoryId)
    : { screen: 'UniversalDetail', params: { entityType: 'provider', entityId: text(providerId), categoryId: text(categoryId) } };
}

export function navigateToProfile(navigation: Navigator, profile: ProfileRef) {
  const destination = profileDestination(profile);
  navigation.navigate(destination.screen, destination.params);
}

export function navigateToProvider(navigation: Navigator, providerId: string, categoryId?: string) {
  const destination = providerDestination(providerId, categoryId);
  navigation.navigate(destination.screen, destination.params);
}

/** Compatibility for stored links and callers from before business storefronts. */
export function legacyBusinessDestination(screen: string, params: Record<string, unknown> = {}): BusinessProfileDestination | null {
  if (!params || typeof params !== 'object') return null;
  if (screen === 'Profile' && (params.profileType === 'business' || params.profileType === 'provider')) {
    const providerId = text(params.profileId) || text(params.userId);
    return providerId ? businessProfileDestination(providerId, text(params.categoryId)) : null;
  }
  const providerId = screen === 'UniversalDetail' && params.entityType === 'provider' ? text(params.entityId)
    : screen === 'DoctorProfile' ? text(params.doctorId)
    : screen === 'LabDetail' ? text(params.labId)
    : screen === 'ClassDetail' ? text(params.classId) : '';
  return API_PROVIDER_ID.test(providerId) ? businessProfileDestination(providerId, text(params.categoryId)) : null;
}

/** Preserve nested tab state while migrating only known business destinations. */
export function normalizeBusinessNavigationState<T>(state: T): T {
  if (!state || typeof state !== 'object') return state;
  const value = state as Record<string, unknown>;
  if (!Array.isArray(value.routes)) return state;
  return {
    ...value,
    routes: value.routes.map(route => {
      if (!route || typeof route !== 'object') return route;
      const target = legacyBusinessDestination(route.name, route.params);
      return {
        ...route,
        ...(target ? { name: target.screen, params: target.params } : {}),
        ...(route.state ? { state: normalizeBusinessNavigationState(route.state) } : {}),
      };
    }),
  } as T;
}
