import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CheckoutClient from "./CheckoutClient";
import { getCustomerSession } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export default async function CheckoutPage() {
  const customerId = await getCustomerSession();
  const customer = customerId ? await db.query.customers.findFirst({ where: eq(schema.customers.id, customerId) }) : null;
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
