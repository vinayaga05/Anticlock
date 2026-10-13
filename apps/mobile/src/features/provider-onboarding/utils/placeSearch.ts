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

/** Turns a typed address into a map point. Returns null when nothing matches. */
export async function searchPlace(query: string): Promise<MapPoint | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Anticlock/1.0 (provider location picker)',
    },
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const hit = rows[0];
  if (!hit?.lat || !hit.lon) return null;
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}
