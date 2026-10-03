import { db } from "@/db";
import { NextResponse } from "next/server";

function pieceLabel(catSlug: string, productName: string): string {
  if (catSlug === "3-piece-set") return "3 Piece";
  if (catSlug === "2-piece-set" || catSlug === "co-ords") return "2 Piece";
  const lower = productName.toLowerCase();
  if (lower.includes("3 piece") || lower.includes("3-piece")) return "3 Piece";
  if (lower.includes("set") || lower.includes("co-ord") || lower.includes("coord")) return "2 Piece";
  return "1 Piece";
}

export async function GET() {
  const products = await db.query.products.findMany({
    where: (p, { eq }) => eq(p.isActive, true),
    with: { category: true },
  });

  const results = products.map((p) => ({
    name: p.name,
    categorySlug: p.category?.slug ?? "NULL",
    categoryName: p.category?.name ?? "NULL",
    pieceLabel: pieceLabel(p.category?.slug ?? "", p.name),
  }));

  const byPiece = {
    "1 Piece": results.filter((r) => r.pieceLabel === "1 Piece").length,
    "2 Piece": results.filter((r) => r.pieceLabel === "2 Piece").length,
    "3 Piece": results.filter((r) => r.pieceLabel === "3 Piece").length,
  };

  const nonSingle = results.filter((r) => r.pieceLabel !== "1 Piece");

  return NextResponse.json({ total: products.length, byPiece, nonSingle, allCategories: [...new Set(results.map(r => r.categorySlug))] });
}
