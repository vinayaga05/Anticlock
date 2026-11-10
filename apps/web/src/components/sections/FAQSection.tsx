'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { faqs } from '@/config/content';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();

  return (
    <section id="faq" className="relative overflow-hidden bg-[#e5f8fc] py-20 text-[#09235b] sm:py-28">
      <div aria-hidden="true" className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-[#11b5da]/15 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-16 right-[5%] h-56 w-56 rounded-full bg-[#f4bb28]/20 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-[#0b7696]">Good to know</p>
          <motion.h2
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 text-4xl font-black tracking-[-0.045em] text-[#09235b] md:text-5xl"
          >
            Frequently Asked Questions
          </motion.h2>
          <motion.p
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg leading-8 text-[#415878] sm:text-xl"
          >
            Everything you need to know about Knock
          </motion.p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={reduceMotion ? false : { y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`overflow-hidden rounded-[1.5rem] border-2 shadow-[0_8px_24px_rgba(9,35,91,0.05)] ${openIndex === index ? 'border-[#f4bb28] bg-[#fff8df]' : 'border-[#c9e8ef] bg-white'}`}
            >
              <button
                type="button"
                id={`home-faq-question-${index}`}
                aria-expanded={openIndex === index}
                aria-controls={`home-faq-answer-${index}`}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between gap-4 p-6 text-left transition-colors hover:bg-[#fff8df] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#0b7696] sm:p-7"
              >
                <span className="text-base font-black leading-7 text-[#09235b] sm:text-lg">{faq.question}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-9 w-9 shrink-0 rounded-xl bg-[#e94c62] p-2 text-white transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  size={20}
                />
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    id={`home-faq-answer-${index}`}
                    role="region"
                    aria-labelledby={`home-faq-question-${index}`}
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.25 }}
                  >
                    <div className="px-6 pb-6 leading-7 text-[#415878] sm:px-7 sm:pb-7">{faq.answer}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
