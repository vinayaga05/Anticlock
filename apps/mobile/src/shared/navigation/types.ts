export type KnockTab = 'notifications' | 'bookings' | 'chat';

export type MainTabParamList = {
  Flash: undefined;
  PlayFeed: undefined;
  Needs: undefined;
  Community: undefined;
  Knock: { initialTab?: KnockTab } | undefined;
  Shop: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: undefined | { screen: keyof MainTabParamList };
  Search: undefined;
  Profile: { userId?: string } | undefined;
  AccountSettings: undefined;
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
  StoryViewer: { authorId: string };
  StoryCreator: undefined;
  SavedHub: undefined;
  ExploreCreate: undefined;
  CreateExploreEvent: { challengeId?: string } | undefined;
  CreateExploreProduct: undefined;
  ExploreSubmissionDetail: { itemId: string };
  TeamDetail: { teamId: string };
  TeamRoster: { teamId: string };
  TeamPlayerForm: { teamId: string; playerId?: string };
  CreateTeam: undefined;
  TeamJoinRequests: { teamId: string };
  ChallengeDetail: { challengeId: string };
  ChallengeParticipate: { challengeId: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
