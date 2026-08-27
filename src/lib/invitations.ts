import "server-only";
import { sql } from "drizzle-orm";
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
  const result = await db.execute(sql`
    WITH claimed AS (
      UPDATE ${invitations}
      SET ${sql.identifier("redeemed_at")} = now()
      WHERE ${invitations.tokenHash} = ${hashToken(token)}
        AND ${invitations.email} = ${normalizeEmail(session.user.email)}
        AND ${invitations.redeemedAt} IS NULL
        AND ${invitations.expiresAt} > now()
      RETURNING ${invitations.id}
    ), inserted AS (
      INSERT INTO ${memberships} (${sql.identifier("user_id")}, ${sql.identifier("role")})
      SELECT ${session.user.id}, 'member' FROM claimed
      ON CONFLICT (${sql.identifier("user_id")}) DO NOTHING
      RETURNING ${memberships.userId}
    ) SELECT count(*)::int AS count FROM claimed
  `);
  const rows = (result as unknown as { rows?: unknown }).rows;
  const count = Array.isArray(rows) && rows[0] && typeof rows[0] === "object" && "count" in rows[0]
    ? Number((rows[0] as { count: unknown }).count)
    : 0;
  const claimed = count > 0;
  if (claimed) cookieStore.delete("pending_invite");
  return claimed ? { ok: true as const } : { ok: false as const, reason: "invalid" as const };
}
