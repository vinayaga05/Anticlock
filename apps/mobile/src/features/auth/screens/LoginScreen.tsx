import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { Button } from '@/shared/components/Button';
import { useAuth } from '@/shared/context/AuthProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import { AuthError } from '@/shared/services/auth/types';
import { ApiError } from '@/shared/api/client';

type Step = 'phone' | 'otp';

function authErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AuthError || err instanceof ApiError) return err.message;
  return fallback;
}

export function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { requestOtp, loginWithOtp } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedHint = useMemo(() => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '+91';
    return digits.length <= 10 ? `+91 ${digits}` : `+${digits}`;
  }, [phone]);

  const handleSendOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const digits = phone.replace(/\D/g, '').slice(-10);
      if (digits.length !== 10) {
        throw new AuthError('invalid_phone', 'Enter a valid 10-digit mobile number');
      }
      const result = await requestOtp(digits);
      setRequestId(result.requestId);
      setStep('otp');
    } catch (err) {
      setError(authErrorMessage(err, 'Could not send OTP. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const digits = phone.replace(/\D/g, '').slice(-10);
      await loginWithOtp(digits, otp.trim(), requestId);
    } catch (err) {
      setError(authErrorMessage(err, 'Invalid OTP. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtp('');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 48,
            paddingBottom: insets.bottom + 24,
          },
        ]}>
        <BrandLogo height={56} style={styles.logo} />
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {step === 'phone' ? 'Sign in with mobile' : 'Enter OTP'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {step === 'phone'
            ? 'We will send a one-time code to verify your number.'
            : `Code sent to ${formattedHint}`}
        </Text>

        {step === 'phone' ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Mobile number</Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.borderSoft,
                },
              ]}>
              <Text style={[styles.prefix, { color: theme.colors.textPrimary }]}>+91</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="9999999999"
                placeholderTextColor={theme.colors.textTertiary}
                style={[styles.input, { color: theme.colors.textPrimary }]}
                autoFocus
              />
            </View>
          </View>
        ) : (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>OTP</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor={theme.colors.textTertiary}
              style={[
                styles.otpInput,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.borderSoft,
                  color: theme.colors.textPrimary,
                },
              ]}
              autoFocus
            />
          </View>
        )}

        {error ? (
          <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
        ) : null}

        {__DEV__ ? (
          <Text style={[styles.devHint, { color: theme.colors.textTertiary }]}>
            Dev login: +91 9999999999 or 8888888888 · OTP 123456
          </Text>
        ) : null}

        <View style={styles.actions}>
          {step === 'otp' ? (
            <Button title="Change number" variant="ghost" onPress={handleBack} disabled={loading} />
          ) : null}
          <Button
            title={step === 'phone' ? 'Continue' : 'Verify & sign in'}
            onPress={step === 'phone' ? handleSendOtp : handleVerifyOtp}
            loading={loading}
            disabled={step === 'phone' ? phone.replace(/\D/g, '').length < 10 : otp.length < 6}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export function AuthLoadingScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.loadingRoot, { backgroundColor: theme.colors.background }]}>
      <BrandLogo height={64} />
      <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loadingSpinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 16,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 54,
    gap: 8,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    paddingVertical: 12,
  },
  otpInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    minHeight: 54,
    paddingHorizontal: 14,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  error: {
    fontSize: 14,
    fontWeight: '500',
  },
  devHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    gap: 8,
    marginTop: 8,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  loadingSpinner: {
    marginTop: 8,
  },
});
