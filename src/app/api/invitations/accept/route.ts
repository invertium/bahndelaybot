import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { invitations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hashToken, normalizeEmail } from "@/lib/security";

const acceptRequest = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "invalid token") });

export async function POST(request: Request) {
  const parsed = acceptRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Einladung ungültig" }, { status: 400 });
  const token = parsed.data.token;
  const [invite] = await getDb()
    .select({ email: invitations.email })
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, hashToken(token)),
        isNull(invitations.redeemedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!invite) return Response.json({ error: "Einladung ist abgelaufen oder wurde bereits verwendet" }, { status: 410 });

  const cookieStore = await cookies();
  cookieStore.set("pending_invite", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  const result = await auth.api.signInMagicLink({
    headers: request.headers,
    body: {
      email: normalizeEmail(invite.email),
      callbackURL: "/invite/complete",
      errorCallbackURL: "/?anmeldung=fehlgeschlagen",
      metadata: { inviteToken: token },
    },
  });
  if (!result?.status) return Response.json({ error: "Anmeldelink konnte nicht versendet werden" }, { status: 502, headers: { "cache-control": "no-store" } });
  return Response.json({ email: invite.email }, { headers: { "cache-control": "no-store" } });
}
