import { notFound } from "next/navigation";
import { requirePageMember } from "@/lib/membership";
import { getOwnedJourney } from "@/lib/journeys";
import { JourneyLive } from "@/components/journey-live";

export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) { const member = await requirePageMember(); const { id } = await params; const journey = await getOwnedJourney(member.session.user.id, id); if (!journey) notFound(); return <JourneyLive initial={journey} />; }
