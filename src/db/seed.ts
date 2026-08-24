// Seed logic for categories, sample products, a bootstrap admin user, and a
// starter coupon. Exports runSeed() only — no auto-execution here, since
// this module is also imported by the production bootstrap API route
// (src/app/api/system/bootstrap/route.ts) and must be side-effect-free at
// import time. To run this from the command line, use seed-cli.ts instead:
//   npx tsx --env-file=.env src/db/seed-cli.ts

import { db } from "./index";
import { categories, products, productImages, productSizes, productColors, adminUsers, coupons } from "./schema";
import { hashPassword } from "../lib/auth";
import { eq } from "drizzle-orm";

const CATEGORIES = [
  { slug: "festive-wear", name: "Festive Wear", parent: "Occasion", position: 1 },
  { slug: "office-wear", name: "Office Wear", parent: "Office", position: 2 },
  { slug: "casual-wear", name: "Casual Wear", parent: "Everyday", position: 3 },
  { slug: "short-tops", name: "Short Tops", parent: "Everyday", position: 4 },
  { slug: "kurta", name: "Kurta", parent: "Everyday", position: 5 },
  { slug: "fusion-edit", name: "Fusion Edit", parent: "Occasion", position: 6 },
];

const PRODUCTS: Array<{
  sku: string; slug: string; name: string; sub: string; price: number; compareAtPrice?: number;
  fabric: string; sizes: string[]; colors: { name: string; hex: string }[]; description: string;
  badge?: string; image: string; stock: number;
}> = [
  { sku: "URVI-FES-001", slug: "meera-silk-anarkali-gown", name: "Meera Silk Anarkali Gown", sub: "festive-wear",
    price: 6499, compareAtPrice: 7999, fabric: "Pure silk blend with hand-finished zari border",
    sizes: ["S","M","L","XL"], colors: [{name:"Deep Maroon",hex:"#6d1f2b"},{name:"Olive",hex:"#3F4827"}],
    description: "An Anarkali silhouette cut for movement — fitted through the bodice, flaring into soft godets that catch the light on every turn. Finished with an antique-gold zari border along the hem and sleeves.",
    badge: "Bestseller", image: "/placeholders/festive-wear.svg", stock: 14 },
  { sku: "URVI-FES-002", slug: "antique-gold-zari-saree-gown", name: "Antique Gold Zari Saree Gown", sub: "festive-wear",
    price: 7499, fabric: "Georgette with woven zari pallu",
    sizes: ["S","M","L"], colors: [{name:"Emerald",hex:"#2f4a3a"},{name:"Antique Gold",hex:"#A98238"}],
    description: "A pre-draped saree gown for the woman who wants the drama of six yards without the fuss. The pallu is pleated and stitched in place; the zari catches candlelight beautifully.",
    badge: "New", image: "/placeholders/festive-wear.svg", stock: 9 },
  { sku: "URVI-FES-003", slug: "sagai-velvet-lehenga-set", name: "Sagai Velvet Lehenga Set", sub: "festive-wear",
    price: 8999, compareAtPrice: 10999, fabric: "Velvet lehenga, silk blend dupatta",
    sizes: ["S","M","L","XL"], colors: [{name:"Wine",hex:"#5a1f2e"},{name:"Bottle Green",hex:"#20361f"}],
    description: "Weighty velvet that holds its shape beautifully, paired with a flowing dupatta finished in a fine gold border. Built for the occasions that call for a little more drama.",
    image: "/placeholders/festive-wear.svg", stock: 6 },

  { sku: "URVI-OFF-001", slug: "olive-structured-blazer-set", name: "Olive Structured Blazer Set", sub: "office-wear",
    price: 4299, fabric: "Textured suiting fabric, fully lined",
    sizes: ["XS","S","M","L","XL"], colors: [{name:"Olive",hex:"#3F4827"},{name:"Earth",hex:"#51462F"}],
    description: "A sharply tailored blazer and trouser set that carries a boardroom meeting and a Sunday brunch equally well. Structured shoulders, a nipped waist, and pockets that actually work.",
    badge: "Bestseller", image: "/placeholders/office-wear.svg", stock: 20 },
  { sku: "URVI-OFF-002", slug: "ivory-tailored-shirt-dress", name: "Ivory Tailored Shirt Dress", sub: "office-wear",
    price: 3199, fabric: "Cotton-blend twill",
    sizes: ["S","M","L","XL"], colors: [{name:"Ivory",hex:"#F7F0E4"},{name:"Sand",hex:"#EFE4D0"}],
    description: "A crisp shirt dress with a self-fabric belt to define the waist. Clean lines, mother-of-pearl buttons, and enough structure to feel put-together from 9 to 9.",
    image: "/placeholders/office-wear.svg", stock: 17 },
  { sku: "URVI-OFF-003", slug: "earth-tone-co-ord-trouser-set", name: "Earth Tone Co-ord Trouser Set", sub: "office-wear",
    price: 3799, fabric: "Stretch crepe",
    sizes: ["S","M","L","XL","XXL"], colors: [{name:"Earth",hex:"#51462F"},{name:"Sage",hex:"#6A7444"}],
    description: "A co-ord set with a relaxed tailored trouser and a longline shirt — the kind of outfit that requires zero decision-making on a Monday morning and still looks considered.",
    image: "/placeholders/office-wear.svg", stock: 12 },

  { sku: "URVI-CAS-001", slug: "sand-wrap-midi-dress", name: "Sand Wrap Midi Dress", sub: "casual-wear",
    price: 2399, fabric: "Rayon crepe",
    sizes: ["S","M","L","XL"], colors: [{name:"Sand",hex:"#EFE4D0"},{name:"Rust",hex:"#9a4a2b"}],
    description: "An easy wrap dress that ties at the waist and moves with you all day. Equally at home at a weekend market or a long lunch with the girls.",
    badge: "New", image: "/placeholders/casual-wear.svg", stock: 22 },
  { sku: "URVI-CAS-002", slug: "botanical-print-tiered-dress", name: "Botanical Print Tiered Dress", sub: "casual-wear",
    price: 2699, fabric: "Pure cotton, tiered skirt",
    sizes: ["S","M","L"], colors: [{name:"Sage Print",hex:"#6A7444"}],
    description: "Soft botanical print across a breezy tiered silhouette. Puffed sleeves, a smocked bodice, and just enough swing in the skirt to feel a little joyful.",
    image: "/placeholders/casual-wear.svg", stock: 15 },
  { sku: "URVI-CAS-003", slug: "ivory-linen-shift-dress", name: "Ivory Linen Shift Dress", sub: "casual-wear",
    price: 2199, fabric: "Pure linen",
    sizes: ["XS","S","M","L","XL"], colors: [{name:"Ivory",hex:"#F7F0E4"},{name:"Olive",hex:"#3F4827"}],
    description: "The kind of dress you reach for without thinking — clean shift cut, breathable linen, and pockets deep enough for your phone and keys.",
    image: "/placeholders/casual-wear.svg", stock: 18 },

  { sku: "URVI-TOP-001", slug: "gold-thread-crop-blouse", name: "Gold Thread Crop Blouse", sub: "short-tops",
    price: 1599, fabric: "Chanderi cotton with gold thread work",
    sizes: ["XS","S","M","L"], colors: [{name:"Ivory",hex:"#F7F0E4"},{name:"Blush",hex:"#d9b7ad"}],
    description: "A crop top with fine gold thread detailing along the neckline — dress it up with a skirt for an evening, or down with denim for the day.",
    badge: "New", image: "/placeholders/short-tops.svg", stock: 25 },
  { sku: "URVI-TOP-002", slug: "sage-knot-front-top", name: "Sage Knot-Front Top", sub: "short-tops",
    price: 1399, fabric: "Cotton poplin",
    sizes: ["S","M","L","XL"], colors: [{name:"Sage",hex:"#6A7444"},{name:"Earth",hex:"#51462F"}],
    description: "A knotted front top that flatters every body — soft structure on top, easy movement below. Our most-repurchased top for a reason.",
    badge: "Bestseller", image: "/placeholders/short-tops.svg", stock: 30 },
  { sku: "URVI-TOP-003", slug: "ivory-bardot-top", name: "Ivory Bardot Top", sub: "short-tops",
    price: 1499, fabric: "Textured cotton blend",
    sizes: ["XS","S","M","L"], colors: [{name:"Ivory",hex:"#F7F0E4"}],
    description: "An off-shoulder Bardot top with a fitted band and a soft gathered body. Simple, elegant, and endlessly pairable.",
    image: "/placeholders/short-tops.svg", stock: 19 },

  { sku: "URVI-KUR-001", slug: "olive-cotton-straight-kurta", name: "Olive Cotton Straight Kurta", sub: "kurta",
    price: 1899, fabric: "100% cotton",
    sizes: ["S","M","L","XL","XXL"], colors: [{name:"Olive",hex:"#3F4827"},{name:"Ivory",hex:"#F7F0E4"}],
    description: "A straight-cut kurta in breathable cotton with side slits for ease of movement. The everyday staple every URVI girl keeps three of.",
    badge: "Bestseller", image: "/placeholders/kurta.svg", stock: 28 },
  { sku: "URVI-KUR-002", slug: "hand-block-print-kurta-set", name: "Hand Block Print Kurta Set", sub: "kurta",
    price: 2599, fabric: "Hand block-printed cotton, comes with pants",
    sizes: ["S","M","L","XL"], colors: [{name:"Rust Print",hex:"#9a4a2b"},{name:"Sage Print",hex:"#6A7444"}],
    description: "Traditional hand block printing on soft cotton, paired with straight-fit pants. Each print run is small-batch, so patterns vary slightly — that's the charm of it.",
    image: "/placeholders/kurta.svg", stock: 16 },
  { sku: "URVI-KUR-003", slug: "antique-gold-embroidered-kurta", name: "Antique Gold Embroidered Kurta", sub: "kurta",
    price: 3299, compareAtPrice: 3899, fabric: "Chanderi silk with gold thread embroidery",
    sizes: ["S","M","L","XL"], colors: [{name:"Deep Maroon",hex:"#6d1f2b"},{name:"Olive",hex:"#3F4827"}],
    description: "A dressier kurta with delicate gold embroidery along the yoke — festive enough for a small gathering, comfortable enough to wear all evening.",
    image: "/placeholders/kurta.svg", stock: 11 },

  { sku: "URVI-FUS-001", slug: "indo-western-jacket-co-ord", name: "Indo-Western Jacket Co-ord", sub: "fusion-edit",
    price: 4599, fabric: "Silk-cotton blend jacket with matching pants",
    sizes: ["S","M","L","XL"], colors: [{name:"Earth",hex:"#51462F"},{name:"Bottle Green",hex:"#20361f"}],
    description: "A structured open jacket with traditional embroidery detailing, worn over tailored pants. For the woman who wants Indian craft with a western silhouette.",
    badge: "New", image: "/placeholders/fusion-edit.svg", stock: 13 },
  { sku: "URVI-FUS-002", slug: "draped-pant-saree-set", name: "Draped Pant Saree Set", sub: "fusion-edit",
    price: 5299, fabric: "Crepe drape with attached pants",
    sizes: ["S","M","L"], colors: [{name:"Wine",hex:"#5a1f2e"},{name:"Antique Gold",hex:"#A98238"}],
    description: "The elegance of a saree drape, pre-stitched onto tailored pants for effortless wear. No pins, no pleating panic — just step in and go.",
    image: "/placeholders/fusion-edit.svg", stock: 8 },
  { sku: "URVI-FUS-003", slug: "cape-sleeve-fusion-gown", name: "Cape Sleeve Fusion Gown", sub: "fusion-edit",
    price: 6899, fabric: "Georgette with cape detailing",
    sizes: ["S","M","L","XL"], colors: [{name:"Emerald",hex:"#2f4a3a"},{name:"Deep Maroon",hex:"#6d1f2b"}],
    description: "A floor-length gown with dramatic cape sleeves that move beautifully on the dance floor. Western silhouette, Indian sensibility.",
    badge: "Limited", image: "/placeholders/fusion-edit.svg", stock: 5 },
];

export async function runSeed() {
  console.log("Seeding categories...");
  const categoryIds: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const existing = await db.select().from(categories).where(eq(categories.slug, c.slug)).then((r) => r[0]);
    if (existing) {
      categoryIds[c.slug] = existing.id;
      continue;
    }
    const [row] = await db.insert(categories).values(c).returning();
    categoryIds[c.slug] = row.id;
  }

  console.log("Seeding products...");
  for (const p of PRODUCTS) {
    const existing = await db.select().from(products).where(eq(products.slug, p.slug)).then((r) => r[0]);
    if (existing) continue;

    const [row] = await db
      .insert(products)
      .values({
        sku: p.sku,
        slug: p.slug,
        name: p.name,
        description: p.description,
        fabric: p.fabric,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        badge: p.badge,
        stock: p.stock,
        categoryId: categoryIds[p.sub],
      })
      .returning();

    await db.insert(productImages).values({ productId: row.id, url: p.image, position: 0 });
    await db.insert(productSizes).values(p.sizes.map((label, i) => ({ productId: row.id, label, position: i })));
    await db.insert(productColors).values(p.colors.map((c, i) => ({ productId: row.id, name: c.name, hex: c.hex, position: i })));
  }

  console.log("Seeding bootstrap admin user...");
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL || "owner@urvistudios.in";
  const existingAdmin = await db.select().from(adminUsers).where(eq(adminUsers.email, adminEmail)).then((r) => r[0]);
  if (!existingAdmin) {
    const passwordHash = await hashPassword(process.env.ADMIN_BOOTSTRAP_PASSWORD || "ChangeMe123!");
    await db.insert(adminUsers).values({ email: adminEmail, passwordHash, name: "Urvi Studios Admin", role: "owner" });
    console.log(`  Admin user created: ${adminEmail} (password from ADMIN_BOOTSTRAP_PASSWORD env var)`);
  }

  console.log("Seeding starter coupon...");
  const existingCoupon = await db.select().from(coupons).where(eq(coupons.code, "WELCOME10")).then((r) => r[0]);
  if (!existingCoupon) {
    await db.insert(coupons).values({ code: "WELCOME10", type: "PERCENT", value: 10, minOrderValue: 1500, active: true });
  }

  console.log("Done.");
}
