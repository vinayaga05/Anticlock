import { darkColors, lightColors, palette, softFill, treeColors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { typography } from './typography';
import { shadows } from './shadows';
import { glass, glassDark, motion, healthGlass } from './motion';

const icons = {
  stroke: 1.75,
  size: {
    sm: 16,
    md: 20,
    lg: 22,
    xl: 26,
  },
};

export const lightTheme = {
  mode: 'light' as const,
  colors: lightColors,
  spacing,
  radius,
  typography,
  shadows,
  glass,
  healthGlass,
  motion,
  icons,
};

export const darkTheme = {
  mode: 'dark' as const,
  colors: darkColors,
  spacing,
  radius,
  typography,
  shadows,
  glass: glassDark,
  healthGlass,
  motion,
  icons,
};

export type AppTheme = typeof lightTheme | typeof darkTheme;

export { palette, softFill, treeColors, spacing, radius, typography, shadows, motion, healthGlass };
export { healthTheme } from './healthTheme';
