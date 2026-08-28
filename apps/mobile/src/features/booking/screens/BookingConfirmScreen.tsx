import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { HealthScreenShell } from '@/shared/components/HealthScreenShell';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Glass } from '@/shared/components/Glass';
import { SoftIllustration } from '@/shared/components/illustrations/SoftIllustration';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { healthTheme } from '@/shared/theme/healthTheme';
import { RootStackParamList } from '@/shared/navigation/types';

const HEALTH_KINDS = new Set(['doctor', 'lab', 'appointment']);

export function BookingConfirmScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingConfirm'>>();
  const { kind, title, subtitle, when, place, fee, patientName } = route.params;
  const isHealth = HEALTH_KINDS.has(kind);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 160 });
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const Shell = isHealth ? HealthScreenShell : ScreenContainer;
  const accent = isHealth ? healthTheme.sky : theme.colors.primary;
  const titleColor = isHealth ? healthTheme.navy : theme.colors.textPrimary;
  const mutedColor = isHealth ? healthTheme.textMuted : theme.colors.textSecondary;

  return (
    <Shell scrollable tabAware={false}>
      <View style={styles.center}>
        <Animated.View style={animStyle}>
          <SoftIllustration variant="confirm" accent={accent} width={180} height={130} />
        </Animated.View>
        <Text style={[theme.typography.title, { color: titleColor }]}>
          Booking confirmed
        </Text>
        <Text style={[theme.typography.body, { color: mutedColor, textAlign: 'center' }]}>
          Your appointment is scheduled for {when}.
        </Text>
      </View>

      <Glass
        variant={isHealth ? 'health' : undefined}
        intensity="heavy"
        radius={isHealth ? healthTheme.radiusMd : theme.radius.lg}
        elevated={isHealth}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: isHealth ? healthTheme.navy : theme.colors.primary },
          ]}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
            {(patientName ?? 'U').slice(0, 1)}
          </Text>
        </View>
        <View>
          <Text style={[theme.typography.body, { color: titleColor, fontWeight: '600' }]}>
            {patientName ?? 'Guest User'}
          </Text>
          <Text style={[theme.typography.caption, { color: mutedColor }]}>Age 42</Text>
        </View>
      </Glass>

      <Glass
        variant={isHealth ? 'health' : undefined}
        intensity="heavy"
        radius={isHealth ? healthTheme.radiusMd : theme.radius.lg}
        elevated={isHealth}
        style={{ gap: 14, padding: 16 }}>
        <Row label="Provider" value={title} muted={mutedColor} title={titleColor} />
        <Row label="Service" value={subtitle} muted={mutedColor} title={titleColor} />
        <Row label="Place" value={place} muted={mutedColor} title={titleColor} />
        <Row label="When" value={when} muted={mutedColor} title={titleColor} />
        <View
          style={[
            styles.paid,
            {
              backgroundColor: isHealth ? healthTheme.skySoft : theme.colors.primarySoft,
              borderRadius: isHealth ? healthTheme.radiusSm : theme.radius.lg,
            },
          ]}>
          <AppIcon name="credit-card" size={16} color={isHealth ? healthTheme.navy : theme.colors.primary} />
          <Text
            style={[
              theme.typography.bodySmall,
              {
                color: isHealth ? healthTheme.navy : theme.colors.primary,
                fontWeight: '700',
              },
            ]}>
            Amount paid Rs {fee}
          </Text>
        </View>
      </Glass>

      <Button
        title="View booking"
        variant={isHealth ? 'health' : 'primary'}
        icon="clipboard"
        onPress={() => navigation.navigate('MyBookings')}
      />
      <Button
        title="Back to home"
        variant="secondary"
        onPress={() => navigation.navigate('Main', { screen: 'Needs' })}
      />
    </Shell>
  );
}

function Row({
  label,
  value,
  muted,
  title,
}: {
  label: string;
  value: string;
  muted: string;
  title: string;
}) {
  const theme = useTheme();
  return (
    <View>
      <Text style={[theme.typography.caption, { color: muted }]}>{label}</Text>
      <Text
        style={[
          theme.typography.body,
          { color: title, fontWeight: '600', marginTop: 2 },
        ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paid: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
});
