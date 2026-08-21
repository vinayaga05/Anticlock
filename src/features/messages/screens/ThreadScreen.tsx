import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { conversations, messages as seedMessages } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';
import { Message } from '@/shared/types';

export function ThreadScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'Thread'>>();
  const conversation = conversations.find(c => c.id === route.params.conversationId);
  const [items, setItems] = useState<Message[]>(
    seedMessages.filter(m => m.conversationId === route.params.conversationId),
  );
  const [draft, setDraft] = useState('');

  const title = useMemo(() => conversation?.name ?? 'Chat', [conversation]);

  const send = () => {
    if (!draft.trim()) return;
    setItems(prev => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        conversationId: route.params.conversationId,
        text: draft.trim(),
        fromMe: true,
        time: 'Now',
      },
    ]);
    setDraft('');
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              {
                alignSelf: item.fromMe ? 'flex-end' : 'flex-start',
                backgroundColor: item.fromMe ? theme.colors.primary : theme.colors.surface,
              },
            ]}>
            <Text style={{ color: item.fromMe ? '#fff' : theme.colors.navy }}>{item.text}</Text>
            <Text
              style={{
                color: item.fromMe ? '#dff' : theme.colors.textSecondary,
                fontSize: 10,
                marginTop: 4,
              }}>
              {item.time}
            </Text>
          </View>
        )}
      />
      <View style={[styles.composer, { backgroundColor: theme.colors.surface }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={theme.colors.textSecondary}
          style={[styles.input, { color: theme.colors.navy }]}
        />
        <Pressable onPress={send} style={[styles.send, { backgroundColor: theme.colors.primary }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    padding: 12,
  },
  composer: {
    flexDirection: 'row',
    gap: 8,
    margin: 12,
    borderRadius: 14,
    padding: 8,
    alignItems: 'center',
  },
  input: { flex: 1, paddingHorizontal: 8, paddingVertical: 8 },
  send: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
