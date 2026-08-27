import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { conversations } from '@/shared/data/mocks';

export function InboxScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Knock" />
      <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
        Messages from doctors, coaches, and support
      </Text>

      {conversations.length === 0 ? (
        <EmptyState
          icon="messages"
          title="No messages"
          description="Your conversations will appear here."
        />
      ) : (
        conversations.map(item => (
          <Card
            key={item.id}
            onPress={() => navigation.navigate('Thread', { conversationId: item.id })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {item.name.slice(0, 1)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.top}>
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                  {item.name}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                  {item.time}
                </Text>
              </View>
              <Text
                style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}
                numberOfLines={1}>
                {item.preview}
              </Text>
            </View>
            {item.unread > 0 ? (
              <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                <Text style={{ color: '#042F2E', fontSize: 11, fontWeight: '700' }}>
                  {item.unread}
                </Text>
              </View>
            ) : null}
          </Card>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
