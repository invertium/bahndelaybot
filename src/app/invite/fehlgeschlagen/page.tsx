import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Einladung nicht abgeschlossen",
  robots: { index: false, follow: false },
};

export default function FailedInvitePage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Einladung konnte nicht abgeschlossen werden.</h1>
        <p>Der Link ist abgelaufen oder bereits verwendet. Bitte lass dir in der Administration eine neue Einladung schicken.</p>
        <Link className="button primary" href="/">Zur Startseite</Link>
      </section>
    </main>
  );
}
