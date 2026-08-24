// Urvi Studios — database schema (Drizzle ORM, Postgres dialect).
//
// Runs against Netlify's auto-provisioned Postgres in production, and a
// local Postgres instance in dev (see src/db/index.ts for how the
// connection is chosen).

import { pgTable, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () => timestamp("created_at").notNull().defaultNow();

// ---------------------------------------------------------------- Identity

export const customers = pgTable("customers", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  createdAt: createdAt(),
});

export const addresses = pgTable("addresses", {
  id: id(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Home"),
  line1: text("line1").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  phone: text("phone").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
});

export const adminUsers = pgTable("admin_users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("owner"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- Catalog

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  parent: text("parent"), // "Everyday" | "Office" | "Occasion"
  position: integer("position").notNull().default(0),
});

export const products = pgTable("products", {
  id: id(),
  sku: text("sku").notNull().unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  fabric: text("fabric").notNull(),
  price: integer("price").notNull(), // rupees
  compareAtPrice: integer("compare_at_price"),
  badge: text("badge"),
  stock: integer("stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  categoryId: text("category_id").notNull().references(() => categories.id),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productImages = pgTable("product_images", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
});

export const productSizes = pgTable("product_sizes", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  position: integer("position").notNull().default(0),
});

export const productColors = pgTable("product_colors", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  hex: text("hex").notNull(),
  position: integer("position").notNull().default(0),
});

// ---------------------------------------------------------------- Orders

export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

export const orders = pgTable("orders", {
  id: id(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: text("customer_id").references(() => customers.id),

  status: text("status").notNull().default("PLACED"),
  paymentStatus: text("payment_status").notNull().default("PENDING"),
  paymentMethod: text("payment_method").notNull(), // "razorpay" | "whatsapp_cod"
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),

  subtotal: integer("subtotal").notNull(),
  shipping: integer("shipping").notNull(),
  discount: integer("discount").notNull().default(0),
  total: integer("total").notNull(),
  couponCode: text("coupon_code"),

  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  addressLine1: text("address_line1").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  notes: text("notes"),

  createdAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  size: text("size").notNull(),
  color: text("color").notNull(),
  qty: integer("qty").notNull(),
  price: integer("price").notNull(),
});

export const coupons = pgTable("coupons", {
  id: id(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // "PERCENT" | "FLAT"
  value: integer("value").notNull(),
  minOrderValue: integer("min_order_value").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: createdAt(),
});

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: id(),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => ({
    uniq: uniqueIndex("wishlist_customer_product").on(t.customerId, t.productId),
  })
);

export const reviews = pgTable("reviews", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => customers.id),
  customerName: text("customer_name").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  photoUrl: text("photo_url"),
  verifiedPurchase: boolean("verified_purchase").notNull().default(false),
  status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- Relations

export const customersRelations = relations(customers, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  wishlist: many(wishlistItems),
  reviews: many(reviews),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  customer: one(customers, { fields: [addresses.customerId], references: [customers.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  sizes: many(productSizes),
  colors: many(productColors),
  orderItems: many(orderItems),
  wishlistedBy: many(wishlistItems),
  reviews: many(reviews),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const productSizesRelations = relations(productSizes, ({ one }) => ({
  product: one(products, { fields: [productSizes.productId], references: [products.id] }),
}));

export const productColorsRelations = relations(productColors, ({ one }) => ({
  product: one(products, { fields: [productColors.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  customer: one(customers, { fields: [wishlistItems.customerId], references: [customers.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  customer: one(customers, { fields: [reviews.customerId], references: [customers.id] }),
}));
