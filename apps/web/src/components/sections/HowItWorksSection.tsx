'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarCheck2, Compass, LayoutDashboard, UsersRound } from 'lucide-react';
import { howItWorksSteps } from '@/config/content';

const stepIcons = [Compass, CalendarCheck2, UsersRound, LayoutDashboard];
const stepColours = [
  'border-[#bceaf4] bg-[#eaf9ff] text-[#0b7696]',
  'border-[#ffb4a6] bg-[#fff0ed] text-[#bd3047]',
  'border-[#f1d97e] bg-[#fff8df] text-[#946112]',
  'border-[#d8d0fa] bg-[#f3efff] text-[#6250b5]',
];

export function HowItWorksSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="relative scroll-mt-24 overflow-hidden bg-[#fff8df] py-20 text-[#09235b] sm:py-28">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-12 top-12 h-64 w-64 rounded-full bg-[#f4bb28]/20 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[#11b5da]/15 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 text-4xl font-black tracking-[-0.055em] md:text-5xl"
          >
            How It Works
          </motion.h2>
          <motion.p
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto max-w-2xl text-lg leading-8 text-[#415878] md:text-xl"
          >
            Four simple steps to transform your lifestyle experience
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {howItWorksSteps.map((step, index) => {
            const Icon = stepIcons[index];
            return (
            <motion.div
              key={step.number}
              initial={reduceMotion ? false : { y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.08 }}
              className="relative"
            >
              <div className={`h-full rounded-[1.75rem] border-2 p-6 shadow-lg shadow-[#09235b]/5 ${stepColours[index]}`}>
                <div className="mb-6 flex items-center justify-between gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm"><Icon size={26} aria-hidden="true" /></span>
                  <span className="text-3xl font-black tracking-tight opacity-30">0{step.number}</span>
                </div>
                <h3 className="mb-3 text-xl font-black text-[#09235b]">{step.title}</h3>
                <p className="text-sm leading-7 text-[#415878]">{step.description}</p>
              </div>
              {index < howItWorksSteps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 transform translate-x-1/2 -translate-y-1/2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#f1d97e] bg-white text-[#bd3047] shadow-sm"><ArrowRight size={18} aria-hidden="true" /></span>
                </div>
              )}
            </motion.div>
          );
          })}
        </div>
      </div>
    </section>
  );
}
