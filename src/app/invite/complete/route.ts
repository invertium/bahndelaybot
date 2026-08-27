import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { completePendingInvitation } from "@/lib/invitations";

function redirectTo(path: string) {
  return new URL(path, getAppUrl());
}

function noStoreRedirect(path: string) {
  const response = NextResponse.redirect(redirectTo(path), 303);
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return noStoreRedirect("/?anmeldung=erforderlich");

  const token = request.cookies.get("pending_invite")?.value;
  if (!token) return noStoreRedirect("/invite/fehlgeschlagen?grund=fehlt");

  const result = await completePendingInvitation({
    token,
    userId: session.user.id,
    email: session.user.email,
  });
  const response = result.ok
    ? noStoreRedirect("/dashboard?willkommen=1")
    : noStoreRedirect("/invite/fehlgeschlagen?grund=ungueltig");
  response.cookies.delete("pending_invite");
  return response;
}
