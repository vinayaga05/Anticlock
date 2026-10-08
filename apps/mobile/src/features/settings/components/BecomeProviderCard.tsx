import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { palette } from '@/shared/theme/colors';

const ART = [
  require('@/shared/assets/categories/health-doctor-consultation.png'),
  require('@/shared/assets/categories/fitness-personal-trainer.png'),
  require('@/shared/assets/categories/beauty-salon-male.png'),
];

/** Personal profile CTA: real service artwork, short title, one action. */
export function BecomeProviderCard({
  actionLabel,
  onPress,
}: {
  actionLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const dark = theme.mode === 'dark';
  return (
    <View
      testID="become-provider-card"
      style={[
        styles.card,
        {
          backgroundColor: dark ? palette.gray[850] : '#EAF7F5',
          borderColor: dark ? theme.colors.border : 'rgba(13, 148, 136, 0.16)',
        },
      ]}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Become a Service Provider
        </Text>
        <PressableScale
          testID="become-provider-action"
          accessibilityLabel={actionLabel}
          onPress={onPress}
          style={[styles.button, { backgroundColor: theme.colors.primaryMuted }]}>
          <Text style={styles.buttonLabel}>{actionLabel}</Text>
          <AppIcon name="arrow-right" size={16} color="#FFFFFF" strokeWidth={2.5} />
        </PressableScale>
      </View>
      <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Image source={ART[0]} style={[styles.bubble, styles.bubbleBack, { borderColor: dark ? palette.gray[850] : '#EAF7F5' }]} />
        <Image source={ART[2]} style={[styles.bubble, styles.bubbleSide, { borderColor: dark ? palette.gray[850] : '#EAF7F5' }]} />
        <Image source={ART[1]} style={[styles.bubble, styles.bubbleFront, { borderColor: dark ? palette.gray[850] : '#EAF7F5' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 1,
    paddingVertical: 18,
    paddingLeft: 18,
    paddingRight: 8,
    minHeight: 150,
    overflow: 'hidden',
  },
  copy: { flex: 1, gap: 14, paddingRight: 4 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, lineHeight: 25 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
  },
  buttonLabel: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  art: { width: 138, height: 124 },
  bubble: { position: 'absolute', borderWidth: 3 },
  bubbleBack: { width: 74, height: 74, borderRadius: 37, top: 0, left: 6 },
  bubbleSide: { width: 66, height: 66, borderRadius: 33, top: 10, right: 0 },
  bubbleFront: { width: 86, height: 86, borderRadius: 43, bottom: -4, left: 30 },
});
