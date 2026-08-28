export type ThemeMode = 'light' | 'dark' | 'system';

export type ServiceMode = 'center' | 'home' | 'online';

export type BookingKind = 'doctor' | 'lab' | 'fitness';

export interface Doctor {
  id: string;
  name: string;
  qualification: string;
  specialty: string;
  languages: string[];
  experienceYears: number;
  fee: number;
  registration: string;
  about: string;
  education: string[];
  imageUrl: string;
  rating: number;
  online: boolean;
  modes: ServiceMode[];
  nextSlot?: string;
  /** Display label e.g. "3.2k+" */
  patientsServed?: string;
}

export interface LabProvider {
  id: string;
  name: string;
  location: string;
  distanceKm: number;
  experienceYears: number;
  imageUrl: string;
  collection: string;
  rating: number;
}

export interface LabTest {
  id: string;
  name: string;
  priceFrom: number;
  reportHours: string;
  availableAt: string;
}

export interface FitnessClass {
  id: string;
  title: string;
  coach: string;
  gym: string;
  location: string;
  durationMins: number;
  level: string;
  type: string;
  schedule: string;
  imageUrl: string;
  about: string;
  needs: string[];
  routine: { label: string; mins: number }[];
  languages: string[];
  fee: number;
}

export interface ReelItem {
  id: string;
  title: string;
  author: string;
  /** Creator profile image shown on the clip overlay. */
  authorAvatarUrl?: string;
  caption: string;
  /** Remote HTTPS URL or local `require(...mp4)` asset id */
  videoUrl: string | number;
  posterUrl: string;
  likeCount: number;
  commentCount: number;
  bookTarget?: {
    kind?: BookingKind;
    id?: string;
    entityType?: 'provider' | 'event' | 'course' | 'product';
    entityId?: string;
    categoryId?: string;
    serviceTreeId?: string;
    serviceCategoryId?: string;
    cta?: 'book' | 'cart' | 'trip';
  };
  liked?: boolean;
  saved?: boolean;
}

export type {
  ServiceTreeId,
  ServiceActionType,
  ServiceCategory,
  ServiceTree,
  UniversalBooking,
  MarketplaceProvider,
  MarketplaceProduct,
  MarketplaceEvent,
  MarketplaceCourse,
} from '@/shared/data/services/serviceTypes';

export interface Community {
  id: string;
  name: string;
  membersLabel: string;
  imageUrl: string;
  joined: boolean;
}

export interface ShopProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
}

export interface Conversation {
  id: string;
  name: string;
  preview: string;
  time: string;
  unread: number;
  avatarColor: string;
}

export interface KnockNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  icon: string;
}

export interface Message {
  id: string;
  conversationId: string;
  text: string;
  fromMe: boolean;
  time: string;
}

export interface BookingRecord {
  id: string;
  kind: BookingKind;
  title: string;
  subtitle: string;
  patientName: string;
  patientAge: number;
  when: string;
  place: string;
  amountPaid: number;
  status: 'confirmed' | 'upcoming' | 'completed';
}

export interface ServiceTile {
  id: string;
  label: string;
  icon: string;
  route?: string;
}

export interface TrackItem {
  id: string;
  label: string;
  icon: string;
  value?: string;
}

export interface ReportTile {
  id: string;
  title: string;
  items: string[];
  icon?: string;
}
