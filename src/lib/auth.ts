import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb } from "@/db";
import { invitations, memberships, schema, user } from "@/db/schema";
import { sendMagicLinkEmail } from "@/lib/email";
import { getAppUrl, getServerEnv } from "@/lib/env";
import { hashToken, normalizeEmail } from "@/lib/security";

const env = getServerEnv();

async function mayReceiveMagicLink(emailInput: string, metadata?: Record<string, unknown>) {
  const email = normalizeEmail(emailInput);
  if (email === normalizeEmail(env.BOOTSTRAP_ADMIN_EMAIL)) return true;

  const db = getDb();
  const [member] = await db
    .select({ id: user.id })
    .from(user)
    .innerJoin(memberships, eq(memberships.userId, user.id))
    .where(eq(user.email, email))
    .limit(1);
  if (member) return true;

  const inviteToken = typeof metadata?.inviteToken === "string" ? metadata.inviteToken : undefined;
  if (!inviteToken) return false;
  const [invite] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        eq(invitations.tokenHash, hashToken(inviteToken)),
        isNull(invitations.redeemedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(invite);
}

export const auth = betterAuth({
  appName: "BahnDelay",
  baseURL: getAppUrl(),
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [getAppUrl()],
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema,
  }),
  advanced: {
    database: { joins: true },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },
  plugins: [
    magicLink({
      expiresIn: 600,
      storeToken: "hashed",
      sendMagicLink: async ({ email, token, url, metadata }) => {
        if (!(await mayReceiveMagicLink(email, metadata))) {
          // Do not reveal membership status to the caller.
          return;
        }
        await sendMagicLinkEmail(normalizeEmail(email), url, token);
      },
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
