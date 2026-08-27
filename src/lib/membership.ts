import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { memberships } from "@/db/schema";
import { auth, type AuthSession } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { normalizeEmail } from "@/lib/security";

export interface MemberSession {
  session: AuthSession;
  role: "admin" | "member";
}

async function ensureBootstrapAdministrator(session: AuthSession) {
  const bootstrapEmail = normalizeEmail(getServerEnv().BOOTSTRAP_ADMIN_EMAIL);
  if (normalizeEmail(session.user.email) !== bootstrapEmail) return;
  await getDb()
    .insert(memberships)
    .values({ userId: session.user.id, role: "admin" })
    .onConflictDoNothing();
}

export async function getMemberSession(requestHeaders?: Headers): Promise<MemberSession | null> {
  const session = await auth.api.getSession({ headers: requestHeaders ?? (await headers()) });
  if (!session) return null;
  await ensureBootstrapAdministrator(session);
  const [membership] = await getDb()
    .select({ role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);
  return membership ? { session, role: membership.role } : null;
}

export async function requirePageMember() {
  const member = await getMemberSession();
  if (!member) redirect("/?anmeldung=erforderlich");
  return member;
}

export async function requirePageAdmin() {
  const member = await requirePageMember();
  if (member.role !== "admin") redirect("/dashboard");
  return member;
}
