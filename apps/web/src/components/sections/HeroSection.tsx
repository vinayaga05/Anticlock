'use client';

import { motion } from 'framer-motion';
import { Apple, Play, Sparkles } from 'lucide-react';
import { EventArtwork } from '@/components/event/EventArtwork';
import { getAppStoreButton, getPlayStoreButton } from '@/lib/utils';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { HomeScreen, ClipsScreen, MarketplaceScreen } from '@/components/ui/AppScreens';

export function HeroSection() {
  const appStore = getAppStoreButton();
  const playStore = getPlayStoreButton();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#eaf9ff] pt-20 pb-12 lg:pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_18%,rgba(17,181,218,0.28),transparent_25%),radial-gradient(circle_at_93%_12%,rgba(255,186,34,0.4),transparent_25%),radial-gradient(circle_at_88%_87%,rgba(238,70,103,0.22),transparent_26%),linear-gradient(135deg,#effcff_0%,#ffffff_48%,#fff8df_100%)]" aria-hidden="true" />
      
      {/* Optimized blur orbs with reduced blur and GPU acceleration */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-[4%] top-[24%] h-14 w-6 rotate-[28deg] rounded-full bg-[#ff8e2b]" />
        <div className="absolute bottom-[12%] left-[16%] h-6 w-14 -rotate-[30deg] rounded-full border-4 border-[#11b5da]" />
        {/* Centered lime orb - use container for positioning, inner div for animation */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
          <div className="h-full w-full rounded-full bg-[#f4bb28]/15 blur-2xl" />
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
              <span className="inline-flex items-center gap-2 rounded-full border border-[#09235b]/15 bg-white/85 px-4 py-2 text-sm font-bold text-[#0b5f9d] shadow-sm">
                <Sparkles aria-hidden="true" className="text-[#e94c62]" size={17} />
                Your lifestyle, simplified
              </span>
            </motion.div>

            <motion.h1
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-4 text-5xl font-black leading-[1.03] tracking-[-0.055em] text-[#09235b] sm:text-6xl lg:mb-6 lg:text-6xl xl:text-7xl"
            >
              Discover, Book,
              <br />
              <span className="font-serif italic text-[#d23848]">
                Live Your Best Life
              </span>
            </motion.h1>

            <motion.p
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg sm:text-xl lg:text-2xl text-[#415878] mb-8 lg:mb-10 max-w-3xl lg:max-w-none leading-relaxed"
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
                    ? 'bg-[#09235b] text-white hover:bg-[#0b5f9d] hover:shadow-xl motion-safe:hover:-translate-y-1'
                    : 'border border-[#09235b]/15 bg-white/75 text-[#52677e] cursor-not-allowed'
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
                    ? 'border-2 border-[#e94c62] bg-white text-[#c22d42] hover:bg-[#fff0f1] hover:shadow-xl motion-safe:hover:-translate-y-1'
                    : 'border border-[#09235b]/15 bg-white/75 text-[#52677e] cursor-not-allowed'
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
              className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-[#09235b] text-xs font-bold"
            >
              <span className="inline-flex items-center gap-2 rounded-2xl border border-[#f1d97e] bg-[#fff8df] py-2 pl-2 pr-3 shadow-sm">
                <EventArtwork kind="strength" className="h-8 w-8" />
                9 Service Categories
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl border border-[#bceaf4] bg-[#eaf9ff] py-2 pl-2 pr-3 shadow-sm">
                <EventArtwork kind="community" className="h-8 w-8" />
                Social Discovery
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl border border-[#ffb4a6] bg-[#fff0ed] py-2 pl-2 pr-3 shadow-sm">
                <Sparkles aria-hidden="true" className="mx-1 text-[#d23848]" size={22} />
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
                  y: { duration: 3.2, ease: "easeInOut" }
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
                  y: { duration: 3.2, ease: "easeInOut", delay: 0.4 }
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
                  y: { duration: 3.2, ease: "easeInOut", delay: 0.2 }
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
            <p className="text-xs text-[#52677e] mt-3">Sample screen</p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2" aria-hidden="true">
        <div className="w-6 h-10 border-2 border-[#09235b]/25 rounded-full p-1">
          <div className="w-1.5 h-3 bg-[#0b7696] rounded-full"></div>
        </div>
      </div>
    </section>
  );
}
