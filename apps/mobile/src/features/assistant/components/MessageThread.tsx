import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  FlatList,
  GestureDetector,
  type GestureType,
} from 'react-native-gesture-handler';
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
  const isDark = theme.mode === 'dark';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? {
                backgroundColor: theme.colors.primary,
                borderColor: 'transparent',
              }
            : {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(255,255,255,0.55)',
                borderColor: isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(255,255,255,0.7)',
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
  nativeGesture,
  onScrollOffsetChange,
}: {
  messages: AssistantMessage[];
  onPressCard: (card: AssistantResultCard, rank: number) => void;
  nativeGesture?: GestureType;
  onScrollOffsetChange?: (offsetY: number) => void;
}) {
  const theme = useTheme();
  const listRef = useRef<FlatList<AssistantMessage>>(null);

  const list = (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={item => item.id}
      style={styles.thread}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      bounces
      onScroll={e => {
        onScrollOffsetChange?.(e.nativeEvent.contentOffset.y);
      }}
      scrollEventThrottle={16}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      renderItem={({ item }) => <Bubble message={item} onPressCard={onPressCard} />}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
          Ask Genie anything about Knock.
        </Text>
      }
    />
  );

  if (!nativeGesture) return list;

  return <GestureDetector gesture={nativeGesture}>{list}</GestureDetector>;
}

const styles = StyleSheet.create({
  thread: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    flexGrow: 1,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 28,
    fontSize: 14,
    opacity: 0.72,
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
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
