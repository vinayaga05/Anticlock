'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { Apple, Play } from 'lucide-react';
import { getAppStoreButton, getPlayStoreButton } from '@/lib/utils';

export function CTASection() {
  const appStore = getAppStoreButton();
  const playStore = getPlayStoreButton();
  const reduceMotion = useReducedMotion();

  return (
    <section id="download" className="relative overflow-hidden bg-[linear-gradient(115deg,#fff1ad_0%,#ffc451_52%,#f28a7b_100%)] py-20 text-[#09235b] sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-[#6ee8e0]/45 blur-3xl" />
        <div className="absolute -bottom-32 right-[7%] h-80 w-80 rounded-full bg-white/35 blur-3xl" />
        <div className="absolute left-[8%] top-20 h-10 w-5 rotate-[25deg] rounded-full bg-[#11b5da]" />
        <div className="absolute bottom-16 right-[8%] h-9 w-14 -rotate-[20deg] rounded-full border-4 border-[#e94c62]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={reduceMotion ? false : { scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mb-7"
        >
          <div className="inline-flex rounded-[1.75rem] border-4 border-white/80 bg-white p-2 shadow-[0_16px_40px_rgba(9,35,91,0.18)]">
            <Image src="/brand/logo-square.png" alt="Knock" width={80} height={80} className="rounded-[1.1rem]" />
          </div>
        </motion.div>

        <motion.h2
          initial={reduceMotion ? false : { y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-6 text-4xl font-black leading-tight tracking-[-0.05em] text-[#09235b] md:text-5xl"
        >
          Ready to Simplify{' '}
          <span className="font-serif italic text-[#a9233d]">
            Your Lifestyle?
          </span>
        </motion.h2>

        <motion.p
          initial={reduceMotion ? false : { y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mx-auto mb-10 max-w-2xl text-lg leading-8 text-[#09235b]/80 sm:text-xl"
        >
          Download Knock today and discover a world of services, communities, and experiences
          at your fingertips.
        </motion.p>

        <motion.div
          initial={reduceMotion ? false : { y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href={appStore.url}
            className={`inline-flex min-h-14 items-center rounded-2xl border-2 px-8 py-4 font-black transition-all ${
              appStore.available
                ? 'border-[#09235b] bg-[#09235b] text-white shadow-lg shadow-[#09235b]/15 motion-safe:hover:-translate-y-1 hover:bg-[#0b5f9d]'
                : 'cursor-not-allowed border-[#09235b]/15 bg-white/65 text-[#52677e]'
            }`}
            {...(!appStore.available && { 'aria-disabled': 'true' })}
          >
            <Apple className="mr-3" size={24} />
            {appStore.label}
          </a>
          <a
            href={playStore.url}
            className={`inline-flex min-h-14 items-center rounded-2xl border-2 px-8 py-4 font-black transition-all ${
              playStore.available
                ? 'border-[#09235b]/15 bg-white text-[#09235b] shadow-lg shadow-[#09235b]/10 motion-safe:hover:-translate-y-1 hover:border-[#e94c62] hover:bg-[#fff8df]'
                : 'cursor-not-allowed border-[#09235b]/15 bg-white/65 text-[#52677e]'
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
