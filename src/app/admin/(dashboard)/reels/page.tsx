import { db } from "@/db";
import { firstImageUrl } from "@/components/admin/ProductThumb";
import { SITE } from "@/lib/site-config";
import { detailsLine, draftCaption, factRows } from "@/lib/reel/caption";
import ReelMaker from "./ReelMaker";

/** 919538559595 -> +91 95385 59595 */
function phone(n: string) {
  const m = /^(\d{2})(\d{5})(\d{5})$/.exec(n);
  return m ? `+${m[1]} ${m[2]} ${m[3]}` : `+${n}`;
}

export const dynamic = "force-dynamic";

export default async function AdminReelsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  const all = await db.query.products.findMany({
    with: { images: true, sizes: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  const products = all
    .map((p) => {
      const src = {
        name: p.name,
        price: p.price,
        fabric: p.fabric,
        perfectFor: p.perfectFor,
        bestWeather: p.bestWeather,
        styleNotes: p.styleNotes,
        description: p.description,
        sizes: [...p.sizes].filter((z) => z.stock > 0).sort((a, b) => a.position - b.position).map((z) => z.label),
        parentTags: p.parentTags,
        fabricTags: p.fabricTags,
      };
      return {
        id: String(p.id),
        name: p.name,
        sku: p.sku,
        imageUrl: firstImageUrl(p.images),
        details: detailsLine(src),
        facts: factRows(src),
        caption: draftCaption(src),
      };
    })
    .filter((p): p is typeof p & { imageUrl: string } => !!p.imageUrl);

  return (
    <>
      <div className="admin-header">
        <h1>Reel maker</h1>
      </div>
      <p className="field-hint" style={{ marginTop: -8, marginBottom: 18 }}>
        Turn one photo of a dress into a 30-second vertical reel, ready to download and post. It runs in your
        browser (Chrome or Edge on a computer) and costs nothing.
      </p>
      <ReelMaker
        products={products}
        brand="Urvi Studios"
        instagramHandle={`@${SITE.instagramHandle}`}
        instagramUrl={`instagram.com/${SITE.instagramHandle}`}
        defaultContact={[
          `WhatsApp ${phone(SITE.whatsappNumber)}`,
          SITE.contactEmail,
          SITE.siteUrl.replace(/^https?:\/\//, ""),
        ].join("\n")}
        initialProductId={product}
      />
    </>
  );
}
