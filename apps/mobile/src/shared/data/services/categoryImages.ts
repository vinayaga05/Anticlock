import type { ImageSourcePropType } from 'react-native';

/**
 * Photorealistic category images used consistently by service grids and needs cards.
 * Every catalog category has a local image so no service falls back to an icon badge.
 */
export const categoryImages: Record<string, ImageSourcePropType> = {
  'health.hospitals': require('../../assets/categories/health-hospitals.png'),
  'health.doctors': require('../../assets/categories/health-doctor-consultation.png'),
  'health.special_educator': require('../../assets/categories/wellness-therapy-mental.png'),
  'health.pharmacy': require('../../assets/categories/health-order-medicines.png'),
  'health.laboratory': require('../../assets/categories/health-laboratory.png'),
  'health.physiotherapist': require('../../assets/categories/health-physiotherapist.png'),
  'health.nursing': require('../../assets/categories/health-nursing.png'),
  'health.scan': require('../../assets/categories/health-scan.png'),
  'health.medical_transport': require('../../assets/categories/health-medical-transport.png'),

  'fitness.gym': require('../../assets/categories/fitness-gym.png'),
  'fitness.personal_trainer': require('../../assets/categories/fitness-personal-trainer.png'),
  'fitness.aerobics_zumba': require('../../assets/categories/fitness-aerobics-zumba.png'),
  'fitness.yoga': require('../../assets/categories/fitness-yoga.png'),
  'fitness.womens': require('../../assets/categories/fitness-womens.png'),
  'fitness.sports_fitness': require('../../assets/categories/fitness-sports-fitness.png'),
  'fitness.bodybuilding': require('../../assets/categories/fitness-bodybuilding.png'),
  'fitness.crossfit': require('../../assets/categories/fitness-crossfit.png'),
  'fitness.geriatric': require('../../assets/categories/fitness-geriatric.png'),

  'sports.athletics': require('../../assets/categories/sports-athletics.png'),
  'sports.outdoor': require('../../assets/categories/sports-outdoor.png'),
  'sports.traditional': require('../../assets/categories/sports-traditional.png'),
  'sports.water': require('../../assets/categories/sports-water.png'),
  'sports.indoor': require('../../assets/categories/sports-indoor.png'),
  'sports.table': require('../../assets/categories/sports-table.png'),
  'sports.mma': require('../../assets/categories/sports-mma.png'),
  'sports.archery': require('../../assets/categories/sports-archery.png'),
  'sports.kids': require('../../assets/categories/sports-kids.png'),

  'wellness.alternate_medicine': require('../../assets/categories/wellness-alternate-medicine.png'),
  'wellness.nutrition_clinical': require('../../assets/categories/wellness-nutrition-clinical.png'),
  'wellness.nutrition_sports': require('../../assets/categories/wellness-nutrition-sports.png'),
  'wellness.psychologist': require('../../assets/categories/wellness-psychologist.png'),
  'wellness.reiki': require('../../assets/categories/wellness-reiki.png'),
  'wellness.spiritual': require('../../assets/categories/wellness-spiritual.png'),
  'wellness.life_coach': require('../../assets/categories/wellness-life-coach.png'),
  'wellness.motivation': require('../../assets/categories/wellness-motivation.png'),
  'wellness.acupuncture': require('../../assets/categories/wellness-acupuncture.png'),

  'tours.trekking': require('../../assets/categories/tours-trekking.png'),
  'tours.cycling': require('../../assets/categories/tours-cycling.png'),
  'tours.marathon': require('../../assets/categories/tours-marathon.png'),
  'tours.devotional': require('../../assets/categories/tours-devotional.png'),
  'tours.adventure': require('../../assets/categories/tours-adventure.png'),
  'tours.india': require('../../assets/categories/tours-india.png'),
  'tours.abroad': require('../../assets/categories/tours-abroad.png'),
  'tours.party': require('../../assets/categories/tours-party.png'),
  'tours.transport': require('../../assets/categories/tours-transport.png'),

  'beauty.parlour_female': require('../../assets/categories/beauty-parlour-female.png'),
  'beauty.salon_male': require('../../assets/categories/beauty-salon-male.png'),
  'beauty.cosmetology': require('../../assets/categories/beauty-cosmetology.png'),
  'beauty.fashion_show': require('../../assets/categories/beauty-fashion-show.png'),
  'beauty.makeup': require('../../assets/categories/beauty-makeup.png'),
  'beauty.massage': require('../../assets/categories/beauty-massage.png'),
  'beauty.reflexology': require('../../assets/categories/beauty-reflexology.png'),
  'beauty.tattoo': require('../../assets/categories/beauty-tattoo.png'),
  'beauty.piercing': require('../../assets/categories/beauty-piercing.png'),

  'course.health_fitness': require('../../assets/categories/course-health-fitness.png'),
  'course.school_tuition': require('../../assets/categories/course-school-tuition.png'),
  'course.music': require('../../assets/categories/course-music.png'),
  'course.homemade': require('../../assets/categories/course-homemade.png'),
  'course.ai': require('../../assets/categories/course-ai.png'),
  'course.language': require('../../assets/categories/course-language.png'),
  'course.design': require('../../assets/categories/course-design.png'),
  'course.social': require('../../assets/categories/course-social.png'),
  'course.app_dev': require('../../assets/categories/course-app-dev.png'),

  'home.electrician': require('../../assets/categories/home-electrician.png'),
  'home.plumber': require('../../assets/categories/home-plumber.png'),
  'home.carpenter': require('../../assets/categories/home-carpenter.png'),
  'home.cleaning': require('../../assets/categories/home-cleaning.png'),
  'home.ac': require('../../assets/categories/home-ac.png'),
  'home.driver': require('../../assets/categories/home-driver.png'),
  'home.interior': require('../../assets/categories/home-interior.png'),
  'home.civil': require('../../assets/categories/home-civil.png'),
  'home.agriculture': require('../../assets/categories/home-agriculture.png'),

  'ecom.sports': require('../../assets/categories/ecom-sports.png'),
  'ecom.health': require('../../assets/categories/ecom-health.png'),
  'ecom.fitness': require('../../assets/categories/ecom-fitness.png'),
  'ecom.beauty': require('../../assets/categories/ecom-beauty.png'),
  'ecom.garments': require('../../assets/categories/ecom-garments.png'),
  'ecom.property': require('../../assets/categories/ecom-property.png'),
  'ecom.kitchen': require('../../assets/categories/ecom-kitchen.png'),
  'ecom.games': require('../../assets/categories/ecom-games.png'),
  'ecom.electronics': require('../../assets/categories/ecom-electronics.png'),
};

/** Featured cover image per service tree (Needs home tiles). */
export const treeImages: Partial<Record<string, ImageSourcePropType>> = {
  health: require('../../assets/categories/health-doctor-consultation.png'),
  fitness: require('../../assets/categories/fitness-gym.png'),
  sports: require('../../assets/categories/sports-outdoor.png'),
  wellness: require('../../assets/categories/wellness-psychologist.png'),
  tours_events: require('../../assets/categories/tours-adventure.png'),
  beauty_spa: require('../../assets/categories/beauty-parlour-female.png'),
  ecommerce: require('../../assets/categories/ecom-sports.png'),
  course_training: require('../../assets/categories/course-music.png'),
  home_services: require('../../assets/categories/home-electrician.png'),
};

export function getCategoryImage(categoryId: string): ImageSourcePropType | undefined {
  return categoryImages[categoryId];
}

export function getTreeImage(treeId: string): ImageSourcePropType | undefined {
  return treeImages[treeId];
}
