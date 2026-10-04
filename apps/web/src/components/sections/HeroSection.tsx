'use client';

import { motion } from 'framer-motion';
import { Download, Apple, Play } from 'lucide-react';
import { getAppStoreButton, getPlayStoreButton } from '@/lib/utils';

export function HeroSection() {
  const appStore = getAppStoreButton();
  const playStore = getPlayStoreButton();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20">
      <div className="absolute inset-0 gradient-radial opacity-60"></div>
      
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-aqua/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-coral/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-lime/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-6"
        >
          <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm font-medium">
            <span className="w-2 h-2 bg-aqua rounded-full mr-2 animate-pulse"></span>
            Your lifestyle, simplified
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
        >
          Discover, Book,
          <br />
          <span className="bg-gradient-to-r from-aqua via-coral to-lime bg-clip-text text-transparent">
            Live Your Best Life
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl sm:text-2xl text-white/80 mb-12 max-w-3xl mx-auto leading-relaxed"
        >
          From health and fitness to travel and beauty—explore services, connect with communities,
          and book everything in one place.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-3 text-white/70 text-sm"
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
          <span className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
            Built-In Communities
          </span>
        </motion.div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/30 rounded-full p-1">
          <div className="w-1.5 h-3 bg-white/50 rounded-full"></div>
        </div>
      </div>
    </section>
  );
}
