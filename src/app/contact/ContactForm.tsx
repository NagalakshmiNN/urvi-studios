"use client";

import { useState } from "react";

export default function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setState("sending");
        try {
          const res = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: data.get("name"),
              email: data.get("email"),
              message: data.get("message"),
            }),
          });
          if (!res.ok) throw new Error("failed");
          setState("sent");
          form.reset();
        } catch {
          setState("error");
        }
      }}
    >
      <div className="form-group"><label>Name</label><input type="text" name="name" required /></div>
      <div className="form-group"><label>Email</label><input type="email" name="email" required /></div>
      <div className="form-group"><label>Message</label><textarea name="message" rows={5} required /></div>
      <button type="submit" className="btn btn-primary btn-block" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send Message"}
      </button>
      {state === "sent" && (
        <p style={{ display: "block", color: "var(--olive)", marginTop: 12, fontSize: 13 }}>
          Thank you — we&apos;ll get back to you soon. For a faster reply, message us on WhatsApp.
        </p>
      )}
      {state === "error" && (
        <p style={{ display: "block", color: "#a5333a", marginTop: 12, fontSize: 13 }}>
          Something went wrong sending that — please try WhatsApp instead, or try again in a moment.
        </p>
      )}
    </form>
  );
}
