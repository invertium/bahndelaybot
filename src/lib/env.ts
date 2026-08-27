import { z } from "zod";

const serverSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("BahnDelay <onboarding@resend.dev>"),
  APP_CONTACT_EMAIL: z.string().email(),
  TRANSITOUS_USER_AGENT: z.string().min(8),
});

export function getServerEnv() {
  return serverSchema.parse({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    APP_CONTACT_EMAIL: process.env.APP_CONTACT_EMAIL,
    TRANSITOUS_USER_AGENT: process.env.TRANSITOUS_USER_AGENT,
  });
}

export function getAppUrl() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
