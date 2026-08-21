import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { LocationBar } from '@/shared/components/LocationBar';
import { ModeTabs } from '@/shared/components/ModeTabs';
import {
  SchedulePicker,
  useScheduleState,
} from '@/shared/components/SchedulePicker';
import { Button } from '@/shared/components/Button';
import { RootStackParamList } from '@/shared/navigation/types';
import { ServiceMode } from '@/shared/types';

export function ScheduleScreen() {
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
        kind === 'doctor'
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
    <ScreenContainer scrollable>
      <AppHeader />
      <LocationBar />
      <ModeTabs value={mode} onChange={setMode} />
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summarySub}>Fee Rs {fee}</Text>
      </View>
      <SchedulePicker
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        onSelectDate={setSelectedDate}
        onSelectTime={setSelectedTime}
      />
      <Button title="Book Now" onPress={confirm} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  summaryTitle: { color: '#123', fontWeight: '700', fontSize: 16 },
  summarySub: { color: '#555', marginTop: 4 },
});
