import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CartClient from "./CartClient";

export default async function CartPage() {
  return (
    <>
      <SiteHeader active="Cart" />
      <div className="page-hero container">
        <div className="eyebrow">Step 1 of 2</div>
        <h1>Your Bag</h1>
      </div>
      <div className="container">
        <CartClient />
      </div>
      <SiteFooter />
    </>
  );
}
