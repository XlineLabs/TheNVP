/**
 * Applies generated SQL migrations from ./drizzle to DATABASE_URL via Neon HTTP.
 * Run with: pnpm db:migrate
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { DEFAULTS } from "@/app/lib/defaults";

async function main() {
  const url = process.env.DATABASE_URL || DEFAULTS.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL");

  const sql = neon(url);
  const db = drizzle(sql);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
