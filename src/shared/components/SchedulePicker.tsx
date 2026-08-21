import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { timeSlots } from '@/shared/data/mocks';

type Props = {
  selectedDate: string | null;
  selectedTime: string | null;
  onSelectDate: (d: string) => void;
  onSelectTime: (t: string) => void;
};

export function SchedulePicker({
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: Props) {
  const theme = useTheme();
  const dates = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const label = d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
      });
      return { id: d.toISOString().slice(0, 10), label };
    });
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: '#111' }]}>
      <Text style={[styles.heading, { color: theme.colors.textInverse, backgroundColor: '#111' }]}>
        Schedule Of Appointment
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {dates.map(d => {
          const active = selectedDate === d.id;
          return (
            <Pressable
              key={d.id}
              onPress={() => onSelectDate(d.id)}
              style={[
                styles.date,
                {
                  borderColor: theme.colors.navy,
                  backgroundColor: active ? theme.colors.primary : '#fff',
                },
              ]}>
              <Text style={{ color: active ? '#fff' : theme.colors.navy, fontWeight: '700', fontSize: 12 }}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={[styles.sub, { color: theme.colors.navy }]}>Select Timing</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {timeSlots.map(slot => {
          const active = selectedTime === slot;
          return (
            <Pressable
              key={slot}
              onPress={() => onSelectTime(slot)}
              style={[
                styles.time,
                {
                  borderColor: theme.colors.navy,
                  backgroundColor: active ? theme.colors.primary : '#fff',
                },
              ]}>
              <Text style={{ color: active ? '#fff' : theme.colors.navy, fontWeight: '600', fontSize: 12 }}>
                {slot}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function useScheduleState() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  return { selectedDate, selectedTime, setSelectedDate, setSelectedTime };
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
    paddingBottom: 12,
    gap: 10,
  },
  heading: {
    paddingVertical: 10,
    textAlign: 'center',
    fontWeight: '700',
  },
  row: {
    gap: 8,
    paddingHorizontal: 12,
  },
  date: {
    minWidth: 64,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
  },
  time: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  sub: {
    paddingHorizontal: 12,
    fontWeight: '700',
  },
});
