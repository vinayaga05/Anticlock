import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';
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

  const primaryDisabled =
    step === 'phone'
      ? !validPhone || resendSeconds > 0 || loading
      : !/^\d{6}$/.test(otp) ||
        !challenge ||
        expired ||
        verifyBlockedSeconds > 0 ||
        loading;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.header}>
          {step === 'otp' ? (
            <Pressable
              style={styles.back}
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Change number"
            >
              <Text style={styles.backArrow}>‹</Text>
            </Pressable>
          ) : null}
          <Image
            source={require('@/shared/assets/brand/knock-icon.png')}
            style={styles.brandIcon}
            accessibilityLabel="Knock app icon"
          />
          <Text style={styles.brand}>knock</Text>
        </View>

        {step === 'phone' ? (
          <>
            <View style={styles.art} accessible={false}>
              <View style={styles.artGlow} />
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 340 210"
                style={StyleSheet.absoluteFill}
              >
                <Defs>
                  <LinearGradient id="orbit" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#a6b8ff" />
                    <Stop offset="0.5" stopColor="#2458ff" />
                    <Stop offset="1" stopColor="#183be0" />
                  </LinearGradient>
                </Defs>
                <Ellipse
                  cx="170"
                  cy="105"
                  rx="146"
                  ry="48"
                  fill="none"
                  stroke="url(#orbit)"
                  strokeWidth="17"
                  transform="rotate(-23 170 105)"
                />
              </Svg>
              <Image
                source={require('@/shared/assets/categories/tours-marathon.png')}
                style={[styles.portrait, styles.portraitLeft]}
              />
              <Image
                source={require('@/shared/assets/categories/fitness-personal-trainer.png')}
                style={[styles.portrait, styles.portraitRight]}
              />
              <Image
                source={require('@/shared/assets/categories/wellness-life-coach.png')}
                style={[styles.portrait, styles.portraitBottom]}
              />
              <Text style={[styles.sparkle, styles.sparkleLeft]}>✦</Text>
              <Text style={[styles.sparkle, styles.sparkleRight]}>✦</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>
                Your world<Text style={styles.pink}>.</Text>
                {'\n'}A little closer<Text style={styles.pink}>.</Text>
              </Text>
              <Text style={styles.subtitle}>
                People, services & moments around you.
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Let’s get started</Text>
              <Text style={styles.label}>Mobile number</Text>
              <View style={styles.inputRow}>
                <Text style={styles.flag}>🇮🇳</Text>
                <Text style={styles.prefix}>+91</Text>
                <View style={styles.divider} />
                <TextInput
                  value={phone}
                  onChangeText={handlePhoneChange}
                  accessibilityLabel="Mobile number"
                  keyboardType="phone-pad"
                  maxLength={18}
                  placeholder="Enter mobile number"
                  placeholderTextColor="#88879a"
                  style={styles.input}
                />
              </View>
              {error ? (
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {error}
                </Text>
              ) : null}
              <Button
                title={
                  resendSeconds > 0
                    ? `Try again in ${resendSeconds}s`
                    : 'Get OTP'
                }
                onPress={() => handleSendOtp()}
                loading={loading}
                disabled={primaryDisabled}
                style={styles.primaryButton}
              />
              <Text style={styles.secure}>♙ Secure, password-free login</Text>
            </View>
          </>
        ) : (
          <View style={styles.otpContent}>
            <View style={styles.otpArt} accessible={false}>
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 300 140"
                style={StyleSheet.absoluteFill}
              >
                <Defs>
                  <LinearGradient id="otpOrbit" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#a6b8ff" />
                    <Stop offset="0.55" stopColor="#265cff" />
                    <Stop offset="1" stopColor="#c3aaff" />
                  </LinearGradient>
                </Defs>
                <Ellipse
                  cx="150"
                  cy="70"
                  rx="125"
                  ry="34"
                  fill="none"
                  stroke="url(#otpOrbit)"
                  strokeWidth="15"
                  transform="rotate(-20 150 70)"
                />
              </Svg>
              <View style={styles.messageBubble}>
                <Text style={styles.messageDots}>● ● ● ● ●</Text>
                <Text style={styles.check}>✓</Text>
              </View>
            </View>
            <Text style={styles.otpTitle}>You’re almost in</Text>
            <Text style={styles.otpSubtitle}>
              Enter the 6-digit code sent to
            </Text>
            <Text style={styles.destination}>
              {otpDestination(destination)}
            </Text>
            <View style={styles.otpBoxes}>
              {Array.from({ length: 6 }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    index === otp.length && styles.otpBoxActive,
                  ]}
                >
                  <Text style={styles.otpDigit}>{otp[index] ?? ''}</Text>
                </View>
              ))}
              <TextInput
                value={otp}
                onChangeText={value =>
                  setOtp(value.replace(/\D/g, '').slice(0, 6))
                }
                accessibilityLabel="One-time code"
                editable={!loading}
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                autoComplete={
                  Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'
                }
                style={styles.otpOverlay}
                autoFocus
              />
            </View>
            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {challenge ? (
              <Text accessibilityLiveRegion="polite" style={styles.expiry}>
                {expired
                  ? 'This code has expired. Request a new code.'
                  : `Code expires in ${Math.floor(
                      expiresSeconds / 60,
                    )}:${String(expiresSeconds % 60).padStart(2, '0')}`}
              </Text>
            ) : null}
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
            <Button
              title="Verify & continue"
              onPress={handleVerifyOtp}
              loading={loading}
              disabled={primaryDisabled}
              style={styles.primaryButton}
            />
            <Text style={styles.wrongNumber}>
              Wrong number?{' '}
              <Text
                style={styles.link}
                onPress={handleBack}
                accessibilityRole="button"
              >
                Edit number
              </Text>
            </Text>
          </View>
        )}
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
      <Image
        source={require('@/shared/assets/brand/knock-icon.png')}
        style={styles.loadingIcon}
        accessibilityLabel="Knock app icon"
      />
      <ActivityIndicator
        size="large"
        color={theme.colors.primary}
        style={styles.loadingSpinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fcf2ef' },
  content: { flexGrow: 1 },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  back: {
    position: 'absolute',
    left: 20,
    zIndex: 1,
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  backArrow: { fontSize: 40, lineHeight: 44, color: '#0b0d3c' },
  brandIcon: { width: 42, height: 42, borderRadius: 11 },
  brand: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1.5,
    color: '#0b0d3c',
  },
  art: { height: 218, marginHorizontal: 20, marginTop: 8 },
  artGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#e9dfff',
    right: 12,
    top: 8,
  },
  portrait: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#e1e9fa',
  },
  portraitLeft: { left: 4, top: 18 },
  portraitRight: { right: 2, top: 12 },
  portraitBottom: { left: '37%', bottom: 1 },
  sparkle: { position: 'absolute', fontSize: 24, color: '#ff7781' },
  sparkleLeft: { left: 20, bottom: 32 },
  sparkleRight: { right: '40%', top: 2 },
  heroCopy: { paddingHorizontal: 24, marginBottom: 18 },
  heroTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: '#0b0d3c',
  },
  pink: { color: '#f52382' },
  subtitle: { color: '#333352', fontSize: 15, marginTop: 6 },
  card: {
    backgroundColor: '#fffaf8',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    flexGrow: 1,
    gap: 12,
  },
  cardTitle: {
    color: '#0b0d3c',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 2,
  },
  label: { color: '#34334f', fontWeight: '600', fontSize: 14 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c9c8d5',
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 52,
    gap: 8,
  },
  flag: { fontSize: 20 },
  prefix: { fontWeight: '700', color: '#11143f', fontSize: 16 },
  divider: {
    height: 25,
    width: 1,
    backgroundColor: '#c9c8d5',
    marginHorizontal: 3,
  },
  input: { flex: 1, color: '#0b0d3c', fontSize: 16, paddingVertical: 10 },
  primaryButton: { backgroundColor: '#063eea', borderRadius: 28, marginTop: 8 },
  secure: { color: '#48465e', textAlign: 'center', fontSize: 13, marginTop: 6 },
  error: { color: '#d33449', fontSize: 14, textAlign: 'center' },
  otpContent: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'stretch' },
  otpArt: {
    height: 145,
    marginHorizontal: 14,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    backgroundColor: '#fffafa',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 5,
  },
  messageDots: { color: '#5d7eff', fontSize: 15 },
  check: {
    position: 'absolute',
    right: -14,
    top: -12,
    backgroundColor: '#f2328e',
    color: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    fontSize: 18,
    fontWeight: '900',
    width: 30,
    height: 30,
    textAlign: 'center',
  },
  otpTitle: {
    color: '#0b0d3c',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 32,
    letterSpacing: -1,
    marginTop: 8,
  },
  otpSubtitle: {
    textAlign: 'center',
    color: '#34334f',
    fontSize: 15,
    marginTop: 5,
  },
  destination: {
    textAlign: 'center',
    color: '#10123e',
    fontWeight: '700',
    fontSize: 16,
    marginTop: 3,
  },
  otpBoxes: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 24,
    position: 'relative',
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8d4d8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffaf8',
  },
  otpBoxActive: { borderColor: '#1249ff', borderWidth: 2 },
  otpDigit: { fontSize: 23, fontWeight: '700', color: '#10123e' },
  otpOverlay: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    opacity: 0.02,
  },
  expiry: {
    textAlign: 'center',
    color: '#67647b',
    marginTop: 12,
    fontSize: 12,
  },
  wrongNumber: { textAlign: 'center', color: '#48465e', marginTop: 18 },
  link: { color: '#073eeb', fontWeight: '700' },
  loadingIcon: { width: 64, height: 64, borderRadius: 14 },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  loadingSpinner: { marginTop: 8 },
});
