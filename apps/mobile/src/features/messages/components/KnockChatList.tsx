import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { conversations } from '@/shared/data/mocks';

export function KnockChatList() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

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

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
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
