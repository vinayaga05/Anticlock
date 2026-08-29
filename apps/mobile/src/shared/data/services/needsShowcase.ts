import type { ImageSourcePropType } from 'react-native';
import type { ServiceTreeId } from './serviceTypes';
import { categoryImages } from './categoryImages';

export type NeedsShowcaseItem = {
  categoryId: string;
  treeId: ServiceTreeId;
  label: string;
  image: ImageSourcePropType;
};

export type NeedsShowcaseCard = {
  id: string;
  title: string;
  /** Primary tree opened when tapping the card chrome (not an icon). */
  treeId: ServiceTreeId;
  items: [NeedsShowcaseItem, NeedsShowcaseItem];
};

function item(
  categoryId: string,
  treeId: ServiceTreeId,
  label: string,
): NeedsShowcaseItem {
  const image = categoryImages[categoryId];
  if (!image) {
    throw new Error(`Missing category image for ${categoryId}`);
  }
  return { categoryId, treeId, label, image };
}

/**
 * Needs tab showcase — 9 cards × 2 photoreal icons (matches design collage).
 * Not the full catalog; other trees remain reachable via Search / ServiceTree.
 */
export const needsShowcaseCards: NeedsShowcaseCard[] = [
  {
    id: 'my-activity',
    title: 'My Activity',
    treeId: 'fitness',
    items: [
      item('fitness.yoga', 'fitness', 'My Classes'),
      item('sports.outdoor', 'sports', 'My Sports'),
    ],
  },
  {
    id: 'health',
    title: 'Health',
    treeId: 'health',
    items: [
      item('health.doctors', 'health', 'Doctor Consultation'),
      item('health.pharmacy', 'health', 'Order Medicines'),
    ],
  },
  {
    id: 'services',
    title: 'Services',
    treeId: 'home_services',
    items: [
      item('home.plumber', 'home_services', 'Home Repairs'),
      item('home.cleaning', 'home_services', 'Home Cleaning'),
    ],
  },
  {
    id: 'courses-training',
    title: 'Courses & Training',
    treeId: 'course_training',
    items: [
      item('course.health_fitness', 'course_training', 'Fitness Courses'),
      item('course.music', 'course_training', 'Music & Dance'),
    ],
  },
  {
    id: 'fitness',
    title: 'Fitness',
    treeId: 'fitness',
    items: [
      item('fitness.yoga', 'fitness', 'Yoga Classes'),
      item('fitness.bodybuilding', 'fitness', 'Workout Routines'),
    ],
  },
  {
    id: 'travel-events',
    title: 'Travel & Events',
    treeId: 'tours_events',
    items: [
      item('tours.adventure', 'tours_events', 'Adventure Activities'),
      item('tours.india', 'tours_events', 'Tours & Expeditions'),
    ],
  },
  {
    id: 'sports',
    title: 'Sports',
    treeId: 'sports',
    items: [
      item('sports.outdoor', 'sports', 'Football'),
      item('sports.athletics', 'sports', 'Cricket'),
    ],
  },
  {
    id: 'wellness',
    title: 'Wellness',
    treeId: 'wellness',
    items: [
      item('wellness.nutrition_clinical', 'wellness', 'Nutrition & Diet'),
      item('wellness.psychologist', 'wellness', 'Therapy & Mental Health'),
    ],
  },
  {
    id: 'beauty-spa',
    title: 'Beauty & Spa',
    treeId: 'beauty_spa',
    items: [
      item('beauty.parlour_female', 'beauty_spa', 'Beauty Parlour'),
      item('beauty.massage', 'beauty_spa', 'Massage & Spa'),
    ],
  },
];
