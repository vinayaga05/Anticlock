export const STORAGE_KEYS = {
  THEME_MODE: 'theme_mode',
  CART_COUNT: 'cart_count',
  AUTH_SESSION: 'auth_session',
  PROVIDER_APPLICATION: 'provider_application',
  PROVIDER_APPLICATIONS: 'provider_applications',
  ASSISTANT_ENABLED: 'assistant_enabled',
  ASSISTANT_OFFLINE_QUEUE: 'assistant_offline_queue',
  ASSISTANT_BUTTON_POSITION: 'assistant_button_position',
  CLIP_COMPOSER_DRAFT: 'clip_composer_draft',
} as const;

export const APP_NAME = 'Knock';

export { BRAND_LOGO } from '@/shared/assets/brand';

export const DEFAULT_LOCATION = {
  city: 'Chennai',
  pincode: '600017',
  area: 'Panagal Park-T.Nagar',
  clinicsNearby: 6,
};
