import {
  businessProfileDestination, legacyBusinessDestination, navigateToProfile,
  navigateToProvider, normalizeBusinessNavigationState, profileDestination, providerDestination,
} from './businessNavigation';

const providerId = 'ed3b2a59-3ab7-49bd-b557-d74294a01ed4';

describe('business storefront navigation', () => {
  it('keeps business and personal identities separate even when their ids are the same', () => {
    expect(profileDestination({ type: 'business', id: providerId })).toEqual({ screen: 'BusinessProfile', params: { providerId } });
    expect(profileDestination({ type: 'provider', id: providerId })).toEqual({ screen: 'BusinessProfile', params: { providerId } });
    expect(profileDestination({ type: 'personal', id: providerId })).toEqual({ screen: 'Profile', params: { profileType: 'personal', profileId: providerId } });
    expect(profileDestination({ type: 'user', id: 'user-1' })).toEqual({ screen: 'Profile', params: { profileType: 'personal', profileId: 'user-1' } });
  });

  it('opens approved API providers in their storefront while preserving demo Details', () => {
    expect(providerDestination(providerId, ' service-1 ')).toEqual({ screen: 'BusinessProfile', params: { providerId, categoryId: 'service-1' } });
    expect(providerDestination('prov-demo', 'health.doctors')).toEqual({ screen: 'UniversalDetail', params: { entityType: 'provider', entityId: 'prov-demo', categoryId: 'health.doctors' } });
    expect(businessProfileDestination(` ${providerId} `, '')).toEqual({ screen: 'BusinessProfile', params: { providerId } });
  });

  it('uses the same identity rules from chat, author, listing and active-profile actions', () => {
    const navigation = { navigate: jest.fn() };
    navigateToProfile(navigation, { type: 'business', id: providerId });
    expect(navigation.navigate).toHaveBeenLastCalledWith('BusinessProfile', { providerId });
    navigateToProfile(navigation, { type: 'personal', id: 'customer' });
    expect(navigation.navigate).toHaveBeenLastCalledWith('Profile', { profileType: 'personal', profileId: 'customer' });
    navigateToProvider(navigation, providerId, 'category');
    expect(navigation.navigate).toHaveBeenLastCalledWith('BusinessProfile', { providerId, categoryId: 'category' });
  });

  it.each([
    ['Profile', { profileType: 'business', profileId: providerId }],
    ['Profile', { profileType: 'business', userId: providerId }],
    ['UniversalDetail', { entityType: 'provider', entityId: providerId }],
    ['DoctorProfile', { doctorId: providerId }], ['LabDetail', { labId: providerId }], ['ClassDetail', { classId: providerId }],
  ])('migrates a historic %s business link', (screen, params) => {
    expect(legacyBusinessDestination(screen as string, params as Record<string, unknown>)).toEqual({ screen: 'BusinessProfile', params: { providerId } });
  });

  it.each([
    ['Profile', { userId: providerId }], ['Profile', { profileType: 'personal', profileId: providerId }],
    ['UniversalDetail', { entityType: 'product', entityId: providerId }],
    ['UniversalDetail', { entityType: 'provider', entityId: 'prov-demo' }],
    ['DoctorProfile', { doctorId: 'doc-remya' }], ['LabDetail', { labId: 'lab-demo' }],
    ['ProviderApplicationForm', { applicationId: providerId }], ['ProviderDashboard', { providerId }],
  ])('does not hijack a personal, demo or owner %s route', (screen, params) => {
    expect(legacyBusinessDestination(screen as string, params as Record<string, unknown>)).toBeNull();
  });

  it('migrates nested business links without changing personal routes or mutating navigation state', () => {
    const state = Object.freeze({ index: 1, routes: [
      { name: 'Main', state: { routes: [{ name: 'PlayFeed', params: { reelId: 'clip-1' } }] } },
      { name: 'Profile', params: { profileType: 'business', profileId: providerId } },
    ] });
    const normalized = normalizeBusinessNavigationState(state);
    expect(normalized.routes[1]).toEqual({ name: 'BusinessProfile', params: { providerId } });
    expect(normalized.routes[0]).toEqual(state.routes[0]);
    expect(state.routes[1].name).toBe('Profile');
    expect(normalizeBusinessNavigationState(undefined)).toBeUndefined();
  });
});
