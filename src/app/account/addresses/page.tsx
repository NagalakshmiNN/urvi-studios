import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AccountNav from "@/components/AccountNav";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCustomerSession } from "@/lib/auth";
import { deleteAddressAction, setDefaultAddressAction } from "@/app/actions/address";
import AddAddressForm from "./AddAddressForm";

export default async function AddressesPage() {
  const customerId = (await getCustomerSession())!;
  const addresses = await db.query.addresses.findMany({ where: eq(schema.addresses.customerId, customerId) });

  return (
    <>
      <SiteHeader active="Account" />
      <div className="page-hero container">
        <div className="eyebrow">My Account</div>
        <h1>Your Addresses</h1>
      </div>
      <div className="container account-layout">
        <AccountNav active="Addresses" />
        <div>
          {addresses.length > 0 && (
            <div className="address-grid">
              {addresses.map((a) => (
                <div className="address-card" key={a.id}>
                  {a.isDefault && <span className="address-default-tag">Default</span>}
                  <div className="address-label">{a.label}</div>
                  <p>
                    {a.line1}<br />
                    {a.city}, {a.state} {a.pincode}<br />
                    {a.phone}
                  </p>
                  <div className="address-actions">
                    {!a.isDefault && (
                      <form action={setDefaultAddressAction.bind(null, a.id)}>
                        <button type="submit" className="link-btn">Make default</button>
                      </form>
                    )}
                    <form action={deleteAddressAction.bind(null, a.id)}>
                      <button type="submit" className="link-btn danger">Remove</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
          <h3 style={{ margin: "28px 0 14px" }}>Add a new address</h3>
          <AddAddressForm />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
