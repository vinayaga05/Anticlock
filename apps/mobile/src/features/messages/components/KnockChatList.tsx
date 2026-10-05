import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChannelList } from 'stream-chat-react-native';
import { useStreamChat } from '@/shared/providers/StreamChatProvider';
import { useAuthStore } from '@/shared/services/auth/authStore';
import { useTheme } from '@/shared/hooks/useTheme';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { conversations } from '@/shared/data/mocks';

export function KnockChatList() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { client, isReady, isConnecting, error } = useStreamChat();
  const session = useAuthStore(state => state.session);

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
        <View style={styles.centerContainer}>
          <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
            Chat unavailable (using mock data)
          </Text>
        </View>
      );
    }

    // Mock fallback
    if (conversations.length === 0) {
      return (
        <EmptyState
          icon="messages"
          title="No messages"
          description="Your conversations will appear here."
        />
      );
    }

    return (
      <View style={styles.wrap}>
        {conversations.map(item => (
          <Card
            key={item.id}
            onPress={() => navigation.navigate('Thread', { conversationId: item.id })}
            style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
              <Text style={styles.avatarText}>{item.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.body}>
              <View style={styles.top}>
                <Text style={[styles.name, { color: theme.colors.textPrimary }]}>
                  {item.name}
                </Text>
                <Text style={[styles.time, { color: theme.colors.textTertiary }]}>
                  {item.time}
                </Text>
              </View>
              <Text
                style={[styles.preview, { color: theme.colors.textSecondary }]}
                numberOfLines={1}>
                {item.preview}
              </Text>
            </View>
            {item.unread > 0 ? (
              <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.badgeText}>{item.unread}</Text>
              </View>
            ) : null}
          </Card>
        ))}
      </View>
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
          navigation.navigate('Thread', { 
            channelId: channel.id,
            channelType: channel.type 
          });
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
