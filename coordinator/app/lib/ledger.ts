import { sql } from "drizzle-orm";
import { db } from "@/app/db/client";

/** Current balance = SUM(ledger_entries.amount) for a worker (docs/03 §solde). */
export async function getBalance(workerId: string): Promise<number> {
  const rows = await db.execute<{ balance: string }>(
    sql`SELECT COALESCE(SUM(amount), 0)::text AS balance FROM ledger_entries WHERE worker_id = ${workerId}`,
  );
  return Number(rows.rows[0]?.balance ?? "0");
}

/** Count of accepted jobs (earn entries) for a worker. */
export async function getJobsDone(workerId: string): Promise<number> {
  const rows = await db.execute<{ n: string }>(
    sql`SELECT COUNT(*)::text AS n FROM ledger_entries WHERE worker_id = ${workerId} AND type = 'earn'`,
  );
  return Number(rows.rows[0]?.n ?? "0");
}

/** Chatbot user's USD balance = SUM(user_ledger_entries.amount). */
export async function getUserBalance(userId: string): Promise<number> {
  const rows = await db.execute<{ balance: string }>(
    sql`SELECT COALESCE(SUM(amount), 0)::text AS balance FROM user_ledger_entries WHERE user_id = ${userId}`,
  );
  return Number(rows.rows[0]?.balance ?? "0");
}
