import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { useAuth } from '@/shared/context/AuthProvider';
import { useCreateComplaintMutation } from '@/shared/api/complaintHooks';
import { validateComplaintDraft } from '../complaintForm';

export function CreateComplaintScreen() {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const mutation = useCreateComplaintMutation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const activeSubmission = useRef<object | null>(null);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setTitle(''); setDescription(''); setError(null); setPending(false);
    activeSubmission.current = null; request.current = null;
  }, [user?.id]);
  const signedIn = Boolean(user && user.id !== 'temporary-guest');

  const submit = async () => {
    if (activeSubmission.current || !signedIn) return;
    let input;
    try { input = validateComplaintDraft(title, description); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Check your complaint.'); return; }
    const payload = JSON.stringify(input);
    if (request.current?.payload !== payload) {
      request.current = { payload, id: `complaint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` };
    }
    const submission = {};
    activeSubmission.current = submission; setPending(true); setError(null);
    try {
      await mutation.mutateAsync({ ...input, clientRequestId: request.current.id });
      if (mounted.current && activeSubmission.current === submission) navigation.goBack();
    } catch {
      if (mounted.current && activeSubmission.current === submission) setError('Could not post your complaint. Your text is still here. Please try again.');
    } finally {
      if (mounted.current && activeSubmission.current === submission) { activeSubmission.current = null; setPending(false); }
    }
  };
  const inputStyle = [styles.input, { color: theme.colors.textPrimary, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md }];

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
    <ScreenContainer scrollable tabAware={false}>
      {!signedIn ? (
        <>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Sign in to post a complaint.</Text>
          <Button title="Sign in" onPress={() => { void logout(); }} />
        </>
      ) : (
        <>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Your complaint will be visible to everyone signed in.</Text>
          <View style={styles.field}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary }]}>Title</Text>
            <TextInput accessibilityLabel="Complaint title" value={title} onChangeText={setTitle} editable={!pending} maxLength={120} placeholder="What is the issue?" placeholderTextColor={theme.colors.textTertiary} style={inputStyle} />
          </View>
          <View style={styles.field}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary }]}>Description</Text>
            <TextInput accessibilityLabel="Complaint description" value={description} onChangeText={setDescription} editable={!pending} multiline maxLength={3000} placeholder="Describe what happened and what needs attention" placeholderTextColor={theme.colors.textTertiary} style={[...inputStyle, styles.description]} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{description.length} / 3,000</Text>
          </View>
          {error ? <Text accessibilityRole="alert" style={[theme.typography.bodySmall, { color: theme.colors.error }]}>{error}</Text> : null}
          <Button title="Post complaint" onPress={() => { void submit(); }} loading={pending} disabled={pending} />
          <Button title="Cancel" variant="secondary" disabled={pending} onPress={() => navigation.goBack()} />
        </>
      )}
    </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  field: { gap: 8 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, minHeight: 48, fontSize: 16 },
  description: { minHeight: 180, textAlignVertical: 'top' },
});
