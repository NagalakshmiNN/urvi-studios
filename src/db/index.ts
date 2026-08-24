import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getConnectionString } from "@netlify/database";
import * as dbSchema from "./schema";

// Connection resolution, in order:
//  1. An explicit DATABASE_URL (lets any environment override).
//  2. Netlify's auto-provisioned Postgres (works in production deploys and
//     in `netlify dev`) — throws when not running in a Netlify context.
//  3. A local Postgres instance for plain `next dev` outside Netlify.
function resolveConnectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    return getConnectionString();
  } catch {
    return "postgres://postgres:devpassword@localhost:5432/urvi_dev";
  }
}

const pool = new Pool({ connectionString: resolveConnectionString() });

export const db = drizzle(pool, { schema: dbSchema });
export const schema = dbSchema;
