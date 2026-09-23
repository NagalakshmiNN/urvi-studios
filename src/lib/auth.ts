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
// A customer staying signed in for a month is a convenience they expect from
// a shop, and the worst a stolen customer session does is show someone their
// own order history and address.
const CUSTOMER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// The admin is a different proposition: it reads every customer's details,
// moves money and changes prices. Twelve hours covers a working day — sign in
// in the morning, still signed in at night — without leaving a token valid
// for a month on a laptop that gets left somewhere.
const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

async function signSession(payload: Record<string, unknown>, maxAgeSeconds: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
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
  const token = await signSession({ sub: customerId, kind: "customer" }, CUSTOMER_MAX_AGE_SECONDS);
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_MAX_AGE_SECONDS,
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
  const token = await signSession({ sub: adminId, kind: "admin" }, ADMIN_MAX_AGE_SECONDS);
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE_SECONDS,
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
    // Both sides are compared in whole seconds, because that is all a JWT
    // records: setIssuedAt() floors to the second, while passwordChangedAt
    // has milliseconds. Comparing the two directly meant a token minted
    // immediately after a password change looked *older* than the change
    // whenever the change landed mid-second — so changing your password
    // signed you out of the screen you changed it on, about half the time,
    // depending on where the clock happened to be.
    const issuedAtSeconds = typeof payload.iat === "number" ? payload.iat : 0;
    const changedAtSeconds = Math.floor(admin.passwordChangedAt.getTime() / 1000);
    if (issuedAtSeconds < changedAtSeconds) return null;
  }

  return adminId;
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
