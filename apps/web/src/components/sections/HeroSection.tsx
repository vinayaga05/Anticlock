'use client';

import { motion } from 'framer-motion';
import { Download, Apple, Play } from 'lucide-react';
import { getAppStoreButton, getPlayStoreButton } from '@/lib/utils';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { HomeScreen, ClipsScreen, MarketplaceScreen } from '@/components/ui/AppScreens';

export function HeroSection() {
  const appStore = getAppStoreButton();
  const playStore = getPlayStoreButton();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20 pb-12 lg:pb-20">
      <div className="absolute inset-0 gradient-radial opacity-60"></div>
      
      {/* Optimized blur orbs with reduced blur and GPU acceleration */}
      <div className="absolute inset-0" suppressHydrationWarning>
        <div className="blur-orb absolute top-20 left-10 w-72 h-72 bg-aqua/20 rounded-full blur-2xl animate-float"></div>
        <div className="blur-orb absolute bottom-20 right-10 w-96 h-96 bg-coral/20 rounded-full blur-2xl animate-float" style={{ animationDelay: '1s' }}></div>
        {/* Centered lime orb - use container for positioning, inner div for animation */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
          <div className="blur-orb w-full h-full bg-lime/20 rounded-full blur-2xl animate-float" style={{ animationDelay: '2s' }}></div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left side - Content */}
          <div className="text-center lg:text-left" suppressHydrationWarning>
            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-4 lg:mb-6"
            >
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm font-medium">
                <span className="w-2 h-2 bg-aqua rounded-full mr-2 animate-pulse"></span>
                Your lifestyle, simplified
              </span>
            </motion.div>

            <motion.h1
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 lg:mb-6 leading-tight"
            >
              Discover, Book,
              <br />
              <span className="bg-gradient-to-r from-aqua via-coral to-lime bg-clip-text text-transparent">
                Live Your Best Life
              </span>
            </motion.h1>

            <motion.p
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg sm:text-xl lg:text-2xl text-white/80 mb-8 lg:mb-12 max-w-3xl lg:max-w-none leading-relaxed"
            >
              From health and fitness to travel and beauty—explore services, connect with communities,
              and book everything in one place.
            </motion.p>

            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center lg:items-start xl:items-center justify-center lg:justify-start gap-4 mb-6 lg:mb-8"
            >
              <a
                href={appStore.url}
                className={`inline-flex items-center px-8 py-4 rounded-2xl font-semibold transition-all ${
                  appStore.available
                    ? 'bg-white text-black hover:scale-105 hover:shadow-xl'
                    : 'bg-white/20 text-white/60 cursor-not-allowed'
                }`}
                {...(!appStore.available && { 'aria-disabled': 'true' })}
              >
                <Apple className="mr-3" size={24} />
                {appStore.label}
              </a>
              <a
                href={playStore.url}
                className={`inline-flex items-center px-8 py-4 rounded-2xl font-semibold transition-all ${
                  playStore.available
                    ? 'bg-gradient-to-r from-aqua to-aqua-deep text-white hover:scale-105 hover:shadow-xl'
                    : 'bg-white/20 text-white/60 cursor-not-allowed'
                }`}
                {...(!playStore.available && { 'aria-disabled': 'true' })}
              >
                <Play className="mr-3" size={24} />
                {playStore.label}
              </a>
            </motion.div>

            <motion.div
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-white/70 text-sm"
            >
              <span className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
                9 Service Categories
              </span>
              <span className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
                Social Discovery
              </span>
              <span className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
                AI-Powered
              </span>
            </motion.div>
          </div>

          {/* Right side - Phone mockups (desktop) */}
          <div className="hidden lg:block relative h-[600px]" suppressHydrationWarning>
            {/* Phone 1 - Home Screen (center) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 z-20">
              <motion.div
                initial={false}
                animate={{ 
                  opacity: 1, 
                  y: [0, -10, 0],
                }}
                transition={{ 
                  opacity: { duration: 0.8, delay: 0.3 },
                  y: { duration: 4, repeat: Infinity, ease: "easeInOut", repeatType: "loop" }
                }}
              >
                <PhoneFrame delay={0.3}>
                  <HomeScreen />
                </PhoneFrame>
              </motion.div>
            </div>

            {/* Phone 2 - Clips (left, behind) */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-56 z-10 opacity-80">
              <motion.div
                initial={false}
                animate={{ 
                  opacity: 0.8, 
                  x: 0,
                  y: [0, 10, 0],
                }}
                transition={{ 
                  opacity: { duration: 0.8, delay: 0.5 },
                  x: { duration: 0.8, delay: 0.5 },
                  y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1, repeatType: "loop" }
                }}
              >
                <PhoneFrame delay={0.5} variant="tilted-left">
                  <ClipsScreen />
                </PhoneFrame>
              </motion.div>
            </div>

            {/* Phone 3 - Marketplace (right, behind) */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-56 z-10 opacity-80">
              <motion.div
                initial={false}
                animate={{ 
                  opacity: 0.8, 
                  x: 0,
                  y: [0, -15, 0],
                }}
                transition={{ 
                  opacity: { duration: 0.8, delay: 0.7 },
                  x: { duration: 0.8, delay: 0.7 },
                  y: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5, repeatType: "loop" }
                }}
              >
                <PhoneFrame delay={0.7} variant="tilted-right">
                  <MarketplaceScreen />
                </PhoneFrame>
              </motion.div>
            </div>
          </div>

          {/* Mobile phone view */}
          <div className="lg:hidden flex flex-col items-center mt-6" suppressHydrationWarning>
            <div className="w-56 sm:w-64">
              <motion.div
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1 }}
              >
                <PhoneFrame delay={0}>
                  <HomeScreen />
                </PhoneFrame>
              </motion.div>
            </div>
            <p className="text-xs text-white/50 mt-2">Sample screen</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/30 rounded-full p-1">
          <div className="w-1.5 h-3 bg-white/50 rounded-full"></div>
        </div>
      </div>
    </section>
  );
}
