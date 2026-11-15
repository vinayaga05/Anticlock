import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Minus,
  Plus,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { FitnessAction, useFitnessBusy, useFitnessColors } from './FitnessUI';
import { localFitnessDate } from '../fitnessModel';

export function FitnessDisclosure({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const c = useFitnessColors();
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[styles.disclosure, { borderColor: c.line }]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.label, { color: c.ink }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.caption, { color: c.muted }]}>{subtitle}</Text>
          )}
        </View>
        <ChevronDown
          size={19}
          color={c.muted}
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {open && children}
    </View>
  );
}
export function FitnessSheet({
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
  const c = useFitnessColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: c.background,
              paddingBottom: Math.max(16, insets.bottom),
            },
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.line,
            }}
          />
          <View style={styles.row}>
            <Text
              accessibilityRole="header"
              style={[styles.heading, { color: c.ink, flex: 1 }]}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              onPress={onClose}
              style={styles.icon}
            >
              <X size={22} color={c.ink} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingBottom: 12 }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function FitnessStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  formatValue,
  disabled = false,
  initialValue,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  initialValue?: number;
  disabled?: boolean;
}) {
  const c = useFitnessColors();
  const busy = useFitnessBusy() || disabled;
  const [editing, setEditing] = React.useState(false);
  const [input, setInput] = React.useState('');
  const change = (direction: number) => {
    if (!busy)
      onChange(
        Math.min(
          max,
          Math.max(
            min,
            Number(
              (value === undefined
                ? initialValue ?? min
                : value + direction * step
              ).toFixed(3),
            ),
          ),
        ),
      );
  };
  const display =
    value === undefined
      ? 'Set value'
      : formatValue
      ? formatValue(value)
      : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
          value,
        );
  const action = (e: AccessibilityActionEvent) =>
    change(e.nativeEvent.actionName === 'increment' ? 1 : -1);
  const commit = () => {
    const parsed = Number(input.replace(',', '.'));
    if (
      input.trim() &&
      Number.isFinite(parsed) &&
      parsed >= min &&
      parsed <= max
    ) {
      onChange(Number(parsed.toFixed(3)));
      setEditing(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <View
        style={[
          styles.stepper,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          accessibilityState={{
            disabled: busy || (value !== undefined && value <= min),
          }}
          disabled={busy || (value !== undefined && value <= min)}
          onPress={() => change(-1)}
          style={styles.icon}
        >
          <Minus size={21} color={c.accent} />
        </Pressable>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          accessibilityLabel={label}
          accessibilityValue={{
            min,
            max,
            now: value,
            text: `${display}${unit ? ` ${unit}` : ''}`,
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={action}
          accessibilityHint="Swipe up or down to adjust. Double tap to enter a value."
          onPress={() => {
            if (!busy) {
              setInput(value?.toString() ?? '');
              setEditing(true);
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            alignItems: 'center',
            paddingVertical: 14,
          }}
        >
          <Text style={[styles.value, { color: c.ink }]}>{display}</Text>
          {unit && (
            <Text style={[styles.caption, { color: c.muted }]}>{unit}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          accessibilityState={{
            disabled: busy || (value !== undefined && value >= max),
          }}
          disabled={busy || (value !== undefined && value >= max)}
          onPress={() => change(1)}
          style={styles.icon}
        >
          <Plus size={21} color={c.accent} />
        </Pressable>
      </View>
      <FitnessSheet
        visible={editing}
        title={label}
        onClose={() => setEditing(false)}
      >
        <TextInput
          autoFocus
          accessibilityLabel={`Enter ${label}`}
          value={input}
          onChangeText={setInput}
          keyboardType="decimal-pad"
          style={[styles.manualInput, { color: c.ink, borderColor: c.line }]}
          onSubmitEditing={commit}
        />
        <Text style={[styles.caption, { color: c.muted }]}>
          {min}–{max}
          {unit ? ` ${unit}` : ''}
        </Text>
        <FitnessAction
          label="Done"
          onPress={commit}
          disabled={
            !input.trim() ||
            !Number.isFinite(Number(input.replace(',', '.'))) ||
            Number(input.replace(',', '.')) < min ||
            Number(input.replace(',', '.')) > max
          }
        />
      </FitnessSheet>
    </View>
  );
}
export function FitnessDayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const c = useFitnessColors();
  const busy = useFitnessBusy();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {[1, 2, 3, 4, 5, 6, 0].map(day => (
        <Pressable
          key={day}
          accessibilityRole="checkbox"
          accessibilityLabel={days[day]}
          accessibilityState={{ checked: value.includes(day), disabled: busy }}
          disabled={busy}
          onPress={() =>
            onChange(
              value.includes(day)
                ? value.filter(d => d !== day)
                : [...value, day].sort(),
            )
          }
          style={{
            minWidth: 42,
            minHeight: 48,
            flexGrow: 1,
            padding: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 16,
            backgroundColor: value.includes(day) ? c.accent : c.surface,
            borderColor: c.line,
            borderWidth: 1,
          }}
        >
          <Text
            style={{
              color: value.includes(day) ? c.onAccent : c.ink,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            {days[day]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function FitnessChoiceCards({
  options,
  value,
  onChange,
  multiple = false,
}: {
  options: {
    value: string;
    label: string;
    icon?: LucideIcon;
    description?: string;
  }[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
}) {
  const c = useFitnessColors();
  const busy = useFitnessBusy();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {options.map(option => {
        const selected = value.includes(option.value);
        const Icon = option.icon;
        return (
          <Pressable
            key={option.value}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled: busy }}
            disabled={busy}
            onPress={() =>
              onChange(
                multiple
                  ? selected
                    ? value.filter(v => v !== option.value)
                    : [...value, option.value]
                  : [option.value],
              )
            }
            style={{
              flexBasis: '46%',
              flexGrow: 1,
              minWidth: 110,
              minHeight: 108,
              borderRadius: 22,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? c.accent : c.line,
              backgroundColor: selected ? c.soft : c.surface,
              padding: 15,
              gap: 9,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {Icon ? (
                <Icon size={25} strokeWidth={1.6} color={c.accent} />
              ) : (
                <View />
              )}
              {selected && <Check size={17} color={c.accent} />}
            </View>
            <Text style={[styles.label, { color: c.ink }]}>{option.label}</Text>
            {option.description && (
              <Text style={[styles.caption, { color: c.muted }]}>
                {option.description}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
export function FitnessToggle({
  label,
  value,
  onChange,
  detail,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  detail?: string;
}) {
  const c = useFitnessColors();
  const busy = useFitnessBusy();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
        {detail && (
          <Text style={[styles.caption, { color: c.muted }]}>{detail}</Text>
        )}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={busy}
        trackColor={{ false: c.line, true: c.accent }}
        thumbColor={value ? c.onAccent : c.surface}
      />
    </View>
  );
}

export function parseFitnessPickerDate(
  value?: string,
  mode: 'date' | 'time' = 'date',
) {
  if (mode === 'time') {
    const date = new Date();
    const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
    date.setHours(
      match ? Math.min(23, Number(match[1])) : 9,
      match ? Math.min(59, Number(match[2])) : 0,
      0,
      0,
    );
    return date;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}
export function formatFitnessPickerDate(date: Date, mode: 'date' | 'time') {
  return mode === 'date'
    ? localFitnessDate(date)
    : `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes(),
      ).padStart(2, '0')}`;
}
function boundDate(value?: Date | string) {
  return typeof value === 'string' ? parseFitnessPickerDate(value) : value;
}
class PickerBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function FitnessDatePicker({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  mode = 'date',
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  minimumDate?: Date | string;
  maximumDate?: Date | string;
  mode?: 'date' | 'time';
}) {
  const c = useFitnessColors();
  const busy = useFitnessBusy();
  const [visible, setVisible] = React.useState(false);
  const [draft, setDraft] = React.useState(() =>
    parseFitnessPickerDate(value, mode),
  );
  const [NativePicker, setNativePicker] =
    React.useState<React.ComponentType<any> | null>(null);
  const min = boundDate(minimumDate);
  const max = boundDate(maximumDate);
  const clamp = (date: Date) =>
    new Date(
      Math.min(
        max?.getTime() ?? Infinity,
        Math.max(min?.getTime() ?? -Infinity, date.getTime()),
      ),
    );
  const open = () => {
    const initial = clamp(parseFitnessPickerDate(value, mode));
    setDraft(initial);
    try {
      const picker = require('@react-native-community/datetimepicker');
      if (Platform.OS === 'android') {
        picker.DateTimePickerAndroid.open({
          value: initial,
          mode,
          minimumDate: min,
          maximumDate: max,
          onValueChange: (_: unknown, date: Date) =>
            onChange(formatFitnessPickerDate(date, mode)),
          onError: () => {
            setNativePicker(null);
            setVisible(true);
          },
        });
        return;
      }
      setNativePicker(() => picker.default);
    } catch {
      setNativePicker(null);
    }
    setVisible(true);
  };
  const fallback = (
    <PickerFallback
      value={draft}
      onChange={setDraft}
      min={min}
      max={max}
      mode={mode}
    />
  );
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{
          text: value
            ? mode === 'date'
              ? parseFitnessPickerDate(value).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : value
            : 'Choose',
        }}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={open}
        style={[
          styles.date,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        {mode === 'date' ? (
          <CalendarDays size={21} color={c.accent} />
        ) : (
          <Clock3 size={21} color={c.accent} />
        )}
        <Text style={{ color: value ? c.ink : c.muted, fontSize: 16, flex: 1 }}>
          {value
            ? mode === 'date'
              ? parseFitnessPickerDate(value).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : value
            : 'Choose'}
        </Text>
        <ChevronDown size={18} color={c.muted} />
      </Pressable>
      <FitnessSheet
        visible={visible}
        title={label}
        onClose={() => setVisible(false)}
      >
        {NativePicker ? (
          <PickerBoundary key={`${label}-${visible}`} fallback={fallback}>
            <NativePicker
              value={draft}
              mode={mode}
              display="spinner"
              minimumDate={min}
              maximumDate={max}
              textColor={c.ink}
              accentColor={c.accent}
              onValueChange={(_: unknown, date: Date) => setDraft(date)}
              style={{ alignSelf: 'stretch' }}
            />
          </PickerBoundary>
        ) : (
          fallback
        )}
        <FitnessAction
          label="Done"
          onPress={() => {
            onChange(formatFitnessPickerDate(clamp(draft), mode));
            setVisible(false);
          }}
        />
      </FitnessSheet>
    </View>
  );
}
function PickerFallback({
  value,
  onChange,
  min,
  max,
  mode,
}: {
  value: Date;
  onChange: (value: Date) => void;
  min?: Date;
  max?: Date;
  mode: 'date' | 'time';
}) {
  const c = useFitnessColors();
  const [view, setView] = React.useState(
    new Date(value.getFullYear(), value.getMonth(), 1, 12),
  );
  if (mode === 'time')
    return (
      <View style={{ gap: 12 }}>
        <FitnessStepper
          label="Hour"
          value={value.getHours()}
          min={0}
          max={23}
          onChange={n => {
            const next = new Date(value);
            next.setHours(n);
            onChange(next);
          }}
        />
        <FitnessStepper
          label="Minute"
          value={value.getMinutes()}
          min={0}
          max={59}
          onChange={n => {
            const next = new Date(value);
            next.setMinutes(n);
            onChange(next);
          }}
        />
      </View>
    );
  const offset = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  return (
    <View style={{ gap: 12 }}>
      <FitnessStepper
        label="Year"
        value={view.getFullYear()}
        min={min?.getFullYear() ?? 1900}
        max={max?.getFullYear() ?? new Date().getFullYear() + 20}
        onChange={year => setView(new Date(year, view.getMonth(), 1, 12))}
      />
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() =>
            setView(new Date(view.getFullYear(), view.getMonth() - 1, 1, 12))
          }
          style={styles.icon}
        >
          <ChevronLeft size={22} color={c.ink} />
        </Pressable>
        <Text
          style={[styles.label, { color: c.ink, flex: 1, textAlign: 'center' }]}
        >
          {view.toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() =>
            setView(new Date(view.getFullYear(), view.getMonth() + 1, 1, 12))
          }
          style={styles.icon}
        >
          <ChevronRight size={22} color={c.ink} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: offset + count }, (_, i) => {
          const day = i - offset + 1;
          if (day < 1) return <View key={i} style={{ width: '14.28%' }} />;
          const date = new Date(view.getFullYear(), view.getMonth(), day, 12);
          const blocked = Boolean(
            (min && localFitnessDate(date) < localFitnessDate(min)) ||
              (max && localFitnessDate(date) > localFitnessDate(max)),
          );
          const selected = localFitnessDate(date) === localFitnessDate(value);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={date.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              accessibilityState={{ selected, disabled: blocked }}
              disabled={blocked}
              onPress={() => onChange(date)}
              style={{
                width: '14.28%',
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? c.accent : undefined,
                borderRadius: 14,
                opacity: blocked ? 0.3 : 1,
              }}
            >
              <Text style={{ color: selected ? c.onAccent : c.ink }}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  caption: { fontSize: 12, lineHeight: 18 },
  heading: { fontSize: 22, fontWeight: '600', letterSpacing: -0.4 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#081A1466',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    gap: 12,
  },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 4,
  },
  value: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  manualInput: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    fontSize: 22,
  },
  date: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
