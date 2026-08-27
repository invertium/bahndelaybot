import "server-only";
import { appendFile } from "node:fs/promises";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { Resend } from "resend";
import { getServerEnv } from "@/lib/env";

interface EmailContentProps {
  heading: string;
  preview: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
}

function EmailContent({ heading, preview, message, actionLabel, actionUrl }: EmailContentProps) {
  return (
    <Html lang="de">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f1f4ef", fontFamily: "Arial, sans-serif", color: "#173126" }}>
        <Container style={{ backgroundColor: "#ffffff", margin: "40px auto", maxWidth: 560, padding: 32, borderRadius: 24 }}>
          <Text style={{ color: "#e4512d", fontWeight: 700, letterSpacing: 1.2 }}>BAHNDELAY</Text>
          <Heading style={{ fontSize: 28 }}>{heading}</Heading>
          <Text style={{ fontSize: 16, lineHeight: 1.6 }}>{message}</Text>
          <Button href={actionUrl} style={{ backgroundColor: "#173126", color: "#ffffff", padding: "14px 20px", borderRadius: 999 }}>
            {actionLabel}
          </Button>
          <Text style={{ color: "#66756d", fontSize: 13, marginTop: 28 }}>Der Link ist persönlich und nur einmal verwendbar.</Text>
        </Container>
      </Body>
    </Html>
  );
}

async function sendEmail(to: string, subject: string, content: React.ReactElement, idempotencyKey: string, developmentUrl: string) {
  const env = getServerEnv();
  const capturePath = process.env.EMAIL_CAPTURE_PATH;
  if (capturePath && process.env.NODE_ENV !== "production") {
    await appendFile(capturePath, `${JSON.stringify({ to, subject, url: developmentUrl })}\n`, { encoding: "utf8", mode: 0o600 });
    return { id: "captured" };
  }
  if (!env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is required in production");
    console.info(`[email:development] ${subject} -> ${to}: ${developmentUrl}`);
    return { id: "development" };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send(
    { from: env.EMAIL_FROM, to, subject, react: content },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  if (error) throw new Error(`Email delivery failed: ${error.message}`);
  return data;
}

export function sendInvitationEmail(email: string, inviteUrl: string, invitationId: string, attemptKey = `invitation-${invitationId}`) {
  return sendEmail(
    email,
    "Deine Einladung zu BahnDelay",
    <EmailContent
      heading="Du bist eingeladen"
      preview="Einladung zu BahnDelay"
      message="Mit BahnDelay behältst du Verspätungen und bessere Verbindungen während deiner Reise im Blick."
      actionLabel="Einladung annehmen"
      actionUrl={inviteUrl}
    />,
    attemptKey,
    inviteUrl,
  );
}

export function sendMagicLinkEmail(email: string, magicLinkUrl: string, token: string) {
  return sendEmail(
    email,
    "Dein Anmeldelink für BahnDelay",
    <EmailContent
      heading="Sicher anmelden"
      preview="Dein BahnDelay-Anmeldelink"
      message="Öffne den Link, um dich ohne Passwort sicher anzumelden. Er läuft nach zehn Minuten ab."
      actionLabel="Bei BahnDelay anmelden"
      actionUrl={magicLinkUrl}
    />,
    `magic-link-${hashForIdempotency(token)}`,
    magicLinkUrl,
  );
}

function hashForIdempotency(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash.toString(16);
}
