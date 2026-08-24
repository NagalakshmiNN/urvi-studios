// CLI entry point for seeding the database directly (local dev, or a
// one-off run against production with DATABASE_URL set). Run with:
//   npx tsx --env-file=.env src/db/seed-cli.ts

import { runSeed } from "./seed";

runSeed().catch((err) => {
  console.error(err);
  process.exit(1);
});
