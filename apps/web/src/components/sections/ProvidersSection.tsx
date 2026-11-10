'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { providerBenefits } from '@/config/content';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { ProviderScreen } from '@/components/ui/AppScreens';

export function ProvidersSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="providers" className="relative scroll-mt-24 overflow-hidden bg-[#eaf9ff] py-20 text-[#09235b] sm:py-28">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-16 top-0 h-80 w-80 rounded-full bg-[#11b5da]/15 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-[#f4bb28]/20 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <motion.div
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="mb-6 text-3xl font-black tracking-[-0.055em] md:text-4xl lg:text-5xl">
              <span className="font-serif italic text-[#d23848]">
                Grow Your Business
              </span>
              <br />
              With Knock
            </h2>
            <p className="mb-8 text-lg leading-8 text-[#415878] md:text-xl">
              Service providers from health practitioners to fitness trainers, beauty professionals to tour operators—grow
              your business on Knock.
            </p>
            <div className="space-y-3 md:space-y-4 mb-8">
              {providerBenefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={reduceMotion ? false : { x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: reduceMotion ? 0 : index * 0.06 }}
                  className="flex items-start gap-3 rounded-2xl border border-[#bceaf4] bg-white/85 px-4 py-3 shadow-sm"
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f4bb28]">
                    <Check className="text-[#09235b]" size={14} aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold leading-6 text-[#09235b] md:text-base">{benefit}</p>
                </motion.div>
              ))}
            </div>
            <a
              href="#download"
              className="inline-flex items-center rounded-2xl bg-[#09235b] px-6 py-4 text-sm font-black text-white shadow-lg shadow-[#09235b]/20 transition hover:bg-[#0b5f9d] motion-safe:hover:-translate-y-1 md:px-8 md:text-base"
            >
              Become a Provider
              <ArrowRight className="ml-2" size={20} />
            </a>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative flex flex-col items-center rounded-[2.5rem] border-2 border-[#bceaf4] bg-white/75 px-8 py-10 shadow-xl shadow-[#09235b]/10 lg:items-center"
          >
            <div className="w-full max-w-[16rem] md:max-w-[18rem]">
              <PhoneFrame delay={0.3}>
                <ProviderScreen />
              </PhoneFrame>
            </div>
            <p className="mt-4 text-xs font-semibold text-[#52677e]">Sample screen</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
