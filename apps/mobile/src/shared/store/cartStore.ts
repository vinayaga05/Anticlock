import { create } from 'zustand';
import {
  getStoredCartItems,
  setStoredCartItems,
  type StoredCartItem,
} from '@/shared/services/storage';

export type CartItem = StoredCartItem;

interface CartState {
  count: number;
  items: CartItem[];
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

const initialItems = getStoredCartItems();
const itemCount = (items: CartItem[]) => items.reduce((sum, item) => sum + item.quantity, 0);
function saveCart(items: CartItem[]) {
  setStoredCartItems(items);
  return { items, count: itemCount(items) };
}

export const useCartStore = create<CartState>((set, get) => ({
  count: itemCount(initialItems),
  items: initialItems,
  addProduct: (productId, name, price, imageUrl) =>
    set(state => {
      if (!productId.trim() || !name.trim() || !Number.isFinite(price) || price < 0) return state;
      const existing = state.items.find(item => item.productId === productId);
      if (existing && !Number.isSafeInteger(existing.quantity + 1)) return state;
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

      return saveCart(newItems);
    }),
  updateQuantity: (productId, quantity) =>
    set(state => {
      if (!Number.isSafeInteger(quantity)) return state;
      const newItems =
        quantity > 0
          ? state.items.map(item =>
              item.productId === productId ? { ...item, quantity } : item,
            )
          : state.items.filter(item => item.productId !== productId);

      return saveCart(newItems);
    }),
  removeItem: productId =>
    set(state => {
      const newItems = state.items.filter(item => item.productId !== productId);
      return saveCart(newItems);
    }),
  clear: () => {
    set(saveCart([]));
  },
  getTotal: () => {
    return get().items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  },
}));
