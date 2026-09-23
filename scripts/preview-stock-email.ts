import { renderStockGridEmail } from "../src/lib/stock-report-email";

// A catalogue shaped like a real one: some pieces fully stocked, some with a
// size gone, one not made in the larger sizes at all, one with a Free Size.
const pieces = [
  { id: "1", sku: "URVI-BLUSH-1470-2", name: "Blush Bloom – 3PC Designer Set", slug: "blush", isActive: true,
    images: [], sizes: [{label:"S",stock:2},{label:"M",stock:0},{label:"L",stock:4},{label:"XL",stock:1},{label:"XXL",stock:3}] },
  { id: "2", sku: "URVI-OLIVE-1461-1", name: "Olive Grace – 3PC Designer Set", slug: "olive", isActive: true,
    images: [], sizes: [{label:"S",stock:0},{label:"M",stock:0},{label:"L",stock:2},{label:"XL",stock:5}] },
  { id: "3", sku: "URVI-STRAIG-4740", name: "Straight Regular Kurthas – Black", slug: "straight", isActive: true,
    images: [], sizes: [{label:"XS",stock:1},{label:"S",stock:6},{label:"M",stock:8},{label:"L",stock:7},{label:"XL",stock:3},{label:"XXL",stock:2},{label:"3XL",stock:0}] },
  { id: "4", sku: "URVI-MUSTAR-1488", name: "Mustard Statement – 3PC", slug: "mustard", isActive: true,
    images: [], sizes: [{label:"M",stock:4},{label:"L",stock:4},{label:"Free Size",stock:2}] },
];

const out = renderStockGridEmail(pieces, { siteUrl: "https://urvi-studios.netlify.app", when: new Date() });
console.log("SUBJECT:", out.subject);
import { writeFileSync } from "node:fs";
writeFileSync("/tmp/stock-email.html", out.html);
writeFileSync("/tmp/stock-email.txt", out.text);
