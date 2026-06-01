import Seating from "@/components/seating/Seating";

export default function SeatingTab({ eventId }: { eventId: string; onNavigateNext?: () => void }) {
  return <Seating eventId={eventId} />;
}
