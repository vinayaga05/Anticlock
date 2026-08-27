export type ServiceTreeId =
  | 'health'
  | 'fitness'
  | 'sports'
  | 'wellness'
  | 'tours_events'
  | 'beauty_spa'
  | 'course_training'
  | 'home_services'
  | 'ecommerce';

export type ServiceActionType =
  | 'appointment'
  | 'class_booking'
  | 'membership'
  | 'event_booking'
  | 'home_service'
  | 'course_enrollment'
  | 'product_purchase'
  | 'property_enquiry'
  | 'transport_booking'
  | 'service_request';

export type ServiceFeature =
  | 'provider_search'
  | 'specialization'
  | 'availability'
  | 'appointment'
  | 'reviews'
  | 'membership'
  | 'classes'
  | 'timetable'
  | 'itinerary'
  | 'participants'
  | 'curriculum'
  | 'enrollment'
  | 'job_description'
  | 'attachments'
  | 'address'
  | 'cart'
  | 'enquiry'
  | 'gallery';

export type ServiceTree = {
  id: ServiceTreeId;
  name: string;
  description: string;
  icon: string;
  serviceCount: number;
  accent: string;
};

export type ServiceCategory = {
  id: string;
  treeId: ServiceTreeId;
  order: number;
  name: string;
  description: string;
  icon: string;
  actionType: ServiceActionType;
  features: ServiceFeature[];
  legacyRoute?: 'Doctors' | 'DiagnosticsHub' | 'PhysioHub' | 'FitnessFeed' | 'LabList' | 'Shop';
};

export type MarketplaceLocation = {
  city: string;
  area: string;
  distanceKm?: number;
};

export type MarketplaceProvider = {
  id: string;
  name: string;
  type: string;
  categoryIds: string[];
  actionType: ServiceActionType;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  location: MarketplaceLocation;
  priceFrom?: number;
  verified: boolean;
  subtitle?: string;
  tags?: string[];
  about?: string;
  modes?: Array<'online' | 'center' | 'home'>;
};

export type MarketplaceEvent = {
  id: string;
  categoryId: string;
  title: string;
  organizer: string;
  destination: string;
  duration: string;
  dateLabel: string;
  price: number;
  slotsLeft: number;
  imageUrl: string;
  itinerary: string[];
  meetingPoint: string;
};

export type MarketplaceCourse = {
  id: string;
  categoryId: string;
  title: string;
  instructor: string;
  level: string;
  duration: string;
  mode: 'online' | 'offline' | 'hybrid';
  price: number;
  imageUrl: string;
  curriculum: string[];
  enrolled?: boolean;
  progress?: number;
};

export type MarketplaceProduct = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  imageUrl: string;
  seller: string;
  rating: number;
  description: string;
  isProperty?: boolean;
};

export type BookingStatus = 'upcoming' | 'completed' | 'cancelled' | 'confirmed';

export type UniversalBooking = {
  id: string;
  type: ServiceActionType;
  categoryId: string;
  providerId?: string;
  title: string;
  subtitle?: string;
  date?: string;
  time?: string;
  place?: string;
  status: BookingStatus;
  price?: number;
};

export type ServiceRequestStatus =
  | 'requested'
  | 'searching'
  | 'assigned'
  | 'confirmed'
  | 'on_the_way'
  | 'started'
  | 'completed'
  | 'rated';

export type ServiceRequest = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  address: string;
  when: string;
  status: ServiceRequestStatus;
  providerName?: string;
  priceEstimate?: number;
};

export type CtaConfig = {
  label: string;
  icon: string;
  action:
    | 'schedule'
    | 'request'
    | 'enroll'
    | 'cart'
    | 'enquiry'
    | 'membership'
    | 'event_book';
};
