import { linking } from './linking';

const providerId = 'ed3b2a59-3ab7-49bd-b557-d74294a01ed4';
function parse(path: string) {
  return linking.getStateFromPath!(path, linking.config)?.routes.at(-1);
}

test.each([`business/${providerId}`, `provider/${providerId}`])('opens the business storefront link %s', path => {
  expect(parse(path)).toMatchObject({ name: 'BusinessProfile', params: { providerId } });
});
test('migrates old business profile and provider Details links', () => {
  expect(parse(`profile?profileType=business&profileId=${providerId}`)).toMatchObject({ name: 'BusinessProfile', params: { providerId } });
  expect(parse(`detail/provider/${providerId}/service-1`)).toMatchObject({ name: 'BusinessProfile', params: { providerId, categoryId: 'service-1' } });
});
test('preserves personal profiles, demo Details, and onboarding/dashboard links', () => {
  expect(parse(`profile/${providerId}`)).toMatchObject({ name: 'Profile', params: { userId: providerId } });
  expect(parse('detail/provider/prov-demo/health.doctors')).toMatchObject({ name: 'UniversalDetail', params: { entityId: 'prov-demo' } });
  expect(parse('provider/apply')).toMatchObject({ name: 'ProviderApplicationIntro' });
  expect(parse('provider/apply/application-1/form')).toMatchObject({ name: 'ProviderApplicationForm', params: { applicationId: 'application-1' } });
  expect(parse('provider/dashboard')).toMatchObject({ name: 'ProviderDashboard' });
});
test('keeps booking and owner management links on their dedicated guarded screens', () => {
  expect(parse(`business/${providerId}/book?categoryId=service-1`)).toMatchObject({ name: 'BusinessBooking', params: { providerId, categoryId: 'service-1' } });
  expect(parse(`business/${providerId}/manage/services`)).toMatchObject({ name: 'BusinessManage', params: { providerId, section: 'services' } });
});
