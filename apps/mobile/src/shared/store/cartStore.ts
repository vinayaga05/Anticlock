import { create } from 'zustand';
import {
  getStoredCartCount,
  setStoredCartCount,
} from '@/shared/services/storage';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface CartState {
  count: number;
  items: CartItem[];
  add: (n?: number) => void;
  addProduct: (
    productId: string,
    name: string,
    price: number,
    imageUrl?: string,
  ) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  count: getStoredCartCount(),
  items: [],
  add: (n = 1) =>
    set(state => {
      const next = state.count + n;
      setStoredCartCount(next);
      return { count: next };
    }),
  addProduct: (productId, name, price, imageUrl) =>
    set(state => {
      const existing = state.items.find(item => item.productId === productId);
      let newItems: CartItem[];

      if (existing) {
        newItems = state.items.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      } else {
        newItems = [
          ...state.items,
          { productId, name, price, quantity: 1, imageUrl },
        ];
      }

      const totalCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      setStoredCartCount(totalCount);

      return { items: newItems, count: totalCount };
    }),
  updateQuantity: (productId, quantity) =>
    set(state => {
      const newItems =
        quantity > 0
          ? state.items.map(item =>
              item.productId === productId ? { ...item, quantity } : item,
            )
          : state.items.filter(item => item.productId !== productId);

      const totalCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      setStoredCartCount(totalCount);

      return { items: newItems, count: totalCount };
    }),
  removeItem: productId =>
    set(state => {
      const newItems = state.items.filter(item => item.productId !== productId);
      const totalCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
      setStoredCartCount(totalCount);

      return { items: newItems, count: totalCount };
    }),
  clear: () => {
    setStoredCartCount(0);
    set({ count: 0, items: [] });
  },
  getTotal: () => {
    return get().items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  },
}));
