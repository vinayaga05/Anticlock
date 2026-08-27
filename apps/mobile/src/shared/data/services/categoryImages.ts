import type { ImageSourcePropType } from 'react-native';

/**
 * Local photoreal category icons for Needs.
 * Unmapped categories keep Lucide IconBadge fallback.
 */
export const categoryImages: Record<string, ImageSourcePropType> = {
  'health.hospitals': require('../../assets/categories/health-hospitals.png'),
  'health.doctors': require('../../assets/categories/health-doctor-consultation.png'),
  'health.clinic': require('../../assets/categories/health-clinic.png'),
  'health.pharmacy': require('../../assets/categories/health-order-medicines.png'),
  'health.laboratory': require('../../assets/categories/health-laboratory.png'),
  'health.physiotherapist': require('../../assets/categories/health-physiotherapist.png'),
  'health.nursing': require('../../assets/categories/health-nursing.png'),
  'health.scan': require('../../assets/categories/health-scan.png'),
  'health.medical_transport': require('../../assets/categories/health-medical-transport.png'),
  'fitness.yoga': require('../../assets/categories/fitness-yoga-classes.png'),
  'fitness.bodybuilding': require('../../assets/categories/fitness-workout-routines.png'),
  'sports.outdoor': require('../../assets/categories/sports-football.png'),
  'sports.athletics': require('../../assets/categories/sports-cricket.png'),
  'sports.traditional': require('../../assets/categories/traditional-silambam.png'),
  'tours.adventure': require('../../assets/categories/tours-adventure-activities.png'),
  'tours.india': require('../../assets/categories/tours-expeditions.png'),
  'tours.devotional': require('../../assets/categories/devotional-meditation-chanting.png'),
  'ecom.sports': require('../../assets/categories/products-sports-apparel.png'),
  'ecom.fitness': require('../../assets/categories/products-protein-supplements.png'),
  'wellness.nutrition_clinical': require('../../assets/categories/wellness-nutrition-diet.png'),
  'wellness.psychologist': require('../../assets/categories/wellness-therapy-mental.png'),
  'wellness.alternate_medicine': require('../../assets/categories/natural-ayurveda-herbal.png'),
  'wellness.acupuncture': require('../../assets/categories/natural-siddha-healing.png'),
  'course.music': require('../../assets/categories/devotional-music-kirtan.png'),
  'sports.mma': require('../../assets/categories/traditional-mallakhamb.png'),
};

/** Featured cover image per service tree (Needs home tiles). */
export const treeImages: Partial<Record<string, ImageSourcePropType>> = {
  health: require('../../assets/categories/health-doctor-consultation.png'),
  fitness: require('../../assets/categories/fitness-yoga-classes.png'),
  sports: require('../../assets/categories/sports-football.png'),
  wellness: require('../../assets/categories/wellness-therapy-mental.png'),
  tours_events: require('../../assets/categories/tours-adventure-activities.png'),
  ecommerce: require('../../assets/categories/products-sports-apparel.png'),
  course_training: require('../../assets/categories/devotional-music-kirtan.png'),
};

export function getCategoryImage(categoryId: string): ImageSourcePropType | undefined {
  return categoryImages[categoryId];
}

export function getTreeImage(treeId: string): ImageSourcePropType | undefined {
  return treeImages[treeId];
}
