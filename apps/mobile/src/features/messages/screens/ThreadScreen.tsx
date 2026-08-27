import React, { useMemo, useState } from 'react';
import {
  FlatList,
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
import { IconButton } from '@/shared/components/IconButton';

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
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}>
      <Text
        style={[
          theme.typography.section,
          { color: theme.colors.textPrimary, paddingHorizontal: 16, paddingTop: 8 },
        ]}>
        {title}
      </Text>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              {
                alignSelf: item.fromMe ? 'flex-end' : 'flex-start',
                backgroundColor: item.fromMe
                  ? theme.colors.primary
                  : theme.colors.surface,
                borderRadius: theme.radius.lg,
              },
            ]}>
            <Text
              style={[
                theme.typography.body,
                { color: item.fromMe ? '#042F2E' : theme.colors.textPrimary },
              ]}>
              {item.text}
            </Text>
            <Text
              style={[
                theme.typography.caption,
                {
                  color: item.fromMe ? 'rgba(4,47,46,0.7)' : theme.colors.textTertiary,
                  marginTop: 4,
                },
              ]}>
              {item.time}
            </Text>
          </View>
        )}
      />
      <View
        style={[
          styles.composer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.xl,
          },
        ]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={theme.colors.textTertiary}
          style={[theme.typography.body, { flex: 1, color: theme.colors.textPrimary, paddingVertical: 8 }]}
        />
        <IconButton
          name="send"
          accessibilityLabel="Send message"
          onPress={send}
          color={theme.colors.primary}
          glass={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bubble: {
    maxWidth: '80%',
    padding: 14,
  },
  composer: {
    flexDirection: 'row',
    gap: 4,
    margin: 12,
    paddingLeft: 14,
    paddingRight: 4,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
