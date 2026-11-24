import { Platform, processColor } from 'react-native';
import { elevatedSurface } from './elevatedSurface';

const originalOS = Platform.OS;
beforeEach(() => { Platform.OS = 'android'; });
afterEach(() => { Platform.OS = originalOS; });

test.each([
  ['rgba(167, 139, 250, 0.12)', '#FFFFFF', 'rgb(244, 241, 254)'],
  ['rgba(167, 139, 250, 0.12)', '#1E1D1B', 'rgb(47, 42, 54)'],
  ['#A78BFA33', '#FFFFFF', 'rgb(237, 232, 254)'],
  ['transparent', '#FFFFFF', 'rgb(255, 255, 255)'],
])('composites elevated tint %s over %s', (backgroundColor, surface, expected) => {
  const input = { backgroundColor, elevation: 2, borderRadius: 24, padding: 16 };
  const result = elevatedSurface(input, surface);
  expect(result).toEqual({ ...input, backgroundColor: expected });
  expect((processColor(result.backgroundColor) as number) >>> 24).toBe(255);
  expect(input.backgroundColor).toBe(backgroundColor);
});

test('leaves opaque fills and unelevated tints unchanged', () => {
  for (const input of [
    { backgroundColor: '#FFFFFF', elevation: 2 },
    { backgroundColor: 'rgba(167,139,250,0.12)', elevation: 0 },
    { backgroundColor: 'rgba(167,139,250,0.12)' },
  ]) expect(elevatedSurface(input, '#FFFFFF')).toBe(input);
});

test('keeps iOS translucency and shadow styles unchanged', () => {
  Platform.OS = 'ios';
  const input = { backgroundColor: 'rgba(167,139,250,0.12)', elevation: 2, shadowOpacity: 0.08 };
  expect(elevatedSurface(input, '#FFFFFF')).toBe(input);
});
