import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import type { MobileUser, OtpSendResult, ProfileUpdate } from '@/shared/services/auth/types';
import { setUnauthorizedHandler } from '@/shared/api/client';
import { ensureUserAvatar } from '@/shared/services/auth/avatar';

type AuthState = {
  user: MobileUser | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<OtpSendResult>;
  loginWithOtp: (
    phone: string,
    code: string,
    requestId: string,
  ) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  updateProfile: (input: ProfileUpdate) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await logoutRemote();
    clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const session = readStoredSession();
      if (!session) {
        if (!cancelled) setLoading(false);
        return;
      }

      const validated = await validateSession(session);
      if (cancelled) return;

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

  const requestOtp = useCallback(async (phone: string) => sendOtp(phone), []);

  const continueAsGuest = useCallback(() => {
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
    async (phone: string, code: string, requestId: string) => {
      const session = await verifyOtp(phone, code, requestId);
      setUser(session.user);
    },
    [],
  );

  const updateProfile = useCallback(async (input: ProfileUpdate) => {
    const updatedUser = await persistProfile(input);
    setUser(updatedUser);
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
