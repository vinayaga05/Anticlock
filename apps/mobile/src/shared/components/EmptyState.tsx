import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { IconName } from '@/shared/components/AppIcon';
import { Button } from '@/shared/components/Button';
import { SoftIllustration } from '@/shared/components/illustrations/SoftIllustration';
import { IconBadge } from '@/shared/components/IconBadge';

type Props = {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: 'empty' | 'search' | 'confirm';
};

export function EmptyState({
  icon = 'search',
  title,
  description,
  actionLabel,
  onAction,
  illustration = 'empty',
}: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, { paddingVertical: theme.spacing['4xl'] }]}>
      <SoftIllustration
        variant={illustration}
        accent={theme.colors.primary}
        width={140}
        height={100}
      />
      <IconBadge name={icon} color={theme.colors.primary} size="md" />
      <Text
        style={[
          theme.typography.section,
          { color: theme.colors.textPrimary, textAlign: 'center' },
        ]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            theme.typography.bodySmall,
            {
              color: theme.colors.textSecondary,
              textAlign: 'center',
              maxWidth: 280,
            },
          ]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          style={{ marginTop: theme.spacing.md, minWidth: 160 }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
  },
});
