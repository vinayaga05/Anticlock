import { z } from 'zod';
<<<<<<< HEAD

export const ProductStatusSchema = z.enum(['draft', 'published', 'archived']);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const ProductCategorySchema = z.object({
  id: z.string(),
=======
import { ContentStatusSchema } from './rbac.js';

export const ProductCategorySchema = z.object({
  id: z.string().uuid(),
>>>>>>> origin/main
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
<<<<<<< HEAD
  status: ProductStatusSchema,
=======
  status: ContentStatusSchema,
>>>>>>> origin/main
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

<<<<<<< HEAD
export const ProductSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().nullable(),
  inventory: z.number().int().nonnegative().nullable(),
  status: ProductStatusSchema,
  imageIds: z.array(z.string().uuid()),
=======
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
>>>>>>> origin/main
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Product = z.infer<typeof ProductSchema>;

export const CreateProductRequestSchema = z.object({
<<<<<<< HEAD
  categoryId: z.string().nullable().optional(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().max(5000),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().nullable().optional(),
  inventory: z.number().int().nonnegative().nullable().optional(),
  status: ProductStatusSchema.optional(),
  imageIds: z.array(z.string().uuid()).optional(),
=======
  categoryId: z.string().uuid(),
  slug: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().nullable().optional(),
  inventory: z.number().int().nonnegative(),
  imageIds: z.array(z.string().uuid()).optional(),
  status: ContentStatusSchema.optional(),
>>>>>>> origin/main
  metadata: z.record(z.unknown()).optional(),
});
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

<<<<<<< HEAD
export const UpdateProductRequestSchema = CreateProductRequestSchema.partial();
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;

export const ProductListQuerySchema = z.object({
  categoryId: z.string().optional(),
  status: ProductStatusSchema.optional(),
=======
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
>>>>>>> origin/main
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

<<<<<<< HEAD
export const ProductWithImagesSchema = ProductSchema.extend({
  images: z.array(
    z.object({
      id: z.string().uuid(),
      url: z.string().url(),
      width: z.number().int().nullable(),
      height: z.number().int().nullable(),
    })
  ),
});
export type ProductWithImages = z.infer<typeof ProductWithImagesSchema>;
=======
export const ProductListResponseSchema = z.object({
  products: z.array(ProductSchema),
  nextCursor: z.string().nullable(),
});
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;
>>>>>>> origin/main

export const OrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
<<<<<<< HEAD
  'refunded',
=======
>>>>>>> origin/main
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const PaymentStatusSchema = z.enum([
  'pending',
  'paid',
<<<<<<< HEAD
  'failed',
  'refunded',
=======
  'refunded',
  'failed',
>>>>>>> origin/main
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  productSlug: z.string(),
  quantity: z.number().int().positive(),
<<<<<<< HEAD
  unitPrice: z.number().int().nonnegative(),
  totalPrice: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullable(),
=======
  price: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
>>>>>>> origin/main
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const ShippingAddressSchema = z.object({
<<<<<<< HEAD
  name: z.string().min(1),
  phone: z.string().min(8),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(4).max(10),
  country: z.string().default('IN'),
=======
  fullName: z.string().min(1).max(200),
  phone: z.string().min(10).max(20),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(100).default('India'),
>>>>>>> origin/main
});
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  mobileUserId: z.string().uuid(),
<<<<<<< HEAD
  status: OrderStatusSchema,
  paymentStatus: PaymentStatusSchema,
  items: z.array(OrderItemSchema),
  subtotal: z.number().int().nonnegative(),
  shippingCost: z.number().int().nonnegative(),
  tax: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  shippingAddress: ShippingAddressSchema,
  notes: z.string().optional(),
=======
  items: z.array(OrderItemSchema),
  subtotal: z.number().int().nonnegative(),
  shipping: z.number().int().nonnegative(),
  tax: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  shippingAddress: ShippingAddressSchema,
  status: OrderStatusSchema,
  paymentStatus: PaymentStatusSchema,
>>>>>>> origin/main
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
<<<<<<< HEAD
  deliveredAt: z.string().datetime().nullable(),
=======
  completedAt: z.string().datetime().nullable(),
>>>>>>> origin/main
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
<<<<<<< HEAD
  notes: z.string().max(500).optional(),
=======
  metadata: z.record(z.unknown()).optional(),
>>>>>>> origin/main
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export const UpdateOrderRequestSchema = z.object({
  status: OrderStatusSchema.optional(),
  paymentStatus: PaymentStatusSchema.optional(),
<<<<<<< HEAD
  notes: z.string().max(500).optional(),
=======
>>>>>>> origin/main
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateOrderRequest = z.infer<typeof UpdateOrderRequestSchema>;

<<<<<<< HEAD
=======
export const CancelOrderRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type CancelOrderRequest = z.infer<typeof CancelOrderRequestSchema>;

>>>>>>> origin/main
export const OrderListQuerySchema = z.object({
  status: OrderStatusSchema.optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;

<<<<<<< HEAD
=======
export const OrderListResponseSchema = z.object({
  orders: z.array(OrderSchema),
  nextCursor: z.string().nullable(),
});
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;

>>>>>>> origin/main
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
<<<<<<< HEAD
  search: z.string().optional(),
=======
>>>>>>> origin/main
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type OrderAdminQuery = z.infer<typeof OrderAdminQuerySchema>;
