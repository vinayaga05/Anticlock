import { releaseRecords } from '@/shared/config/releaseFeatures';
import { treeColors } from '@/shared/theme/colors';
import { ServiceTree } from './serviceTypes';

export const serviceTrees: ServiceTree[] = releaseRecords<ServiceTree>([
  {
    id: 'health',
    name: 'Health',
    description: 'Care for your health, all in one place.',
    icon: 'health',
    serviceCount: 9,
    accent: treeColors.health.accent,
  },
  {
    id: 'home_services',
    name: 'Needs',
    description: 'Find property, jobs, automotive, and home services.',
    icon: 'home',
    serviceCount: 9,
    accent: treeColors.home_services.accent,
  },
  {
    id: 'fitness',
    name: 'Fitness, Beauty & Spa',
    description: 'Find fitness, beauty, and spa providers near you.',
    icon: 'fitness',
    serviceCount: 9,
    accent: treeColors.fitness.accent,
  },
  {
    id: 'course_training',
    name: 'Coaching & Training',
    description: 'Learn skills from trusted instructors.',
    icon: 'graduation-cap',
    serviceCount: 9,
    accent: treeColors.course_training.accent,
  },
  {
    id: 'sports',
    name: 'Sports',
    description: 'Play, train, and compete across sports.',
    icon: 'activity',
    serviceCount: 9,
    accent: treeColors.sports.accent,
  },
  {
    id: 'tours_events',
    name: 'Travel & Events',
    description: 'Trips, adventures, and celebrations.',
    icon: 'globe',
    serviceCount: 9,
    accent: treeColors.tours_events.accent,
  },
  {
    id: 'wellness',
    name: 'Indian Medicine & Wellness',
    description: 'Explore Indian medicine, holistic care, and mental wellness.',
    icon: 'leaf',
    serviceCount: 9,
    accent: treeColors.wellness.accent,
  },
  {
    id: 'rooms_restaurant',
    name: 'Hotels & Restaurants',
    description: 'Find nearby stays, restaurants, and food spots.',
    icon: 'utensils',
    serviceCount: 9,
    accent: treeColors.rooms_restaurant.accent,
  },
  {
    id: 'local_services',
    name: 'Services',
    description:
      'Find nearby document, printing, payment, and technology services.',
    icon: 'clipboard',
    serviceCount: 9,
    accent: treeColors.local_services.accent,
  },
  {
    id: 'beauty_spa',
    name: 'Beauty & Spa',
    description: 'Salons, spa, and beauty professionals.',
    icon: 'sparkles',
    serviceCount: 9,
    accent: treeColors.beauty_spa.accent,
  },
  {
    id: 'ecommerce',
    name: 'E-commerce & Products',
    description: 'Shop products from local sellers.',
    icon: 'shopping-bag',
    serviceCount: 9,
    accent: treeColors.ecommerce.accent,
  },
]);

export const needsServiceTrees = serviceTrees.filter(
  tree => tree.id !== 'beauty_spa' && tree.id !== 'ecommerce',
);
