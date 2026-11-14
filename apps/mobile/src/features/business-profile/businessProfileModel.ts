/** Display helpers for the dedicated business storefront. No sample business data. */
const PALETTES = [
  '#345D51',
  '#745049',
  '#3C526F',
  '#68516B',
  '#675B3B',
  '#32636A',
];

function rgb(hex: string) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
}
function hex(values: number[]) {
  return `#${values
    .map(value => Math.round(value).toString(16).padStart(2, '0'))
    .join('')}`;
}
function luminance(color: string) {
  const values = rgb(color).map(value => {
    const unit = value / 255;
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

export function businessBrand(
  id: string,
  preferred?: string | null,
  dark = false,
) {
  const hash = [...id].reduce(
    (value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0,
    0,
  );
  let accent =
    preferred && /^#[0-9a-f]{6}$/i.test(preferred)
      ? preferred
      : PALETTES[hash % PALETTES.length];
  // White labels stay readable even when an owner chooses a pale brand color.
  while (1.05 / (luminance(accent) + 0.05) < 4.5)
    accent = hex(rgb(accent).map(value => value * 0.88));
  const button = accent;
  if (dark)
    while ((luminance(accent) + 0.05) / (luminance('#19211C') + 0.05) < 4.5)
      accent = hex(rgb(accent).map(value => value + (255 - value) * 0.16));
  return {
    accent,
    button,
    deep: hex(rgb(button).map(value => value * 0.55)),
    soft: `${accent}${dark ? '20' : '14'}`,
    line: `${accent}35`,
    light: '#F5EDD8',
  };
}

export type BusinessBrand = ReturnType<typeof businessBrand>;

export function businessInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => [...word][0])
      .join('')
      .toLocaleUpperCase() || 'B'
  );
}

export function businessPrice(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : 'Price on request';
}

export function businessDistance(km: number | null | undefined) {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) return null;
  return km < 1
    ? `${Math.round(km * 1000)} m away`
    : `${km.toFixed(km < 10 ? 1 : 0)} km away`;
}

export function businessDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  if (
    ![from, to].every(
      point =>
        Number.isFinite(point.latitude) &&
        Math.abs(point.latitude) <= 90 &&
        Number.isFinite(point.longitude) &&
        Math.abs(point.longitude) <= 180,
    )
  )
    return null;
  const rad = (value: number) => (value * Math.PI) / 180;
  const deltaLat = rad(to.latitude - from.latitude);
  const deltaLng = rad(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(rad(from.latitude)) *
      Math.cos(rad(to.latitude)) *
      Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function businessProfileLink(providerId: string) {
  return `https://anticlock.online/business/${encodeURIComponent(providerId)}`;
}

export function directionsUrl(location: {
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
  city?: string | null;
}) {
  const { latitude, longitude } = location;
  const coordinates =
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180;
  const destination = coordinates
    ? `${latitude},${longitude}`
    : [location.address, location.city].filter(Boolean).join(', ');
  return destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        destination,
      )}`
    : null;
}
