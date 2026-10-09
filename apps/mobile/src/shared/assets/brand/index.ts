import type { ImageSourcePropType } from 'react-native';

/** Central Knock brand assets — import from here, not individual files. */
export const brandAssets = {
  logo: require('./logo.png') as ImageSourcePropType,
} as const;

export const BRAND_LOGO = brandAssets.logo;

/** Native logo dimensions (1024 × 573). */
export const BRAND_LOGO_ASPECT = 1024 / 573;

export function brandLogoSize(height: number): { width: number; height: number } {
  return {
    width: Math.round(height * BRAND_LOGO_ASPECT),
    height,
  };
}
