export type MainTabParamList = {
  Flash: undefined;
  Clips: undefined;
  Needs: undefined;
  Community: undefined;
  Knock: undefined;
  Shop: undefined;
};

export type RootStackParamList = {
  Main: undefined | { screen: keyof MainTabParamList };
  Search: undefined;
  Profile: undefined;
  Doctors: undefined;
  DoctorProfile: { doctorId: string };
  DiagnosticsHub: undefined;
  LabList: { testId?: string };
  LabDetail: { labId: string; testId?: string };
  PhysioHub: undefined;
  FitnessFeed: undefined;
  ClassDetail: { classId: string };
  Schedule: {
    kind: 'doctor' | 'lab' | 'fitness' | 'appointment' | 'class';
    id: string;
    title: string;
    fee: number;
  };
  BookingConfirm: {
    kind: 'doctor' | 'lab' | 'fitness' | 'appointment' | 'class';
    title: string;
    subtitle: string;
    when: string;
    place: string;
    fee: number;
    patientName?: string;
  };
  MyBookings: undefined;
  Communities: undefined;
  Inbox: undefined;
  Thread: { conversationId: string };
  ServiceTree: { treeId: string };
  ServiceCategory: { treeId: string; categoryId: string };
  UniversalDetail: {
    entityType: 'provider' | 'event' | 'course' | 'product';
    entityId: string;
    categoryId: string;
  };
  ServiceRequest: { categoryId: string; providerId?: string };
  CourseDetail: { courseId: string };
  EventDetail: { eventId: string };
  ProductDetail: { productId: string };
  Checkout: undefined;
  MyLearning: undefined;
  MyTrips: undefined;
  MyServiceRequests: undefined;
  MyOrders: undefined;
  ComingSoon: { title: string };
  FlashComposer: undefined;
  FlashComments: { postId: string };
  SavedHub: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
