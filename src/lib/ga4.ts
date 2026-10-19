// GA4 Data API integration — authenticates with the service account
// and queries the Analytics Data API (REST). Uses jose (already in deps)
// for JWT signing, so there is zero additional dependency.

import { SignJWT, importPKCS8 } from "jose";

// ---- Module-scope caches (cold-start–safe) ----
let tokenCache: { token: string; expiresAt: number } | null = null;
let propertyCache: string | null = null;

// ---- Auth ----
async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const raw = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GA4_SERVICE_ACCOUNT_KEY is not set");

  const creds = JSON.parse(raw);
  const key = await importPKCS8(creds.private_key, "RS256");

  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/analytics.readonly",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .setIssuer(creds.client_email)
    .setSubject(creds.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description ?? "Failed to obtain Google access token");
  }

  tokenCache = { token: data.access_token, expiresAt: Date.now() + 3_500_000 };
  return data.access_token;
}

// ---- Property discovery ----
async function discoverPropertyId(token: string): Promise<string> {
  if (propertyCache) return propertyCache;

  // If an explicit numeric ID is stored, use it directly.
  const explicit = process.env.GA4_NUMERIC_PROPERTY_ID;
  if (explicit) {
    propertyCache = explicit;
    return explicit;
  }

  // Otherwise discover via the Admin API (the service account must be a
  // Viewer on at least one GA4 property).
  const res = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    throw new Error(
      "Cannot discover GA4 property. Enable the Google Analytics Admin API " +
      "in Cloud Console, or set GA4_NUMERIC_PROPERTY_ID env var. " +
      `(${err?.error?.message ?? res.status})`,
    );
  }

  const body = await res.json();
  for (const acct of body.accountSummaries ?? []) {
    for (const prop of acct.propertySummaries ?? []) {
      const id = (prop.property as string).replace("properties/", "");
      propertyCache = id;
      return id;
    }
  }

  throw new Error("No GA4 properties accessible to this service account");
}

// ---- Data API wrapper ----
async function runReport(
  propertyId: string,
  token: string,
  body: Record<string, unknown>,
) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `GA4 Data API ${res.status}`);
  }

  return res.json();
}

// ---- Helper to pull a simple number out of a one-row report ----
function metricValue(report: any, index: number): number {
  return Number(report?.rows?.[0]?.metricValues?.[index]?.value ?? 0);
}

// ---- Public API ----
export type GA4Data = {
  ok: true;
  summary: {
    sessions: number;
    totalUsers: number;
    newUsers: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  sessionsByDay: { day: string; sessions: number; users: number }[];
  trafficSources: { channel: string; sessions: number; users: number }[];
  topPages: { path: string; views: number }[];
  devices: { category: string; sessions: number; users: number }[];
};

export async function fetchGA4Data(from: string, to: string): Promise<GA4Data> {
  const token = await getAccessToken();
  const propertyId = await discoverPropertyId(token);

  const dateRanges = [{ startDate: from, endDate: to }];

  // Run all five reports in parallel.
  const [summaryR, dailyR, sourcesR, pagesR, devicesR] = await Promise.all([
    // 1. Summary metrics
    runReport(propertyId, token, {
      dateRanges,
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
    }),
    // 2. Sessions by day
    runReport(propertyId, token, {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    // 3. Traffic sources
    runReport(propertyId, token, {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
    // 4. Top pages
    runReport(propertyId, token, {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 15,
    }),
    // 5. Device category
    runReport(propertyId, token, {
      dateRanges,
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
    }),
  ]);

  // Parse daily sessions
  const sessionsByDay = (dailyR.rows ?? []).map((r: any) => {
    const raw = r.dimensionValues[0].value; // YYYYMMDD
    const day = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return {
      day,
      sessions: Number(r.metricValues[0].value),
      users: Number(r.metricValues[1].value),
    };
  });

  // Parse traffic sources
  const trafficSources = (sourcesR.rows ?? []).map((r: any) => ({
    channel: r.dimensionValues[0].value,
    sessions: Number(r.metricValues[0].value),
    users: Number(r.metricValues[1].value),
  }));

  // Parse top pages
  const topPages = (pagesR.rows ?? []).map((r: any) => ({
    path: r.dimensionValues[0].value,
    views: Number(r.metricValues[0].value),
  }));

  // Parse devices
  const devices = (devicesR.rows ?? []).map((r: any) => ({
    category: r.dimensionValues[0].value,
    sessions: Number(r.metricValues[0].value),
    users: Number(r.metricValues[1].value),
  }));

  return {
    ok: true,
    summary: {
      sessions: metricValue(summaryR, 0),
      totalUsers: metricValue(summaryR, 1),
      newUsers: metricValue(summaryR, 2),
      avgSessionDuration: Math.round(metricValue(summaryR, 3)),
      bounceRate: Math.round(metricValue(summaryR, 4) * 100),
    },
    sessionsByDay,
    trafficSources,
    topPages,
    devices,
  };
}
