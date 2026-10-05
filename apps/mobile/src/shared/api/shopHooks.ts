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
import { isApiEnabled } from './config';

export function useProductsQuery(categoryId?: string) {
  return useQuery({
    queryKey: ['products', categoryId],
    queryFn: async () => {
      if (!isApiEnabled) {
        return getMockProducts(categoryId);
      }

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
      if (!isApiEnabled) {
        return getMockProduct(productId);
      }

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
      if (!isApiEnabled) {
        return getMockOrders(status);
      }

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
      if (!isApiEnabled) {
        return getMockOrder(orderId);
      }

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
      if (!isApiEnabled) {
        return createMockOrder(request);
      }

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
      if (!isApiEnabled) {
        return cancelMockOrder(orderId);
      }

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

const mockProducts: Product[] = [
  {
    id: 'mock-product-1',
    categoryId: 'mock-cat-1',
    slug: 'yoga-mat-premium',
    name: 'Premium Yoga Mat',
    description: 'High-quality non-slip yoga mat with carrying strap',
    price: 2499,
    compareAtPrice: 3499,
    inventory: 50,
    images: [],
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mock-product-2',
    categoryId: 'mock-cat-1',
    slug: 'resistance-bands-set',
    name: 'Resistance Bands Set',
    description: 'Set of 5 resistance bands with different levels',
    price: 1299,
    compareAtPrice: null,
    inventory: 100,
    images: [],
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mock-product-3',
    categoryId: 'mock-cat-2',
    slug: 'whey-protein-1kg',
    name: 'Whey Protein Isolate 1kg',
    description: 'Premium whey protein isolate, chocolate flavor',
    price: 3999,
    compareAtPrice: null,
    inventory: 30,
    images: [],
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function getMockProducts(categoryId?: string): ProductListResponse {
  const filtered = categoryId
    ? mockProducts.filter((p) => p.categoryId === categoryId)
    : mockProducts;
  return { products: filtered, nextCursor: null };
}

function getMockProduct(productId: string): Product | null {
  return mockProducts.find((p) => p.id === productId) ?? null;
}

const mockOrders: Order[] = [
  {
    id: 'mock-order-1',
    orderNumber: 'ORD-12345',
    mobileUserId: 'mock-user-1',
    items: [
      {
        productId: 'mock-product-1',
        productName: 'Premium Yoga Mat',
        productSlug: 'yoga-mat-premium',
        quantity: 1,
        price: 2499,
      },
    ],
    subtotal: 2499,
    shipping: 500,
    tax: 450,
    total: 3449,
    shippingAddress: {
      fullName: 'John Doe',
      phone: '9876543210',
      addressLine1: '123 Main St',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600001',
      country: 'India',
    },
    status: 'confirmed',
    paymentStatus: 'paid',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    cancelledAt: null,
    completedAt: null,
  },
];

function getMockOrders(status?: string): OrderListResponse {
  const filtered = status
    ? mockOrders.filter((o) => o.status === status)
    : mockOrders;
  return { orders: filtered, nextCursor: null };
}

function getMockOrder(orderId: string): Order | null {
  return mockOrders.find((o) => o.id === orderId) ?? null;
}

function createMockOrder(request: CreateOrderRequest): Order {
  const subtotal = request.items.reduce((sum, item) => sum + item.quantity * 2499, 0);
  const shipping = subtotal >= 50000 ? 0 : 500;
  const tax = Math.round(subtotal * 0.18);

  return {
    id: `mock-order-${Date.now()}`,
    orderNumber: `ORD-${Date.now()}`,
    mobileUserId: 'mock-user-1',
    items: request.items.map((item) => ({
      productId: item.productId,
      productName: 'Product Name',
      productSlug: 'product-slug',
      quantity: item.quantity,
      price: 2499,
    })),
    subtotal,
    shipping,
    tax,
    total: subtotal + shipping + tax,
    shippingAddress: request.shippingAddress,
    status: 'pending',
    paymentStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cancelledAt: null,
    completedAt: null,
  };
}

function cancelMockOrder(orderId: string): Order {
  const order = getMockOrder(orderId);
  if (!order) {
    throw new Error('Order not found');
  }
  return {
    ...order,
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  };
}
