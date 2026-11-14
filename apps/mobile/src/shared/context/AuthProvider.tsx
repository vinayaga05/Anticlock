import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  clearSession,
  logoutRemote,
  persistSession,
  readStoredSession,
  sendOtp,
  validateSession,
  verifyOtp,
  updateProfile as persistProfile,
} from '@/shared/services/auth/authService';
import type { MobileUser, OtpSendResult, ProfileUpdate, OtpRequestOptions } from '@/shared/services/auth/types';
import { setUnauthorizedHandler } from '@/shared/api/client';
import { ensureUserAvatar } from '@/shared/services/auth/avatar';

type AuthState = {
  user: MobileUser | null;
  loading: boolean;
  requestOtp: (phone: string, options?: OtpRequestOptions) => Promise<OtpSendResult>;
  loginWithOtp: (
    phone: string,
    code: string,
    requestId: string,
    options?: OtpRequestOptions,
  ) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  updateProfile: (input: ProfileUpdate) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const authGeneration = useRef(0);

  const logout = useCallback(async () => {
    authGeneration.current += 1;
    // Capture/send the current token before clearing local state immediately.
    const revocation = logoutRemote();
    clearSession();
    setUser(null);
    await revocation;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      authGeneration.current += 1;
      clearSession();
      setUser(null);
      setLoading(false);
    });
    return () => {
      authGeneration.current += 1;
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const generation = authGeneration.current;
      const session = readStoredSession();
      if (!session) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const validated = await validateSession(session);
      if (cancelled) return;
      if (generation !== authGeneration.current || readStoredSession()?.token !== session.token) {
        setLoading(false);
        return;
      }

      if (validated) {
        persistSession({ ...session, user: validated });
        setUser(validated);
      } else {
        clearSession();
        setUser(null);
      }
      setLoading(false);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestOtp = useCallback(async (phone: string, options?: OtpRequestOptions) => sendOtp(phone, options), []);

  const continueAsGuest = useCallback(() => {
    authGeneration.current += 1;
    // Intentionally in-memory only: this is a temporary way to preview the app
    // and guests return to sign-in after the app restarts.
    setUser(
      ensureUserAvatar({
        id: 'temporary-guest',
        phone: '',
        displayName: 'Guest',
      }),
    );
  }, []);

  const loginWithOtp = useCallback(
    async (phone: string, code: string, requestId: string, options?: OtpRequestOptions) => {
      const generation = ++authGeneration.current;
      const isCurrentAttempt = () => generation === authGeneration.current && options?.isCurrentAttempt?.() !== false;
      const session = await verifyOtp(phone, code, requestId, { ...options, isCurrentAttempt });
      if (!isCurrentAttempt() || options?.signal?.aborted || readStoredSession()?.token !== session.token) {
        throw new Error('This sign-in attempt is no longer active.');
      }
      setUser(session.user);
    },
    [],
  );

  const updateProfile = useCallback(async (input: ProfileUpdate) => {
    const expectedSession = readStoredSession();
    if (!expectedSession) throw new Error('Please sign in to edit your profile.');
    const updatedUser = await persistProfile(input);
    const currentSession = readStoredSession();
    if (
      !currentSession ||
      currentSession.user.id !== expectedSession.user.id ||
      currentSession.token !== expectedSession.token
    ) {
      throw new Error('Your account changed. Reopen Edit profile to try again.');
    }
    setUser(current => current?.id === expectedSession.user.id ? updatedUser : current);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      requestOtp,
      loginWithOtp,
      continueAsGuest,
      logout,
      updateProfile,
    }),
    [user, loading, requestOtp, loginWithOtp, continueAsGuest, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
