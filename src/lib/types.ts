export type ProductCardData = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  badge: string | null;
  stock: number;
  images: { url: string }[];
  colors: { name: string; hex: string }[];
  sizes: { label: string; stock: number }[];
  category: { name: string; slug: string; parent: string | null };
};
