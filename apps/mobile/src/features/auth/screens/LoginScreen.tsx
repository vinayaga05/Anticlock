import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import {
  AuthError,
  normalizePhone,
  type OtpSendResult,
} from '@/shared/services/auth/types';
import { ApiError } from '@/shared/api/client';
import {
  otpDestination,
  otpLocalTiming,
  otpRetryAt,
  otpSecondsUntil,
} from '../utils/otpLoginModel';

type Step = 'phone' | 'otp';

function authErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AuthError || err instanceof ApiError) return err.message;
  return fallback;
}

export function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { requestOtp, loginWithOtp, user } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challenge, setChallenge] = useState<OtpSendResult | null>(null);
  const [destination, setDestination] = useState('');
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [verifyBlockedUntil, setVerifyBlockedUntil] = useState<number | null>(
    null,
  );
  const [now, setNow] = useState(Date.now);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const account = useRef(user?.id);
  account.current = user?.id;

  const cancelAttempt = () => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    busy.current = false;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAttempt();
    };
  }, []);
  useEffect(() => {
    if (step !== 'otp' && !resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step, resendAt]);
  const resendSeconds = otpSecondsUntil(resendAt, now);
  const verifyBlockedSeconds = otpSecondsUntil(verifyBlockedUntil, now);
  const expiresSeconds = otpSecondsUntil(challenge?.expiresAt ?? null, now);
  const expired = !!challenge && expiresSeconds === 0;
  let validPhone = false;
  try {
    normalizePhone(phone);
    validPhone = true;
  } catch {
    /* input is still incomplete */
  }

  function startAttempt() {
    const attempt = ++generation.current;
    const userId = account.current;
    const abort = new AbortController();
    controller.current = abort;
    busy.current = true;
    return {
      signal: abort.signal,
      isCurrentAttempt: () =>
        mounted.current &&
        generation.current === attempt &&
        account.current === userId,
    };
  }

  const handleSendOtp = async (resend = false) => {
    if (busy.current || resendSeconds > 0 || verifyBlockedSeconds > 0) return;
    const options = startAttempt();
    setError(null);
    setLoading(true);
    try {
      const normalized = resend ? destination : normalizePhone(phone);
      if (resend) {
        setChallenge(null);
        setOtp('');
      }
      const result = await requestOtp(normalized, options);
      if (!options.isCurrentAttempt()) return;
      const timing = otpLocalTiming(result, Date.now());
      setDestination(normalized);
      setChallenge(timing);
      setResendAt(Date.parse(timing.resendAvailableAt));
      setVerifyBlockedUntil(null);
      setNow(Date.now());
      setStep('otp');
    } catch (err) {
      if (!options.isCurrentAttempt()) return;
      const retry = otpRetryAt(err, Date.now());
      if (retry) setResendAt(retry);
      else if (!(err instanceof AuthError && err.code === 'invalid_phone'))
        setResendAt(Date.now() + 60_000);
      setNow(Date.now());
      setError(authErrorMessage(err, 'Could not send OTP. Try again.'));
    } finally {
      if (options.isCurrentAttempt()) {
        busy.current = false;
        controller.current = null;
        setLoading(false);
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (busy.current || !challenge || expired || verifyBlockedSeconds > 0)
      return;
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit code.');
      return;
    }
    const options = startAttempt();
    setError(null);
    setLoading(true);
    try {
      await loginWithOtp(destination, otp, challenge.requestId, options);
    } catch (err) {
      if (!options.isCurrentAttempt()) return;
      if (
        (err instanceof AuthError || err instanceof ApiError) &&
        ['otp_expired', 'otp_used', 'otp_consumed'].includes(err.code)
      ) {
        setChallenge(null);
        setOtp('');
      }
      const retry = otpRetryAt(err, Date.now());
      if (retry) {
        setVerifyBlockedUntil(retry);
        setResendAt(current => Math.max(current ?? 0, retry));
      }
      setNow(Date.now());
      setError(authErrorMessage(err, 'Invalid OTP. Try again.'));
    } finally {
      if (options.isCurrentAttempt()) {
        busy.current = false;
        controller.current = null;
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    cancelAttempt();
    setStep('phone');
    setOtp('');
    setChallenge(null);
    setLoading(false);
    setError(null);
  };

  const handlePhoneChange = (value: string) => {
    cancelAttempt();
    try {
      setPhone(normalizePhone(value).slice(3));
    } catch {
      setPhone(value);
    }
    setLoading(false);
    setChallenge(null);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 48,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <BrandLogo height={56} style={styles.logo} />
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {step === 'phone' ? 'Sign in with mobile' : 'Enter OTP'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {step === 'phone'
            ? 'We will send a one-time code to verify your number.'
            : `Enter the code requested for ${otpDestination(
                destination,
              )}. SMS delivery may take a moment.`}
        </Text>

        {step === 'phone' ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              Mobile number
            </Text>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.borderSoft,
                },
              ]}
            >
              <Text
                style={[styles.prefix, { color: theme.colors.textPrimary }]}
              >
                +91
              </Text>
              <TextInput
                value={phone}
                onChangeText={handlePhoneChange}
                accessibilityLabel="Mobile number"
                keyboardType="phone-pad"
                maxLength={18}
                placeholder="Mobile number"
                placeholderTextColor={theme.colors.textTertiary}
                style={[styles.input, { color: theme.colors.textPrimary }]}
                autoFocus
              />
            </View>
          </View>
        ) : (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              OTP
            </Text>
            <TextInput
              value={otp}
              onChangeText={value =>
                setOtp(value.replace(/\D/g, '').slice(0, 6))
              }
              accessibilityLabel="One-time code"
              editable={!loading}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6-digit code"
              textContentType="oneTimeCode"
              autoComplete={
                Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'
              }
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
          <Text style={[styles.error, { color: theme.colors.error }]}>
            {error}
          </Text>
        ) : null}

        {step === 'otp' && challenge ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.devHint,
              {
                color: expired ? theme.colors.error : theme.colors.textTertiary,
              },
            ]}
          >
            {expired
              ? 'This code has expired. Request a new code.'
              : `Code expires in ${Math.floor(expiresSeconds / 60)}:${String(
                  expiresSeconds % 60,
                ).padStart(2, '0')}`}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {step === 'otp' ? (
            <Button
              title="Change number"
              variant="ghost"
              onPress={handleBack}
            />
          ) : null}
          {step === 'otp' ? (
            <Button
              title={
                resendSeconds > 0
                  ? `Resend code in ${resendSeconds}s`
                  : 'Resend code'
              }
              variant="ghost"
              onPress={() => handleSendOtp(true)}
              disabled={
                loading || resendSeconds > 0 || verifyBlockedSeconds > 0
              }
            />
          ) : null}
          <Button
            title={
              step === 'phone' && resendSeconds > 0
                ? `Try again in ${resendSeconds}s`
                : step === 'phone'
                ? 'Continue'
                : 'Verify & sign in'
            }
            onPress={step === 'phone' ? () => handleSendOtp() : handleVerifyOtp}
            loading={loading}
            disabled={
              step === 'phone'
                ? !validPhone || resendSeconds > 0 || loading
                : !/^\d{6}$/.test(otp) ||
                  !challenge ||
                  expired ||
                  verifyBlockedSeconds > 0 ||
                  loading
            }
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthLoadingScreen() {
  const theme = useTheme();
  return (
    <View
      style={[styles.loadingRoot, { backgroundColor: theme.colors.background }]}
    >
      <BrandLogo height={64} />
      <ActivityIndicator
        size="large"
        color={theme.colors.primary}
        style={styles.loadingSpinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
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
