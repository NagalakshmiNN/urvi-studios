import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CartClient from "./CartClient";
import { getCustomerSession } from "@/lib/auth";

export default async function CartPage() {
  const customerId = await getCustomerSession();
  return (
    <>
      <SiteHeader active="Cart" />
      <div className="page-hero container">
        <div className="eyebrow">Step 1 of 2</div>
        <h1>Your <span className="flow">Bag</span></h1>
      </div>
      <div className="container">
        <CartClient isLoggedIn={Boolean(customerId)} />
      </div>
      <SiteFooter />
    </>
  );
}
