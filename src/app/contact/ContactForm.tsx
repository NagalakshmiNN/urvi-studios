"use client";

import { useState } from "react";

export default function ContactForm() {
  const [sent, setSent] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
        e.currentTarget.reset();
      }}
    >
      <div className="form-group"><label>Name</label><input type="text" required /></div>
      <div className="form-group"><label>Email</label><input type="email" required /></div>
      <div className="form-group"><label>Message</label><textarea rows={5} required /></div>
      <button type="submit" className="btn btn-primary btn-block">Send Message</button>
      {sent && (
        <p style={{ display: "block", color: "var(--olive)", marginTop: 12, fontSize: 13 }}>
          Thank you — we&apos;ll get back to you soon. For a faster reply, message us on WhatsApp.
        </p>
      )}
    </form>
  );
}
