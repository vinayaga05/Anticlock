'use client';

import { motion } from 'framer-motion';
import { 
  Video, Zap, Store, CalendarCheck, Users, MessageCircle, Sparkles, Briefcase 
} from 'lucide-react';
import { features } from '@/config/content';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { 
  ClipsScreen, 
  HomeScreen, 
  MarketplaceScreen, 
  BookingScreen, 
  CommunityScreen, 
  MessagesScreen, 
  ProviderScreen 
} from '@/components/ui/AppScreens';

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

const screenMap: Record<string, React.ComponentType> = {
  clips: ClipsScreen,
  flash: HomeScreen,
  marketplace: MarketplaceScreen,
  bookings: BookingScreen,
  communities: CommunityScreen,
  knock: MessagesScreen,
  'provider-tools': ProviderScreen,
};

export function FeaturesSection() {
  const featuresWithScreens = features.filter(f => screenMap[f.id]);

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

        {/* Icon grid overview - compact on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-20">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Sparkles;
            const gradientClass = categoryColors[feature.category];

            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <div className="relative h-full p-4 md:p-6 rounded-xl md:rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className={`inline-flex p-2 md:p-3 rounded-lg md:rounded-xl bg-gradient-to-r ${gradientClass} mb-2 md:mb-4`}>
                    <Icon className="text-white" size={20} />
                  </div>
                  <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2 text-gray-900">{feature.name}</h3>
                  <p className="text-xs md:text-base text-gray-600 leading-relaxed hidden md:block">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Detailed feature rows with phone mockups */}
        <div className="space-y-24 md:space-y-32">
          {featuresWithScreens.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Sparkles;
            const gradientClass = categoryColors[feature.category];
            const ScreenComponent = screenMap[feature.id];
            const isEven = index % 2 === 0;

            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center ${
                  isEven ? '' : 'lg:grid-flow-dense'
                }`}
              >
                {/* Content */}
                <motion.div
                  initial={{ opacity: 0, x: isEven ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className={isEven ? '' : 'lg:col-start-2'}
                >
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${gradientClass} mb-4`}>
                    <Icon className="text-white" size={28} />
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">{feature.name}</h3>
                  <p className="text-lg md:text-xl text-gray-600 leading-relaxed">{feature.description}</p>
                </motion.div>

                {/* Phone mockup */}
                <motion.div
                  initial={{ opacity: 0, x: isEven ? 30 : -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className={`flex justify-center ${isEven ? '' : 'lg:col-start-1 lg:row-start-1'}`}
                >
                  <div className="w-64 md:w-72">
                    <PhoneFrame delay={0.4}>
                      <ScreenComponent />
                    </PhoneFrame>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
