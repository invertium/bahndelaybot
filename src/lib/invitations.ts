import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { invitations, memberships } from "@/db/schema";
import { hashToken, normalizeEmail } from "@/lib/security";

export interface CompleteInvitationInput {
  token: string;
  userId: string;
  email: string;
}

type InvitationDatabase = Pick<ReturnType<typeof getDb>, "execute">;

function completedFromResult(result: unknown) {
  const rows = result && typeof result === "object" && "rows" in result
    ? (result as { rows?: unknown }).rows
    : result;
  if (!Array.isArray(rows) || !rows[0] || typeof rows[0] !== "object" || !("completed" in rows[0])) return false;
  const completed = (rows[0] as { completed: unknown }).completed;
  return completed === true || completed === "true" || completed === 1 || completed === "1";
}

export async function completePendingInvitation(
  input: CompleteInvitationInput,
  db: InvitationDatabase = getDb(),
) {
  const tokenHash = hashToken(input.token);
  const email = normalizeEmail(input.email);
  const result = await db.execute(sql`
    WITH claimed AS (
      UPDATE ${invitations}
      SET ${sql.identifier("redeemed_at")} = now()
      WHERE ${invitations.tokenHash} = ${tokenHash}
        AND ${invitations.email} = ${email}
        AND ${invitations.redeemedAt} IS NULL
        AND ${invitations.expiresAt} > now()
      RETURNING ${invitations.id}
    ), inserted AS (
      INSERT INTO ${memberships} (${sql.identifier("user_id")}, ${sql.identifier("role")})
      SELECT ${input.userId}, 'member' FROM claimed
      ON CONFLICT (${sql.identifier("user_id")}) DO NOTHING
      RETURNING ${memberships.userId}
    ), previously_completed AS (
      SELECT ${invitations.id}
      FROM ${invitations}
      WHERE ${invitations.tokenHash} = ${tokenHash}
        AND ${invitations.email} = ${email}
        AND ${invitations.redeemedAt} IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM ${memberships}
          WHERE ${memberships.userId} = ${input.userId}
        )
    )
    SELECT (
      EXISTS (SELECT 1 FROM claimed)
      OR EXISTS (SELECT 1 FROM previously_completed)
    ) AS completed
  `);
  return completedFromResult(result)
    ? { ok: true as const }
    : { ok: false as const, reason: "invalid" as const };
}
