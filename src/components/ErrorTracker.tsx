"use client";

// Captures uncaught JS errors and unhandled promise rejections and sends
// them to /api/analytics/events. Mounted once in the root layout. Fires
// at most once every 5 seconds to avoid flooding the endpoint.

import { useEffect } from "react";

let lastSent = 0;

function sendEvent(payload: { kind: string; message?: string; stack?: string; pageUrl?: string }) {
  const now = Date.now();
  if (now - lastSent < 5000) return; // throttle
  lastSent = now;

  try {
    fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, pageUrl: window.location.href }),
    }).catch(() => {}); // fire-and-forget
  } catch {
    // fail silently
  }
}

export default function ErrorTracker() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      sendEvent({
        kind: "js_error",
        message: event.message,
        stack: event.error?.stack,
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      sendEvent({
        kind: "unhandled_rejection",
        message: reason?.message ?? String(reason),
        stack: reason?.stack,
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
