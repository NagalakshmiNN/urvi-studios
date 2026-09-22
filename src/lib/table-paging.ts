// Turning a page number and a page size from the address bar into a slice.
//
// Kept apart from the page that uses it because every value here arrives from
// a query string, which is to say from anyone: ?per=99999999 is a way to ask
// the server to render the entire catalogue, and ?page=-1 or ?page=NaN are
// ways to find out what happens when it doesn't hold. The rules are small
// enough to read in one go and are tested on their own.

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type Paging = {
  page: number;
  perPage: number;
  totalPages: number;
  from: number; // 1-based, for "showing 26–50 of 214"
  to: number;
  total: number;
  start: number; // 0-based slice bounds
  end: number;
};

/** Only a size we offer. Anything else — junk, or a request for everything. */
export function normalisePerPage(raw: string | undefined): number {
  const n = Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

export function paginate(total: number, rawPage: string | undefined, rawPer: string | undefined): Paging {
  const perPage = normalisePerPage(rawPer);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const asked = Number(rawPage);
  // Clamped rather than refused: a stale bookmark to page 9 of a list that
  // has since shrunk should show the last page, not an error or an empty
  // table that looks like the products have gone.
  const page = Number.isFinite(asked) ? Math.min(Math.max(Math.trunc(asked), 1), totalPages) : 1;

  const start = (page - 1) * perPage;
  const end = Math.min(start + perPage, total);

  return {
    page,
    perPage,
    totalPages,
    total,
    start,
    end,
    from: total === 0 ? 0 : start + 1,
    to: end,
  };
}

/**
 * Whether a product matches what was typed.
 *
 * Matches name, SKU and category, because those are the three things someone
 * has in hand when they go looking: the piece, the label on the piece, or the
 * shelf it belongs on. Case and surrounding space are ignored — a SKU copied
 * from a spreadsheet usually brings a space with it.
 */
export function matchesSearch(
  product: { name: string; sku: string | null; category?: { name: string } | null },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [product.name, product.sku ?? "", product.category?.name ?? ""].join(" ").toLowerCase();
  return haystack.includes(q);
}
