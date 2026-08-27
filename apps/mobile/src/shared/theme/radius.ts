export const radius = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  '2xl': 28,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof radius;
