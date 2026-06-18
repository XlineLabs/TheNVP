/**
 * Database client (Drizzle + Neon serverless HTTP driver).
 *
 * The neon-http driver tunnels SQL over HTTPS (443), which works in restricted
 * networks (no raw 5432), on Vercel serverless, and on a dev Mac alike.
 *
 * Trade-off: HTTP is stateless, so there are no interactive transactions held
 * across awaits. We get atomicity via:
 *   - single-statement dispatch (UPDATE ... WHERE id = (SELECT ... FOR UPDATE
 *     SKIP LOCKED)), and
 *   - conditional guarded writes + db.batch([...]) for multi-row commits.
 * See docs/03 (dispatch) and the result endpoint.
 *
 * The client is initialized lazily (on first query) so CLI scripts can load
 * .env.local before the connection string is read.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { env } from "@/app/lib/env";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | undefined;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    const sql = neon(env.DATABASE_URL);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

/** Lazy proxy: the real Drizzle db is created on first property access. */
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
