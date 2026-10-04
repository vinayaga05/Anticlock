'use client';

import { motion } from 'framer-motion';
import { 
  Video, Zap, Store, CalendarCheck, Users, MessageCircle, Sparkles, Briefcase 
} from 'lucide-react';
import { features } from '@/config/content';

const iconMap: Record<string, any> = {
  video: Video,
  zap: Zap,
  store: Store,
  'calendar-check': CalendarCheck,
  users: Users,
  'message-circle': MessageCircle,
  sparkles: Sparkles,
  briefcase: Briefcase,
};

const categoryColors: Record<string, string> = {
  social: 'from-coral to-pink-500',
  marketplace: 'from-aqua to-sky',
  community: 'from-lavender to-indigo-500',
  smart: 'from-lime to-green-500',
};

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Everything You Need,{' '}
            <span className="bg-gradient-to-r from-aqua to-coral bg-clip-text text-transparent">
              One Platform
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            Social content meets comprehensive service marketplace. Discover through inspiration,
            book with confidence.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Sparkles;
            const gradientClass = categoryColors[feature.category];

            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="relative h-full p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${gradientClass} mb-4`}>
                    <Icon className="text-white" size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900">{feature.name}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
