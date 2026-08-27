"use client";
import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  TrainFront,
  WifiOff,
} from "lucide-react";
import type {
  JourneyPlan,
  JourneyLeg,
  RankedAlternative,
} from "@/lib/transport/types";
type Stored = {
  id: string;
  title: string;
  status: string;
  importedVia: string;
  plan: JourneyPlan;
  updatedAt: string;
};
type Live = {
  plan: JourneyPlan;
  currentLeg: JourneyLeg | null;
  delayMinutes: number;
  stale: boolean;
  updatedAt: string;
};
const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Fehler");
    return data;
  });
const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});
const time = (value?: string) => value ? timeFormatter.format(new Date(value)) : "—";
export function JourneyLive({ initial }: { initial: Stored }) {
  const { data, error, mutate } = useSWR<Live>(
    `/api/journeys/${initial.id}/live`,
    fetcher,
    {
      fallbackData: {
        plan: initial.plan,
        currentLeg: null,
        delayMinutes: 0,
        stale: true,
        updatedAt: initial.updatedAt,
      },
      refreshInterval: 60000,
      revalidateOnFocus: true,
    },
  );
  const [alternatives, setAlternatives] = React.useState<
    RankedAlternative[] | null
  >(null);
  const [loading, setLoading] = React.useState(false);
  const plan = data?.plan ?? initial.plan;
  const active =
    data?.currentLeg ?? plan.legs.find((leg) => !leg.cancelled) ?? plan.legs[0];
  const delay = data?.delayMinutes ?? 0;
  const referenceTime = Date.parse(data?.updatedAt ?? initial.updatedAt);
  const nextStopIndex =
    active?.stopCalls.findIndex(
      (stop) =>
        Date.parse(
          stop.predictedArrival ??
            stop.predictedDeparture ??
            stop.scheduledArrival ??
            stop.scheduledDeparture ??
            "",
        ) >= referenceTime,
    ) ?? -1;
  async function loadAlternatives() {
    setLoading(true);
    try {
      const result = await fetcher(`/api/journeys/${initial.id}/alternatives`);
      setAlternatives(result.alternatives);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="app-shell">
      <header className="detail-header">
        <Link href="/dashboard" className="icon-button" aria-label="Zurück">
          <ArrowLeft size={20} />
        </Link>
        <span>Meine Reise</span>
        <button className="icon-button" aria-label="Weitere Optionen">
          <MoreHorizontal size={21} />
        </button>
      </header>
      <div className="journey-detail content-wrap">
        {(data?.stale || error) && (
          <div className="offline-banner">
            <WifiOff size={16} />{" "}
            {error
              ? "Live-Daten gerade nicht verfügbar"
              : "Zwischengespeicherte Daten"}{" "}
            · zuletzt {time(data?.updatedAt ?? initial.updatedAt)}
          </div>
        )}
        <div className="detail-title">
          <div>
            <span className="status-live">
              <span className="pulse-dot" /> LIVE-REISE
            </span>
            <h1>
              {plan.origin.name} → {plan.destination.name}
            </h1>
            <p>
              {new Intl.DateTimeFormat("de-DE", { dateStyle: "full" }).format(
                new Date(plan.scheduledDeparture),
              )}
            </p>
          </div>
          <button
            className="refresh-button"
            onClick={() => mutate()}
            aria-label="Daten aktualisieren"
          >
            <RefreshCw size={17} />
          </button>
        </div>
        <section className="delay-hero">
          <div>
            <span className="muted-label">AKTUELLE ANKUNFT</span>
            <div className="big-delay">
              {delay > 0 ? "+" : ""}
              {delay} <small>MIN</small>
            </div>
            <p>
              <Clock3 size={14} /> geplant {time(plan.scheduledArrival)}
              {delay ? ` · erwartet ${time(plan.predictedArrival)}` : ""}
            </p>
          </div>
          <span className="delay-emoji">{delay > 0 ? "⌛" : "✓"}</span>
        </section>
        {active && (
          <section className="train-info">
            <div className="train-badge">
              <TrainFront size={20} />
            </div>
            <div>
              <strong>{active.lineName ?? active.mode}</strong>
              <span>
                {active.origin.name} → {active.destination.name}
              </span>
            </div>
            <div className="platform">
              <small>GLEIS</small>
              <b>{active.departurePlatform ?? "—"}</b>
            </div>
          </section>
        )}
        <section className="timeline" aria-label="Reiseverlauf">
          {active?.stopCalls.length ? (
            active.stopCalls.map((stop, index) => (
              <div className="timeline-row" key={`${stop.stop.id}-${index}`}>
                <div className="timeline-marker">
                  <span
                    className={
                      stop.cancelled
                        ? "cancelled"
                        : index === nextStopIndex
                          ? "current"
                          : ""
                    }
                  />
                  {index < active.stopCalls.length - 1 && <i />}
                </div>
                <div className="stop-copy">
                  <strong>{stop.stop.name}</strong>
                  {index === nextStopIndex && (
                    <span className="next-stop">NÄCHSTER HALT</span>
                  )}
                </div>
                <div className="stop-time">
                  <b>
                    {time(
                      stop.predictedArrival ??
                        stop.predictedDeparture ??
                        stop.scheduledArrival ??
                        stop.scheduledDeparture,
                    )}
                  </b>
                  <span>
                    {time(stop.scheduledArrival ?? stop.scheduledDeparture)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-copy">
              Für diesen Abschnitt sind keine Halte verfügbar.
            </p>
          )}
        </section>
        <section className="alternatives">
          <div className="section-heading">
            <div>
              <h2>Deine Optionen</h2>
              <p>Verbindungen ab deinem nächsten Halt</p>
            </div>
            {!alternatives && (
              <button
                className="text-link"
                onClick={loadAlternatives}
                disabled={loading}
              >
                {loading ? "Suche …" : "Alternativen"}{" "}
                <ChevronRight size={15} />
              </button>
            )}
          </div>
          {alternatives?.length ? (
            alternatives.map((option) => (
              <div
                className={`option-card ${option.recommended ? "recommended" : ""}`}
                key={option.id}
              >
                {option.recommended && (
                  <div className="option-label">EMPFOHLEN</div>
                )}
                <div className="option-route">
                  <strong>
                    {option.legs[0]?.lineName ??
                      option.legs[0]?.mode ??
                      "Verbindung"}{" "}
                    · {option.transfers} Umstiege
                  </strong>
                    <b>{time(option.predictedArrival ?? option.scheduledArrival)}</b>
                </div>
                <div className="option-meta">
                  <span>
                    {option.origin.name} → {option.destination.name}
                  </span>
                  <span>
                    {option.riskyTransfer
                      ? "Wenig Puffer"
                      : `Ankunft ${time(option.predictedArrival ?? option.scheduledArrival)}`}
                  </span>
                </div>
              </div>
            ))
          ) : alternatives ? (
            <p className="empty-copy">Leider keine Alternative gefunden.</p>
          ) : null}
        </section>
        <p className="data-source">
          <ExternalLink size={12} /> Echtzeitdaten von Transitous · aktualisiert{" "}
          {time(data?.updatedAt ?? initial.updatedAt)}
        </p>
      </div>
      <nav className="bottom-nav">
        <Link className="active" href="/dashboard">
          <TrainFront size={20} />
          <span>Reisen</span>
        </Link>
        <Link href="/dashboard/import">
          <MapPin size={20} />
          <span>Importieren</span>
        </Link>
        <Link href="/hilfe">
          <CircleAlert size={20} />
          <span>Hilfe</span>
        </Link>
      </nav>
    </main>
  );
}
