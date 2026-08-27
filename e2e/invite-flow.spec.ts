import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const fullInviteEnabled = process.env.E2E_FULL_INVITE === "1";
const databaseUrl = process.env.E2E_DATABASE_URL;
const capturePath = process.env.EMAIL_CAPTURE_PATH;

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function capturedMagicUrl(email: string) {
  if (!capturePath) return "";
  const contents = await readFile(capturePath, "utf8").catch(() => "");
  const messages = contents.trim().split("\n").filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line) as { to?: string; subject?: string; url?: string }];
    } catch {
      return [];
    }
  });
  return messages.find((message) => message.to === email && message.subject?.includes("Anmeldelink"))?.url ?? "";
}

test.describe("complete invitation journey", () => {
  test.skip(!fullInviteEnabled || !databaseUrl || !capturePath, "Run through `bun run test:e2e` to provision the isolated database and email capture.");

  test("accepts an invitation, signs in, redeems membership, and imports the reported DB route", async ({ page, context }, testInfo) => {
    const sql = postgres(databaseUrl!, { max: 1 });
    const suffix = randomUUID();
    const creatorId = `creator-${suffix}`;
    const creatorEmail = `creator-${suffix}@example.test`;
    const inviteEmail = `invite-${suffix}@example.test`;
    const invitationId = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });

    try {
      await sql`INSERT INTO "user" (id, name, email, email_verified) VALUES (${creatorId}, 'E2E Creator', ${creatorEmail}, true)`;
      await sql`INSERT INTO invitations (id, email, token_hash, expires_at, created_by) VALUES (${invitationId}, ${inviteEmail}, ${hashToken(token)}, now() + interval '1 hour', ${creatorId})`;

      await page.goto(`/invite/${token}`);
      await expect(page.getByRole("heading", { name: /Gemeinsam entspannter ankommen/ })).toBeVisible();
      await page.getByRole("button", { name: "Anmeldelink senden" }).click();
      await expect(page.getByText(/E-Mail ist unterwegs/)).toBeVisible();

      await expect.poll(() => capturedMagicUrl(inviteEmail), { timeout: 15_000 }).toMatch(/^http:\/\/localhost:3000\/api\/auth\//);
      const magicUrl = await capturedMagicUrl(inviteEmail);
      await page.goto(magicUrl);
      await page.waitForURL(/\/dashboard\?willkommen=1$/, { timeout: 20_000 });
      await expect(page.getByRole("link", { name: /Reise hinzufügen/ })).toBeVisible();

      const [state] = await sql<{ redeemed_at: Date | null; role: string | null }[]>`
        SELECT invitations.redeemed_at, memberships.role
        FROM invitations
        JOIN "user" ON "user".email = invitations.email
        LEFT JOIN memberships ON memberships.user_id = "user".id
        WHERE invitations.id = ${invitationId}
      `;
      expect(state?.redeemed_at).not.toBeNull();
      expect(state?.role).toBe("member");
      expect((await context.cookies()).some((cookie) => cookie.name === "pending_invite")).toBe(false);

      if (testInfo.project.name === "Desktop Chrome") {
        await page.goto("/dashboard/import");
        await page.getByLabel("DB Navigator Link").fill("https://int.bahn.de/en/buchung/start?vbid=2112412b-b348-4912-9a5c-ca51ef3a31ba");
        await page.getByRole("button", { name: /Import prüfen/ }).click();
        const recommendation = page.locator(".plan-choice").first();
        await expect(recommendation).toContainText("Empfohlen", { timeout: 30_000 });
        await expect(recommendation).toContainText("ICE 512 → ICE 22");
        await expect(recommendation).toContainText("1 Umstieg");
        await expect(recommendation).toContainText("22:18");
        await page.screenshot({ path: testInfo.outputPath("db-route-recommendation.png"), fullPage: true });
      }

      expect(browserErrors).toEqual([]);
    } finally {
      await sql`DELETE FROM invitations WHERE id = ${invitationId}`;
      await sql`DELETE FROM "user" WHERE email IN (${inviteEmail}, ${creatorEmail})`;
      await sql.end();
    }
  });
});
