export function formatINR(amount: number) {
  return "₹" + Number(amount).toLocaleString("en-IN");
}

export function generateOrderNumberSeed(year: number, seq: number) {
  return `URVI-${year}-${String(seq).padStart(5, "0")}`;
}
