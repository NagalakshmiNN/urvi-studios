// Central place for the shop's public contact details.
export const SITE = {
  siteUrl: "https://urvi-studios.netlify.app",
  // The name and address the business is actually registered under, shown on
  // the Terms and Privacy pages. Indian e-commerce rules require a real
  // address on the site, and Razorpay checks these pages before it will
  // activate an account — so these two lines must be the registered details,
  // not the trading name, once the entity is settled with the accountant.
  legalName: "URVI Studios",
  registeredAddress: "Bengaluru, Karnataka, India",
  /** Set once the business has its own GSTIN; hidden while null. */
  gstin: null as string | null,
  whatsappNumber: "919538559595", // Lakshmi — country code + number, no + or spaces
  whatsappNumberAlt: "919632311118", // Shilpa
  instagramHandle: "urvi.studios",
  contactEmail: "urvistudios2026@gmail.com",
  // Every number an order handoff (the WhatsApp fallback when Razorpay isn't
  // configured) can be sent to — a customer can reach whichever is easiest.
  whatsappOrderNumbers: [
    { name: "Lakshmi", number: "919538559595" },
    { name: "Shilpa", number: "919632311118" },
    { name: "Urvi Studio", number: "919180181526" },
  ],
};
