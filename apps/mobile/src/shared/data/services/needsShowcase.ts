import type { ImageSourcePropType } from 'react-native';
import type { ServiceTreeId } from './serviceTypes';
import { categoryImages } from './categoryImages';
import { needsServiceTrees } from './serviceTrees';

export type NeedsShowcaseItem = {
  categoryId: string;
  treeId: ServiceTreeId;
  label: string;
  image?: ImageSourcePropType;
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
  return { categoryId, treeId, label, image };
}

const previews: Partial<
  Record<ServiceTreeId, [NeedsShowcaseItem, NeedsShowcaseItem]>
> = {
  health: [
    item('health.doctors', 'health', 'Doctors'),
    item('health.pharmacy', 'health', 'Pharmacy'),
  ],
  home_services: [
    item('home.plumber', 'home_services', 'Home Repairs'),
    item('home.cleaning', 'home_services', 'Cleaning'),
  ],
  fitness: [
    item('fitness.yoga', 'fitness', 'Yoga'),
    item('beauty.massage', 'fitness', 'Spa'),
  ],
  course_training: [
    item('course.school_tuition', 'course_training', 'Tuition'),
    item('course.music', 'course_training', 'Music & Dance'),
  ],
  sports: [
    item('sports.indoor', 'sports', 'Indoor Sports'),
    item('sports.outdoor', 'sports', 'Outdoor Sports'),
  ],
  tours_events: [
    item('tours.india', 'tours_events', 'Tour Packages'),
    item('tours.adventure', 'tours_events', 'Adventure'),
  ],
  wellness: [
    item('wellness.alternate_medicine', 'wellness', 'Indian Medicine'),
    item('wellness.spiritual', 'wellness', 'Meditation'),
  ],
  rooms_restaurant: [
    item('rooms.hotel', 'rooms_restaurant', 'Hotels'),
    item('rooms.veg_restaurant', 'rooms_restaurant', 'Restaurants'),
  ],
  local_services: [
    item('services.e_sevai', 'local_services', 'e-Sevai'),
    item('services.devices', 'local_services', 'Mobile & Laptop'),
  ],
};

export const needsShowcaseCards: NeedsShowcaseCard[] =
  needsServiceTrees.flatMap(tree => {
    const items = previews[tree.id];
    return items
      ? [{ id: tree.id, title: tree.name, treeId: tree.id, items }]
      : [];
  });
