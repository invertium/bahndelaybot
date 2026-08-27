import { and, eq, gt, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { invitations } from "@/db/schema";
import { hashToken, isInvitationToken, maskEmail } from "@/lib/security";
import { AcceptInviteButton } from "./accept-invite-button";

export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isInvitationToken(token)) notFound();
  const [invite] = await getDb()
    .select({ email: invitations.email, expiresAt: invitations.expiresAt })
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, hashToken(token)),
        isNull(invitations.redeemedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!invite) notFound();

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">PERSÖNLICHE EINLADUNG</span>
        <h1>Gemeinsam entspannter ankommen.</h1>
        <p>Dein Anmeldelink wird an {maskEmail(invite.email)} geschickt.</p>
        <AcceptInviteButton token={token} />
        <small>Gültig bis {invite.expiresAt.toLocaleDateString("de-DE")}.</small>
      </section>
    </main>
  );
}
