"use client";

import { useState, useEffect } from "react";

export default function WelcomeBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="notice-box success" style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>Account created successfully! Welcome to Urvi Studios.</span>
      <button onClick={() => setVisible(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#2e5c34", fontSize: 18, padding: "0 4px" }} aria-label="Dismiss">&times;</button>
    </div>
  );
}
