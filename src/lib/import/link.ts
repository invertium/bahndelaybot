const ALLOWED_HOSTS = new Set(["bahn.de", "www.bahn.de", "int.bahn.de", "reiseauskunft.bahn.de", "next.bahn.de"]);
export class UnsafeJourneyLinkError extends Error { constructor(message = "Der Link ist nicht erlaubt.") { super(message); this.name = "UnsafeJourneyLinkError"; } }
export function parseDbLink(input: string): URL {
  let url: URL; try { url = new URL(input.trim()); } catch { throw new UnsafeJourneyLinkError(); }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) throw new UnsafeJourneyLinkError();
  return url;
}
export interface SafeFetchOptions { fetcher?: typeof fetch; maxRedirects?: number; }
export async function fetchDbLink(input: string, options: SafeFetchOptions = {}): Promise<Response> {
  let url = parseDbLink(input); const fetcher = options.fetcher ?? fetch; const max = options.maxRedirects ?? 3;
  for (let attempt = 0; attempt <= max; attempt++) {
    const response = await fetcher(url, { redirect: "manual", headers: { accept: "text/html,application/xhtml+xml,application/pdf" } });
    if (![301,302,303,307,308].includes(response.status)) return response;
    const location = response.headers.get("location"); if (!location) throw new UnsafeJourneyLinkError("Der Link enthält keine Weiterleitung.");
    url = parseDbLink(new URL(location, url).toString());
  }
  throw new UnsafeJourneyLinkError("Zu viele Weiterleitungen.");
}

export interface DbLinkCandidate {
  origin?: string;
  destination?: string;
  departure?: string;
  resolvedUrl: string;
  ambiguous: string[];
}

export function parseDbLinkCandidate(input: string): DbLinkCandidate {
  const url = parseDbLink(input);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const found = url.searchParams.get(key) ?? fragment.get(key);
      if (found) return found;
    }
  };
  const origin = value("so", "start", "origin", "from");
  const destination = value("zo", "ziel", "destination", "to");
  const rawDeparture = value("hd", "departure", "date");
  const parsedDeparture = rawDeparture ? new Date(rawDeparture) : undefined;
  const departure = parsedDeparture && !Number.isNaN(parsedDeparture.getTime()) ? parsedDeparture.toISOString() : undefined;
  const ambiguous: string[] = [];
  if (!origin) ambiguous.push("Start fehlt im Link.");
  if (!destination) ambiguous.push("Ziel fehlt im Link.");
  if (rawDeparture && !departure) ambiguous.push("Reisezeit im Link ist ungültig.");
  return { origin, destination, departure, resolvedUrl: url.toString(), ambiguous };
}
