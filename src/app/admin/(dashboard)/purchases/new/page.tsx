import Link from "next/link";
import NewPurchase from "../NewPurchase";

export const dynamic = "force-dynamic";

export default function NewPurchasePage() {
  return (
    <>
      <div className="admin-header">
        <h1>Enter a purchase</h1>
        <Link href="/admin/purchases" className="btn btn-outline">All purchases</Link>
      </div>

      <div className="notice-box" style={{ marginBottom: 28 }}>
        <strong>One invoice in, everything else follows.</strong> Recording a purchase creates any products it buys,
        adds the stock, works out what each piece cost to land — unit price plus its share of GST, freight and
        discount — and records what was paid. Nothing has to be typed into the workbook afterwards.
      </div>

      <NewPurchase />
    </>
  );
}
