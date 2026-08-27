import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainNavigator } from '@/shared/navigation/MainNavigator';
import { RootStackParamList } from '@/shared/navigation/types';
import { useTheme } from '@/shared/hooks/useTheme';
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
import { SavedHubScreen } from '@/features/flash/screens/SavedHubScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();

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

  return (
    <NavigationContainer theme={navigationTheme}>
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
          options={{ title: 'My Bookings' }}
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
          name="SavedHub"
          component={SavedHubScreen}
          options={{ title: 'Saved' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
