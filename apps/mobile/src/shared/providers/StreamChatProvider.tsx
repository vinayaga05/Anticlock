import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { StreamChat } from 'stream-chat';
import { Chat, OverlayProvider } from 'stream-chat-react-native';
import { useAuth } from '@/shared/context/AuthProvider';
import { isApiEnabled } from '@/shared/api/config';
import { apiClient } from '@/shared/api/client';

interface StreamChatContextType {
  client: StreamChat | null;
  isReady: boolean;
  isConnecting: boolean;
  error: string | null;
}

const StreamChatContext = createContext<StreamChatContextType>({
  client: null,
  isReady: false,
  isConnecting: false,
  error: null,
});

export const useStreamChat = () => useContext(StreamChatContext);

interface StreamTokenResponse {
  apiKey: string;
  userId: string;
  token: string;
}

export function StreamChatProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<StreamChat | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const session = user ? { userId: user.id } : null;

  const connectClient = useCallback(async () => {
    if (!isApiEnabled) {
      setIsReady(false);
      return;
    }

    if (!session?.userId) {
      setIsReady(false);
      setClient(null);
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Fetch token from API
      const response = await apiClient.post<StreamTokenResponse>('/v1/messages/token', {});
      const { apiKey, userId, token } = response;

      // Initialize Stream client
      const streamClient = StreamChat.getInstance(apiKey);

      // Connect user with token provider for auto-refresh
      await streamClient.connectUser(
        {
          id: userId,
        },
        token
      );

      setClient(streamClient);
      setIsReady(true);
    } catch (err: any) {
      console.error('Stream Chat connection error:', err);
      setError(err.message || 'Failed to connect to Stream Chat');
      setIsReady(false);
    } finally {
      setIsConnecting(false);
    }
  }, [session?.userId]);

  const disconnectClient = useCallback(async () => {
    if (client) {
      try {
        await client.disconnectUser();
      } catch (err) {
        console.error('Stream Chat disconnect error:', err);
      }
      setClient(null);
      setIsReady(false);
    }
  }, [client]);

  // Connect on mount and when session changes
  useEffect(() => {
    if (session?.userId) {
      connectClient();
    } else {
      disconnectClient();
    }

    // Cleanup on unmount
    return () => {
      if (client) {
        client.disconnectUser().catch(console.error);
      }
    };
  }, [session?.userId]);

  const contextValue: StreamChatContextType = {
    client,
    isReady,
    isConnecting,
    error,
  };

  // Only wrap with Chat provider if client is ready
  if (!isApiEnabled || !client || !isReady) {
    return (
      <StreamChatContext.Provider value={contextValue}>
        {children}
      </StreamChatContext.Provider>
    );
  }

  return (
    <StreamChatContext.Provider value={contextValue}>
      <OverlayProvider>
        <Chat client={client}>{children}</Chat>
      </OverlayProvider>
    </StreamChatContext.Provider>
  );
}
