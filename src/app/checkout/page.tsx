import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CheckoutClient from "./CheckoutClient";
import { getCustomerSession } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function CheckoutPage() {
  const customerId = await getCustomerSession();
  // An account is required to place an order — this keeps every order tied
  // to a real customer record with login access, instead of one-off guest
  // orders. Sending them to login (not straight to register) covers both
  // returning and new customers; the login page's own "Create an account"
  // link handles the rest, and either path returns here via ?next=/checkout.
  if (!customerId) redirect("/account/login?next=/checkout");

  const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, customerId) });
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "";

  return (
    <>
      <SiteHeader active="Cart" />
      <div className="page-hero container">
        <div className="eyebrow">Step 2 of 2</div>
        <h1>Checkout</h1>
      </div>
      <div className="container">
        <CheckoutClient
          prefill={customer ? { name: customer.name, email: customer.email, phone: customer.phone || "" } : null}
          razorpayConfigured={Boolean(razorpayKeyId)}
        />
      </div>
      <SiteFooter />
    </>
  );
}
