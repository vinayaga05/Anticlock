import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainNavigator } from '@/shared/navigation/MainNavigator';
import { RootStackParamList } from '@/shared/navigation/types';
import { useTheme } from '@/shared/hooks/useTheme';
import { SearchScreen } from '@/features/booking/screens/SearchScreen';
import { ProfileScreen } from '@/features/booking/screens/ProfileScreen';
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
          headerStyle: { backgroundColor: theme.colors.backgroundElevated },
          headerTintColor: theme.colors.textPrimary,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          contentStyle: { backgroundColor: theme.colors.background },
        }}>
        <Stack.Screen
          name="Main"
          component={MainNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
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
          options={{ title: 'Communities' }}
        />
        <Stack.Screen name="Inbox" component={InboxScreen} options={{ title: 'Knock' }} />
        <Stack.Screen name="Thread" component={ThreadScreen} options={{ title: 'Chat' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
