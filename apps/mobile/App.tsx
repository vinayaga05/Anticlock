import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalProvider } from 'react-native-teleport';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from '@/shared/navigation/RootNavigator';
import { AuthProvider, useAuth } from '@/shared/context/AuthProvider';
import { StreamChatProvider } from '@/shared/providers/StreamChatProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import { useNotificationSetup } from '@/shared/hooks/useNotificationSetup';
import { LiveContentSync } from '@/shared/realtime/LiveContentSync';
import { LiveBookingSync } from '@/shared/realtime/LiveBookingSync';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppShell() {
  const theme = useTheme();
  const { user } = useAuth();

  // Set up push notifications when user is authenticated
  useNotificationSetup(Boolean(user && user.id !== 'temporary-guest'));

  return (
    <>
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      {user && user.id !== 'temporary-guest' ? (
        <>
          <LiveContentSync />
          <LiveBookingSync />
        </>
      ) : null}
      <RootNavigator />
    </>
  );
}

function App() {
  // Match Connect (Mellini): PortalProvider outermost so react-native-teleport
  // PortalHostView is registered above GestureHandler / navigation / Stream Chat.
  return (
    <PortalProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StreamChatProvider>
                <AppShell />
              </StreamChatProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </PortalProvider>
  );
}

export default App;
