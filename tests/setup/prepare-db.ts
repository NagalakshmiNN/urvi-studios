// Builds a throwaway test database from scratch, then hands over to the app.
//
// This runs as the first half of Playwright's webServer command rather than
// as a globalSetup hook, because Playwright starts the web server *before*
// globalSetup — which would leave the app briefly connected to the previous
// run's database while this script replaced it underneath it.
//
// The schema is built by replaying the real migration files in
// netlify/database/migrations/ in order — the exact same SQL Netlify runs on
// deploy — so a broken or out-of-order migration fails the test run instead
// of surprising us in production. The seed script that ships with the app
// then fills in categories, the sample catalog, the admin user and the
// starter coupon.

import { Client } from "pg";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ARTIFACTS_DIR,
  OUTBOX_FILE,
  TEST_DATABASE_URL,
  maintenanceUrl,
  testDatabaseName,
} from "./env";

const MIGRATIONS_DIR = path.join(process.cwd(), "netlify", "database", "migrations");

async function recreateDatabase() {
  const dbName = testDatabaseName();
  const client = new Client({ connectionString: maintenanceUrl() });
  await client.connect();
  try {
    // Kick off any stale connections (a previous run that didn't shut down
    // cleanly) or the DROP will hang.
    await client.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`,
      [dbName]
    );
    await client.query(`drop database if exists "${dbName}"`);
    await client.query(`create database "${dbName}"`);
  } finally {
    await client.end();
  }
}

async function applyMigrations() {
  const dirs = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  if (dirs.length === 0) throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    for (const dir of dirs) {
      const file = path.join(MIGRATIONS_DIR, dir, "migration.sql");
      if (!fs.existsSync(file)) throw new Error(`Migration ${dir} has no migration.sql`);
      const sql = fs.readFileSync(file, "utf8");
      try {
        await client.query(sql);
      } catch (err) {
        throw new Error(`Migration ${dir} failed: ${(err as Error).message}`);
      }
    }
    console.log(`  applied ${dirs.length} migrations`);
  } finally {
    await client.end();
  }
}

function runSeed() {
  execFileSync("npx", ["tsx", "src/db/seed-cli.ts"], {
    stdio: "pipe",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      ADMIN_BOOTSTRAP_EMAIL: ADMIN_EMAIL,
      ADMIN_BOOTSTRAP_PASSWORD: ADMIN_PASSWORD,
    },
  });
}

async function main() {
  console.log("Preparing test database…");
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  fs.writeFileSync(OUTBOX_FILE, "");

  await recreateDatabase();
  await applyMigrations();
  runSeed();

  console.log("  seeded catalog, admin user and starter coupon");
}

main().catch((err) => {
  console.error(`\nTest database setup failed: ${(err as Error).message}\n`);
  process.exit(1);
});
