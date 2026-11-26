import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { normalizeUsername, usernameProblem, type UsernameAvailability } from '@anticlock/contracts/username';
import { apiRequest } from '@/shared/api/client';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';

type Check = { username: string; status: UsernameAvailability['status'] | 'checking' | 'error'; message?: string; suggestions: string[] };
export function useUsernameAvailability(value: string, current?: string | null) {
  const username = normalizeUsername(value);
  const problem = usernameProblem(value);
  const [check, setCheck] = useState<Check>({ username: '', status: 'checking', suggestions: [] });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (problem || (username === current && retry === 0)) return;
    let active = true;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setCheck({ username, status: 'checking', suggestions: [] });
    const debounce = setTimeout(() => {
      timeout = setTimeout(() => {
        if (active) { setCheck({ username, status: 'error', suggestions: [] }); controller.abort(); }
      }, 10_000);
      apiRequest<UsernameAvailability>(`/auth/mobile/username/availability?username=${encodeURIComponent(username)}`, { signal: controller.signal })
        .then(result => { if (active && !controller.signal.aborted && result.username === username) setCheck(result); })
        .catch(() => { if (active) setCheck({ username, status: 'error', suggestions: [] }); })
        .finally(() => clearTimeout(timeout));
    }, 300);
    return () => { active = false; clearTimeout(debounce); clearTimeout(timeout); controller.abort(); };
  }, [username, current, problem, retry]);
  const result: Check = problem ? { username, status: 'invalid', message: problem, suggestions: [] }
    : username === current && retry === 0 ? { username, status: 'available', suggestions: [] }
    : check.username === username ? check : { username, status: 'checking', suggestions: [] };
  return { ...result, retry: () => setRetry(previous => previous + 1) };
}

export function UsernameField({ value, onChangeText, check, disabled = false }: {
  value: string; onChangeText: (value: string) => void;
  check: ReturnType<typeof useUsernameAvailability>; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const message = check.status === 'checking' ? 'Checking…' : check.status === 'available' ? 'Available'
    : check.status === 'taken' ? 'Taken. Try another username.' : check.status === 'error' ? 'Couldn’t check. Try again.' : check.message;
  return <View style={{ gap: 10 }}>
    <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Username</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, backgroundColor: colors.surface }}>
      <Text style={{ color: colors.textSecondary, fontSize: 18 }}>@</Text>
      <TextInput accessibilityLabel="Username" value={value} editable={!disabled} onChangeText={next => onChangeText(next.trim().startsWith('@@') ? next : normalizeUsername(next))} autoCapitalize="none" autoCorrect={false} maxLength={64} placeholder="your_username" placeholderTextColor={colors.textTertiary} style={{ flex: 1, color: colors.textPrimary, fontSize: 17, padding: 12 }} />
    </View>
    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>3–30 letters, numbers, periods or underscores. Your display name stays separate.</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: ['invalid', 'taken', 'error'].includes(check.status) ? colors.error : colors.textSecondary }}>{message}</Text>
    {check.status === 'error' ? <PressableScale accessibilityLabel="Retry username check" disabled={disabled} onPress={check.retry}><Text style={{ color: colors.primary, paddingVertical: 10 }}>Try again</Text></PressableScale> : null}
    {check.suggestions.map(suggestion => <PressableScale key={suggestion} accessibilityLabel={`Use @${suggestion}`} disabled={disabled} onPress={() => onChangeText(suggestion)}><Text style={{ color: colors.primary, paddingVertical: 8 }}>@{suggestion}</Text></PressableScale>)}
  </View>;
}
