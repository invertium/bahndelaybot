import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) return NextResponse.redirect(new URL("/?anmeldung=erforderlich", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/journeys/:path*", "/admin/:path*"],
};
