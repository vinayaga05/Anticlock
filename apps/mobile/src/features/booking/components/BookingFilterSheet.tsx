import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';
import {
  BookingAdvancedFilters,
  BookingCategory,
  DEFAULT_ADVANCED_FILTERS,
} from '@/shared/data/bookings';

type Props = {
  visible: boolean;
  filters: BookingAdvancedFilters;
  onChange: (filters: BookingAdvancedFilters) => void;
  onClose: () => void;
};

const STATUS_OPTIONS: {
  id: BookingAdvancedFilters['status'];
  label: string;
}[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const TYPE_OPTIONS: { id: BookingCategory; label: string }[] = [
  { id: 'appointment', label: 'Health' },
  { id: 'class', label: 'Fitness' },
  { id: 'home_service', label: 'Home Service' },
  { id: 'event', label: 'Events' },
];

const DATE_OPTIONS: {
  id: NonNullable<BookingAdvancedFilters['date']>;
  label: string;
}[] = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
];

function RadioRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} style={styles.row}>
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? theme.colors.primary : theme.colors.border,
            backgroundColor: selected ? theme.colors.primary : 'transparent',
          },
        ]}
      />
      <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>{label}</Text>
    </PressableScale>
  );
}

function CheckRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} style={styles.row}>
      <View
        style={[
          styles.check,
          {
            borderColor: checked ? theme.colors.primary : theme.colors.border,
            backgroundColor: checked ? theme.colors.primary : 'transparent',
          },
        ]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>{label}</Text>
    </PressableScale>
  );
}

export function BookingFilterSheet({ visible, filters, onChange, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const toggleType = (type: BookingCategory) => {
    const types = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onChange({ ...filters, types });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
          onPress={e => e.stopPropagation()}>
          <View style={[styles.handle, { backgroundColor: theme.colors.borderSoft }]} />
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Filters</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Text style={[styles.section, { color: theme.colors.textSecondary }]}>Status</Text>
            <RadioRow
              label="Any status"
              selected={filters.status == null}
              onPress={() => onChange({ ...filters, status: null })}
            />
            {STATUS_OPTIONS.map(opt => (
              <RadioRow
                key={opt.id ?? 'none'}
                label={opt.label}
                selected={filters.status === opt.id}
                onPress={() => onChange({ ...filters, status: opt.id })}
              />
            ))}

            <Text style={[styles.section, { color: theme.colors.textSecondary }]}>Type</Text>
            {TYPE_OPTIONS.map(opt => (
              <CheckRow
                key={opt.id}
                label={opt.label}
                checked={filters.types.includes(opt.id)}
                onPress={() => toggleType(opt.id)}
              />
            ))}

            <Text style={[styles.section, { color: theme.colors.textSecondary }]}>Date</Text>
            <RadioRow
              label="Any date"
              selected={filters.date == null}
              onPress={() => onChange({ ...filters, date: null })}
            />
            {DATE_OPTIONS.map(opt => (
              <RadioRow
                key={opt.id}
                label={opt.label}
                selected={filters.date === opt.id}
                onPress={() => onChange({ ...filters, date: opt.id })}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <PressableScale
              onPress={() => onChange(DEFAULT_ADVANCED_FILTERS)}
              style={[styles.footerBtn, { borderColor: theme.colors.borderSoft }]}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '700' }}>Reset</Text>
            </PressableScale>
            <PressableScale
              onPress={onClose}
              style={[styles.footerBtn, { backgroundColor: theme.colors.primary }]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Apply</Text>
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  content: { gap: 4, paddingBottom: 12 },
  section: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
