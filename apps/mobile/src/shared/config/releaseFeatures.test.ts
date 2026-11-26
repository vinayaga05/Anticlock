function edition(os: 'android' | 'ios') {
  jest.resetModules();
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
  return require('./releaseFeatures') as typeof import('./releaseFeatures');
}

afterEach(() => jest.dontMock('react-native'));

test('Android excludes mixed health providers, catalogue categories, courses and health bookings', () => {
  const policy = edition('android');
  const rows = [
    { id: 'health.doctors', treeId: 'health' },
    { id: 'uuid-health-tree', slug: 'health' },
    { id: 'home.plumber', treeId: 'home_services' },
    { id: 'provider-1', categories: [{ id: 'uuid', treeId: 'health' }] },
    { id: 'provider-2', categoryIds: ['fitness.yoga', 'beauty.salon'] },
    { id: 'course-1', categoryId: 'course.health_fitness' },
    { id: 'booking-1', kind: 'doctor' },
    { id: 'legacy-booking', category: 'appointment', categoryId: null },
  ];
  expect(policy.releaseRecords(rows)).toEqual([rows[2]]);
  expect(policy.releaseResponse({ data: rows, cursor: 'page2' })).toEqual({
    data: [rows[2]],
    cursor: 'page2',
  });
});

test('Android denies health routes even through nested links and sensitive network requests', () => {
  const policy = edition('android');
  for (const name of [
    'Doctors',
    'DoctorProfile',
    'LabDetail',
    'DiagnosticsHub',
    'PhysioHub',
    'FitnessHome',
    'FitnessSharing',
    'ClassDetail',
    'Schedule',
    'BookingConfirm',
  ]) {
    expect(policy.isHealthRoute(name)).toBe(true);
  }
  expect(
    policy.isHealthRoute('ServiceCategory', { categoryId: 'health.doctors' }),
  ).toBe(true);
  expect(policy.isHealthRoute('Main', { screen: 'Shop' })).toBe(false);
  expect(policy.isHealthRequest('/v1/fitness/assessment')).toBe(true);
  expect(policy.isHealthRequest('/v1/catalog/categories?treeId=health')).toBe(
    true,
  );
  expect(
    policy.isHealthRequest('/v1/bookings', {
      categoryId: 'wellness.nutrition_clinical',
    }),
  ).toBe(true);
  expect(
    policy.isHealthRequest('/v1/bookings', { categoryId: 'home.plumber' }),
  ).toBe(false);
});

test('iOS retains its health catalogue and routes', () => {
  const policy = edition('ios');
  const rows = [{ id: 'health.doctors' }];
  expect(policy.releaseRecords(rows)).toBe(rows);
  expect(policy.releaseResponse({ data: rows })).toEqual({ data: rows });
  expect(policy.isHealthRoute('FitnessHome')).toBe(false);
  expect(policy.isHealthRequest('/v1/fitness/assessment')).toBe(false);
});
