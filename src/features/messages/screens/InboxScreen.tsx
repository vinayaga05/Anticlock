import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { useTheme } from '@/shared/hooks/useTheme';
import { conversations } from '@/shared/data/mocks';

export function InboxScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Knock</Text>
      <Text style={{ color: theme.colors.textSecondary, marginBottom: 8 }}>
        Messages from doctors, coaches, and support.
      </Text>
      {conversations.map(item => (
        <Pressable
          key={item.id}
          onPress={() => navigation.navigate('Thread', { conversationId: item.id })}
          style={[styles.row, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {item.name.slice(0, 1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.top}>
              <Text style={[styles.name, { color: theme.colors.navy }]}>{item.name}</Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>{item.time}</Text>
            </View>
            <Text style={{ color: theme.colors.textSecondary }} numberOfLines={1}>
              {item.preview}
            </Text>
          </View>
          {item.unread > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{item.unread}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: { fontWeight: '700' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
