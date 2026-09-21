// The markup bands, loaded and saved.
//
// Kept apart from `markup-bands.ts` so the rules stay a pure module that can
// be reasoned about and tested without a database — everything that touches
// Postgres lives here instead.

import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import { DEFAULT_BANDS, validateBands, type MarkupBand } from "@/lib/markup-bands";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

/**
 * The bands in force.
 *
 * Falls back to the defaults when the table is empty rather than returning
 * nothing — a missing row must never mean a product cannot be priced, and the
 * defaults are the workbook's own 50/30, so the fallback prices exactly as the
 * spreadsheet would have.
 */
export async function loadBands(conn: Db = db): Promise<MarkupBand[]> {
  const rows = await conn
    .select({
      upToPaise: schema.markupBands.upToPaise,
      targetPct: schema.markupBands.targetPct,
      minPct: schema.markupBands.minPct,
    })
    .from(schema.markupBands)
    .orderBy(asc(schema.markupBands.position));

  if (rows.length === 0) return DEFAULT_BANDS;

  // A band table that has somehow become unusable — a ceiling on the last row,
  // say — would leave the dearest stock unpriced. Better to price from the
  // defaults and let the Pricing screen show the problem.
  const bands = rows.map((r) => ({ upToPaise: r.upToPaise, targetPct: r.targetPct, minPct: r.minPct }));
  return validateBands(bands).length === 0 ? bands : DEFAULT_BANDS;
}

/** Replace the bands wholesale. Refuses a set that would leave any cost unpriced. */
export async function saveBands(bands: MarkupBand[]): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const problems = validateBands(bands);
  if (problems.length > 0) {
    return { ok: false, errors: problems.map((p) => (p.index >= 0 ? `Band ${p.index + 1}: ${p.message}` : p.message)) };
  }

  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: schema.markupBands.id }).from(schema.markupBands);
    for (const row of existing) await tx.delete(schema.markupBands).where(eq(schema.markupBands.id, row.id));
    await tx.insert(schema.markupBands).values(
      bands.map((b, i) => ({ position: i, upToPaise: b.upToPaise, targetPct: b.targetPct, minPct: b.minPct }))
    );
  });

  return { ok: true };
}
