// The stock grid: one row per piece, one column per size, a count in each cell.
//
// The Stock screen already lists every product-and-size combination, but as a
// long column of rows — hundreds of them, one size each. That answers "how
// much of this exact thing" and nothing else. The question actually asked
// every morning is different: which sizes am I out of, across everything, at
// a glance. That is a grid, and it only works as a grid.
//
// Built here as a plain function over plain data so the screen and the daily
// email render the same numbers from the same code. Two implementations of
// "what do I have" would eventually disagree, and the email is the one nobody
// would check.

/**
 * Column order, smallest to largest.
 *
 * Fixed rather than derived: sorting size labels alphabetically puts XXL
 * before XS and 3XL before S, and sorting by first appearance gives a
 * different order every time a product is added. A garment size order is
 * knowledge about clothes, not about data.
 */
export const SIZE_COLUMNS = [
  "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL", "7XL",
] as const;

/** Labels that mean the same size written differently. */
const ALIASES: Record<string, string> = {
  "2XL": "XXL",
  "XXXL": "3XL",
  "XXXXL": "4XL",
  "XXXXXL": "5XL",
  "XXXXXXL": "6XL",
  "XXXXXXXL": "7XL",
  "EXTRA SMALL": "XS",
  "SMALL": "S",
  "MEDIUM": "M",
  "LARGE": "L",
};

/**
 * The column a size label belongs in, or null if it isn't one of ours.
 *
 * Anything unrecognised — "Free Size", "28", "One Size" — is deliberately not
 * forced into a column. It gets counted separately rather than silently
 * landing in the wrong cell, because a wrong number here is worse than a
 * missing one: you would go and pick a garment that isn't there.
 */
export function sizeColumn(label: string): string | null {
  const key = label.trim().toUpperCase().replace(/[\s.-]/g, "");
  const resolved = ALIASES[key] ?? key;
  return (SIZE_COLUMNS as readonly string[]).includes(resolved) ? resolved : null;
}

export type GridProduct = {
  id: string;
  sku: string | null;
  name: string;
  slug: string;
  isActive: boolean;
  images?: { url: string; position: number | null }[];
  sizes: { label: string; stock: number }[];
};

export type GridRow = {
  id: string;
  code: string;
  name: string;
  slug: string;
  isActive: boolean;
  imageUrl: string | null;
  /** Count per column. A size the product does not come in is null, not 0 — */
  /** "we don't make it" and "we've run out" are different facts. */
  cells: Record<string, number | null>;
  /** Sizes this product has that are not one of our columns. */
  other: { label: string; stock: number }[];
  total: number;
};

export type StockGrid = {
  rows: GridRow[];
  /** Column totals, for the foot of the table. */
  columnTotals: Record<string, number>;
  grandTotal: number;
  /** Columns nothing in the catalogue uses, so the table can leave them out. */
  emptyColumns: string[];
};

function firstImage(images: GridProduct["images"]): string | null {
  if (!images || images.length === 0) return null;
  return [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]?.url ?? null;
}

export function buildStockGrid(products: GridProduct[]): StockGrid {
  const rows: GridRow[] = [];
  const columnTotals: Record<string, number> = Object.fromEntries(SIZE_COLUMNS.map((c) => [c, 0]));
  const used = new Set<string>();

  for (const product of products) {
    const cells: Record<string, number | null> = Object.fromEntries(SIZE_COLUMNS.map((c) => [c, null]));
    const other: { label: string; stock: number }[] = [];
    let total = 0;

    for (const size of product.sizes) {
      const column = sizeColumn(size.label);
      if (column) {
        // Added, not assigned: a product listing "XXL" and "2XL" separately
        // has two rows for one column, and they are the same shelf.
        cells[column] = (cells[column] ?? 0) + size.stock;
        columnTotals[column] += size.stock;
        used.add(column);
      } else {
        other.push({ label: size.label, stock: size.stock });
      }
      total += size.stock;
    }

    rows.push({
      id: product.id,
      code: product.sku ?? "—",
      name: product.name,
      slug: product.slug,
      isActive: product.isActive,
      imageUrl: firstImage(product.images),
      cells,
      other,
      total,
    });
  }

  return {
    rows,
    columnTotals,
    grandTotal: rows.reduce((sum, r) => sum + r.total, 0),
    emptyColumns: SIZE_COLUMNS.filter((c) => !used.has(c)),
  };
}

/** Columns worth showing: the ones something in the catalogue actually uses. */
export function visibleColumns(grid: StockGrid): string[] {
  return SIZE_COLUMNS.filter((c) => !grid.emptyColumns.includes(c));
}

/** How a cell should read at a glance. Empty shelves are the point of this page. */
export type CellTone = "none" | "out" | "low" | "ok";

export function cellTone(value: number | null, lowAt = 2): CellTone {
  if (value === null) return "none";
  if (value <= 0) return "out";
  if (value <= lowAt) return "low";
  return "ok";
}
