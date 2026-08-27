import Link from "next/link";
import { ArrowRight, Check, Clock3, MapPin, TrainFront } from "lucide-react";

export default function HomePage() {
  return <main className="landing">
    <header className="landing-nav"><Link href="/" className="brand"><span className="brand-mark"><TrainFront size={18} /></span> BahnDelay</Link><Link className="nav-link" href="/anmelden">Anmelden</Link></header>
    <section className="hero content-wrap">
      <div className="eyebrow"><span className="pulse-dot" /> Echtzeit für deine Reise</div>
      <h1>Entspannter ankommen.<br /><em>Auch wenn’s später wird.</em></h1>
      <p className="hero-copy">BahnDelay zeigt dir, wie viel Verspätung dein Zug hat — und findet sofort die beste Verbindung zu deinem Ziel.</p>
      <Link className="button button-dark button-large" href="/anmelden">Los geht’s <ArrowRight size={18} /></Link>
      <div className="hero-note"><Check size={15} /> Privat. Einfach. Nur für dich.</div>
    </section>
    <section className="preview content-wrap">
      <div className="preview-window"><div className="preview-top"><span className="status-live"><span className="pulse-dot" /> LIVE</span><span>Heute, 27. Aug.</span><span className="avatar-mini">JK</span></div><div className="preview-route"><div><span className="muted-label">DEINE REISE</span><strong>Berlin Hbf <ArrowRight size={16} /> Hamburg Hbf</strong></div><span className="delay-pill">+12 min</span></div><div className="preview-line"><span className="station-dot done" /><span className="line-segment done-line" /><span className="station-dot current" /><span className="line-segment" /><span className="station-dot" /></div><div className="preview-times"><span>14:32 Berlin</span><b>14:44 · jetzt</b><span>17:18 Hamburg</span></div></div>
    </section>
    <section className="benefits content-wrap"><div><Clock3 size={22} /><h2>Immer aktuell</h2><p>Live-Daten für deinen Zug und deine Anschlüsse.</p></div><div><MapPin size={22} /><h2>Der beste Weg</h2><p>Alternativen, wenn dein Plan nicht mehr aufgeht.</p></div></section>
    <footer className="site-footer content-wrap"><span>© 2026 BahnDelay</span><span>Open data by Transitous &amp; OpenStreetMap</span></footer>
  </main>;
}
