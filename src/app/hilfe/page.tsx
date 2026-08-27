import Link from "next/link";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { requirePageMember } from "@/lib/membership";
import { getServerEnv } from "@/lib/env";

export default async function HelpPage() {
  await requirePageMember();
  const contactEmail = getServerEnv().APP_CONTACT_EMAIL;
  return (
    <main className="auth-page">
      <Link href="/dashboard" className="back-link"><ArrowLeft size={16} /> Reisen</Link>
      <section className="auth-card">
        <span className="icon-circle"><CircleHelp size={21} /></span>
        <h1>So funktioniert <em>BahnDelay</em></h1>
        <p>Importiere ein textbasiertes DB-Ticket als PDF oder einen DB-Navigator-Link. Wir gleichen die Verbindung mit Transitous ab und zeigen Verspätungen sowie Alternativen. PDF-Dateien werden nur im Arbeitsspeicher gelesen und danach verworfen.</p>
        <a className="button button-dark button-full" href={`mailto:${contactEmail}`}>Hilfe per E-Mail</a>
      </section>
    </main>
  );
}
