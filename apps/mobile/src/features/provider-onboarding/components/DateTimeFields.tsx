import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { Button } from '@/shared/components/Button';
import { PressableScale } from '@/shared/components/PressableScale';
import { formatTimeLabel } from '@/features/provider-onboarding/utils/formValues';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateLabel(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]?.slice(0, 3)} ${m[1]}`;
}

export { formatTimeLabel };

function PickerTrigger({
  icon,
  label,
  placeholder,
  onPress,
  hasError,
}: {
  icon: 'calendar' | 'clock';
  label: string | null;
  placeholder: string;
  onPress: () => void;
  hasError?: boolean;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.trigger,
        {
          borderColor: hasError ? theme.colors.error : theme.colors.borderSoft,
        },
      ]}
    >
      <AppIcon name={icon} size={18} color={theme.colors.textSecondary} />
      <Text
        style={[
          styles.triggerText,
          {
            color: label ? theme.colors.textPrimary : theme.colors.textTertiary,
          },
        ]}
      >
        {label ?? placeholder}
      </Text>
    </PressableScale>
  );
}

function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sheetHeader}>
            <Text
              style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}
            >
              {title}
            </Text>
            <PressableScale onPress={onClose} accessibilityLabel="Close">
              <AppIcon
                name="close"
                size={22}
                color={theme.colors.textSecondary}
              />
            </PressableScale>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** JS-only calendar date picker; value is YYYY-MM-DD. */
export function DateField({
  value,
  onChange,
  label,
  hasError,
}: {
  value: unknown;
  onChange: (value: string | null) => void;
  label: string;
  hasError?: boolean;
}) {
  const theme = useTheme();
  const current =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : null;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const base = current ? new Date(`${current}T00:00:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const days = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1).getDay();
    const count = new Date(cursor.year, cursor.month + 1, 0).getDate();
    return [
      ...Array.from({ length: first }, () => null),
      ...Array.from({ length: count }, (_, i) => i + 1),
    ];
  }, [cursor]);
  const shift = (delta: number) =>
    setCursor(c => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  return (
    <>
      <PickerTrigger
        icon="calendar"
        label={current ? formatDateLabel(current) : null}
        placeholder="Select date"
        onPress={() => setOpen(true)}
        hasError={hasError}
      />
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View style={styles.monthRow}>
          <PressableScale onPress={() => shift(-12)} style={styles.navBtn}>
            <Text style={{ color: theme.colors.textSecondary }}>«</Text>
          </PressableScale>
          <PressableScale onPress={() => shift(-1)} style={styles.navBtn}>
            <AppIcon
              name="chevron-left"
              size={20}
              color={theme.colors.textPrimary}
            />
          </PressableScale>
          <Text
            style={[styles.monthLabel, { color: theme.colors.textPrimary }]}
          >
            {MONTHS[cursor.month]} {cursor.year}
          </Text>
          <PressableScale onPress={() => shift(1)} style={styles.navBtn}>
            <AppIcon
              name="chevron-right"
              size={20}
              color={theme.colors.textPrimary}
            />
          </PressableScale>
          <PressableScale onPress={() => shift(12)} style={styles.navBtn}>
            <Text style={{ color: theme.colors.textSecondary }}>»</Text>
          </PressableScale>
        </View>
        <View style={styles.grid}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text
              key={`h${i}`}
              style={[
                styles.cell,
                styles.dow,
                { color: theme.colors.textTertiary },
              ]}
            >
              {d}
            </Text>
          ))}
          {days.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={styles.cell} />;
            const iso = `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`;
            const active = iso === current;
            return (
              <PressableScale
                key={iso}
                onPress={() => {
                  onChange(iso);
                  setOpen(false);
                }}
                style={
                  active
                    ? [
                        styles.cell,
                        {
                          backgroundColor: theme.colors.primary,
                          borderRadius: 20,
                        },
                      ]
                    : styles.cell
                }
              >
                <Text
                  style={{
                    color: active
                      ? theme.colors.textInverse
                      : theme.colors.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {day}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        {current ? (
          <Button
            title="Clear date"
            variant="ghost"
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/** JS-only time picker; value is HH:MM (24h). */
export function TimeField({
  value,
  onChange,
  label,
  hasError,
}: {
  value: unknown;
  onChange: (value: string | null) => void;
  label: string;
  hasError?: boolean;
}) {
  const theme = useTheme();
  const current =
    typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : null;
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState<number>(
    current ? Number(current.slice(0, 2)) : 9,
  );
  const [minute, setMinute] = useState<number>(
    current ? Number(current.slice(3, 5)) : 0,
  );
  const chip = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active
        ? theme.colors.primary
        : theme.colors.surfaceMuted,
    },
  ];
  return (
    <>
      <PickerTrigger
        icon="clock"
        label={current ? formatTimeLabel(current) : null}
        placeholder="Select time"
        onPress={() => setOpen(true)}
        hasError={hasError}
      />
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: 360 }}>
          <Text
            style={[styles.groupLabel, { color: theme.colors.textSecondary }]}
          >
            Hour
          </Text>
          <View style={styles.chips}>
            {HOURS.map(h => (
              <PressableScale
                key={h}
                onPress={() => setHour(h)}
                style={chip(h === hour)}
              >
                <Text
                  style={{
                    color:
                      h === hour
                        ? theme.colors.textInverse
                        : theme.colors.textPrimary,
                  }}
                >
                  {formatTimeLabel(`${pad(h)}:00`).replace(':00', '')}
                </Text>
              </PressableScale>
            ))}
          </View>
          <Text
            style={[styles.groupLabel, { color: theme.colors.textSecondary }]}
          >
            Minute
          </Text>
          <View style={styles.chips}>
            {MINUTES.map(m => (
              <PressableScale
                key={m}
                onPress={() => setMinute(m)}
                style={chip(m === minute)}
              >
                <Text
                  style={{
                    color:
                      m === minute
                        ? theme.colors.textInverse
                        : theme.colors.textPrimary,
                  }}
                >
                  :{pad(m)}
                </Text>
              </PressableScale>
            ))}
          </View>
        </ScrollView>
        <Button
          title={`Set ${formatTimeLabel(`${pad(hour)}:${pad(minute)}`)}`}
          onPress={() => {
            onChange(`${pad(hour)}:${pad(minute)}`);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  triggerText: { fontSize: 16 },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 12,
    padding: 18,
    paddingBottom: 34,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
  dow: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  groupLabel: { fontSize: 12, fontWeight: '700', marginVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderRadius: 10,
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
});
