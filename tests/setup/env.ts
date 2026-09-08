// Everything the suite needs to know about the environment it runs against,
// in one place. Defaults work out of the box against a local Postgres; CI
// overrides TEST_DATABASE_URL to point at its own service container.

import path from "node:path";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres:devpassword@localhost:5432/urvi_test";

// Same server, but the always-present "postgres" database — needed to DROP
// and CREATE the test database itself.
export function maintenanceUrl(): string {
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = "/postgres";
  return url.toString();
}

export function testDatabaseName(): string {
  return new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
}

export const PORT = Number(process.env.TEST_PORT || 3100);
export const BASE_URL = `http://localhost:${PORT}`;

export const ARTIFACTS_DIR = path.join(process.cwd(), "test-results");
export const OUTBOX_FILE = path.join(ARTIFACTS_DIR, "mail-outbox.jsonl");

export const ADMIN_EMAIL = "admin@test.urvistudios.in";
export const ADMIN_PASSWORD = "TestAdminPass123!";

// A stand-in Razorpay secret. Note that RAZORPAY_KEY_ID is deliberately left
// EMPTY for the app under test: checkout treats Razorpay as "not configured"
// unless both are present, so the storefront exercises the WhatsApp/COD path
// (and never calls the real Razorpay API), while /api/checkout/verify-payment
// — which only needs the secret to check an HMAC signature — stays fully
// testable with locally-signed payloads.
export const RAZORPAY_TEST_SECRET = "test-razorpay-secret";

// The environment the app under test is started with.
export function appEnv(): Record<string, string> {
  return {
    NODE_ENV: "production",
    DATABASE_URL: TEST_DATABASE_URL,
    SESSION_SECRET: "test-session-secret-not-used-anywhere-real",
    ADMIN_BOOTSTRAP_EMAIL: ADMIN_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD: ADMIN_PASSWORD,
    RAZORPAY_KEY_ID: "",
    RAZORPAY_KEY_SECRET: RAZORPAY_TEST_SECRET,
    MAIL_OUTBOX_FILE: OUTBOX_FILE,
    CONTACT_NOTIFY_EMAIL: "shop@test.urvistudios.in",
    GMAIL_USER: "",
    GMAIL_APP_PASSWORD: "",
  };
}
