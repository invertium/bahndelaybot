"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export function AcceptInviteButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function accept() {
    setState("sending");
    setMessage("");
    try {
      const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "Anmeldelink konnte nicht gesendet werden. Bitte versuche es erneut.");
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setMessage("Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut.");
      setState("error");
    }
  }

  if (state === "sent") return <p className="notice success" aria-live="polite">E-Mail ist unterwegs. Du kannst dieses Fenster schließen.</p>;
  return (
    <>
      <button className="button primary wide" type="button" onClick={accept} disabled={state === "sending"}>
        <Mail size={18} aria-hidden="true" />
        {state === "sending" ? "Wird gesendet …" : state === "error" ? "Erneut versuchen" : "Anmeldelink senden"}
      </button>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
    </>
  );
}
