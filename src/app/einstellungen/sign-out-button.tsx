"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button className="button button-dark button-full" type="button" onClick={signOut} disabled={busy}>
      {busy ? "Wird abgemeldet …" : "Abmelden"}
    </button>
  );
}
