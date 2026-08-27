import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { invitations } from "@/db/schema";
import { requirePageAdmin } from "@/lib/membership";
import { InviteForm } from "./invite-form";

export default async function AdminPage() {
  await requirePageAdmin();
  const records = await getDb().select().from(invitations).orderBy(desc(invitations.createdAt)).limit(50);
  return (
    <main className="page-shell narrow">
      <a className="text-link" href="/dashboard">← Zurück</a>
      <header className="page-header">
        <span className="eyebrow">ADMINISTRATION</span>
        <h1>Menschen einladen</h1>
        <p>Einladungen sind an die E-Mail-Adresse gebunden und sieben Tage gültig.</p>
      </header>
      <InviteForm />
      <section className="panel">
        <h2>Letzte Einladungen</h2>
        <ul className="plain-list">
          {records.map((invite) => (
            <li key={invite.id} className="list-row">
              <span>{invite.email}</span>
              <small>{invite.redeemedAt ? "Angenommen" : invite.expiresAt < new Date() ? "Abgelaufen" : "Offen"}</small>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
