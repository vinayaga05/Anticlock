import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Product,
  ProductListResponse,
  Order,
  OrderListResponse,
  CreateOrderRequest,
  CancelOrderRequest,
  CreateUserProductRequest,
  ProductCategory,
  UpdateUserProductRequest,
} from '@anticlock/contracts';
import { apiRequest } from './client';
import type { PublisherProfileType } from '@/shared/publishing/publisherSelection';

type Viewer = { id: string; type: PublisherProfileType } | undefined;

export function useProductsQuery(categoryId?: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['products', categoryId],
    enabled: options.enabled !== false,
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

export function useExploreProductsQuery(options: {
  categoryId?: string;
  search?: string;
  following?: boolean;
  maxPrice?: number;
  viewer?: Viewer;
} = {}) {
  return useQuery({
    queryKey: ['products', 'explore', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.categoryId) params.set('categoryId', options.categoryId);
      if (options.search) params.set('search', options.search);
      if (options.following) params.set('following', 'true');
      if (options.maxPrice != null) params.set('maxPrice', String(options.maxPrice));
      if (options.viewer) {
        params.set('viewerProfileId', options.viewer.id);
        params.set('viewerProfileType', options.viewer.type);
      }
      params.set('limit', '50');
      return apiRequest<ProductListResponse>(`/v1/shop/products/explore?${params}`);
    },
  });
}

export function useProductCategoriesQuery(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['products', 'categories'],
    enabled: options.enabled !== false,
    queryFn: async () => {
      const response = await apiRequest<{ categories: ProductCategory[] }>('/v1/shop/categories');
      return response.categories;
    },
  });
}

export function useMyProductsQuery() {
  return useQuery({
    queryKey: ['products', 'mine'],
    queryFn: async () => apiRequest<ProductListResponse>('/v1/shop/products/mine'),
  });
}

export function useSavedProductsQuery(viewer?: Viewer) {
  return useQuery({
    queryKey: ['products', 'saved', viewer],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (viewer) {
        params.set('viewerProfileId', viewer.id);
        params.set('viewerProfileType', viewer.type);
      }
      return apiRequest<ProductListResponse>(
        `/v1/shop/products/saved${params.toString() ? `?${params}` : ''}`,
      );
    },
  });
}

export function useCreateUserProductMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateUserProductRequest) => {
      const response = await apiRequest<{ product: Product }>('/v1/shop/products', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      return response.product;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateUserProductMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, update }: { id: string; update: UpdateUserProductRequest }) => {
      const response = await apiRequest<{ product: Product }>(`/v1/shop/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      });
      return response.product;
    },
    onSuccess: product => {
      client.setQueryData(['products', product.id], product);
      client.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useSubmitUserProductMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest<{ product: Product }>(`/v1/shop/products/${id}/submit`, {
        method: 'POST',
      });
      return response.product;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useProductQuery(productId: string, viewer?: Viewer) {
  return useQuery({
    queryKey: ['products', productId, viewer],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (viewer) {
        params.set('viewerProfileId', viewer.id);
        params.set('viewerProfileType', viewer.type);
      }
      const response = await apiRequest<{ product: Product }>(
        `/v1/shop/products/${productId}${params.toString() ? `?${params}` : ''}`,
      );
      return response.product;
    },
    enabled: !!productId,
  });
}

export function useManageUserProductMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'archive' | 'delete' }) => {
      if (action === 'archive') {
        const response = await apiRequest<{ product: Product }>(`/v1/shop/products/${id}/archive`, { method: 'POST' });
        return response.product;
      }
      await apiRequest<{ success: true }>(`/v1/shop/products/${id}`, { method: 'DELETE' });
      return null;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useSaveProductMutation(id: string, viewer?: Viewer) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (saved: boolean) => {
      const params = new URLSearchParams();
      if (viewer) {
        params.set('viewerProfileId', viewer.id);
        params.set('viewerProfileType', viewer.type);
      }
      const response = await apiRequest<{ product: Product }>(
        `/v1/shop/products/${id}/save${params.toString() ? `?${params}` : ''}`,
        { method: saved ? 'DELETE' : 'POST' },
      );
      return response.product;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['products', id] });
      client.invalidateQueries({ queryKey: ['products', 'explore'] });
      client.invalidateQueries({ queryKey: ['products', 'saved'] });
    },
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
