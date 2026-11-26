import { getStateFromPath, type LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from '@/shared/navigation/types';
import { normalizeBusinessNavigationState } from './businessNavigation';

/**
 * Deep linking configuration for Knock.
 * 
 * Supports:
 * - Custom scheme: anticlock://
 * - Universal links: https://anticlock.online
 * 
 * Handles both cold start and warm start, including
 * unauthenticated users (pending links stored and routed after login).
 */

export const linking: LinkingOptions<RootStackParamList> = {
  getStateFromPath: (path, options) => normalizeBusinessNavigationState(getStateFromPath(path, options)),
  prefixes: [
    'anticlock://',
    'https://anticlock.online',
    'https://www.anticlock.online',
  ],
  config: {
    screens: {
      // Auth
      Login: 'login',
      InterestOnboarding: 'onboarding',
      InterestPreferences: 'preferences',

      // Main tabs with params
      Main: {
        path: '',
        screens: {
          Flash: 'flash',
          PlayFeed: {
            path: 'reels/:reelId?',
            parse: {
              reelId: (reelId: string) => reelId || undefined,
            },
            stringify: {
              reelId: (reelId: string | undefined) => reelId || '',
            },
          },
          Needs: 'needs',
          Community: 'community',
          Knock: {
            path: 'knock/:initialTab?',
            parse: {
              initialTab: (tab: string) => 
                ['notifications', 'bookings', 'chat'].includes(tab) 
                  ? (tab as 'notifications' | 'bookings' | 'chat')
                  : undefined,
            },
          },
          Shop: {
            path: 'shop',
            parse: {
              q: (q: string) => q || undefined,
              categoryId: (categoryId: string) => categoryId || undefined,
            },
          },
        },
      },

      // Profile
      BusinessProfile: { path: 'business/:providerId', alias: ['provider/:providerId'] },
      BusinessBooking: 'business/:providerId/book',
      BusinessManage: 'business/:providerId/manage/:section?',
      Profile: {
        path: 'profile/:userId?',
        parse: {
          userId: (userId: string) => userId || undefined,
        },
      },
      AccountSettings: 'settings',
      EditProfile: 'edit-profile',

      // Booking & Health
      Doctors: 'doctors',
      DoctorProfile: 'doctor/:doctorId',
      DiagnosticsHub: 'diagnostics',
      LabList: 'labs/:testId?',
      LabDetail: 'lab/:labId',
      PhysioHub: 'physio',
      FitnessHome: { path: 'settings/fitness', alias: ['fitness'] },
      FitnessAssessment: { path: 'settings/fitness/assessment', alias: ['needs/fitness/assessment'] },
      FitnessPlan: { path: 'settings/fitness/plan/:planId?', alias: ['needs/fitness/plan/:planId?'], parse: { version: Number } },
      FitnessWorkout: { path: 'settings/fitness/workout/:workoutId?', alias: ['needs/fitness/workout/:workoutId?'], parse: { day: Number } },
      FitnessMeals: { path: 'settings/fitness/meals', alias: ['needs/fitness/meals'] },
      FitnessLog: { path: 'settings/fitness/log/:kind/:logId?', alias: ['needs/fitness/log/:kind/:logId?'] },
      FitnessProgress: { path: 'settings/fitness/progress', alias: ['needs/fitness/progress'] },
      FitnessPrivacy: { path: 'settings/fitness/privacy', alias: ['needs/fitness/privacy'] },
      FitnessHistory: { path: 'settings/fitness/history', alias: ['needs/fitness/history'] },
      FitnessExperts: { path: 'settings/fitness/experts/:kind?', alias: ['needs/fitness/experts/:kind?'] },
      FitnessWorkspace: { path: 'settings/fitness/workspace/:clientId?', alias: ['needs/fitness/workspace/:clientId?'] },
      FitnessSharing: { path: 'settings/fitness/sharing/:providerId?', alias: ['needs/fitness/sharing/:providerId?'] },
      ClassDetail: 'class/:classId',
      Schedule: 'schedule',
      BookingConfirm: 'booking/confirm',
      MyBookings: 'bookings',

      // Community
      Communities: 'communities',
      ProfileConnections: 'connections/:profileType/:profileId/:direction',
      TeamDetail: 'team/:teamId',
      TeamRoster: 'team/:teamId/roster',
      TeamPlayerForm: 'team/:teamId/player/:playerId?',
      CreateTeam: 'team/create',
      TeamJoinRequests: 'team/:teamId/join-requests',
      ChallengeDetail: 'challenge/:challengeId',
      ChallengeParticipate: 'challenge/:challengeId/participate',

      // Messaging
      Inbox: 'inbox',
      Thread: 'thread/:conversationId',

      // Services
      ServiceTree: { path: 'services/:treeId', alias: ['needs/:treeId'] },
      ServiceCategory: 'services/:treeId/category/:categoryId',
      UniversalDetail: 'detail/:entityType/:entityId/:categoryId',
      ServiceRequest: 'request/:categoryId',
      
      // Specific entity types (courses, events, products, trips)
      CourseDetail: 'course/:courseId',
      EventDetail: 'event/:eventId',
      ProductDetail: 'product/:productId',
      
      Checkout: 'checkout',
      MyLearning: 'learning',
      MyTrips: 'trips',
      MyServiceRequests: 'requests',
      MyOrders: 'orders',

      // Content creation
      FlashComposer: 'flash/create',
      ClipComposer: 'reel/create',
      FlashComments: 'flash/:postId/comments',
      StoryViewer: 'story/:authorId',
      StoryCreator: 'story/create',
      SavedHub: 'saved',

      // Explore
      ExploreCreate: 'explore/create',
      CreateExploreEvent: 'explore/event/create',
      CreateExploreProduct: 'explore/product/create',
      ExploreSubmissionDetail: 'explore/:itemId',

      // Provider
      ProviderApplicationIntro: 'provider/apply',
      ProviderApplicationStart: { path: 'provider/apply/start', alias: ['provider/apply/kind'] },
      ProviderApplicationServices: 'provider/apply/:applicationId/services',
      ProviderApplicationForm: 'provider/apply/:applicationId/form',
      ProviderApplicationReview: 'provider/apply/:applicationId/review',
      ProviderApplicationStatus: 'provider/apply/:applicationId/status',
      ProviderBusinesses: 'provider/businesses',
      ProviderDashboard: 'provider/dashboard',

      // Other
      Search: 'search',
      ComingSoon: 'coming-soon',
    },
  },
};
