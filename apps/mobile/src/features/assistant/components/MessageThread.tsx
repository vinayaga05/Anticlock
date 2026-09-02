import React, { useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ResultCards } from '@/features/assistant/components/ResultCards';
import type { AssistantMessage, AssistantResultCard } from '@/features/assistant/types';

function Bubble({
  message,
  onPressCard,
}: {
  message: AssistantMessage;
  onPressCard: (card: AssistantResultCard, rank: number) => void;
}) {
  const theme = useTheme();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
            borderColor: theme.colors.borderSoft,
          },
        ]}>
        <Text
          style={{
            color: isUser ? '#fff' : theme.colors.textPrimary,
            fontSize: 15,
            lineHeight: 21,
          }}>
          {message.content || (message.pending ? '...' : '')}
        </Text>
        {message.cards?.length ? (
          <ResultCards cards={message.cards} onPressCard={onPressCard} />
        ) : null}
      </View>
    </View>
  );
}

export function MessageThread({
  messages,
  onPressCard,
}: {
  messages: AssistantMessage[];
  onPressCard: (card: AssistantResultCard, rank: number) => void;
}) {
  const listRef = useRef<FlatList<AssistantMessage>>(null);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      renderItem={({ item }) => <Bubble message={item} onPressCard={onPressCard} />}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  row: {
    width: '100%',
  },
  rowUser: {
    alignItems: 'flex-end',
  },
  rowAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
