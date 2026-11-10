'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { 
  Heart, Dumbbell, Trophy, Leaf, Plane, Scissors, GraduationCap, Home, ShoppingBag 
} from 'lucide-react';
import { serviceTrees } from '@/config/content';
import { getCategoryImage } from '@/config/images';

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

const cardStyles = [
  'border-[#bceaf4] bg-[#eaf9ff]',
  'border-[#f1d97e] bg-[#fff8df]',
  'border-[#ffb4a6] bg-[#fff0ed]',
  'border-[#d8d0fb] bg-[#f3efff]',
] as const;

export function ServicesSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="services" className="bg-[#edfaff] py-20 text-[#09235b] sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 text-4xl font-black tracking-[-0.055em] text-[#09235b] md:text-5xl"
          >
            <span className="text-[#0b7696]">
              9 Service Categories
            </span>
            <br />
            Your Entire Lifestyle
          </motion.h2>
          <motion.p
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto max-w-2xl text-lg leading-8 text-[#415878] sm:text-xl"
          >
            From health and wellness to travel and courses—everything you need, beautifully
            organized and ready to book.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceTrees.map((tree, index) => {
            const Icon = iconMap[tree.icon] || Leaf;
            const categoryImage = getCategoryImage(tree.id);

            return (
              <motion.div
                key={tree.id}
                initial={reduceMotion ? false : { y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <div
                  className={`relative h-full overflow-hidden rounded-[1.75rem] border-2 p-6 shadow-lg shadow-[#09235b]/5 transition-shadow duration-300 hover:shadow-xl hover:shadow-[#09235b]/10 sm:p-7 ${cardStyles[index % cardStyles.length]}`}
                >
                  <div
                    className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-10"
                    style={{ background: tree.color }}
                  ></div>
                  <div className="relative">
                    {/* Category artwork */}
                    <div className="relative mb-5 h-24 w-24 overflow-hidden rounded-[1.4rem] border-4 border-white bg-white shadow-md">
                      {categoryImage ? (
                        <Image
                          src={categoryImage}
                          alt={tree.name}
                          fill
                          sizes="96px"
                          className="object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${tree.color}15` }}
                        >
                          <Icon aria-hidden="true" size={32} style={{ color: tree.color }} />
                        </div>
                      )}
                    </div>
                    <h3 className="mb-2 text-xl font-black text-[#09235b]">{tree.name}</h3>
                    <p className="leading-7 text-[#415878]">{tree.description}</p>
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
