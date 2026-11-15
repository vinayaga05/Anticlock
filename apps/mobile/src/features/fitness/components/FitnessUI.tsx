import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
const FitnessBusyContext = React.createContext(false);
export const FitnessPhotoTextContext = React.createContext(false);
export const useFitnessBusy = () => React.useContext(FitnessBusyContext);

export function useFitnessColors() {
  const theme = useTheme();
  return theme.mode === 'dark'
    ? {
        background: '#111A16',
        surface: '#1C2821',
        ink: '#F5F2E9',
        muted: '#A9BAB0',
        line: '#33463A',
        soft: '#263B2F',
        accent: '#A5D9AD',
        onAccent: '#14291C',
        danger: '#FFB5A9',
        clay: '#D3A990',
      }
    : {
        background: '#F6F3EA',
        surface: '#FFFEF9',
        ink: '#192D25',
        muted: '#566A5E',
        line: '#E0E6DA',
        soft: '#E9EEDD',
        accent: '#275D45',
        onAccent: '#FFFFFF',
        danger: '#A33932',
        clay: '#AD7352',
      };
}
export function FitnessScreen({
  title,
  subtitle,
  children,
  back = true,
  right,
  busy = false,
  footer,
  onBack,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: boolean;
  right?: React.ReactNode;
  busy?: boolean;
  footer?: React.ReactNode;
  onBack?: () => void;
}) {
  const c = useFitnessColors();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: c.line },
        ]}
      >
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={
              onBack ??
              (() =>
                nav.canGoBack()
                  ? nav.goBack()
                  : nav.navigate('Main', { screen: 'Needs' }))
            }
            style={styles.iconButton}
          >
            <AppIcon name="chevron-left" color={c.ink} size={23} />
          </Pressable>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: c.accent }]}>
            FITNESS & WELLNESS
          </Text>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: c.ink }]}
          >
            {title}
          </Text>
        </View>
        {right}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {subtitle && (
          <Text style={[styles.body, { color: c.muted }]}>{subtitle}</Text>
        )}
        <FitnessBusyContext.Provider value={busy}>
          {children}
        </FitnessBusyContext.Provider>
      </ScrollView>
      {footer && (
        <FitnessBusyContext.Provider value={busy}>
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: c.line,
              backgroundColor: c.background,
              gap: 8,
            }}
          >
            {footer}
          </View>
        </FitnessBusyContext.Provider>
      )}
    </KeyboardAvoidingView>
  );
}
export function FitnessText({
  children,
  muted = false,
  large = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
  large?: boolean;
}) {
  const c = useFitnessColors();
  const onPhoto = React.useContext(FitnessPhotoTextContext);
  return (
    <Text
      style={[
        large ? styles.metric : styles.body,
        { color: onPhoto ? '#FFFFFF' : muted ? c.muted : c.ink },
      ]}
    >
      {children}
    </Text>
  );
}
export function FitnessCard({
  children,
  tone = 'surface',
}: {
  children: React.ReactNode;
  tone?: 'surface' | 'soft';
}) {
  const c = useFitnessColors();
  return (
    <View
      style={[styles.card, { backgroundColor: c[tone], borderColor: c.line }]}
    >
      {children}
    </View>
  );
}
export function FitnessSection({
  title,
  caption,
}: {
  title: string;
  caption?: string;
}) {
  const c = useFitnessColors();
  const onPhoto = React.useContext(FitnessPhotoTextContext);
  return (
    <View style={{ gap: 4, marginTop: 10 }}>
      <Text
        accessibilityRole="header"
        style={[styles.section, { color: onPhoto ? '#FFFFFF' : c.ink }]}
      >
        {title}
      </Text>
      {caption && (
        <Text style={[styles.body, { color: onPhoto ? '#FFFFFF' : c.muted }]}>
          {caption}
        </Text>
      )}
    </View>
  );
}
export function FitnessAction({
  label,
  onPress,
  disabled,
  busy,
  secondary,
  icon,
  destructive,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  icon?: IconName;
  destructive?: boolean;
  compact?: boolean;
}) {
  const c = useFitnessColors();
  const formBusy = React.useContext(FitnessBusyContext);
  const color = destructive ? c.danger : secondary ? c.ink : c.onAccent;
  const blocked = disabled || busy || formBusy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && { minHeight: 44, paddingVertical: 9, paddingHorizontal: 12 },
        {
          backgroundColor: secondary || destructive ? c.soft : c.accent,
          borderColor: c.line,
          opacity: blocked ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : icon ? (
        <AppIcon name={icon} size={19} color={color} />
      ) : null}
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}
export function FitnessField({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  const c = useFitnessColors();
  const formBusy = React.useContext(FitnessBusyContext);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        editable={props.editable !== false && !formBusy}
        style={[
          styles.input,
          {
            color: c.ink,
            borderColor: c.line,
            backgroundColor: c.surface,
            minHeight: props.multiline ? 90 : 50,
          },
          props.style,
        ]}
      />
      {hint && <FitnessText muted>{hint}</FitnessText>}
    </View>
  );
}
export function FitnessChoices({
  label,
  options,
  selected,
  onChange,
  multiple = false,
}: {
  label: string;
  options: readonly string[];
  selected: string | string[];
  onChange: (value: any) => void;
  multiple?: boolean;
}) {
  const c = useFitnessColors();
  const formBusy = React.useContext(FitnessBusyContext);
  const current = Array.isArray(selected) ? selected : [selected];
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
      <View style={styles.wrap}>
        {options.map(value => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value}`}
            accessibilityState={{
              selected: current.includes(value),
              disabled: formBusy,
            }}
            disabled={formBusy}
            onPress={() =>
              onChange(
                multiple
                  ? current.includes(value)
                    ? current.filter(item => item !== value)
                    : [...current, value]
                  : value,
              )
            }
            style={[
              styles.pill,
              {
                backgroundColor: current.includes(value) ? c.accent : c.surface,
                borderColor: c.line,
              },
            ]}
          >
            <Text
              style={{
                color: current.includes(value) ? c.onAccent : c.ink,
                fontSize: 14,
                fontWeight: '500',
              }}
            >
              {value.replace(/_/g, ' ')}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function FitnessNotice({
  message,
  error = false,
}: {
  message?: string | null;
  error?: boolean;
}) {
  const c = useFitnessColors();
  return message ? (
    <Text
      accessibilityRole={error ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[
        styles.body,
        { color: error ? c.danger : c.muted, paddingVertical: 4 },
      ]}
    >
      {message}
    </Text>
  ) : null;
}
export function FitnessLoading() {
  const c = useFitnessColors();
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={c.accent} />
      <FitnessText muted>Opening your private space…</FitnessText>
    </View>
  );
}
export function FitnessEmpty({
  title,
  message,
  action,
  onPress,
}: {
  title: string;
  message: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <FitnessCard>
      <FitnessSection title={title} />
      <FitnessText muted>{message}</FitnessText>
      {action && onPress && <FitnessAction label={action} onPress={onPress} />}
    </FitnessCard>
  );
}
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    minHeight: 44,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 7,
  },
  title: { fontSize: 29, fontWeight: '600', letterSpacing: -0.8 },
  content: { padding: 20, gap: 17 },
  body: { fontSize: 14, lineHeight: 21 },
  metric: { fontSize: 34, fontWeight: '500', letterSpacing: -1 },
  card: { padding: 19, borderRadius: 24, borderWidth: 1, gap: 14 },
  section: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  buttonText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
  },
});
export const fitnessStyles = styles;
