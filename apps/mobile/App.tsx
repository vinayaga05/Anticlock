import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from '@/shared/navigation/RootNavigator';
<<<<<<< HEAD
import { AuthProvider, useAuth } from '@/shared/context/AuthProvider';
=======
import { AuthProvider } from '@/shared/context/AuthProvider';
import { StreamChatProvider } from '@/shared/providers/StreamChatProvider';
>>>>>>> origin/main
import { useTheme } from '@/shared/hooks/useTheme';
import { useNotificationSetup } from '@/shared/hooks/useNotificationSetup';

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
  const { session } = useAuth();

  // Set up push notifications when user is authenticated
  useNotificationSetup(!!session);

  return (
    <>
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      <RootNavigator />
    </>
  );
}

function App() {
  return (
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
  );
}

export default App;
