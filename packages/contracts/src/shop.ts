import { z } from 'zod';

export const ProductStatusSchema = z.enum(['draft', 'published', 'archived']);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const ProductCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
  status: ProductStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

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
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Product = z.infer<typeof ProductSchema>;

export const CreateProductRequestSchema = z.object({
  categoryId: z.string().nullable().optional(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().max(5000),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().nullable().optional(),
  inventory: z.number().int().nonnegative().nullable().optional(),
  status: ProductStatusSchema.optional(),
  imageIds: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

export const UpdateProductRequestSchema = CreateProductRequestSchema.partial();
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;

export const ProductListQuerySchema = z.object({
  categoryId: z.string().optional(),
  status: ProductStatusSchema.optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

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

export const OrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const PaymentStatusSchema = z.enum([
  'pending',
  'paid',
  'failed',
  'refunded',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  productSlug: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  totalPrice: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullable(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const ShippingAddressSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(4).max(10),
  country: z.string().default('IN'),
});
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  mobileUserId: z.string().uuid(),
  status: OrderStatusSchema,
  paymentStatus: PaymentStatusSchema,
  items: z.array(OrderItemSchema),
  subtotal: z.number().int().nonnegative(),
  shippingCost: z.number().int().nonnegative(),
  tax: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  shippingAddress: ShippingAddressSchema,
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
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
  notes: z.string().max(500).optional(),
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export const UpdateOrderRequestSchema = z.object({
  status: OrderStatusSchema.optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  notes: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateOrderRequest = z.infer<typeof UpdateOrderRequestSchema>;

export const OrderListQuerySchema = z.object({
  status: OrderStatusSchema.optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;

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
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
});
export type OrderAdminQuery = z.infer<typeof OrderAdminQuerySchema>;
