import React from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { HealthScreenShell } from '@/shared/components/HealthScreenShell';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { LocationBar } from '@/shared/components/LocationBar';
import { ModeTabs } from '@/shared/components/ModeTabs';
import {
  SchedulePicker,
  useScheduleState,
} from '@/shared/components/SchedulePicker';
import { Button } from '@/shared/components/Button';
import { Glass } from '@/shared/components/Glass';
import { useTheme } from '@/shared/hooks/useTheme';
import { healthTheme } from '@/shared/theme/healthTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { ServiceMode } from '@/shared/types';

const HEALTH_KINDS = new Set(['doctor', 'lab', 'appointment']);

export function ScheduleScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Schedule'>>();
  const { kind, title, fee } = route.params;
  const isHealth = HEALTH_KINDS.has(kind);
  const [mode, setMode] = React.useState<ServiceMode>('center');
  const { selectedDate, selectedTime, setSelectedDate, setSelectedTime } =
    useScheduleState();

  const confirm = () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Select schedule', 'Please choose a date and time slot.');
      return;
    }
    const place =
      mode === 'online'
        ? 'Online session'
        : mode === 'home'
          ? 'Home visit'
          : 'Anticlock Clinic';
    navigation.replace('BookingConfirm', {
      kind,
      title,
      subtitle:
        kind === 'doctor' || kind === 'appointment'
          ? 'Consultation'
          : kind === 'lab'
            ? 'Diagnostics'
            : 'Fitness class',
      when: `${selectedTime} · ${selectedDate}`,
      place,
      fee,
      patientName: 'Guest User',
    });
  };

  const Shell = isHealth ? HealthScreenShell : ScreenContainer;

  return (
    <Shell scrollable tabAware={false}>
      <LocationBar />
      <ModeTabs value={mode} onChange={setMode} />
      {isHealth ? (
        <Glass variant="health" intensity="heavy" radius={healthTheme.radiusMd} elevated style={{ padding: 16 }}>
          <Text style={[theme.typography.section, { color: healthTheme.navy }]}>
            {title}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: healthTheme.textMuted, marginTop: 4 }]}>
            Fee Rs {fee}
          </Text>
        </Glass>
      ) : (
        <Glass intensity="medium" radius={theme.radius.lg} style={{ padding: 16 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 4 }]}>
            Fee Rs {fee}
          </Text>
        </Glass>
      )}
      <SchedulePicker
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        onSelectDate={setSelectedDate}
        onSelectTime={setSelectedTime}
      />
      <Button
        title="Confirm booking"
        variant={isHealth ? 'health' : 'primary'}
        icon="calendar"
        onPress={confirm}
      />
    </Shell>
  );
}

const styles = StyleSheet.create({});
