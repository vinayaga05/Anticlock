import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChannelList } from 'stream-chat-react-native';
import { useStreamChat } from '@/shared/providers/StreamChatProvider';
import { useAuth } from '@/shared/context/AuthProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import { EmptyState } from '@/shared/components/EmptyState';

export function KnockChatList() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { client, isReady, isConnecting, error } = useStreamChat();
  const { user } = useAuth();
  const session = user ? { userId: user.id } : null;

  // Mock fallback when API is disabled
  if (!client || !isReady) {
    if (isConnecting) {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
            Connecting to chat...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <EmptyState
          icon="messages"
          title="Chat unavailable"
          description="We could not connect to your conversations. Please try again."
        />
      );
    }

    return (
      <EmptyState
        icon="messages"
        title="Chat unavailable"
        description="Sign in and reconnect to load your conversations."
      />
    );
  }

  // Stream Chat live data
  const filters = {
    type: 'messaging',
    members: { $in: [session?.userId || ''] },
  };

  const sort = { last_message_at: -1 as const };

  return (
    <View style={styles.wrap}>
      <ChannelList
        filters={filters}
        sort={sort}
        onSelect={(channel) => {
          navigation.navigate('Thread', { conversationId: channel.id });
        }}
        EmptyStateIndicator={() => (
          <EmptyState
            icon="messages"
            title="No messages"
            description="Your conversations will appear here."
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  time: {
    fontSize: 12,
  },
  preview: {
    fontSize: 14,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#042F2E',
    fontSize: 11,
    fontWeight: '700',
  },
});
