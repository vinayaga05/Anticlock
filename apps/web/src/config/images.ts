/**
 * Mapping of service categories to their representative images
 * Images are real category artwork from the mobile app
 */

export const categoryImages: Record<string, string[]> = {
  health: [
    'health-doctor-consultation.webp',
    'health-clinic.webp',
    'health-hospitals.webp',
    'health-laboratory.webp',
    'health-physiotherapy.webp',
  ],
  fitness: [
    'fitness-gym.webp',
    'fitness-yoga.webp',
    'fitness-personal-trainer.webp',
    'fitness-crossfit.webp',
    'fitness-aerobics-zumba.webp',
  ],
  sports: [
    'sports-football.webp',
    'sports-cricket.webp',
    'sports-athletics.webp',
    'sports-outdoor.webp',
    'sports-indoor.webp',
  ],
  wellness: [
    'wellness-nutrition-diet.webp',
    'wellness-psychologist.webp',
    'wellness-life-coach.webp',
    'wellness-reiki.webp',
    'wellness-acupuncture.webp',
  ],
  'tours-events': [
    'tours-trekking.webp',
    'tours-adventure.webp',
    'tours-abroad.webp',
    'tours-india.webp',
    'tours-cycling.webp',
  ],
  'beauty-spa': [
    'beauty-parlour-female.webp',
    'beauty-salon-male.webp',
    'beauty-massage.webp',
    'beauty-makeup.webp',
    'beauty-cosmetology.webp',
  ],
  courses: [
    'course-design.webp',
    'course-ai.webp',
    'course-app-dev.webp',
    'course-music.webp',
    'course-language.webp',
  ],
  'home-services': [
    'home-plumber.webp',
    'home-interior.webp',
    'home-carpenter.webp',
    'home-electrician.webp',
    'home-appliances.webp',
  ],
  shop: [
    'shop-fitness-3d.webp',
    'shop-health-3d.webp',
    'shop-beauty-3d.webp',
    'shop-sports-3d.webp',
    'shop-garments-3d.webp',
  ],
};

/**
 * Get primary image for a category
 */
export function getCategoryImage(categoryId: string): string {
  const images = categoryImages[categoryId];
  return images ? `/app/${images[0]}` : '';
}

/**
 * Get all images for a category
 */
export function getCategoryImages(categoryId: string): string[] {
  const images = categoryImages[categoryId];
  return images ? images.map(img => `/app/${img}`) : [];
}
