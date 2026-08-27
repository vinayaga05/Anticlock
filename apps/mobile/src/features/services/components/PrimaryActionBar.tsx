import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/shared/components/Button';
import { IconName } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { CtaConfig } from '@/shared/data/services';

export function PrimaryActionBar({
  cta,
  onPress,
  secondaryLabel,
  onSecondary,
}: {
  cta: CtaConfig;
  onPress: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: theme.colors.backgroundElevated,
          borderTopColor: theme.colors.border,
        },
      ]}>
      {secondaryLabel && onSecondary ? (
        <Button
          title={secondaryLabel}
          variant="secondary"
          onPress={onSecondary}
          style={{ flex: 1 }}
        />
      ) : null}
      <Button
        title={cta.label}
        icon={cta.icon as IconName}
        onPress={onPress}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
