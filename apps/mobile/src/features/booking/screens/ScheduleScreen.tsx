import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { LocationBar } from '@/shared/components/LocationBar';
import { ModeTabs } from '@/shared/components/ModeTabs';
import {
  SchedulePicker,
  useScheduleState,
} from '@/shared/components/SchedulePicker';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { ServiceMode } from '@/shared/types';

export function ScheduleScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Schedule'>>();
  const { kind, title, fee } = route.params;
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
      patientName: 'Sathish Kumar',
    });
  };

  return (
    <ScreenContainer scrollable tabAware={false}>
      <LocationBar />
      <ModeTabs value={mode} onChange={setMode} />
      <Card>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 4 }]}>
          Fee Rs {fee}
        </Text>
      </Card>
      <SchedulePicker
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        onSelectDate={setSelectedDate}
        onSelectTime={setSelectedTime}
      />
      <Button title="Confirm booking" icon="calendar" onPress={confirm} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({});
