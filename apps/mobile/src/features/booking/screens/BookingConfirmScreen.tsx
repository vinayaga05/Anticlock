import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { SoftIllustration } from '@/shared/components/illustrations/SoftIllustration';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';

export function BookingConfirmScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingConfirm'>>();
  const { title, subtitle, when, place, fee, patientName } = route.params;
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 160 });
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ScreenContainer scrollable tabAware={false}>
      <View style={styles.center}>
        <Animated.View style={animStyle}>
          <SoftIllustration
            variant="confirm"
            accent={theme.colors.primary}
            width={180}
            height={130}
          />
        </Animated.View>
        <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
          Booking confirmed
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, textAlign: 'center' },
          ]}>
          Your appointment is scheduled for {when}.
        </Text>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={{ color: theme.colors.textInverse, fontWeight: '700' }}>
            {(patientName ?? 'U').slice(0, 1)}
          </Text>
        </View>
        <View>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.textPrimary, fontWeight: '600' },
            ]}>
            {patientName ?? 'Guest User'}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Age 42
          </Text>
        </View>
      </Card>

      <Card style={{ gap: 14 }}>
        <Row label="Provider" value={title} />
        <Row label="Service" value={subtitle} />
        <Row label="Place" value={place} />
        <Row label="When" value={when} />
        <View
          style={[
            styles.paid,
            {
              backgroundColor: theme.colors.primarySoft,
              borderRadius: theme.radius.lg,
            },
          ]}>
          <AppIcon name="credit-card" size={16} color={theme.colors.primary} />
          <Text
            style={[
              theme.typography.bodySmall,
              { color: theme.colors.primary, fontWeight: '700' },
            ]}>
            Amount paid Rs {fee}
          </Text>
        </View>
      </Card>

      <Button
        title="View booking"
        icon="clipboard"
        onPress={() => navigation.navigate('MyBookings')}
      />
      <Button
        title="Back to home"
        variant="secondary"
        onPress={() => navigation.navigate('Main', { screen: 'Needs' })}
      />
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View>
      <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
        {label}
      </Text>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.textPrimary, fontWeight: '600', marginTop: 2 },
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
