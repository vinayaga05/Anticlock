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

export interface StoredCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

const CART_ITEMS_KEY = 'cart_items_v1';

export function getStoredCartItems(): StoredCartItem[] {
  // A legacy count alone cannot reconstruct checkout lines. Never display a
  // phantom badge for those stale pre-migration carts.
  storage.remove(STORAGE_KEYS.CART_COUNT);
  const raw = storage.getString(CART_ITEMS_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const ids = new Set<string>();
    return value.filter((item): item is StoredCartItem => {
      if (!item || typeof item !== 'object' || typeof item.productId !== 'string' ||
          !item.productId.trim() || typeof item.name !== 'string' || !item.name.trim() ||
          !Number.isFinite(item.price) || item.price < 0 ||
          !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
          (item.imageUrl !== undefined && typeof item.imageUrl !== 'string') || ids.has(item.productId)) return false;
      ids.add(item.productId);
      return true;
    });
  } catch {
    return [];
  }
}

export function setStoredCartItems(items: StoredCartItem[]): void {
  storage.set(CART_ITEMS_KEY, JSON.stringify(items));
  storage.remove(STORAGE_KEYS.CART_COUNT);
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
