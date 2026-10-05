'use client';

import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { providerBenefits } from '@/config/content';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { ProviderScreen } from '@/components/ui/AppScreens';

export function ProvidersSection() {
  return (
    <section id="providers" className="py-16 md:py-24 bg-gradient-to-br from-gray-900 to-black text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-aqua/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-coral/40 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-aqua via-coral to-lime bg-clip-text text-transparent">
                Grow Your Business
              </span>
              <br />
              With Anticlock
            </h2>
            <p className="text-lg md:text-xl text-white/80 mb-8 leading-relaxed">
              Service providers from health practitioners to fitness trainers, beauty professionals to tour operators—grow
              your business on Anticlock.
            </p>
            <div className="space-y-3 md:space-y-4 mb-8">
              {providerBenefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full bg-aqua/20 flex items-center justify-center mt-0.5">
                    <Check className="text-aqua" size={14} />
                  </div>
                  <p className="text-sm md:text-base text-white/90">{benefit}</p>
                </motion.div>
              ))}
            </div>
            <a
              href="#download"
              className="inline-flex items-center px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-aqua to-aqua-deep text-white rounded-xl md:rounded-2xl font-semibold hover:scale-105 transition-transform text-sm md:text-base"
            >
              Become a Provider
              <ArrowRight className="ml-2" size={20} />
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center lg:items-end"
          >
            <div className="w-64 md:w-72">
              <PhoneFrame delay={0.3}>
                <ProviderScreen />
              </PhoneFrame>
            </div>
            <p className="text-xs text-white/50 mt-2">Sample screen</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
