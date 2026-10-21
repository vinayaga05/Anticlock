import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/shared/components/Button';
import { useAuth } from '@/shared/context/AuthProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import { ApiError } from '@/shared/api/client';

export function NameOnboardingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = name.trim();
  const canContinue = normalized.length >= 2;

  const subtitle = useMemo(
    () =>
      canContinue
        ? 'This name appears on your profile and clips.'
        : 'Enter at least two characters to continue.',
    [canContinue],
  );

  const save = async () => {
    if (!user || !canContinue || saving) return;
    setError(null);
    setSaving(true);
    try {
      const existingAvatar = user.avatarUrl?.startsWith('data:')
        ? null
        : user.avatarUrl ?? null;
      await updateProfile({
        displayName: normalized,
        avatarUrl: existingAvatar,
        bio: user.bio ?? null,
        location: user.location ?? null,
        website: user.website ?? null,
      });
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Could not save your name. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          What should we call you?
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={theme.colors.textTertiary}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={80}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderSoft,
              color: theme.colors.textPrimary,
            },
          ]}
        />
        {error ? (
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
        ) : null}
        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={() => void save()}
            disabled={!canContinue || saving}
            loading={saving}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 17,
    fontWeight: '600',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
  },
});
