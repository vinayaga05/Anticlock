import { z } from 'zod';
import { ContentStatusSchema } from './rbac.js';
import { PaymentStatusSchema, type PaymentStatus } from './payment.js';
import { ContentPublisherSchema, PublisherProfileTypeSchema } from './publishing.js';
import {
  ExploreReviewStatusSchema,
  ExploreVisibilitySchema,
} from './explore.js';

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
  kind: z.enum(['image', 'video']).default('image'),
  thumbnailUrl: z.string().url().nullable().optional(),
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
  ownerMobileUserId: z.string().uuid().nullable().optional(),
  publisherProfileId: z.string().uuid().nullable().optional(),
  publisherProfileType: PublisherProfileTypeSchema.nullable().optional(),
  publisher: ContentPublisherSchema.nullable().optional(),
  reviewStatus: ExploreReviewStatusSchema.default('approved'),
  requestedVisibility: ExploreVisibilitySchema.default('public'),
  reviewReason: z.string().nullable().optional(),
  reviewVersion: z.number().int().positive().default(1),
  viewerHasSaved: z.boolean().default(false),
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

const UserProductFieldsSchema = z
  .object({
    publisherProfileId: z.string().uuid().optional(),
    publisherProfileType: PublisherProfileTypeSchema.optional(),
    categoryId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10_000),
    price: z.number().int().positive(),
    compareAtPrice: z.number().int().positive().nullable().optional(),
    inventory: z.number().int().nonnegative(),
    imageIds: z.array(z.string().uuid()).min(1).max(10),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(50)).max(15).default([]),
    requestedVisibility: ExploreVisibilitySchema,
    deliveryMethods: z.array(z.enum(['shipping', 'pickup'])).min(1),
    pickupDetails: z.string().trim().max(500).nullable().optional(),
    contact: z.object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().email().optional(),
      phone: z.string().trim().min(8).max(20).optional(),
    }).strict(),
  })
  .strict();

export const CreateUserProductRequestSchema = UserProductFieldsSchema.superRefine((value, ctx) => {
    if (value.compareAtPrice != null && value.compareAtPrice < value.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['compareAtPrice'],
        message: 'Compare-at price cannot be lower than the selling price',
      });
    }
    if (value.deliveryMethods.includes('pickup') && !value.pickupDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pickupDetails'],
        message: 'Add pickup details',
      });
    }
    if (!value.contact.email && !value.contact.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contact'],
        message: 'Add an email address or phone number',
      });
    }
  });
export type CreateUserProductRequest = z.infer<
  typeof CreateUserProductRequestSchema
>;

export const UpdateUserProductRequestSchema = UserProductFieldsSchema.omit({
  publisherProfileId: true,
  publisherProfileType: true,
}).partial();
export type UpdateUserProductRequest = z.infer<
  typeof UpdateUserProductRequestSchema
>;

export const ProductListQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  status: ContentStatusSchema.optional(),
  reviewStatus: ExploreReviewStatusSchema.optional(),
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
