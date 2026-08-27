import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getDb } from "@/db";
import { invitations, memberships } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hashToken, normalizeEmail } from "@/lib/security";

export async function completePendingInvitation() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false as const, reason: "signed-out" as const };
  const cookieStore = await cookies();
  const token = cookieStore.get("pending_invite")?.value;
  if (!token) return { ok: false as const, reason: "missing" as const };

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(invitations)
      .set({ redeemedAt: new Date() })
      .where(
        and(
          eq(invitations.tokenHash, hashToken(token)),
          eq(invitations.email, normalizeEmail(session.user.email)),
          isNull(invitations.redeemedAt),
        ),
      )
      .returning({ id: invitations.id });
    if (!claimed) return false;
    await tx.insert(memberships).values({ userId: session.user.id, role: "member" }).onConflictDoNothing();
    return true;
  });
  if (result) cookieStore.delete("pending_invite");
  return result ? { ok: true as const } : { ok: false as const, reason: "invalid" as const };
}
