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
    id: 'health',
    title: 'Health Services',
    treeId: 'health',
    items: [
      item('health.doctors', 'health', 'Doctor Consultation'),
      item('health.pharmacy', 'health', 'Order Medicines'),
    ],
  },
  {
    id: 'fitness',
    title: 'Fitness & Yoga',
    treeId: 'fitness',
    items: [
      item('fitness.yoga', 'fitness', 'Yoga Classes'),
      item('fitness.bodybuilding', 'fitness', 'Workout Routines'),
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
    id: 'events',
    title: 'Events',
    treeId: 'tours_events',
    items: [
      item('tours.adventure', 'tours_events', 'Adventure Activities'),
      item('tours.india', 'tours_events', 'Tours & Expeditions'),
    ],
  },
  {
    id: 'products',
    title: 'Products',
    treeId: 'ecommerce',
    items: [
      item('ecom.sports', 'ecommerce', 'Apparel & T-shirts'),
      item('ecom.fitness', 'ecommerce', 'Protein & Supplements'),
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
    id: 'natural',
    title: 'Natural Medicine',
    treeId: 'wellness',
    items: [
      item('wellness.acupuncture', 'wellness', 'Siddha Medicine'),
      item('wellness.alternate_medicine', 'wellness', 'Ayurveda & Herbal'),
    ],
  },
  {
    id: 'traditional',
    title: 'Traditional Sports',
    treeId: 'sports',
    items: [
      item('sports.traditional', 'sports', 'Silambam'),
      item('sports.mma', 'sports', 'Mallakhamb'),
    ],
  },
  {
    id: 'devotional',
    title: 'Devotional',
    treeId: 'tours_events',
    items: [
      item('tours.devotional', 'tours_events', 'Meditation & Chanting'),
      item('course.music', 'course_training', 'Music, Dance & Kirtan'),
    ],
  },
];
