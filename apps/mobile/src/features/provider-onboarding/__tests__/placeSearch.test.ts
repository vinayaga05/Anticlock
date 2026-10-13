import {
  placeQueryFromValues,
  shiftCenter,
  visibleTiles,
} from '@/features/provider-onboarding/utils/placeSearch';

describe('place search helpers', () => {
  it('joins the address fields for the same section', () => {
    expect(
      placeQueryFromValues(
        {
          'location.address': ' 12 Lake Road ',
          'location.area': 'Adyar',
          'location.city': 'Chennai',
          'location.pincode': '600020',
          'other.city': 'Mumbai',
        },
        'location.map',
      ),
    ).toBe('12 Lake Road, Adyar, Chennai, 600020');
  });

  it('moves the map centre opposite the finger drag', () => {
    const next = shiftCenter({ latitude: 13, longitude: 80 }, 100, 50, 16);
    expect(next.longitude).toBeLessThan(80);
    expect(next.latitude).toBeGreaterThan(13);
  });

  it('covers the viewport with map tiles', () => {
    const tiles = visibleTiles({ latitude: 13.08, longitude: 80.27 }, 16, 300, 200);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0]?.url).toMatch(/^https:\/\/basemaps\.cartocdn\.com\/rastertiles\/voyager\/16\//);
  });
});
