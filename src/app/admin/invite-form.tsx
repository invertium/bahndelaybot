"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";

export function InviteForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; inviteUrl?: string };
      setMessage(response.ok ? `Einladung versendet${result.inviteUrl ? `: ${result.inviteUrl}` : "."}` : (result.error ?? "Senden fehlgeschlagen"));
      if (response.ok) formElement.reset();
    } catch {
      setMessage("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="panel form-stack" onSubmit={submit}>
      <label htmlFor="invite-email">E-Mail-Adresse</label>
      <div className="input-action">
        <input id="invite-email" name="email" type="email" autoComplete="email" required placeholder="name@beispiel.de" />
        <button className="button primary" disabled={pending}>
          <Send size={17} aria-hidden="true" /> {pending ? "Sendet …" : "Einladen"}
        </button>
      </div>
      {message ? <p className="notice" aria-live="polite">{message}</p> : null}
    </form>
  );
}
