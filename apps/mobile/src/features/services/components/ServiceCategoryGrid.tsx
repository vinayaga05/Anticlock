import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  getCategoryImage,
  ServiceCategory,
  ServiceTreeId,
} from '@/shared/data/services';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { IconBadge } from '@/shared/components/IconBadge';
import { PressableScale } from '@/shared/components/PressableScale';
import { Glass } from '@/shared/components/Glass';
import { softFill, treeColors, TreeColorId } from '@/shared/theme/colors';
import { healthTheme } from '@/shared/theme/healthTheme';

function CategoryVisual({
  category,
  accent,
  size,
}: {
  category: ServiceCategory;
  accent: string;
  size: number;
}) {
  const image = getCategoryImage(category.id);

  if (image) {
    return (
      <View
        style={[
          styles.imageRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: softFill(accent, 0.14),
          },
        ]}>
        <Image source={image} style={styles.image} resizeMode="cover" />
      </View>
    );
  }

  return (
    <IconBadge
      name={category.icon as IconName}
      color={accent}
      size={size >= 56 ? 'lg' : 'md'}
    />
  );
}

export function ServiceCategoryCard({
  category,
  treeId,
  compact,
}: {
  category: ServiceCategory;
  treeId: string;
  compact?: boolean;
}) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const treeKey = (treeId in treeColors ? treeId : 'health') as TreeColorId;
  const accent = treeColors[treeKey].accent;
  const isHealth = treeId === 'health';

  if (compact) {
    const cardBody = (
      <>
        <CategoryVisual category={category} accent={accent} size={64} />
        <Text
          style={[
            styles.compactTitle,
            { color: isHealth ? healthTheme.text : theme.colors.textPrimary },
          ]}
          numberOfLines={2}>
          {category.name}
        </Text>
      </>
    );

    if (isHealth) {
      return (
        <PressableScale
          accessibilityLabel={category.name}
          onPress={() =>
            navigation.navigate('ServiceCategory', {
              treeId,
              categoryId: category.id,
            })
          }>
          <Glass variant="health" intensity="medium" radius={healthTheme.radiusMd} elevated style={styles.compactHealth}>
            {cardBody}
          </Glass>
        </PressableScale>
      );
    }

    return (
      <PressableScale
        accessibilityLabel={category.name}
        onPress={() =>
          navigation.navigate('ServiceCategory', {
            treeId,
            categoryId: category.id,
          })
        }
        style={[
          styles.compact,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderSoft,
            borderRadius: theme.radius.lg,
            ...(theme.shadows.soft as object),
          },
        ]}>
        {cardBody}
      </PressableScale>
    );
  }

  return (
    <PressableScale
      accessibilityLabel={category.name}
      onPress={() =>
        navigation.navigate('ServiceCategory', {
          treeId,
          categoryId: category.id,
        })
      }
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderSoft,
          borderRadius: theme.radius.lg,
          ...(theme.shadows.soft as object),
        },
      ]}>
      <CategoryVisual category={category} accent={accent} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.textPrimary, fontWeight: '700' },
          ]}
          numberOfLines={2}>
          {category.name}
        </Text>
        <Text
          style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
          numberOfLines={2}>
          {category.description}
        </Text>
      </View>
      <AppIcon name="chevron-right" size={16} color={softFill(accent, 0.9)} />
    </PressableScale>
  );
}

export function ServiceCategoryGrid({
  categories,
  treeId,
  compact = true,
}: {
  categories: ServiceCategory[];
  treeId: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.grid, treeId === 'health' && styles.gridHealth]}>
      {categories.map(cat => (
        <View
          key={cat.id}
          style={{ width: compact ? (treeId === 'health' ? '48%' : '31%') : '100%' }}>
          <ServiceCategoryCard
            category={cat}
            treeId={treeId as ServiceTreeId}
            compact={compact}
          />
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
  card: {
    width: '100%',
    minHeight: 76,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compact: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 8,
  },
  compactTitle: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  compactHealth: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 8,
  },
  gridHealth: {
    gap: 12,
  },
  imageRing: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
