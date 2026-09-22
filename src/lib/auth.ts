import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * The key every session cookie is signed with.
 *
 * This used to fall back to the string "dev-only-secret" when the variable
 * was unset. That fallback is in this repository, so anyone reading it could
 * mint a token saying {"kind":"admin"} and the site would believe it — the
 * whole admin, from a text editor. It failed open, and silently, which is the
 * worst way for a thing like this to fail.
 *
 * Now a missing secret throws. Deliberately when a session is signed or read,
 * not when this module loads: the production build evaluates every route's
 * module graph, and the environment variable is not present at build time
 * (it is scoped to the running functions, which is where it belongs). Failing
 * at import would make the build fall over; failing at use makes requests
 * fail closed, which is the behaviour actually wanted.
 */
function sessionSecret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return new TextEncoder().encode(value);

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. Set it in the hosting environment — " +
        "sessions cannot be signed safely without it."
    );
  }
  // Development and the test suite only, and never reachable in production.
  return new TextEncoder().encode("dev-only-secret-not-for-production-use");
}
const CUSTOMER_COOKIE = "urvi_session";
const ADMIN_COOKIE = "urvi_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

async function signSession(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(sessionSecret());
}

async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Customer

export async function createCustomerSession(customerId: string) {
  const token = await signSession({ sub: customerId, kind: "customer" });
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getCustomerSession() {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload || payload.kind !== "customer") return null;
  return payload.sub as string;
}

export async function clearCustomerSession() {
  const store = await cookies();
  store.delete(CUSTOMER_COOKIE);
}

// ------------------------------------------------------------------ Admin

export async function createAdminSession(adminId: string) {
  const token = await signSession({ sub: adminId, kind: "admin" });
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * The admin behind the current cookie, or null.
 *
 * Two checks beyond "the signature is valid", both of which were missing:
 *
 *  * the id in the token has to name a real row in admin_users. Without that,
 *    a token merely saying {"kind":"admin"} was enough — the id was never
 *    looked up, so it did not have to be anyone.
 *  * the token has to have been issued after that admin's last password
 *    change. This is what makes changing the password actually end the
 *    sessions opened with the old one: the cookie is a signed statement with
 *    no server-side record, so without a timestamp to compare it against,
 *    a stolen one stayed good for its full thirty days.
 *
 * This costs one query per admin request. Worth it on this side of the site.
 */
export async function getAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload || payload.kind !== "admin") return null;

  const adminId = payload.sub as string | undefined;
  if (!adminId) return null;

  const { db, schema } = await import("@/db");
  const { eq } = await import("drizzle-orm");
  const admin = await db.query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, adminId) });
  if (!admin) return null;

  if (admin.passwordChangedAt) {
    // iat is in seconds; a token issued in the same second as the change is
    // treated as older, which errs towards signing someone out.
    const issuedAtMs = typeof payload.iat === "number" ? payload.iat * 1000 : 0;
    if (issuedAtMs <= admin.passwordChangedAt.getTime()) return null;
  }

  return adminId;
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
