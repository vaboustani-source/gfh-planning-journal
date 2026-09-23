import MoodBoard from "@/components/moodboard/MoodBoard";

export default function MoodBoardTab({ eventId }: { eventId: string; onNavigateNext?: () => void }) {
  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-muted-foreground">
        The couple's inspiration. Mark team favorites and leave notes they'll see; share a view-only link with vendors.
      </p>
      <MoodBoard eventId={eventId} mode="staff" />
    </div>
  );
}
