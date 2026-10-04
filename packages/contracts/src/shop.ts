import { z } from 'zod';
import { ContentStatusSchema } from './rbac.js';

export const ProductCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
  status: ContentStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

export const ProductImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  alt: z.string().optional(),
  sortOrder: z.number().int().default(0),
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().nullable(),
  inventory: z.number().int().nonnegative(),
  images: z.array(ProductImageSchema),
  status: ContentStatusSchema,
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Product = z.infer<typeof ProductSchema>;

export const CreateProductRequestSchema = z.object({
  categoryId: z.string().uuid(),
  slug: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().nullable().optional(),
  inventory: z.number().int().nonnegative(),
  imageIds: z.array(z.string().uuid()).optional(),
  status: ContentStatusSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

export const UpdateProductRequestSchema = z.object({
  categoryId: z.string().uuid().optional(),
  slug: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  price: z.number().int().positive().optional(),
  compareAtPrice: z.number().int().positive().nullable().optional(),
  inventory: z.number().int().nonnegative().optional(),
  imageIds: z.array(z.string().uuid()).optional(),
  status: ContentStatusSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;

export const ProductListQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  status: ContentStatusSchema.optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

export const ProductListResponseSchema = z.object({
  products: z.array(ProductSchema),
  nextCursor: z.string().nullable(),
});
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;

export const OrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const PaymentStatusSchema = z.enum([
  'pending',
  'paid',
  'refunded',
  'failed',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  productSlug: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const ShippingAddressSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(10).max(20),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(100).default('India'),
});
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  mobileUserId: z.string().uuid(),
  items: z.array(OrderItemSchema),
  subtotal: z.number().int().nonnegative(),
  shipping: z.number().int().nonnegative(),
  tax: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  shippingAddress: ShippingAddressSchema,
  status: OrderStatusSchema,
  paymentStatus: PaymentStatusSchema,
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});
export type Order = z.infer<typeof OrderSchema>;

export const CartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CreateOrderRequestSchema = z.object({
  items: z.array(CartItemSchema).min(1),
  shippingAddress: ShippingAddressSchema,
  metadata: z.record(z.unknown()).optional(),
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export const UpdateOrderRequestSchema = z.object({
  status: OrderStatusSchema.optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateOrderRequest = z.infer<typeof UpdateOrderRequestSchema>;

export const CancelOrderRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type CancelOrderRequest = z.infer<typeof CancelOrderRequestSchema>;

export const OrderListQuerySchema = z.object({
  status: OrderStatusSchema.optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;

export const OrderListResponseSchema = z.object({
  orders: z.array(OrderSchema),
  nextCursor: z.string().nullable(),
});
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;

export const OrderAdminListItemSchema = OrderSchema.extend({
  userName: z.string(),
  userPhone: z.string(),
});
export type OrderAdminListItem = z.infer<typeof OrderAdminListItemSchema>;

export const OrderAdminQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  status: OrderStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type OrderAdminQuery = z.infer<typeof OrderAdminQuerySchema>;
