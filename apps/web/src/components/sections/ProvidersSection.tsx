'use client';

import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { providerBenefits } from '@/config/content';

export function ProvidersSection() {
  return (
    <section id="providers" className="py-24 bg-gradient-to-br from-gray-900 to-black text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-aqua/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-coral/40 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-aqua via-coral to-lime bg-clip-text text-transparent">
                Grow Your Business
              </span>
              <br />
              With Anticlock
            </h2>
            <p className="text-xl text-white/80 mb-8 leading-relaxed">
              Join thousands of service providers reaching lifestyle-conscious customers. From
              health practitioners to fitness trainers, beauty professionals to tour operators—grow
              your business on Anticlock.
            </p>
            <div className="space-y-4 mb-8">
              {providerBenefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-aqua/20 flex items-center justify-center mt-0.5">
                    <Check className="text-aqua" size={16} />
                  </div>
                  <p className="text-white/90">{benefit}</p>
                </motion.div>
              ))}
            </div>
            <a
              href="#download"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-aqua to-aqua-deep text-white rounded-2xl font-semibold hover:scale-105 transition-transform"
            >
              Become a Provider
              <ArrowRight className="ml-2" size={20} />
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 gap-6"
          >
            <div className="space-y-6">
              <div className="glass p-6 rounded-2xl">
                <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-aqua to-coral bg-clip-text text-transparent">
                  9
                </div>
                <p className="text-white/70">Service Categories</p>
              </div>
              <div className="glass p-6 rounded-2xl">
                <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-coral to-pink-500 bg-clip-text text-transparent">
                  Social
                </div>
                <p className="text-white/70">Content Discovery</p>
              </div>
            </div>
            <div className="space-y-6 pt-8">
              <div className="glass p-6 rounded-2xl">
                <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-lime to-green-500 bg-clip-text text-transparent">
                  AI
                </div>
                <p className="text-white/70">Smart Assistant</p>
              </div>
              <div className="glass p-6 rounded-2xl">
                <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-lavender to-indigo-500 bg-clip-text text-transparent">
                  Built-in
                </div>
                <p className="text-white/70">Business Tools</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
