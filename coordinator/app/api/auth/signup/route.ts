import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { userLedgerEntries, users } from "@/app/db/schema";
import { SIGNUP_GRANT_USD } from "@/app/lib/env";
import { error, json } from "@/app/lib/http";
import { id } from "@/app/lib/ids";
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/signup — create a chatbot user.
 * Grants a free $1500 USD balance (v0; no real money) so the chatbot is usable
 * immediately and flipping to real billing later is trivial.
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !EMAIL_RE.test(email)) return error("Valid email required", 400);
  if (password.length < 8) return error("Password must be at least 8 characters", 400);

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return error("Email already registered", 409);

  const userId = id("usr");
  await db.batch([
    db.insert(users).values({ id: userId, email, passwordHash: await hashPassword(password) }),
    db.insert(userLedgerEntries).values({
      id: id("ule"),
      userId,
      amount: SIGNUP_GRANT_USD.toFixed(6),
      type: "grant",
    }),
  ]);

  const token = await createSessionToken(userId);
  const res = json({ user: { id: userId, email }, balance: SIGNUP_GRANT_USD }, 201);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
