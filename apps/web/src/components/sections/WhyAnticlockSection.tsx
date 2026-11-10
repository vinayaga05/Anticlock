'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { differentiators } from '@/config/content';

export function WhyAnticlockSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-white py-20 text-[#09235b] sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 text-4xl font-black tracking-[-0.055em] md:text-5xl"
          >
            Why Choose{' '}
            <span className="font-serif italic text-[#d23848]">
              Knock
            </span>
          </motion.h2>
          <motion.p
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto max-w-2xl text-lg leading-8 text-[#415878] md:text-xl"
          >
            More than just another booking app—a complete lifestyle platform designed for modern
            living
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {differentiators.map((item, index) => (
            <motion.div
              key={item.title}
              initial={reduceMotion ? false : { y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.08 }}
              className={`flex gap-4 rounded-[1.75rem] border-2 p-6 shadow-lg shadow-[#09235b]/5 ${index % 3 === 0 ? 'border-[#bceaf4] bg-[#eaf9ff]' : index % 3 === 1 ? 'border-[#ffb4a6] bg-[#fff0ed]' : 'border-[#f1d97e] bg-[#fff8df]'}`}
            >
              <div className="flex-shrink-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Check className="text-[#0b7696]" size={22} aria-hidden="true" />
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-lg font-black text-[#09235b] md:text-xl">{item.title}</h3>
                <p className="text-sm leading-7 text-[#415878]">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
