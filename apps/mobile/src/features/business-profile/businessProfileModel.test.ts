import {
  businessBrand,
  businessDistance,
  businessDistanceKm,
  businessInitials,
  businessPrice,
  businessProfileLink,
  directionsUrl,
} from './businessProfileModel';

function lum(color: string) {
  const c = [1, 3, 5]
    .map(i => parseInt(color.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
test.each(['#FFFFFF', '#FFEECC', '#112A23', '#000000', '#FF00FF'])(
  'brand %s keeps action labels and dark-mode accents legible',
  preferred => {
    const light = businessBrand('business-1', preferred);
    const dark = businessBrand('business-1', preferred, true);
    expect(1.05 / (lum(light.button) + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(1.05 / (lum(dark.button) + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(
      (lum(dark.accent) + 0.05) / (lum('#19211C') + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  },
);
test('business accents are stable, varied, and reject unsafe owner values', () => {
  expect(businessBrand('a')).toEqual(businessBrand('a'));
  expect(businessBrand('a').accent).not.toBe(businessBrand('b').accent);
  expect(businessBrand('a', 'url(bad)')).toEqual(businessBrand('a'));
});
test('formats real names and prices without invented defaults', () => {
  expect(businessInitials('  Lotus   Movement Studio ')).toBe('LM');
  expect(businessInitials('')).toBe('B');
  expect(businessPrice(null)).toBe('Price on request');
  expect(businessPrice(0)).toBe('₹0');
  expect(businessPrice(1500)).toBe('₹1,500');
});
test('distance needs valid viewer coordinates and uses real geographic distance', () => {
  expect(
    businessDistanceKm(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    ),
  ).toBeCloseTo(111.195, 2);
  expect(
    businessDistanceKm(
      { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: 0 },
    ),
  ).toBeNull();
  expect(businessDistance(null)).toBeNull();
  expect(businessDistance(0.4)).toBe('400 m away');
  expect(businessDistance(4.25)).toBe('4.3 km away');
});
test('directions and share links preserve the actual business identity and address', () => {
  expect(businessProfileLink('business / 1')).toBe(
    'https://anticlock.online/business/business%20%2F%201',
  );
  expect(directionsUrl({ latitude: 13, longitude: 80 })).toContain('13%2C80');
  expect(
    directionsUrl({
      latitude: null,
      longitude: null,
      address: 'A & B Road',
      city: 'Chennai',
    }),
  ).toContain('A%20%26%20B%20Road%2C%20Chennai');
  expect(directionsUrl({ latitude: null, longitude: null })).toBeNull();
});
