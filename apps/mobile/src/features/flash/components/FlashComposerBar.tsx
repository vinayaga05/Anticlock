import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';
import { CURRENT_USER } from '@/shared/data/flash';

export function FlashComposerBar() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <PressableScale
      onPress={() => navigation.navigate('FlashComposer')}
      accessibilityLabel="Create a Flash post"
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}>
      <Image source={{ uri: CURRENT_USER.avatarUrl }} style={styles.avatar} />
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={[theme.typography.body, { color: theme.colors.textTertiary }]}>
          What’s happening?
        </Text>
        <View style={styles.tools}>
          {(['Photo', 'Video', 'Camera', 'More'] as const).map(label => (
            <View
              key={label}
              style={[
                styles.chip,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderRadius: theme.radius.pill,
                },
              ]}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
