'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { 
  Video, Zap, Store, CalendarCheck, Users, MessageCircle, Sparkles, Briefcase 
} from 'lucide-react';
import { features } from '@/config/content';
import { PhoneFrame } from '@/components/ui/PhoneFrame';
import { 
  ClipsScreen, 
  FlashScreen,
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

const categoryStyles: Record<string, { icon: string; surface: string }> = {
  social: { icon: 'bg-[#e94c62] text-white', surface: 'border-[#ffb4a6] bg-[#fff0ed]' },
  marketplace: { icon: 'bg-[#11b5da] text-[#09235b]', surface: 'border-[#bceaf4] bg-[#eaf9ff]' },
  community: { icon: 'bg-[#6c5fe6] text-white', surface: 'border-[#d8d0fb] bg-[#f3efff]' },
  smart: { icon: 'bg-[#f4bb28] text-[#09235b]', surface: 'border-[#f1d97e] bg-[#fff8df]' },
};

const screenMap: Record<string, React.ComponentType> = {
  clips: ClipsScreen,
  flash: FlashScreen,
  marketplace: MarketplaceScreen,
  bookings: BookingScreen,
  communities: CommunityScreen,
  knock: MessagesScreen,
  'provider-tools': ProviderScreen,
};

export function FeaturesSection() {
  const featuresWithScreens = features.filter(f => screenMap[f.id]);
  const reduceMotion = useReducedMotion();

  return (
    <section id="features" className="bg-white py-20 text-[#09235b] sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 text-4xl font-black tracking-[-0.055em] text-[#09235b] md:text-5xl"
          >
            Everything You Need,{' '}
            <span className="text-[#d23848]">
              One Platform
            </span>
          </motion.h2>
          <motion.p
            initial={reduceMotion ? false : { y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto max-w-2xl text-lg leading-8 text-[#415878] sm:text-xl"
          >
            Social content meets comprehensive service marketplace. Discover through inspiration,
            book with confidence.
          </motion.p>
        </div>

        {/* Icon grid overview - compact on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-20">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Sparkles;
            const colors = categoryStyles[feature.category] || categoryStyles.marketplace;

            return (
              <motion.div
                key={feature.id}
                initial={reduceMotion ? false : { y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <div className={`relative h-full rounded-[1.5rem] border-2 p-4 shadow-lg shadow-[#09235b]/5 transition-shadow duration-300 hover:shadow-xl hover:shadow-[#09235b]/10 md:p-6 ${colors.surface}`}>
                  <div className={`mb-3 inline-flex rounded-2xl p-3 shadow-sm md:mb-4 ${colors.icon}`}>
                    <Icon aria-hidden="true" size={22} />
                  </div>
                  <h3 className="mb-1 text-base font-black text-[#09235b] md:mb-2 md:text-xl">{feature.name}</h3>
                  <p className="hidden text-xs leading-relaxed text-[#415878] md:block md:text-base">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Detailed feature rows with phone mockups */}
        <div className="space-y-8 md:space-y-12">
          {featuresWithScreens.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Sparkles;
            const colors = categoryStyles[feature.category] || categoryStyles.marketplace;
            const ScreenComponent = screenMap[feature.id];
            const isEven = index % 2 === 0;

            return (
              <motion.div
                key={feature.id}
                initial={false}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className={`grid grid-cols-1 items-center gap-8 rounded-[2rem] border-2 p-6 shadow-lg shadow-[#09235b]/5 sm:p-10 lg:grid-cols-2 lg:gap-16 ${colors.surface} ${
                  isEven ? '' : 'lg:grid-flow-dense'
                }`}
              >
                {/* Content */}
                <motion.div
                  initial={reduceMotion ? false : { x: isEven ? -18 : 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className={isEven ? '' : 'lg:col-start-2'}
                >
                  <div className={`mb-5 inline-flex rounded-2xl p-4 shadow-sm ${colors.icon}`}>
                    <Icon aria-hidden="true" size={28} />
                  </div>
                  <h3 className="mb-4 text-3xl font-black tracking-[-0.045em] text-[#09235b] md:text-4xl">{feature.name}</h3>
                  <p className="text-lg leading-8 text-[#415878] md:text-xl">{feature.description}</p>
                </motion.div>

                {/* Phone mockup */}
                <motion.div
                  initial={reduceMotion ? false : { x: isEven ? 18 : -18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className={`flex flex-col items-center ${isEven ? '' : 'lg:col-start-1 lg:row-start-1'}`}
                >
                  <div className="w-full max-w-[16rem] md:max-w-[18rem]">
                    <PhoneFrame delay={0.4}>
                      <ScreenComponent />
                    </PhoneFrame>
                  </div>
                  <p className="mt-3 text-center text-xs font-semibold text-[#52677e]">Sample screen</p>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
