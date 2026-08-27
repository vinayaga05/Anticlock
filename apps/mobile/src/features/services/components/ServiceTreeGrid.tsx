import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { getTreeImage, ServiceTree } from '@/shared/data/services';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { IconBadge } from '@/shared/components/IconBadge';
import { PressableScale } from '@/shared/components/PressableScale';
import { softFill } from '@/shared/theme/colors';

export function ServiceTreeCard({
  tree,
  featured,
}: {
  tree: ServiceTree;
  featured?: boolean;
}) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const cover = getTreeImage(tree.id);
  const badgeSize = featured ? 'lg' : 'md';
  const imageSize = featured ? 56 : 44;

  return (
    <PressableScale
      accessibilityLabel={tree.name}
      onPress={() => navigation.navigate('ServiceTree', { treeId: tree.id })}
      style={[
        featured ? styles.featured : styles.standard,
        {
          backgroundColor: softFill(tree.accent, 0.12),
          borderColor: softFill(tree.accent, 0.22),
          borderRadius: theme.radius.xl,
          minHeight: featured ? 148 : 128,
        },
      ]}>
      {cover ? (
        <View
          style={[
            styles.imageRing,
            {
              width: imageSize,
              height: imageSize,
              borderRadius: imageSize / 2,
              backgroundColor: softFill(tree.accent, 0.18),
            },
          ]}>
          <Image source={cover} style={styles.image} resizeMode="cover" />
        </View>
      ) : (
        <IconBadge
          name={tree.icon as IconName}
          color={tree.accent}
          size={badgeSize}
        />
      )}
      <View style={{ flex: 1, gap: 4, marginTop: 8 }}>
        <Text
          style={[
            featured ? theme.typography.title : theme.typography.body,
            { color: theme.colors.textPrimary, fontWeight: '700' },
          ]}
          numberOfLines={1}>
          {tree.name}
        </Text>
        <Text
          style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
          numberOfLines={featured ? 2 : 1}>
          {tree.description}
        </Text>
      </View>
      <View style={styles.footer}>
        <Text style={[theme.typography.caption, { color: tree.accent, fontWeight: '700' }]}>
          {tree.serviceCount} services
        </Text>
        <AppIcon name="chevron-right" size={16} color={tree.accent} />
      </View>
    </PressableScale>
  );
}

/** Bento-style rhythm: featured pairs + standard tiles. */
export function ServiceTreeGrid({ trees }: { trees: ServiceTree[] }) {
  const rows: Array<{ left: ServiceTree; right?: ServiceTree; featuredLeft?: boolean }> = [];

  // Pattern: featured+standard, standard+featured, then 3 standards, etc.
  let i = 0;
  let flip = false;
  while (i < trees.length) {
    if (i + 1 < trees.length && i < 4) {
      rows.push({
        left: trees[i],
        right: trees[i + 1],
        featuredLeft: !flip,
      });
      flip = !flip;
      i += 2;
    } else if (i + 1 < trees.length) {
      rows.push({ left: trees[i], right: trees[i + 1] });
      i += 2;
    } else {
      rows.push({ left: trees[i], featuredLeft: true });
      i += 1;
    }
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, idx) => (
        <View key={`row-${idx}`} style={styles.row}>
          <View style={{ flex: row.featuredLeft || !row.right ? 1.35 : 1 }}>
            <ServiceTreeCard tree={row.left} featured={row.featuredLeft || !row.right} />
          </View>
          {row.right ? (
            <View style={{ flex: row.featuredLeft ? 1 : 1.35 }}>
              <ServiceTreeCard tree={row.right} featured={!row.featuredLeft} />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  featured: {
    flex: 1,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  standard: {
    flex: 1,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
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
