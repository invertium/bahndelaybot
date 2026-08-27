import { extractDbTicket, PdfImportError } from "@/lib/import";
import { getMemberSession } from "@/lib/membership";
import { transitous } from "@/lib/transport";

const MAX_PDF_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const member = await getMemberSession(request.headers);
  if (!member) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.type !== "application/pdf") return Response.json({ error: "Bitte eine PDF-Datei auswählen" }, { status: 400 });
  if (file.size > MAX_PDF_BYTES) return Response.json({ error: "PDF darf höchstens 8 MB groß sein" }, { status: 413 });
  try {
    const candidate = await extractDbTicket(await file.arrayBuffer());
    const [origins, destinations] = await Promise.all([
      candidate.origin ? transitous.searchLocations(candidate.origin.name) : Promise.resolve([]),
      candidate.destination ? transitous.searchLocations(candidate.destination.name) : Promise.resolve([]),
    ]);
    const plans = origins[0] && destinations[0]
      ? await transitous.planJourney({ origin: origins[0], destination: destinations[0], departure: candidate.departure, results: 5 }).catch(() => [])
      : [];
    return Response.json({
      candidate: { ...candidate, rawText: undefined },
      matches: { origins, destinations },
      plans,
      needsConfirmation: candidate.confidence !== "high" || plans.length !== 1,
    });
  } catch (error) {
    if (error instanceof PdfImportError) return Response.json({ error: error.message, code: error.code }, { status: 422 });
    console.error("PDF import failed", error);
    return Response.json({ error: "Ticket konnte nicht verarbeitet werden" }, { status: 500 });
  }
}
