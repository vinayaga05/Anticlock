export const motion = {
  fast: 160,
  normal: 220,
  slow: 320,
  pressScale: 0.96,
} as const;

export const glass = {
  light: {
    background: 'rgba(255,255,255,0.55)',
    border: 'rgba(255,255,255,0.7)',
    highlight: 'rgba(255,255,255,0.85)',
  },
  medium: {
    background: 'rgba(255,255,255,0.72)',
    border: 'rgba(255,255,255,0.85)',
    highlight: '#fff',
  },
  heavy: {
    background: 'rgba(255,255,255,0.88)',
    border: 'rgba(0,0,0,0.06)',
    highlight: '#fff',
  },
  blurAmount: 20,
};

export const glassDark = {
  light: {
    background: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.10)',
    highlight: 'rgba(255,255,255,0.14)',
  },
  medium: {
    background: 'rgba(255,255,255,0.09)',
    border: 'rgba(255,255,255,0.14)',
    highlight: 'rgba(255,255,255,0.18)',
  },
  heavy: {
    background: 'rgba(20,20,24,0.78)',
    border: 'rgba(255,255,255,0.12)',
    highlight: 'rgba(255,255,255,0.16)',
  },
  blurAmount: 20,
};

export const healthGlass = {
  light: {
    background: 'rgba(255, 255, 255, 0.42)',
    border: 'rgba(255, 255, 255, 0.62)',
    highlight: 'rgba(255, 255, 255, 0.72)',
  },
  medium: {
    background: 'rgba(255, 255, 255, 0.62)',
    border: 'rgba(255, 255, 255, 0.78)',
    highlight: '#fff',
  },
  heavy: {
    background: 'rgba(255, 255, 255, 0.84)',
    border: 'rgba(255, 255, 255, 0.92)',
    highlight: '#fff',
  },
  blurAmount: 20,
};
