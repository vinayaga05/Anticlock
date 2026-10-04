'use client';

import { motion } from 'framer-motion';
import { Apple, Play, Smartphone } from 'lucide-react';
import { getAppStoreButton, getPlayStoreButton } from '@/lib/utils';

export function CTASection() {
  const appStore = getAppStoreButton();
  const playStore = getPlayStoreButton();

  return (
    <section id="download" className="py-24 bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-aqua/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-coral/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-aqua to-coral mb-6">
            <Smartphone className="text-white" size={40} />
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-5xl font-bold mb-6"
        >
          Ready to Simplify{' '}
          <span className="bg-gradient-to-r from-aqua via-coral to-lime bg-clip-text text-transparent">
            Your Lifestyle?
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-xl text-white/80 mb-10 max-w-2xl mx-auto"
        >
          Download Anticlock today and discover a world of services, communities, and experiences
          at your fingertips.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
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
      </div>
    </section>
  );
}
