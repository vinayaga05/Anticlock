import type {
  BusinessProfile,
  BusinessService,
  ServiceMode,
  UpdateBusinessProfileRequest,
  UpdateBusinessServicesRequest,
} from '@anticlock/contracts';
import { normalizeProfileWebsite } from '@/features/profile/profileForm';

export const WORKING_DAYS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const;
export type BusinessProfileDraft = {
  name: string;
  description: string;
  tagline: string;
  brandAccentColor: string;
  yearsInBusiness: string;
  certifications: string;
  languages: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  area: string;
  pincode: string;
  latitude: string;
  longitude: string;
  serviceRadiusKm: string;
  workingDays: string[];
  openingTime: string;
  closingTime: string;
  temporarilyUnavailable: boolean;
};
export type BusinessServiceDraft = {
  categoryId: string;
  title: string;
  description: string;
  price: string;
  durationMinutes: string;
  modes: ServiceMode[];
  available: boolean;
};
const numberText = (value: number | null | undefined) =>
  value == null ? '' : String(value);
export function businessProfileDraft(
  business: BusinessProfile,
): BusinessProfileDraft {
  return {
    name: business.name,
    description: business.description ?? '',
    tagline: business.tagline ?? '',
    brandAccentColor: business.brandAccentColor ?? '',
    yearsInBusiness: numberText(business.yearsInBusiness),
    certifications: business.certifications.join('\n'),
    languages: business.languages.join(', '),
    phone: business.contact.phone ?? '',
    email: business.contact.email ?? '',
    website: business.contact.website ?? '',
    address: business.location.address ?? '',
    city: business.location.city ?? '',
    area: business.location.area ?? '',
    pincode: business.location.pincode ?? '',
    latitude: numberText(business.location.latitude),
    longitude: numberText(business.location.longitude),
    serviceRadiusKm: numberText(business.location.serviceRadiusKm),
    workingDays: business.availability.workingDays.map(
      day =>
        WORKING_DAYS.find(
          name => name.toLowerCase() === day.slice(0, 3).toLowerCase(),
        ) ?? day,
    ),
    openingTime: business.availability.openingTime ?? '',
    closingTime: business.availability.closingTime ?? '',
    temporarilyUnavailable: business.availability.temporarilyUnavailable,
  };
}
export function businessServiceDraft(
  service: BusinessService,
): BusinessServiceDraft {
  return {
    categoryId: service.categoryId,
    title: service.title,
    description: service.description ?? '',
    price: numberText(service.price),
    durationMinutes: numberText(service.durationMinutes),
    modes: service.modes,
    available: service.available,
  };
}
function optionalNumber(
  value: string,
  label: string,
  min: number,
  max: number,
  integer = false,
) {
  if (!value.trim()) return null;
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number < min ||
    number > max ||
    (integer && !Number.isInteger(number))
  )
    throw new Error(
      `${label} must be ${
        integer ? 'a whole number' : 'a number'
      } between ${min} and ${max}.`,
    );
  return number;
}
export function buildBusinessProfileUpdate(
  draft: BusinessProfileDraft,
): UpdateBusinessProfileRequest {
  const name = draft.name.trim();
  const description = draft.description.trim();
  if (name.length < 2 || name.length > 160)
    throw new Error('Enter a business name between 2 and 160 characters.');
  if (description && (description.length < 10 || description.length > 2000))
    throw new Error('Describe your business in 10 to 2,000 characters.');
  if (draft.tagline.trim().length > 160)
    throw new Error('Keep your tagline under 160 characters.');
  if (
    draft.brandAccentColor.trim() &&
    !/^#[0-9a-f]{6}$/i.test(draft.brandAccentColor.trim())
  )
    throw new Error('Use a brand color such as #345D51.');
  const phone = draft.phone.trim() || null;
  const email = draft.email.trim() || null;
  if (phone && (phone.length < 8 || phone.length > 20))
    throw new Error('Enter a valid contact phone number.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Enter a valid contact email.');
  if (
    draft.address.trim().length > 500 ||
    draft.city.trim().length > 100 ||
    draft.area.trim().length > 100 ||
    draft.pincode.trim().length > 12
  )
    throw new Error('Check your address, city, area and postal code lengths.');
  const latitude = optionalNumber(draft.latitude, 'Latitude', -90, 90);
  const longitude = optionalNumber(draft.longitude, 'Longitude', -180, 180);
  if ((latitude === null) !== (longitude === null))
    throw new Error('Choose a map location with both coordinates.');
  const openingTime = draft.openingTime.trim();
  const closingTime = draft.closingTime.trim();
  if (
    (openingTime || closingTime) &&
    (!/^([01]\d|2[0-3]):[0-5]\d$/.test(openingTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(closingTime))
  )
    throw new Error('Enter opening and closing times as HH:MM.');
  if (openingTime && closingTime <= openingTime)
    throw new Error('Closing time must be later than opening time.');
  const certifications = draft.certifications
    .split('\n')
    .map(value => value.trim())
    .filter(Boolean);
  const languages = draft.languages
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (
    certifications.length > 20 ||
    certifications.some(value => value.length > 120)
  )
    throw new Error('Use up to 20 certifications, each under 120 characters.');
  if (languages.length > 20 || languages.some(value => value.length > 60))
    throw new Error('Use up to 20 languages, each under 60 characters.');
  if (draft.workingDays.length > 7)
    throw new Error('Select up to seven working days.');
  return {
    name,
    ...(description ? { description } : {}),
    tagline: draft.tagline.trim() || null,
    brandAccentColor: draft.brandAccentColor.trim() || null,
    yearsInBusiness: optionalNumber(
      draft.yearsInBusiness,
      'Years in business',
      0,
      200,
      true,
    ),
    certifications,
    languages,
    phone,
    email,
    website: normalizeProfileWebsite(draft.website),
    address: draft.address.trim() || null,
    city: draft.city.trim() || null,
    area: draft.area.trim() || null,
    pincode: draft.pincode.trim() || null,
    latitude,
    longitude,
    serviceRadiusKm: optionalNumber(
      draft.serviceRadiusKm,
      'Service radius',
      0.1,
      500,
    ),
    ...(draft.workingDays.length ? { workingDays: draft.workingDays } : {}),
    ...(openingTime ? { openingTime, closingTime } : {}),
    temporarilyUnavailable: draft.temporarilyUnavailable,
  };
}
export function buildBusinessServicesUpdate(
  services: BusinessServiceDraft[],
): UpdateBusinessServicesRequest {
  if (!services.length || services.length > 20)
    throw new Error('Keep between one and 20 services.');
  const seen = new Set<string>();
  return {
    services: services.map(service => {
      if (!service.categoryId || seen.has(service.categoryId))
        throw new Error('Each service category can be selected once.');
      seen.add(service.categoryId);
      if (service.description.trim().length > 1000)
        throw new Error('Keep service descriptions under 1,000 characters.');
      if (!service.modes.length)
        throw new Error(`Select a service mode for ${service.title}.`);
      return {
        categoryId: service.categoryId,
        description: service.description.trim() || null,
        price: optionalNumber(
          service.price,
          `${service.title} price`,
          0,
          2147483647,
          true,
        ),
        durationMinutes: optionalNumber(
          service.durationMinutes,
          `${service.title} duration`,
          5,
          480,
          true,
        ),
        modes: service.modes,
        available: service.available,
      };
    }),
  };
}
export function businessToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return ['year', 'month', 'day']
    .map(type => parts.find(part => part.type === type)?.value)
    .join('-');
}
