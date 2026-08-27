"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export function AcceptInviteButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function accept() {
    setState("sending");
    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setState(response.ok ? "sent" : "error");
  }

  if (state === "sent") return <p className="notice success">E-Mail ist unterwegs. Du kannst dieses Fenster schließen.</p>;
  return (
    <button className="button primary wide" type="button" onClick={accept} disabled={state === "sending"}>
      <Mail size={18} aria-hidden="true" />
      {state === "sending" ? "Wird gesendet …" : "Anmeldelink senden"}
      {state === "error" ? <span className="sr-only">Senden fehlgeschlagen</span> : null}
    </button>
  );
}
