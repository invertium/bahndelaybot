import { createHash, randomBytes } from "node:crypto";

const INVITATION_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function isInvitationToken(value: string) {
  return INVITATION_TOKEN.test(value);
}

export function maskEmail(email: string) {
  const [local, domain] = normalizeEmail(email).split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}
