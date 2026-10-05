'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: 'default' | 'tilted-left' | 'tilted-right';
}

/**
 * Reusable phone frame component for mockups
 * Renders content in a realistic phone bezel with notch
 */
export function PhoneFrame({ children, className = '', delay = 0, variant = 'default' }: PhoneFrameProps) {
  const rotation = variant === 'tilted-left' ? -6 : variant === 'tilted-right' ? 6 : 0;
  
  return (
    <motion.div
      initial={false}
      animate={{ rotate: rotation }}
      whileInView={{ y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ 
        duration: 0.4,
        ease: "easeOut"
      }}
      className={`relative ${className}`}
    >
      {/* Phone shadow */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 to-gray-900/40 blur-2xl transform translate-y-8 scale-95 rounded-[3rem]" />
      
      {/* Phone frame */}
      <div className="relative bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
        {/* Screen container with notch */}
        <div className="relative bg-white rounded-[2.5rem] overflow-hidden">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-gray-900 rounded-b-3xl z-10 flex items-center justify-center">
            <div className="w-16 h-1 bg-gray-800 rounded-full mt-2" />
          </div>
          
          {/* Status bar */}
          <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-8 pt-2 text-xs font-medium text-gray-900 z-10">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 border border-gray-900 rounded-sm relative">
                <div className="absolute inset-0.5 bg-gray-900 rounded-sm" />
              </div>
            </div>
          </div>
          
          {/* Screen content */}
          <div className="relative w-full" style={{ aspectRatio: '9/19.5' }}>
            {children}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
