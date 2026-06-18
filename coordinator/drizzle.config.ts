import { defineConfig } from "drizzle-kit";

// drizzle-kit reads DATABASE_URL from the environment. Load it from .env.local
// when running CLI commands (see package.json db:* scripts).
import { config } from "dotenv";
import { DEFAULTS } from "./app/lib/defaults";
config({ path: ".env.local" });

export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || DEFAULTS.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
