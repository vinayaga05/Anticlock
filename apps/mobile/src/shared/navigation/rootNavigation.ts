import { healthFeaturesEnabled } from '@/shared/config/releaseFeatures';
import { createNavigationContainerRef } from '@react-navigation/native';

/** Navigation ref for code that runs outside screens (push taps). */
export const rootNavigationRef = createNavigationContainerRef<any>();

export type NotificationRoute = {
  screen: string;
  params?: Record<string, unknown>;
};

/**
 * Maps a notification `data` payload (in-app record or FCM data, where every
 * value is a string) to a screen. Unknown payloads return null.
 */
export function routeForNotification(
  data: Record<string, unknown> | null | undefined,
): NotificationRoute | null {
  if (!data) return null;
  if (data.kind === 'fitness') return healthFeaturesEnabled ? routeForFitnessNotification(data) : null;
  const applicationId =
    typeof data.applicationId === 'string' ? data.applicationId : null;
  if (data.kind === 'provider_application' && applicationId) {
    return { screen: 'ProviderApplicationStatus', params: { applicationId } };
  }
  const bookingId = typeof data.bookingId === 'string' ? data.bookingId : null;
  const providerId = typeof data.providerId === 'string' ? data.providerId : null;
  if (data.kind === 'booking' && bookingId) {
    if (data.screen === 'ProviderDashboard' && providerId) {
      return { screen: 'ProviderDashboard', params: { providerId } };
    }
    return data.screen === 'MyBookings'
      ? { screen: 'MyBookings' }
      : { screen: 'BookingDetail', params: { bookingId } };
  }
  const entityId = typeof data.entityId === 'string' ? data.entityId : null;
  if (entityId && data.entityType === 'provider') {
    return { screen: 'BusinessProfile', params: { providerId: entityId } };
  }
  if (data.kind === 'business' && providerId) {
    return { screen: 'BusinessProfile', params: { providerId } };
  }
  if (entityId && (data.entityType === 'event' || data.entityType === 'product')) {
    return {
      screen: 'ExploreSubmissionDetail',
      params: { itemId: entityId, kind: data.entityType },
    };
  }
  return null;
}

const fitnessUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const fitnessDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00Z`).getTime()) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value;
function routeForFitnessNotification(data: Record<string, unknown>): NotificationRoute | null {
  const screen = data.screen;
  if (screen === 'FitnessHome') return { screen };
  if (screen === 'FitnessPlan' && fitnessUuid(data.planId)) {
    const version = Number(data.version);
    return { screen, params: { planId: data.planId, ...(Number.isSafeInteger(version) && version > 0 ? { version } : {}) } };
  }
  if (screen === 'FitnessWorkspace' && fitnessUuid(data.clientId) && fitnessUuid(data.providerId)) return { screen, params: { clientId: data.clientId, providerId: data.providerId, ...(fitnessUuid(data.resourceId) ? { resourceId: data.resourceId } : {}) } };
  if (screen === 'FitnessWorkout') {
    if (fitnessUuid(data.workoutId)) return { screen, params: { workoutId: data.workoutId } };
    const day = Number(data.day);
    if (fitnessUuid(data.planId) && Number.isInteger(day) && day >= 0 && day <= 6 && fitnessDate(data.date)) return { screen, params: { planId: data.planId, day, date: data.date } };
  }
  if (screen === 'FitnessMeals' && fitnessDate(data.date)) return { screen, params: { date: data.date, ...(fitnessUuid(data.logId) ? { logId: data.logId } : {}) } };
  if (screen === 'FitnessLog' && ['water','weight','sleep','steps','habit'].includes(String(data.logKind)) && fitnessDate(data.date)) return { screen, params: { kind: data.logKind, date: data.date, ...(fitnessUuid(data.logId) ? { logId: data.logId } : {}) } };
  if (screen === 'FitnessProgress' && fitnessDate(data.from) && fitnessDate(data.to)) return { screen, params: { from: data.from, to: data.to } };
  if (screen === 'BookingDetail' && fitnessUuid(data.bookingId)) return { screen, params: { bookingId: data.bookingId } };
  return null;
}

export function navigateFromNotification(
  data: Record<string, unknown> | null | undefined,
) {
  const route = routeForNotification(data);
  if (!route || !rootNavigationRef.isReady()) return false;
  rootNavigationRef.navigate(route.screen, route.params);
  return true;
}
