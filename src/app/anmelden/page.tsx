"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, TrainFront } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  return <main className="auth-page"><Link href="/" className="back-link"><ArrowLeft size={16} /> Zurück</Link><section className="auth-card"><span className="brand-mark brand-mark-large"><TrainFront size={22} /></span><h1>Willkommen bei<br /><em>BahnDelay</em></h1>{sent ? <div className="sent-state"><div className="icon-circle"><Mail size={22} /></div><h2>Check deine Mails</h2><p>Wir haben dir einen Anmeldelink an <strong>{email}</strong> geschickt.</p><button className="text-button" onClick={() => setSent(false)}>Andere E-Mail verwenden</button></div> : <><p>Gib deine E-Mail-Adresse ein. Du erhältst einen sicheren Link zum Anmelden.</p><form onSubmit={async (e) => { e.preventDefault(); setError(""); setLoading(true); const result = await authClient.signIn.magicLink({ email, callbackURL: "/dashboard" }); setLoading(false); if (result.error) setError(result.error.message ?? "Anmeldung nicht möglich"); else setSent(true); }}><label htmlFor="email">E-Mail-Adresse</label><input id="email" type="email" required placeholder="du@beispiel.de" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="button button-dark button-full" type="submit" disabled={loading}>{loading ? "Wird gesendet …" : "Anmeldelink senden"} <ArrowRight size={17} /></button>{error && <p className="form-error" role="alert">{error}</p>}</form><div className="auth-hint">Noch keine Einladung? <span>Bitte den Admin deiner Gruppe.</span></div></>}</section><p className="legal-copy">Mit der Anmeldung stimmst du unseren Datenschutzbestimmungen zu.</p></main>;
}
