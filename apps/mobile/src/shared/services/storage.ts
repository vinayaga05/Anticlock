import { createMMKV } from 'react-native-mmkv';
import { STORAGE_KEYS } from '@/shared/constants';
import { ThemeMode } from '@/shared/types';
import type { AuthSession } from '@/shared/services/auth/types';

export const storage = createMMKV({
  id: 'anticlock-storage',
});

export function getStoredThemeMode(): ThemeMode {
  const value = storage.getString(STORAGE_KEYS.THEME_MODE);
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'light';
}

export function setStoredThemeMode(mode: ThemeMode): void {
  storage.set(STORAGE_KEYS.THEME_MODE, mode);
}

export function getStoredCartCount(): number {
  return storage.getNumber(STORAGE_KEYS.CART_COUNT) ?? 0;
}

export function setStoredCartCount(count: number): void {
  storage.set(STORAGE_KEYS.CART_COUNT, count);
}

export function getStoredSession(): AuthSession | null {
  const raw = storage.getString(STORAGE_KEYS.AUTH_SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession): void {
  storage.set(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
}

export function clearStoredSession(): void {
  storage.remove(STORAGE_KEYS.AUTH_SESSION);
}
