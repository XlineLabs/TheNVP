import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { users } from "@/app/db/schema";
import { error, json } from "@/app/lib/http";
import { getUserBalance } from "@/app/lib/ledger";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

/** POST /api/auth/login — email + password. */
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) return error("Email and password required", 400);

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Same error whether the email exists or not (no account enumeration).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return error("Invalid email or password", 401);
  }

  const balance = await getUserBalance(user.id);
  const token = await createSessionToken(user.id);
  const res = json({ user: { id: user.id, email: user.email }, balance });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
