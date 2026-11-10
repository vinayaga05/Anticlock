'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';

export function HomeTheme({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="marketing-site min-h-screen bg-[#f9fcff] text-[#09235b]">{children}</div>
    </MotionConfig>
  );
}
