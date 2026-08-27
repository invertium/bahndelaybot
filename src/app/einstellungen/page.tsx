import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { requirePageMember } from "@/lib/membership";
import { SignOutButton } from "./sign-out-button";

export default async function SettingsPage() {
  const member = await requirePageMember();
  return (
    <main className="auth-page">
      <Link href="/dashboard" className="back-link"><ArrowLeft size={16} /> Reisen</Link>
      <section className="auth-card">
        <span className="icon-circle"><Settings size={21} /></span>
        <h1>Dein <em>Konto</em></h1>
        <p>Angemeldet als <strong>{member.session.user.email}</strong>. BahnDelay speichert keine Zugangsdaten deines DB-Kontos.</p>
        <SignOutButton />
      </section>
    </main>
  );
}
