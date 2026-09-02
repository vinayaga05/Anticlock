import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { assistantLinking } from '@/features/assistant/navigation/assistantNavigation';
import { useAssistantStore } from '@/features/assistant/store/assistantStore';
import { MainNavigator } from '@/shared/navigation/MainNavigator';
import { RootStackParamList } from '@/shared/navigation/types';
import { useTheme } from '@/shared/hooks/useTheme';
import { useAuth } from '@/shared/context/AuthProvider';
import { AuthLoadingScreen, LoginScreen } from '@/features/auth/screens/LoginScreen';
import { SearchScreen } from '@/features/booking/screens/SearchScreen';
import { ProfileScreen } from '@/features/booking/screens/ProfileScreen';
import { UserProfileScreen } from '@/features/profile/screens/UserProfileScreen';
import { DoctorsScreen } from '@/features/booking/screens/DoctorsScreen';
import { DoctorProfileScreen } from '@/features/booking/screens/DoctorProfileScreen';
import { DiagnosticsHubScreen } from '@/features/booking/screens/DiagnosticsHubScreen';
import { LabListScreen } from '@/features/booking/screens/LabListScreen';
import { LabDetailScreen } from '@/features/booking/screens/LabDetailScreen';
import { PhysioHubScreen } from '@/features/booking/screens/PhysioHubScreen';
import { FitnessFeedScreen } from '@/features/booking/screens/FitnessFeedScreen';
import { ClassDetailScreen } from '@/features/booking/screens/ClassDetailScreen';
import { ScheduleScreen } from '@/features/booking/screens/ScheduleScreen';
import { BookingConfirmScreen } from '@/features/booking/screens/BookingConfirmScreen';
import { MyBookingsScreen } from '@/features/booking/screens/MyBookingsScreen';
import { CommunitiesScreen } from '@/features/community/screens/CommunitiesScreen';
import { ExploreCreateScreen } from '@/features/community/screens/ExploreCreateScreen';
import {
  CreateExploreEventScreen,
  CreateExploreProductScreen,
} from '@/features/community/screens/ExploreComposeScreen';
import { ExploreSubmissionDetailScreen } from '@/features/community/screens/ExploreSubmissionDetailScreen';
import { ClubDetailScreen } from '@/features/community/screens/ClubDetailScreen';
import { ClubRosterScreen } from '@/features/community/screens/ClubRosterScreen';
import { ClubPlayerFormScreen } from '@/features/community/screens/ClubPlayerFormScreen';
import { CreateClubScreen } from '@/features/community/screens/CreateClubScreen';
import { ClubJoinRequestsScreen } from '@/features/community/screens/ClubJoinRequestsScreen';
import { ChallengeDetailScreen } from '@/features/community/screens/ChallengeDetailScreen';
import { ChallengeParticipateScreen } from '@/features/community/screens/ChallengeParticipateScreen';
import { InboxScreen } from '@/features/messages/screens/InboxScreen';
import { ThreadScreen } from '@/features/messages/screens/ThreadScreen';
import { ServiceTreeScreen } from '@/features/services/screens/ServiceTreeScreen';
import { ServiceCategoryScreen } from '@/features/services/screens/ServiceCategoryScreen';
import { UniversalDetailScreen } from '@/features/services/screens/UniversalDetailScreen';
import { ServiceRequestScreen } from '@/features/services/screens/ServiceRequestScreen';
import { CourseDetailScreen } from '@/features/services/screens/CourseDetailScreen';
import { EventDetailScreen } from '@/features/services/screens/EventDetailScreen';
import { ProductDetailScreen } from '@/features/services/screens/ProductDetailScreen';
import { CheckoutScreen } from '@/features/services/screens/CheckoutScreen';
import { MyLearningScreen } from '@/features/services/screens/MyLearningScreen';
import { MyTripsScreen } from '@/features/services/screens/MyTripsScreen';
import { MyServiceRequestsScreen } from '@/features/services/screens/MyServiceRequestsScreen';
import { MyOrdersScreen } from '@/features/services/screens/MyOrdersScreen';
import { ComingSoonScreen } from '@/features/services/screens/ComingSoonScreen';
import { FlashComposerScreen } from '@/features/flash/screens/FlashComposerScreen';
import { FlashCommentsScreen } from '@/features/flash/screens/FlashCommentsScreen';
import { StoryViewerScreen } from '@/features/flash/screens/StoryViewerScreen';
import { StoryCreatorScreen } from '@/features/flash/screens/StoryCreatorScreen';
import { SavedHubScreen } from '@/features/flash/screens/SavedHubScreen';
import { ProviderApplicationIntroScreen } from '@/features/provider-onboarding/screens/ProviderApplicationIntroScreen';
import { ProviderApplicationKindScreen } from '@/features/provider-onboarding/screens/ProviderApplicationKindScreen';
import { ProviderApplicationServiceSelectScreen } from '@/features/provider-onboarding/screens/ProviderApplicationServiceSelectScreen';
import { ProviderApplicationFormScreen } from '@/features/provider-onboarding/screens/ProviderApplicationFormScreen';
import { ProviderApplicationReviewScreen } from '@/features/provider-onboarding/screens/ProviderApplicationReviewScreen';
import { ProviderApplicationStatusScreen } from '@/features/provider-onboarding/screens/ProviderApplicationStatusScreen';
import { ProviderDashboardScreen } from '@/features/provider-onboarding/screens/ProviderDashboardScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();
  const { user, loading } = useAuth();

  const navigationTheme =
    theme.mode === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: theme.colors.background,
            card: theme.colors.backgroundElevated,
            text: theme.colors.textPrimary,
            border: theme.colors.border,
            primary: theme.colors.primary,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: theme.colors.background,
            card: theme.colors.backgroundElevated,
            text: theme.colors.textPrimary,
            border: theme.colors.border,
            primary: theme.colors.primary,
          },
        };

  if (loading) {
    return <AuthLoadingScreen />;
  }

  return (
    <NavigationContainer
      theme={navigationTheme}
      linking={assistantLinking}
      onStateChange={state => {
        if (!state) return;
        const route = state.routes[state.index];
        const screenName = route?.name ?? null;
        useAssistantStore.getState().setCurrentScreen(screenName);
      }}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.textPrimary,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          headerBackButtonDisplayMode: 'minimal',
          headerBackTitle: '',
          contentStyle: { backgroundColor: theme.colors.background },
        }}>
        {!user ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
        <Stack.Screen
          name="Main"
          component={MainNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
        <Stack.Screen
          name="Profile"
          component={UserProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AccountSettings"
          component={ProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Doctors" component={DoctorsScreen} options={{ title: 'Doctors' }} />
        <Stack.Screen
          name="DoctorProfile"
          component={DoctorProfileScreen}
          options={{ title: 'Doctor' }}
        />
        <Stack.Screen
          name="DiagnosticsHub"
          component={DiagnosticsHubScreen}
          options={{ title: 'Diagnostics' }}
        />
        <Stack.Screen name="LabList" component={LabListScreen} options={{ title: 'Lab Tests' }} />
        <Stack.Screen name="LabDetail" component={LabDetailScreen} options={{ title: 'Lab' }} />
        <Stack.Screen
          name="PhysioHub"
          component={PhysioHubScreen}
          options={{ title: 'Physiotherapy' }}
        />
        <Stack.Screen
          name="FitnessFeed"
          component={FitnessFeedScreen}
          options={{ title: 'Classes' }}
        />
        <Stack.Screen
          name="ClassDetail"
          component={ClassDetailScreen}
          options={{ title: 'Class' }}
        />
        <Stack.Screen
          name="Schedule"
          component={ScheduleScreen}
          options={{ title: 'Schedule' }}
        />
        <Stack.Screen
          name="BookingConfirm"
          component={BookingConfirmScreen}
          options={{ title: 'Confirmed', headerBackVisible: false }}
        />
        <Stack.Screen
          name="MyBookings"
          component={MyBookingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Communities"
          component={CommunitiesScreen}
          options={{ title: 'Communities', headerShown: false }}
        />
        <Stack.Screen
          name="Inbox"
          component={InboxScreen}
          options={{ title: 'Knock', headerShown: false }}
        />
        <Stack.Screen name="Thread" component={ThreadScreen} options={{ title: 'Chat' }} />
        <Stack.Screen
          name="ServiceTree"
          component={ServiceTreeScreen}
          options={{ title: 'Services' }}
        />
        <Stack.Screen
          name="ServiceCategory"
          component={ServiceCategoryScreen}
          options={{ title: 'Category' }}
        />
        <Stack.Screen
          name="UniversalDetail"
          component={UniversalDetailScreen}
          options={{ title: 'Details' }}
        />
        <Stack.Screen
          name="ServiceRequest"
          component={ServiceRequestScreen}
          options={{ title: 'Request service' }}
        />
        <Stack.Screen
          name="CourseDetail"
          component={CourseDetailScreen}
          options={{ title: 'Course' }}
        />
        <Stack.Screen
          name="EventDetail"
          component={EventDetailScreen}
          options={{ title: 'Event' }}
        />
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreen}
          options={{ title: 'Product' }}
        />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
        <Stack.Screen
          name="MyLearning"
          component={MyLearningScreen}
          options={{ title: 'My Learning' }}
        />
        <Stack.Screen name="MyTrips" component={MyTripsScreen} options={{ title: 'My Trips' }} />
        <Stack.Screen
          name="MyServiceRequests"
          component={MyServiceRequestsScreen}
          options={{ title: 'Requests' }}
        />
        <Stack.Screen name="MyOrders" component={MyOrdersScreen} options={{ title: 'My Orders' }} />
        <Stack.Screen
          name="ComingSoon"
          component={ComingSoonScreen}
          options={{ title: 'Coming soon' }}
        />
        <Stack.Screen
          name="FlashComposer"
          component={FlashComposerScreen}
          options={{ title: 'Create post' }}
        />
        <Stack.Screen
          name="FlashComments"
          component={FlashCommentsScreen}
          options={{ title: 'Comments' }}
        />
        <Stack.Screen
          name="StoryViewer"
          component={StoryViewerScreen}
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="StoryCreator"
          component={StoryCreatorScreen}
          options={{ title: 'Create Story', headerShown: false }}
        />
        <Stack.Screen
          name="SavedHub"
          component={SavedHubScreen}
          options={{ title: 'Saved' }}
        />
        <Stack.Screen
          name="ExploreCreate"
          component={ExploreCreateScreen}
          options={{ title: 'Create', headerShown: false }}
        />
        <Stack.Screen
          name="CreateExploreEvent"
          component={CreateExploreEventScreen}
          options={{ title: 'Create Event', headerShown: false }}
        />
        <Stack.Screen
          name="CreateExploreProduct"
          component={CreateExploreProductScreen}
          options={{ title: 'Post Product', headerShown: false }}
        />
        <Stack.Screen
          name="ExploreSubmissionDetail"
          component={ExploreSubmissionDetailScreen}
          options={{ title: 'Submission', headerShown: false }}
        />
        <Stack.Screen
          name="TeamDetail"
          component={ClubDetailScreen}
          options={{ title: 'Team', headerShown: false }}
        />
        <Stack.Screen
          name="TeamRoster"
          component={ClubRosterScreen}
          options={{ title: 'Roster', headerShown: false }}
        />
        <Stack.Screen
          name="TeamPlayerForm"
          component={ClubPlayerFormScreen}
          options={{ title: 'Player', headerShown: false }}
        />
        <Stack.Screen
          name="CreateTeam"
          component={CreateClubScreen}
          options={{ title: 'Create Team', headerShown: false }}
        />
        <Stack.Screen
          name="TeamJoinRequests"
          component={ClubJoinRequestsScreen}
          options={{ title: 'Join Requests', headerShown: false }}
        />
        <Stack.Screen
          name="ChallengeDetail"
          component={ChallengeDetailScreen}
          options={{ title: 'Challenge', headerShown: false }}
        />
        <Stack.Screen
          name="ChallengeParticipate"
          component={ChallengeParticipateScreen}
          options={{ title: 'Participate', headerShown: false }}
        />
        <Stack.Screen
          name="ProviderApplicationIntro"
          component={ProviderApplicationIntroScreen}
          options={{ title: 'Become a Provider' }}
        />
        <Stack.Screen
          name="ProviderApplicationKind"
          component={ProviderApplicationKindScreen}
          options={{ title: 'Provider type' }}
        />
        <Stack.Screen
          name="ProviderApplicationServices"
          component={ProviderApplicationServiceSelectScreen}
          options={{ title: 'Select services' }}
        />
        <Stack.Screen
          name="ProviderApplicationForm"
          component={ProviderApplicationFormScreen}
          options={{ title: 'Application' }}
        />
        <Stack.Screen
          name="ProviderApplicationReview"
          component={ProviderApplicationReviewScreen}
          options={{ title: 'Review' }}
        />
        <Stack.Screen
          name="ProviderApplicationStatus"
          component={ProviderApplicationStatusScreen}
          options={{ title: 'Application status' }}
        />
        <Stack.Screen
          name="ProviderDashboard"
          component={ProviderDashboardScreen}
          options={{ title: 'Provider dashboard' }}
        />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
