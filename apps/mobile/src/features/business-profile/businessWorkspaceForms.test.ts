import { businessFixture } from './businessTestFixture';
import {
  buildBusinessProfileUpdate,
  buildBusinessServicesUpdate,
  businessProfileDraft,
  businessServiceDraft,
} from './businessWorkspaceForms';

test('owner profile keeps real coordinates and schedule, normalizes optional website and brand fields', () => {
  const draft = businessProfileDraft(businessFixture());
  expect(draft.workingDays).toEqual(['Mon', 'Tue']);
  const body = buildBusinessProfileUpdate({
    ...draft,
    name: ' Mira Studio ',
    website: 'example.test/about',
    certifications: ' Certificate A \n\n Certificate B ',
    languages: ' Tamil, English ',
    yearsInBusiness: '0',
  });
  expect(body).toMatchObject({
    name: 'Mira Studio',
    website: 'https://example.test/about',
    certifications: ['Certificate A', 'Certificate B'],
    languages: ['Tamil', 'English'],
    yearsInBusiness: 0,
    latitude: 13,
    longitude: 80,
    workingDays: ['Mon', 'Tue'],
    openingTime: '09:00',
    closingTime: '18:00',
  });
});
test.each([
  { name: 'A' },
  { description: 'short' },
  { brandAccentColor: '#fff' },
  { website: 'https://user:password@example.test' },
  { latitude: '91' },
  { longitude: '' },
  { closingTime: '08:00' },
  { openingTime: '25:00' },
  { serviceRadiusKm: '0' },
  { yearsInBusiness: '1.5' },
  { phone: '123' },
  { email: 'invalid' },
])('rejects invalid owner data before an API request: %j', patch => {
  expect(() =>
    buildBusinessProfileUpdate({
      ...businessProfileDraft(businessFixture()),
      ...patch,
    }),
  ).toThrow();
});
test('service replacement preserves rupee units, modes and availability; blank optional values become null', () => {
  const service = businessServiceDraft(businessFixture().services[0]);
  expect(
    buildBusinessServicesUpdate([
      {
        ...service,
        description: '  Updated service  ',
        price: '0',
        durationMinutes: '',
        available: false,
      },
    ]),
  ).toEqual({
    services: [
      {
        categoryId: 'service-1',
        description: 'Updated service',
        price: 0,
        durationMinutes: null,
        modes: ['center', 'home'],
        available: false,
      },
    ],
  });
});
test.each([
  { price: '-1' },
  { price: '2.5' },
  { durationMinutes: '4' },
  { durationMinutes: '481' },
  { modes: [] },
])('rejects invalid service data: %j', patch => {
  expect(() =>
    buildBusinessServicesUpdate([
      { ...businessServiceDraft(businessFixture().services[0]), ...patch },
    ]),
  ).toThrow();
});
test('service replacement rejects an empty set and duplicate categories', () => {
  const service = businessServiceDraft(businessFixture().services[0]);
  expect(() => buildBusinessServicesUpdate([])).toThrow();
  expect(() => buildBusinessServicesUpdate([service, service])).toThrow();
});
