import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Product,
  ProductListResponse,
  Order,
  OrderListResponse,
  CreateOrderRequest,
  CancelOrderRequest,
} from '@anticlock/contracts';
import { apiRequest } from './client';

export function useProductsQuery(categoryId?: string) {
  return useQuery({
    queryKey: ['products', categoryId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryId) params.set('categoryId', categoryId);

      const response = await apiRequest<ProductListResponse>(
        `/v1/shop/products?${params.toString()}`,
      );
      return response;
    },
  });
}

export function useProductQuery(productId: string) {
  return useQuery({
    queryKey: ['products', productId],
    queryFn: async () => {
      const response = await apiRequest<{ product: Product }>(
        `/v1/shop/products/${productId}`,
      );
      return response.product;
    },
    enabled: !!productId,
  });
}

export function useOrdersQuery(status?: string) {
  return useQuery({
    queryKey: ['orders', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);

      const response = await apiRequest<OrderListResponse>(
        `/v1/shop/orders?${params.toString()}`,
      );
      return response;
    },
  });
}

export function useOrderQuery(orderId: string) {
  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: async () => {
      const response = await apiRequest<{ order: Order }>(
        `/v1/shop/orders/${orderId}`,
      );
      return response.order;
    },
    enabled: !!orderId,
  });
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateOrderRequest) => {
      const response = await apiRequest<{ order: Order }>('/v1/shop/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      return response.order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useCancelOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason?: string;
    }) => {
      const request: CancelOrderRequest = { reason };
      const response = await apiRequest<{ order: Order }>(
        `/v1/shop/orders/${orderId}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        },
      );
      return response.order;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', variables.orderId] });
    },
  });
}
