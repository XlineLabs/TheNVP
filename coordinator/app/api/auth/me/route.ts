import { ADMIN_EMAIL } from "@/app/lib/defaults";
import { HttpError, json } from "@/app/lib/http";
import { getUserBalance } from "@/app/lib/ledger";
import { isAdminEmail, requireUser } from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — current chatbot user + USD balance. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const balance = await getUserBalance(user.id);
    return json({
      user: { id: user.id, email: user.email },
      balance,
      currency: "USD",
      is_admin: isAdminEmail(user.email, ADMIN_EMAIL),
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
