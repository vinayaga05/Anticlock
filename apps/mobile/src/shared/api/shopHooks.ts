import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Product,
  ProductWithImages,
  Order,
  CreateOrderRequest,
} from '@anticlock/contracts';
import { apiRequest } from './client';
import { isApiEnabled } from './config';
import { readStoredSession } from '@/shared/services/auth/authService';

function ensureAuthToken() {
  const session = readStoredSession();
  if (!session?.token) {
    throw new Error('Not authenticated');
  }
}

export function useProductsQuery(categoryId?: string) {
  return useQuery({
    queryKey: ['shop', 'products', categoryId ?? 'all', isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return { products: [], nextCursor: null };
      }
      await ensureAuthToken();
      const qs = categoryId ? `?categoryId=${categoryId}&status=published` : '?status=published';
      const res = await apiRequest<{ products: Product[]; nextCursor: string | null }>(
        `/v1/shop/products${qs}`,
      );
      return res;
    },
    staleTime: isApiEnabled ? 60_000 : Infinity,
  });
}

export function useProductQuery(productId: string) {
  return useQuery({
    queryKey: ['shop', 'products', productId, isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return null;
      }
      await ensureAuthToken();
      const res = await apiRequest<{ product: ProductWithImages }>(
        `/v1/shop/products/${productId}`,
      );
      return res.product;
    },
    staleTime: isApiEnabled ? 60_000 : Infinity,
  });
}

export function useOrdersQuery(status?: 'pending' | 'delivered' | 'cancelled') {
  return useQuery({
    queryKey: ['shop', 'orders', status ?? 'all', isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return { orders: [], nextCursor: null };
      }
      await ensureAuthToken();
      const qs = status ? `?status=${status}` : '';
      const res = await apiRequest<{ orders: Order[]; nextCursor: string | null }>(
        `/v1/shop/orders${qs}`,
      );
      return res;
    },
    staleTime: isApiEnabled ? 30_000 : Infinity,
  });
}

export function useOrderQuery(orderId: string) {
  return useQuery({
    queryKey: ['shop', 'orders', orderId, isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return null;
      }
      await ensureAuthToken();
      const res = await apiRequest<{ order: Order }>(`/v1/shop/orders/${orderId}`);
      return res.order;
    },
    staleTime: isApiEnabled ? 30_000 : Infinity,
  });
}

export function useCreateOrderMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateOrderRequest) => {
      if (!isApiEnabled) {
        throw new Error('API not enabled');
      }
      await ensureAuthToken();
      const res = await apiRequest<{ order: Order }>('/v1/shop/orders', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      return res.order;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop', 'orders'] });
    },
  });
}

export function useCancelOrderMutation(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!isApiEnabled) {
        throw new Error('API not enabled');
      }
      await ensureAuthToken();
      const res = await apiRequest<{ order: Order }>(
        `/v1/shop/orders/${orderId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      return res.order;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop', 'orders'] });
      qc.invalidateQueries({ queryKey: ['shop', 'orders', orderId] });
    },
  });
}
