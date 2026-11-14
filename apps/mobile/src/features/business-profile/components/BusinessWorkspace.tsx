import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';

export function BusinessWorkspace({
  title,
  subtitle,
  children,
  footer,
  busy = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
}) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            borderBottomColor: theme.colors.borderSoft,
          },
        ]}
      >
        <PressableScale
          accessibilityLabel="Back"
          disabled={busy}
          onPress={() => {
            if (!busy) navigation.goBack();
          }}
          style={[styles.back, { backgroundColor: theme.colors.surface }]}
        >
          <AppIcon name="back" color={theme.colors.textPrimary} size={23} />
        </PressableScale>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: theme.colors.textSecondary }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 14,
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.borderSoft,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function WorkspaceCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderSoft,
        },
      ]}
    >
      {title ? (
        <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function WorkspaceField({
  label,
  value,
  onChangeText,
  disabled,
  multiline,
  maxLength,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize={
          keyboardType === 'url' || keyboardType === 'email-address'
            ? 'none'
            : 'sentences'
        }
        autoCorrect={keyboardType !== 'url' && keyboardType !== 'email-address'}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
          },
        ]}
      />
    </View>
  );
}

export function WorkspaceMessage({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole={error ? 'alert' : undefined}
      style={[
        styles.message,
        { color: error ? theme.colors.error : theme.colors.textSecondary },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 12 },
  content: { padding: 20, paddingBottom: 32, gap: 18 },
  footer: {
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  card: {
    borderRadius: 22,
    padding: 19,
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  message: { fontSize: 13, lineHeight: 20 },
});
