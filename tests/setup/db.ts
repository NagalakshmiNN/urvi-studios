// Direct database access for tests — used to check what the app actually
// persisted (rather than trusting the screen), to plant fixtures that would
// be tedious to create through the UI, and to clean up afterwards.

import { Client } from "pg";
import { TEST_DATABASE_URL } from "./env";

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Run a query and return its rows. */
export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return withDb(async (client) => {
    const res = await client.query(sql, params);
    return res.rows as T[];
  });
}

/** Run a query and return the first row, or null. */
export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export type ProductRow = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  landed_cost: number | null;
  min_round_up_to: number | null;
  max_round_up_to: number | null;
  badge: string | null;
  stock: number;
  is_active: boolean;
  description: string;
  perfect_for: string | null;
  category_id: string;
};

export async function getProductBySlug(slug: string): Promise<ProductRow | null> {
  return queryOne<ProductRow>("select * from products where slug = $1", [slug]);
}

export async function getProductBySku(sku: string): Promise<ProductRow | null> {
  return queryOne<ProductRow>("select * from products where sku = $1", [sku]);
}

export async function getOrderByNumber(orderNumber: string) {
  return queryOne<{
    id: string;
    order_number: string;
    customer_id: string | null;
    status: string;
    payment_status: string;
    payment_method: string;
    stock_deducted: boolean;
    source: string;
    subtotal: number;
    discount: number;
    total: number;
    coupon_code: string | null;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    razorpay_order_id: string | null;
  }>("select * from orders where order_number = $1", [orderNumber]);
}

export async function getSizeStock(productId: string, label: string): Promise<number | null> {
  const row = await queryOne<{ stock: number }>(
    "select stock from product_sizes where product_id = $1 and lower(label) = lower($2)",
    [productId, label]
  );
  return row ? row.stock : null;
}

/**
 * A product with known, isolated stock that a test can order against without
 * disturbing the seeded catalog. Returns everything a cart line needs.
 */
export async function createTestProduct(opts: {
  name: string;
  price?: number;
  stock?: number;
  sizes?: string[];
  colors?: { name: string; hex: string }[];
  fabric?: string;
  categorySlug?: string;
  description?: string;
  images?: string[];
  isActive?: boolean;
  badge?: string | null;
  landedCost?: number | null;
  minRoundUpTo?: number | null;
  maxRoundUpTo?: number | null;
}) {
  const {
    name,
    price = 2999,
    stock = 10,
    sizes = ["S", "M", "L"],
    colors = [{ name: "Test Olive", hex: "#3F4827" }],
    fabric = "Test fabric",
    categorySlug = "casual-wear",
    description = "A test product description.",
    images = ["/placeholders/casual-wear.svg"],
    isActive = true,
    badge = null,
    landedCost = null,
    minRoundUpTo = null,
    maxRoundUpTo = null,
  } = opts;

  const unique = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const slug = `test-${slugify(name)}-${unique}`;
  const sku = `TEST-${unique.toUpperCase()}`;

  return withDb(async (client) => {
    const cat = await client.query("select id from categories where slug = $1", [categorySlug]);
    if (!cat.rows[0]) throw new Error(`No category with slug ${categorySlug}`);

    const inserted = await client.query(
      `insert into products
        (id, sku, slug, name, description, fabric, price, compare_at_price, landed_cost,
         min_round_up_to, max_round_up_to, badge, stock, is_active, category_id)
       values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, null, $7, $8, $9, $10, $11, $12, $13)
       returning *`,
      [sku, slug, name, description, fabric, price, landedCost, minRoundUpTo, maxRoundUpTo, badge, stock, isActive, cat.rows[0].id]
    );
    const product = inserted.rows[0] as ProductRow;

    for (const [i, url] of images.entries()) {
      await client.query(
        "insert into product_images (id, product_id, url, position) values (gen_random_uuid()::text, $1, $2, $3)",
        [product.id, url, i]
      );
    }

    // Spread the total evenly across sizes, the same way an import would.
    const base = Math.floor(stock / sizes.length);
    const remainder = stock % sizes.length;
    for (const [i, label] of sizes.entries()) {
      await client.query(
        "insert into product_sizes (id, product_id, label, stock, position) values (gen_random_uuid()::text, $1, $2, $3, $4)",
        [product.id, label, base + (i < remainder ? 1 : 0), i]
      );
    }

    for (const [i, c] of colors.entries()) {
      await client.query(
        "insert into product_colors (id, product_id, name, hex, position) values (gen_random_uuid()::text, $1, $2, $3, $4)",
        [product.id, c.name, c.hex, i]
      );
    }

    return { ...product, slug, sku, sizes, colors };
  });
}

/** Remove a test product and everything hanging off it. */
export async function deleteTestProduct(productId: string) {
  await withDb(async (client) => {
    await client.query("update order_items set product_id = null where product_id = $1", [productId]);
    await client.query("delete from wishlist_items where product_id = $1", [productId]);
    await client.query("delete from reviews where product_id = $1", [productId]);
    await client.query("delete from product_images where product_id = $1", [productId]);
    await client.query("delete from product_sizes where product_id = $1", [productId]);
    await client.query("delete from product_colors where product_id = $1", [productId]);
    await client.query("delete from products where id = $1", [productId]);
  });
}

/** Remove an order and its lines (used to keep counters/stock assertions clean). */
export async function deleteOrderByNumber(orderNumber: string) {
  await withDb(async (client) => {
    const res = await client.query("select id from orders where order_number = $1", [orderNumber]);
    const id = res.rows[0]?.id;
    if (!id) return;
    await client.query("delete from order_items where order_id = $1", [id]);
    await client.query("delete from orders where id = $1", [id]);
  });
}

export async function deleteCustomerByEmail(email: string) {
  await withDb(async (client) => {
    const res = await client.query("select id from customers where lower(email) = lower($1)", [email]);
    const id = res.rows[0]?.id;
    if (!id) return;
    await client.query("update orders set customer_id = null where customer_id = $1", [id]);
    await client.query("delete from wishlist_items where customer_id = $1", [id]);
    await client.query("delete from addresses where customer_id = $1", [id]);
    await client.query("delete from reviews where customer_id = $1", [id]);
    await client.query("delete from customers where id = $1", [id]);
  });
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** A unique email per test run, so tests never collide on the unique index. */
export function uniqueEmail(prefix = "shopper"): string {
  return `${prefix}.${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@test.example.com`;
}
