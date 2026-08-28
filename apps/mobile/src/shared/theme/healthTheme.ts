/** CliniQ-inspired clinical glass theme for health services. */
export const healthTheme = {
  background: '#EAF4FB',
  backgroundSoft: '#F4FAFE',
  sky: '#7EC8E8',
  skyMuted: '#B8E0F5',
  skySoft: 'rgba(126, 200, 232, 0.28)',
  navy: '#1E3A5F',
  navyDeep: '#152C47',
  navySoft: 'rgba(30, 58, 95, 0.1)',
  text: '#1E293B',
  textMuted: '#64748B',
  white: '#FFFFFF',
  radius: 28,
  radiusMd: 22,
  radiusSm: 16,
  glass: {
    light: {
      background: 'rgba(255, 255, 255, 0.42)',
      border: 'rgba(255, 255, 255, 0.62)',
    },
    medium: {
      background: 'rgba(255, 255, 255, 0.62)',
      border: 'rgba(255, 255, 255, 0.78)',
    },
    heavy: {
      background: 'rgba(255, 255, 255, 0.84)',
      border: 'rgba(255, 255, 255, 0.92)',
    },
  },
} as const;
