import { Platform } from 'react-native';
import { palette } from './colors';

export const shadows = {
  none: {},
  soft: Platform.select({
    ios: {
      shadowColor: '#1A1814',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    android: { elevation: 2 },
    default: {},
  }),
  card: Platform.select({
    ios: {
      shadowColor: '#1A1814',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: { elevation: 3 },
    default: {},
  }),
  float: Platform.select({
    ios: {
      shadowColor: '#1A1814',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
    },
    android: { elevation: 8 },
    default: {},
  }),
  glowTeal: Platform.select({
    ios: {
      shadowColor: palette.aqua,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
    default: {},
  }),
  healthSoft: Platform.select({
    ios: {
      shadowColor: '#1E3A5F',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
    },
    android: { elevation: 3 },
    default: {},
  }),
};
