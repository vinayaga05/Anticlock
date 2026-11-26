import { GOOGLE_MAPS_API_KEY } from '@/shared/config/googleMapsApiKey';

export type MapPoint = { latitude: number; longitude: number };

const TILE_SIZE = 256;
const MIN_LAT = -85.05112878;
const MAX_LAT = 85.05112878;

export function placeQueryFromValues(
  values: Record<string, unknown>,
  fieldKey: string,
) {
  const section = fieldKey.split('.')[0] ?? 'location';
  return ['address', 'area', 'city', 'pincode']
    .map(part => values[`${section}.${part}`])
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean)
    .join(', ');
}

export function lngToWorldX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

export function latToWorldY(latitude: number, zoom: number) {
  const clamped = Math.min(MAX_LAT, Math.max(MIN_LAT, latitude));
  const radians = (clamped * Math.PI) / 180;
  const mercator = Math.log(Math.tan(Math.PI / 4 + radians / 2));
  return (0.5 - mercator / (2 * Math.PI)) * TILE_SIZE * 2 ** zoom;
}

export function worldXToLng(x: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  let longitude = (x / scale) * 360 - 180;
  longitude = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return longitude;
}

export function worldYToLat(y: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const mercator = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(mercator));
  return Math.min(MAX_LAT, Math.max(MIN_LAT, latitude));
}

/** Finger drag moves the map under a fixed pin. */
export function shiftCenter(
  center: MapPoint,
  dx: number,
  dy: number,
  zoom: number,
): MapPoint {
  return {
    latitude: worldYToLat(latToWorldY(center.latitude, zoom) - dy, zoom),
    longitude: worldXToLng(lngToWorldX(center.longitude, zoom) - dx, zoom),
  };
}

export type MapTile = { key: string; url: string; left: number; top: number };

export function visibleTiles(
  center: MapPoint,
  zoom: number,
  width: number,
  height: number,
): MapTile[] {
  const left = lngToWorldX(center.longitude, zoom) - width / 2;
  const top = latToWorldY(center.latitude, zoom) - height / 2;
  const n = 2 ** zoom;
  const x0 = Math.floor(left / TILE_SIZE);
  const y0 = Math.floor(top / TILE_SIZE);
  const x1 = Math.floor((left + width) / TILE_SIZE);
  const y1 = Math.floor((top + height) / TILE_SIZE);
  const tiles: MapTile[] = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      if (y < 0 || y >= n) continue;
      const wrapped = ((x % n) + n) % n;
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        url: `https://basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${wrapped}/${y}.png`,
        left: x * TILE_SIZE - left,
        top: y * TILE_SIZE - top,
      });
    }
  }
  return tiles;
}

export function formatCoordinates(point: MapPoint) {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

export type BusinessPlace = MapPoint & { address: string; city?: string; area?: string; pincode?: string };
type GeocodeResult = { formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } }; address_components?: Array<{ long_name?: string; types?: string[] }> };

async function geocode(params: string): Promise<BusinessPlace[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error('Address search is unavailable. Retry or place the pin manually.');
    const body = await response.json() as { status?: string; results?: GeocodeResult[] };
    if (body.status === 'ZERO_RESULTS') return [];
    if (body.status !== 'OK') throw new Error('Address search is unavailable. Retry or place the pin manually.');
    return (body.results ?? []).flatMap(result => {
      const latitude = result.geometry?.location?.lat, longitude = result.geometry?.location?.lng;
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
      const component = (...types: string[]) => result.address_components?.find(item => types.some(type => item.types?.includes(type)))?.long_name;
      return [{ latitude, longitude, address: result.formatted_address ?? '', city: component('locality', 'administrative_area_level_2'), area: component('sublocality_level_1', 'sublocality'), pincode: component('postal_code') }];
    }).slice(0, 5);
  } finally { clearTimeout(timer); }
}

/** Explicit address searches; no autocomplete requests while typing. */
export async function searchPlaces(query: string): Promise<BusinessPlace[]> {
  if (query.trim().length < 3) return [];
  return geocode(`address=${encodeURIComponent(query.trim())}`);
}
export async function reversePlace(point: MapPoint): Promise<BusinessPlace | null> {
  return (await geocode(`latlng=${point.latitude},${point.longitude}`))[0] ?? null;
}
export async function searchPlace(query: string): Promise<MapPoint | null> {
  const found = (await searchPlaces(query))[0];
  return found ? { latitude: found.latitude, longitude: found.longitude } : null;
}
