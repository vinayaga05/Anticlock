import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';
import type { AssistantResultCard } from '@/features/assistant/types';

export function ResultCards({
  cards,
  onPressCard,
}: {
  cards: AssistantResultCard[];
  onPressCard: (card: AssistantResultCard, rank: number) => void;
}) {
  const theme = useTheme();
  if (!cards.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
      {cards.map((card, index) => (
        <PressableScale
          key={`${card.type}-${card.id}`}
          onPress={() => onPressCard(card, index + 1)}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderSoft,
            },
          ]}>
          {card.imageUrl ? (
            <Image source={{ uri: card.imageUrl }} style={styles.image} />
          ) : (
            <View
              style={[
                styles.image,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}
            />
          )}
          <Text
            numberOfLines={2}
            style={[styles.title, { color: theme.colors.textPrimary }]}>
            {card.title}
          </Text>
          {card.subtitle ? (
            <Text
              numberOfLines={1}
              style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {card.subtitle}
            </Text>
          ) : null}
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 8,
    marginBottom: 4,
  },
  card: {
    width: 148,
    marginRight: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  image: {
    width: '100%',
    height: 88,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  subtitle: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingTop: 2,
  },
});
