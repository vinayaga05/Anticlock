'use client';

import { motion } from 'framer-motion';
import { 
  Heart, Dumbbell, Trophy, Leaf, Plane, Scissors, GraduationCap, Home, ShoppingBag 
} from 'lucide-react';
import { serviceTrees } from '@/config/content';

const iconMap: Record<string, any> = {
  'heart-pulse': Heart,
  dumbbell: Dumbbell,
  trophy: Trophy,
  sparkles: Leaf,
  plane: Plane,
  scissors: Scissors,
  'graduation-cap': GraduationCap,
  home: Home,
  'shopping-bag': ShoppingBag,
};

export function ServicesSection() {
  return (
    <section id="services" className="py-24 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            <span className="bg-gradient-to-r from-aqua via-coral to-lavender bg-clip-text text-transparent">
              9 Service Categories
            </span>
            <br />
            Your Entire Lifestyle
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            From health and wellness to travel and courses—everything you need, beautifully
            organized and ready to book.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceTrees.map((tree, index) => {
            const Icon = iconMap[tree.icon] || Leaf;

            return (
              <motion.div
                key={tree.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <div
                  className="relative h-full p-6 rounded-2xl bg-white border-2 border-transparent hover:border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${tree.color}08 0%, white 100%)`,
                  }}
                >
                  <div
                    className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity"
                    style={{ background: tree.color }}
                  ></div>
                  <div className="relative">
                    <div
                      className="inline-flex p-3 rounded-xl mb-4"
                      style={{ backgroundColor: `${tree.color}15` }}
                    >
                      <Icon size={28} style={{ color: tree.color }} />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-gray-900">{tree.name}</h3>
                    <p className="text-gray-600 leading-relaxed">{tree.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
