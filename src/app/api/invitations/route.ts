import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { invitations, memberships, user } from "@/db/schema";
import { sendInvitationEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/env";
import { getMemberSession } from "@/lib/membership";
import { createInvitationToken, hashToken, normalizeEmail } from "@/lib/security";

const invitationRequest = z.object({ email: z.string().email() });

export async function GET(request: Request) {
  const member = await getMemberSession(request.headers);
  if (!member || member.role !== "admin") return Response.json({ error: "Nicht erlaubt" }, { status: 403 });
  const records = await getDb()
    .select({
      id: invitations.id,
      email: invitations.email,
      expiresAt: invitations.expiresAt,
      redeemedAt: invitations.redeemedAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .orderBy(desc(invitations.createdAt))
    .limit(50);
  return Response.json({ invitations: records });
}

export async function POST(request: Request) {
  const member = await getMemberSession(request.headers);
  if (!member || member.role !== "admin") return Response.json({ error: "Nicht erlaubt" }, { status: 403 });

  const parsed = invitationRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Gültige E-Mail-Adresse erforderlich" }, { status: 400 });
  const email = normalizeEmail(parsed.data.email);

  const [existingMember] = await getDb()
    .select({ id: user.id })
    .from(user)
    .innerJoin(memberships, eq(memberships.userId, user.id))
    .where(eq(user.email, email))
    .limit(1);
  if (existingMember) return Response.json({ error: "Diese Person ist bereits Mitglied" }, { status: 409 });

  const [pending] = await getDb()
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.email, email), isNull(invitations.redeemedAt), gt(invitations.expiresAt, new Date())))
    .limit(1);
  if (pending) return Response.json({ error: "Für diese Adresse besteht bereits eine Einladung" }, { status: 409 });

  const token = createInvitationToken();
  const [created] = await getDb()
    .insert(invitations)
    .values({
      email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: member.session.user.id,
    })
    .returning({ id: invitations.id, expiresAt: invitations.expiresAt });
  const inviteUrl = `${getAppUrl()}/invite/${token}`;

  try {
    await sendInvitationEmail(email, inviteUrl, created.id);
  } catch (error) {
    await getDb().delete(invitations).where(eq(invitations.id, created.id));
    console.error("Invitation delivery failed", error);
    return Response.json({ error: "Einladung konnte nicht versendet werden" }, { status: 502 });
  }

  return Response.json(
    {
      id: created.id,
      expiresAt: created.expiresAt,
      ...(process.env.NODE_ENV === "development" ? { inviteUrl } : {}),
    },
    { status: 201 },
  );
}
