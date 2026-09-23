// Urvi Studios — database schema (Drizzle ORM, Postgres dialect).
//
// Runs against Netlify's auto-provisioned Postgres in production, and a
// local Postgres instance in dev (see src/db/index.ts for how the
// connection is chosen).

import { pgTable, text, integer, boolean, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
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
  // Stamped on every password change. Admin tokens issued before this moment
  // are refused, which is how changing the password ends the sessions that
  // were opened with the old one.
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Failed sign-ins, so a password guesser can be slowed down. Kept in the
// database rather than in memory: the site runs as serverless functions, and
// an in-memory counter that resets on every cold start protects nothing.
export const authAttempts = pgTable("auth_attempts", {
  id: id(),
  attemptKey: text("attempt_key").notNull(),
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
  perfectFor: text("perfect_for"), // "Perfect For / Where to Wear"
  bestWeather: text("best_weather"),
  stylingTips: text("styling_tips"), // "Ease / Styling"
  styleNotes: text("style_notes"), // "Style"
  price: integer("price").notNull(), // rupees
  compareAtPrice: integer("compare_at_price"),
  // Costing reference data carried over from Nagalakshmi's product master
  // Excel sheet on each import — admin-only display (see the admin Products
  // list), not shown anywhere on the storefront. "Maximum Round Up To" is
  // the one that actually drives `price` on every import (see
  // import-products/route.ts); the other two are reference-only.
  landedCost: integer("landed_cost"), // "Landed Cost (GST + Shipping)"
  minRoundUpTo: integer("min_round_up_to"), // "Minimum Round Up To"
  maxRoundUpTo: integer("max_round_up_to"), // "Maximum Round Up To" — sets `price` on import
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

// Uploaded product photos, stored right in the database (base64) and served
// back out through /api/images/[id]. Netlify's serverless functions have a
// read-only filesystem, so writing files to disk wouldn't survive a single
// request in production — this needs nowhere else to live, and reuses the
// Postgres connection every other feature already has, no new service or
// credentials required.
export const productImageAssets = pgTable("product_image_assets", {
  id: id(),
  contentType: text("content_type").notNull(),
  dataBase64: text("data_base64").notNull(),
  createdAt: createdAt(),
});

export const productSizes = pgTable("product_sizes", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  // How many physical pieces of this product, in this size, are actually on
  // hand — the real answer to "how do we track the 4 to 40 pieces." Colors
  // are still shared across a size's stock (not their own dimension) since
  // most of the catalog only offers 1–2 colors per style; this is the
  // granularity that actually determines whether a size can be sold.
  stock: integer("stock").notNull().default(0),
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
  paymentMethod: text("payment_method").notNull(), // "razorpay" | "whatsapp_cod" | "manual"
  // Whether stock has actually been taken out of the catalog for this order
  // yet — true the moment a Razorpay payment verifies, a manual order is
  // recorded, or an admin confirms a WhatsApp/COD order. Prevents double
  // (or missed) stock decrements no matter which path an order took.
  stockDeducted: boolean("stock_deducted").notNull().default(false),
  // How the order actually came in — the website itself, or Shilpa/Nagalakshmi
  // logging a sale that happened over WhatsApp, a phone call, or in person.
  // Defaults to "online" so every pre-existing row stays accurate.
  source: text("source").notNull().default("online"), // "online" | "walk_in" | "whatsapp" | "phone" | "word_of_mouth" | "other"
  // Whether this order gets couriered out or handed over in person. A pickup
  // order needs no address and is never charged delivery; its statuses read
  // as "ready to collect" and "collected" rather than shipped/delivered.
  // Defaults to "delivery" so every pre-existing order stays accurate.
  fulfilmentMethod: text("fulfilment_method").notNull().default("delivery"), // "delivery" | "pickup"
  // How an in-person sale was actually settled, for reconciling cash in hand
  // against UPI and card receipts. Null for website orders, where the payment
  // method above already says how it was paid.
  paymentMode: text("payment_mode"), // "cash" | "upi" | "card" | null
  // What the order actually sold for, in PAISE (integer, so two decimal places
  // are exact). Null until an admin records it.
  actualSalePricePaise: integer("actual_sale_price_paise"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  // When money went back to the customer, and how much of it — in PAISE,
  // because a refund can be for any amount and rounding one to whole rupees
  // is how a rupee goes missing from a reconciliation. Both stay null/zero
  // for every order that was never refunded.
  refundedAt: timestamp("refunded_at"),
  refundedPaise: integer("refunded_paise").notNull().default(0),

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
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  sku: text("sku"),
  size: text("size").notNull(),
  color: text("color").notNull(),
  qty: integer("qty").notNull(),
  price: integer("price").notNull(),
  // What this piece cost us, captured when it sold — so a later change to the
  // product's landed cost can never rewrite a past month's profit.
  landedCostAtSale: integer("landed_cost_at_sale"),
});

/**
 * One row per refund Razorpay has made, keyed by Razorpay's own refund id.
 *
 * Razorpay sends several events for a single refund and retries any it does
 * not get a 2xx for, so amounts cannot simply be added up as they arrive —
 * the same money would be counted three times, and a ₹200 goodwill refund
 * would look like a full one, cancelling the sale and putting a garment back
 * on the shelf that the customer still has. Keying on the refund id makes a
 * repeat a no-op and the total the sum of distinct refunds.
 */
export const orderRefunds = pgTable("order_refunds", {
  // Razorpay's id, not one of ours.
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  amountPaise: integer("amount_paise").notNull(),
  createdAt: createdAt(),
});

export const coupons = pgTable("coupons", {
  id: id(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // "PERCENT" | "FLAT"
  value: integer("value").notNull(),
  minOrderValue: integer("min_order_value").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  // How many times this code may be redeemed in total, and how many times by
  // any one customer. NULL means no limit — which is what every coupon
  // created before this existed is, so nothing changes behaviour by itself.
  // A code with no ceiling that reaches a deals site is a standing offer to
  // the entire internet.
  usageLimit: integer("usage_limit"),
  perCustomerLimit: integer("per_customer_limit"),
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

// ---------------------------------------------------------------- Money out
//
// The other half of the business. Orders tell us what came in; these two tell
// us what was put in to start with and what goes out to keep it running, so
// profit and cash position can be answered from this database rather than from
// a spreadsheet that goes stale the moment anything is spent.
//
// Amounts are PAISE (integers) — see the migration for why.

export const capitalContributions = pgTable("capital_contributions", {
  id: id(),
  /** The day the money moved, not the day it was recorded. */
  contributedOn: date("contributed_on", { mode: "string" }).notNull(),
  contributor: text("contributor").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  mode: text("mode").notNull(), // upi | cash | bank | card | other
  reference: text("reference"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const expenses = pgTable("expenses", {
  id: id(),
  spentOn: date("spent_on", { mode: "string" }).notNull(),
  category: text("category").notNull(), // see EXPENSE_CATEGORIES in src/lib/money.ts
  description: text("description").notNull(),
  payee: text("payee"),
  /** What was actually paid, GST included — the figure on the receipt. */
  amountPaise: integer("amount_paise").notNull(),
  /** Basis points: 1800 = 18%. Null where GST doesn't apply or isn't known. */
  gstRateBp: integer("gst_rate_bp"),
  paymentMode: text("payment_mode").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: createdAt(),
});

// ------------------------------------------------------------- Purchasing
//
// Where stock comes from, and what it cost to get here. This replaces the
// costing workbook's VENDOR MASTER, PROCUREMENT REGISTER and the pricing
// columns of PRODUCT MASTER — see src/lib/purchasing.ts for the arithmetic and
// why it is the arithmetic it is.
//
// A purchase is a ledger entry: once recorded it is what the invoice said, so
// every allocated figure is stored on the line rather than recomputed later.
// Re-deriving them from today's code would silently rewrite last quarter's
// costs the first time a rounding rule changed.

export const vendors = pgTable("vendors", {
  id: id(),
  /** V001, V002 — the workbook's own numbering, continued. */
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  businessName: text("business_name"),
  city: text("city"),
  state: text("state"),
  gstin: text("gstin"),
  pan: text("pan"),
  /** Wholesaler, Manufacturer, Agent — free text, as the workbook kept it. */
  type: text("type"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const purchases = pgTable("purchases", {
  id: id(),
  /** PO-00006 — continues the workbook's sequence. */
  ref: text("ref").notNull().unique(),
  vendorId: text("vendor_id").notNull().references(() => vendors.id),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceDate: date("invoice_date", { mode: "string" }).notNull(),

  // Everything below is in integer paise. A vendor's unit price is ₹212.50 as
  // often as it is ₹212, and a float cannot hold two decimals exactly.
  freightPaise: integer("freight_paise").notNull().default(0),
  discountPaise: integer("discount_paise").notNull().default(0),
  otherChargesPaise: integer("other_charges_paise").notNull().default(0),
  grossPaise: integer("gross_paise").notNull(),
  taxablePaise: integer("taxable_paise").notNull(),
  gstPaise: integer("gst_paise").notNull(),
  /** Taxable + GST + freight + other. What the stock cost to get onto the rail. */
  landedTotalPaise: integer("landed_total_paise").notNull(),
  totalQty: integer("total_qty").notNull(),

  paymentMode: text("payment_mode"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const purchaseLines = pgTable("purchase_lines", {
  id: id(),
  purchaseId: text("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
  /** Null once a product is deleted — the purchase is still a true record of what was bought. */
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),

  /** As the invoice named it, kept verbatim even when the product is later renamed. */
  item: text("item").notNull(),
  colour: text("colour"),
  size: text("size").notNull(),
  qty: integer("qty").notNull(),
  unitPricePaise: integer("unit_price_paise").notNull(),
  /** Whole percent: 5 or 18. */
  gstRatePct: integer("gst_rate_pct").notNull(),

  discountSharePaise: integer("discount_share_paise").notNull().default(0),
  gstPaise: integer("gst_paise").notNull().default(0),
  freightSharePaise: integer("freight_share_paise").notNull().default(0),
  otherSharePaise: integer("other_share_paise").notNull().default(0),
  landedPaise: integer("landed_paise").notNull(),
  landedPerUnitPaise: integer("landed_per_unit_paise").notNull(),

  position: integer("position").notNull().default(0),
});

/**
 * The paperwork behind a purchase: the vendor's invoice, the transport bill,
 * the payment screenshot.
 *
 * Held as base64 text in Postgres, like product photographs, because a
 * serverless function has no disk to write to. Served only through an
 * admin-authenticated route — a vendor invoice shows what the business pays for
 * its stock, which must never be reachable from the storefront the way a
 * product photo is.
 *
 * Deleted softly. Paperwork removed by mistake is paperwork that may be needed
 * at the end of the financial year, and a row that can be brought back costs
 * nothing next to an invoice that cannot.
 */
export const purchaseDocuments = pgTable("purchase_documents", {
  id: id(),
  purchaseId: text("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
  /** What it is: Invoice, Transport bill, Payment proof — see src/lib/purchase-documents.ts. */
  kind: text("kind").notNull().default("Invoice"),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  dataBase64: text("data_base64").notNull(),
  notes: text("notes"),
  uploadedAt: createdAt(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  /** Null while the document is in use. Set, it is removed but recoverable. */
  deletedAt: timestamp("deleted_at"),
  deletedReason: text("deleted_reason"),
});

/**
 * What to charge, by what it cost to land.
 *
 * A table rather than a constant because a markup is a commercial decision
 * that changes with the season and the vendor, and a decision that needs a
 * deploy to change is a decision nobody revisits. Edited on the Pricing
 * screen; see src/lib/markup-bands.ts.
 */
export const markupBands = pgTable("markup_bands", {
  id: id(),
  position: integer("position").notNull(),
  /** Top of the band in paise, inclusive. Null on the last band: no ceiling. */
  upToPaise: integer("up_to_paise"),
  targetPct: integer("target_pct").notNull(),
  minPct: integer("min_pct").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contactMessages = pgTable("contact_messages", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("NEW"), // NEW | READ
  createdAt: createdAt(),
});

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
  refunds: many(orderRefunds),
}));

export const orderRefundsRelations = relations(orderRefunds, ({ one }) => ({
  order: one(orders, { fields: [orderRefunds.orderId], references: [orders.id] }),
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

export const vendorsRelations = relations(vendors, ({ many }) => ({
  purchases: many(purchases),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  vendor: one(vendors, { fields: [purchases.vendorId], references: [vendors.id] }),
  lines: many(purchaseLines),
  documents: many(purchaseDocuments),
}));

export const purchaseLinesRelations = relations(purchaseLines, ({ one }) => ({
  purchase: one(purchases, { fields: [purchaseLines.purchaseId], references: [purchases.id] }),
  product: one(products, { fields: [purchaseLines.productId], references: [products.id] }),
}));

export const purchaseDocumentsRelations = relations(purchaseDocuments, ({ one }) => ({
  purchase: one(purchases, { fields: [purchaseDocuments.purchaseId], references: [purchases.id] }),
}));
