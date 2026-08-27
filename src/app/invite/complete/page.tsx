import { redirect } from "next/navigation";
import Link from "next/link";
import { completePendingInvitation } from "@/lib/invitations";

export default async function CompleteInvitePage() {
  const result = await completePendingInvitation();
  if (result.ok) redirect("/dashboard?willkommen=1");
  if (result.reason === "signed-out") redirect("/?anmeldung=erforderlich");
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Einladung konnte nicht abgeschlossen werden.</h1>
        <p>Der Link ist abgelaufen oder bereits verwendet. Bitte lass dir eine neue Einladung schicken.</p>
        <Link className="button primary" href="/">Zur Startseite</Link>
      </section>
    </main>
  );
}
