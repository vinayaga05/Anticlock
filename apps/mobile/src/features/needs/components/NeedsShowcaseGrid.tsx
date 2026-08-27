import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  needsShowcaseCards,
  type NeedsShowcaseCard,
  type NeedsShowcaseItem,
} from '@/shared/data/services';
import { PressableScale } from '@/shared/components/PressableScale';

function SubIcon({
  item,
  onPress,
}: {
  item: NeedsShowcaseItem;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={item.label}
      style={styles.subCol}>
      <View style={styles.iconCircle}>
        <Image source={item.image} style={styles.iconImage} resizeMode="cover" />
      </View>
      <Text
        style={[styles.subLabel, { color: theme.colors.textSecondary }]}
        numberOfLines={2}>
        {item.label}
      </Text>
    </PressableScale>
  );
}

function NeedsShowcaseCardView({ card }: { card: NeedsShowcaseCard }) {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <PressableScale
      accessibilityLabel={card.title}
      onPress={() => navigation.navigate('ServiceTree', { treeId: card.treeId })}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderSoft,
          borderRadius: theme.radius.lg,
          ...(theme.shadows.soft as object),
        },
      ]}>
      <Text
        style={[styles.cardTitle, { color: theme.colors.textPrimary }]}
        numberOfLines={2}>
        {card.title}
      </Text>
      <View style={styles.iconsRow}>
        {card.items.map(item => (
          <SubIcon
            key={item.categoryId}
            item={item}
            onPress={() =>
              navigation.navigate('ServiceCategory', {
                treeId: item.treeId,
                categoryId: item.categoryId,
              })
            }
          />
        ))}
      </View>
    </PressableScale>
  );
}

/** 3-column Needs showcase: title + two circular subcategory icons. */
export function NeedsShowcaseGrid({
  cards = needsShowcaseCards,
}: {
  cards?: NeedsShowcaseCard[];
}) {
  return (
    <View style={styles.grid}>
      {cards.map(card => (
        <View key={card.id} style={styles.cell}>
          <NeedsShowcaseCardView card={card} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '31%',
  },
  card: {
    width: '100%',
    paddingTop: 10,
    paddingHorizontal: 6,
    paddingBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  iconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 2,
  },
  subCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F3F2EE',
  },
  iconImage: {
    width: '100%',
    height: '100%',
  },
  subLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 11,
  },
});
