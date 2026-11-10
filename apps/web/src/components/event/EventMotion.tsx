'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function EventReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { y: 18 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reduceMotion ? 0 : 0.55, delay: reduceMotion ? 0 : delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function EventFloat({ children, className, delay = 0 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={false}
      animate={reduceMotion ? { y: 0, rotate: 0 } : { y: [0, -9, 0], rotate: [0, 5, 0] }}
      transition={{ duration: reduceMotion ? 0 : 3.2, delay: reduceMotion ? 0 : delay, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}
