import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/shared/context/AuthProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/components/Button';
import { UsernameField, useUsernameAvailability } from '@/features/profile/components/UsernameField';

export function UsernameOnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { claimUsername, logout } = useAuth();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const check = useUsernameAvailability(value);
  const save = async () => {
    if (pending.current || check.status !== 'available') return;
    pending.current = true; setSaving(true); setError(null);
    try { await claimUsername(check.username); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not save. Please try again.'); check.retry(); }
    finally { pending.current = false; setSaving(false); }
  };
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24, gap: 20 }}>
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '800' }}>Choose a username</Text>
      <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>Your unique handle helps people find you on Knock. You can change it later in Edit profile.</Text>
      <UsernameField value={value} onChangeText={next => { setValue(next); setError(null); }} check={check} disabled={saving} />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
      <View style={{ marginTop: 'auto', gap: 12 }}>
        <Button title="Continue" onPress={() => void save()} disabled={saving || check.status !== 'available'} loading={saving} />
        <Button title="Sign out" onPress={() => void logout()} disabled={saving} variant="secondary" />
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
