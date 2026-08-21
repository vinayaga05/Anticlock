export type MainTabParamList = {
  Home: undefined;
  Reels: undefined;
  Create: undefined;
  Health: undefined;
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
    kind: 'doctor' | 'lab' | 'fitness';
    id: string;
    title: string;
    fee: number;
  };
  BookingConfirm: {
    kind: 'doctor' | 'lab' | 'fitness';
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
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
