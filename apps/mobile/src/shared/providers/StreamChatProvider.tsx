import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { StreamChat } from 'stream-chat';
import { Chat, OverlayProvider } from 'stream-chat-react-native';
import {
  StreamVideo,
  StreamVideoClient,
  useCalls,
  type Call,
} from '@stream-io/video-react-native-sdk';
import { useAuth } from '@/shared/context/AuthProvider';
import { isApiEnabled } from '@/shared/api/config';
import { apiClient, getApiToken } from '@/shared/api/client';
import { rootNavigationRef } from '@/shared/navigation/rootNavigation';

interface StreamChatContextType {
  client: StreamChat | null;
  videoClient: StreamVideoClient | null;
  isReady: boolean;
  isVideoReady: boolean;
  isConnecting: boolean;
  error: string | null;
}

const StreamChatContext = createContext<StreamChatContextType>({
  client: null,
  videoClient: null,
  isReady: false,
  isVideoReady: false,
  isConnecting: false,
  error: null,
});

export const useStreamChat = () => useContext(StreamChatContext);

interface StreamTokenResponse {
  apiKey: string;
  userId: string;
  token: string;
}

function incomingCallName(call: Call) {
  const custom = call.state.custom;
  return typeof custom?.caller_name === 'string'
    ? custom.caller_name
    : call.state.createdBy?.name ?? 'Incoming call';
}

function IncomingCallNavigator() {
  const calls = useCalls();
  const opened = useRef(new Set<string>());

  useEffect(() => {
    const call = calls.find(item => item.ringing && !item.isCreatedByMe);
    if (!call || opened.current.has(call.cid) || !rootNavigationRef.isReady()) return;
    opened.current.add(call.cid);
    const custom = call.state.custom;
    const mode = custom?.mode === 'audio' ? 'audio' : 'video';
    rootNavigationRef.navigate('Call', {
      mode,
      name: incomingCallName(call),
      avatarUrl: typeof custom?.caller_avatar === 'string' ? custom.caller_avatar : null,
      callId: call.id,
      callType: call.type,
      incoming: true,
    });
  }, [calls]);

  return null;
}

export function StreamChatProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<StreamChat | null>(null);
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const userId = user?.id === 'temporary-guest' ? null : user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    let connectedChat: StreamChat | null = null;
    let connectedVideo: StreamVideoClient | null = null;

    setClient(null);
    setVideoClient(null);
    setIsReady(false);
    setIsVideoReady(false);
    setError(null);

    if (!isApiEnabled || !userId || !getApiToken()) return;
    const connectedUserId = userId;

    async function connect() {
      try {
        setIsConnecting(true);
        const initial = await apiClient.post<StreamTokenResponse>('/v1/messages/token', {});
        if (cancelled) return;

        const tokenProvider = () => {
          let currentToken: string | null = initial.token;
          return async () => {
            if (currentToken) {
              const token = currentToken;
              currentToken = null;
              return token;
            }
            const refreshed = await apiClient.post<StreamTokenResponse>('/v1/messages/token', {});
            return refreshed.token;
          };
        };

        connectedChat = StreamChat.getInstance(initial.apiKey);
        await connectedChat.connectUser(
          { id: initial.userId, name: user?.displayName, image: user?.avatarUrl ?? undefined },
          tokenProvider(),
        );
        if (cancelled) return;
        setClient(connectedChat);
        setIsReady(true);

        const apiKey = initial.apiKey;
        connectedVideo = new StreamVideoClient({ apiKey });
        await connectedVideo.connectUser(
          { id: connectedUserId, name: user?.displayName, image: user?.avatarUrl ?? undefined },
          tokenProvider(),
        );
        if (cancelled) return;
        setVideoClient(connectedVideo);
        setIsVideoReady(true);
      } catch (err: any) {
        console.error('Stream connection error:', err);
        if (!cancelled) setError(err.message || 'Failed to connect to messaging and calls');
      } finally {
        if (!cancelled) setIsConnecting(false);
      }
    }

    void connect();
    return () => {
      cancelled = true;
      connectedChat?.disconnectUser().catch(console.error);
      connectedVideo?.disconnectUser().catch(console.error);
    };
  }, [userId, user?.displayName, user?.avatarUrl]);

  const contextValue: StreamChatContextType = {
    client,
    videoClient,
    isReady,
    isVideoReady,
    isConnecting,
    error,
  };

  // OverlayProvider always mounted (supplies ThemeContext / overlay portal for
  // Stream components); Chat only once the Stream client is connected.
  const chatContent =
    isApiEnabled && client && isReady ? (
      <Chat client={client} enableOfflineSupport>{children}</Chat>
    ) : (
      children
    );

  return (
    <StreamChatContext.Provider value={contextValue}>
      <OverlayProvider>
        {videoClient && isVideoReady ? (
          <StreamVideo client={videoClient}>
            <IncomingCallNavigator />
            {chatContent}
          </StreamVideo>
        ) : chatContent}
      </OverlayProvider>
    </StreamChatContext.Provider>
  );
}
