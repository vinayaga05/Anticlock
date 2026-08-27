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
} from '@/shared/services/auth/authService';
import type { MobileUser, OtpSendResult } from '@/shared/services/auth/types';
import { setUnauthorizedHandler } from '@/shared/api/client';

type AuthState = {
  user: MobileUser | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<OtpSendResult>;
  loginWithOtp: (phone: string, code: string, requestId: string) => Promise<void>;
  logout: () => Promise<void>;
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

  const loginWithOtp = useCallback(
    async (phone: string, code: string, requestId: string) => {
      const session = await verifyOtp(phone, code, requestId);
      setUser(session.user);
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      requestOtp,
      loginWithOtp,
      logout,
    }),
    [user, loading, requestOtp, loginWithOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
