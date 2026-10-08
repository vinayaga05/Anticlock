import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { timeSlots } from '@/shared/data/mocks';
import { PressableScale } from '@/shared/components/PressableScale';
import { AppIcon } from '@/shared/components/AppIcon';
import { toLocalDateId } from '@/shared/utils/bookingDates';

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
      return {
        id: toLocalDateId(d),
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d.getDate().toString(),
      };
    });
  }, []);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.xl,
        },
      ]}>
      <View style={styles.headingRow}>
        <AppIcon name="calendar" size={18} color={theme.colors.primary} />
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Schedule appointment
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {dates.map(d => {
          const active = selectedDate === d.id;
          return (
            <PressableScale
              key={d.id}
              onPress={() => onSelectDate(d.id)}
              accessibilityLabel={`${d.day} ${d.date}`}
              style={[
                styles.date,
                {
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  backgroundColor: active ? theme.colors.primarySoft : theme.colors.backgroundElevated,
                  borderRadius: theme.radius.lg,
                },
              ]}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {d.day}
              </Text>
              <Text
                style={[
                  theme.typography.title,
                  { color: active ? theme.colors.primary : theme.colors.textPrimary, fontSize: 20 },
                ]}>
                {d.date}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      <View style={styles.headingRow}>
        <AppIcon name="clock" size={18} color={theme.colors.primary} />
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Select timing
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {timeSlots.map(slot => {
          const active = selectedTime === slot;
          return (
            <PressableScale
              key={slot}
              onPress={() => onSelectTime(slot)}
              accessibilityLabel={slot}
              style={[
                styles.time,
                {
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  backgroundColor: active ? theme.colors.primary : theme.colors.backgroundElevated,
                  borderRadius: theme.radius.pill,
                },
              ]}>
              <Text
                style={[
                  theme.typography.bodySmall,
                  {
                    color: active
                      ? theme.mode === 'dark'
                        ? '#042F2E'
                        : '#FFFFFF'
                      : theme.colors.textSecondary,
                    fontWeight: '600',
                  },
                ]}>
                {slot}
              </Text>
            </PressableScale>
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
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  row: {
    gap: 10,
  },
  date: {
    width: 64,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  time: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
