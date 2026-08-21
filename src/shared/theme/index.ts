import { Platform } from 'react-native';

export const palette = {
  black: '#000000',
  white: '#FFFFFF',
  teal: '#2D9EB3',
  tealDark: '#1F7A8C',
  maroon: '#8B1E3F',
  maroonSoft: '#A83255',
  green: '#288B22',
  yellow: '#F5C518',
  orange: '#E67E22',
  navy: '#1A3A5C',
  lightBlue: '#B8D4E8',
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EFEFEF',
    300: '#DBDBDB',
    400: '#C7C7C7',
    500: '#8E8E8E',
    600: '#737373',
    700: '#262626',
    800: '#121212',
    900: '#000000',
  },
  like: '#ED4956',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#ED4956',
} as const;

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 40,
};

const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

const typography = {
  display: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700' as const,
    fontStyle: 'italic' as const,
  },
};

export const darkTheme = {
  mode: 'dark' as const,
  colors: {
    background: palette.black,
    backgroundElevated: palette.gray[800],
    surface: palette.white,
    surfaceMuted: palette.gray[700],
    surfaceGlass: 'rgba(18, 18, 18, 0.92)',
    textPrimary: palette.white,
    textSecondary: palette.gray[400],
    textInverse: palette.black,
    textOnSurface: palette.navy,
    border: palette.gray[700],
    borderSoft: '#1A1A1A',
    primary: palette.teal,
    primarySoft: palette.tealDark,
    accent: palette.maroon,
    accentSoft: palette.maroonSoft,
    like: palette.like,
    link: palette.teal,
    success: palette.success,
    warning: palette.warning,
    error: palette.error,
    tabBar: palette.black,
    tabIcon: palette.maroon,
    overlay: 'rgba(0, 0, 0, 0.55)',
    tile: palette.lightBlue,
    yellow: palette.yellow,
    green: palette.green,
    orange: palette.orange,
    navy: palette.navy,
  },
  spacing,
  radius,
  typography,
  shadows: {
    card: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
};

export const lightTheme = {
  ...darkTheme,
  mode: 'light' as const,
  colors: {
    ...darkTheme.colors,
    background: palette.gray[100],
    backgroundElevated: palette.white,
    textPrimary: palette.gray[900],
    textSecondary: palette.gray[600],
    textInverse: palette.white,
    border: palette.gray[300],
    tabBar: palette.white,
  },
};

export type AppTheme = typeof darkTheme | typeof lightTheme;
