import type { ImageSourcePropType } from 'react-native';

/** Central Knock brand assets — import from here, not individual files. */
export const brandAssets = {
  logo: require('./knock-icon.png') as ImageSourcePropType,
} as const;

export const BRAND_LOGO = brandAssets.logo;

/** Native logo dimensions (1024 × 1024). */
export const BRAND_LOGO_ASPECT = 1;

export function brandLogoSize(height: number): { width: number; height: number } {
  return {
    width: Math.round(height * BRAND_LOGO_ASPECT),
    height,
  };
}
