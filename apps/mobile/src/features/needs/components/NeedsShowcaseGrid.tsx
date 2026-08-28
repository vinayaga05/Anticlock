import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  needsShowcaseCards,
  type NeedsShowcaseCard,
  type NeedsShowcaseItem,
} from '@/shared/data/services';
import { PressableScale } from '@/shared/components/PressableScale';
import { Glass } from '@/shared/components/Glass';
import { healthTheme } from '@/shared/theme/healthTheme';

const COLS = 3;
const GAP = 6;
const ICON_SIZE = 64;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

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

  const isHealth = card.treeId === 'health';

  const inner = (
    <>
      <Text
        style={[
          styles.cardTitle,
          { color: isHealth ? healthTheme.navy : theme.colors.textPrimary },
        ]}
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
    </>
  );

  if (isHealth) {
    return (
      <PressableScale
        accessibilityLabel={card.title}
        onPress={() => navigation.navigate('ServiceTree', { treeId: card.treeId })}>
        <Glass variant="health" intensity="heavy" radius={healthTheme.radiusMd} elevated style={styles.healthCard}>
          {inner}
        </Glass>
      </PressableScale>
    );
  }

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
      {inner}
    </PressableScale>
  );
}

/** 3-column Needs showcase: title + two circular subcategory icons. */
export function NeedsShowcaseGrid({
  cards = needsShowcaseCards,
}: {
  cards?: NeedsShowcaseCard[];
}) {
  const rows = useMemo(() => chunk(cards, COLS), [cards]);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map(card => (
            <View key={card.id} style={styles.cell}>
              <NeedsShowcaseCardView card={card} />
            </View>
          ))}
          {row.length < COLS
            ? Array.from({ length: COLS - row.length }).map((_, i) => (
                <View key={`empty-${rowIndex}-${i}`} style={styles.cell} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    width: '100%',
    paddingTop: 8,
    paddingHorizontal: 2,
    paddingBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  healthCard: {
    width: '100%',
    paddingTop: 8,
    paddingHorizontal: 2,
    paddingBottom: 6,
    gap: 6,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  iconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 0,
  },
  subCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
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
