import { create } from 'zustand';
import {
  getStoredCartCount,
  setStoredCartCount,
} from '@/shared/services/storage';

interface CartState {
  count: number;
  add: (n?: number) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>(set => ({
  count: getStoredCartCount(),
  add: (n = 1) =>
    set(state => {
      const next = state.count + n;
      setStoredCartCount(next);
      return { count: next };
    }),
  clear: () => {
    setStoredCartCount(0);
    set({ count: 0 });
  },
}));
