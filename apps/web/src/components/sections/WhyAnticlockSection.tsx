'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { differentiators } from '@/config/content';

export function WhyAnticlockSection() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Why Choose{' '}
            <span className="bg-gradient-to-r from-aqua to-coral bg-clip-text text-transparent">
              Anticlock
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            More than just another booking app—a complete lifestyle platform designed for modern
            living
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {differentiators.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex gap-3 md:gap-4"
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-gradient-to-br from-aqua to-aqua-deep flex items-center justify-center">
                  <Check className="text-white" size={20} />
                </div>
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-gray-900">{item.title}</h3>
                <p className="text-sm md:text-base text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
