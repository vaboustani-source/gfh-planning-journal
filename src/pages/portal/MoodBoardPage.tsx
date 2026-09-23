import { useNavigate } from "react-router-dom";
import { usePortalData } from "@/hooks/usePortalData";
import MoodBoard from "@/components/moodboard/MoodBoard";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

export default function MoodBoardPage() {
  const navigate = useNavigate();
  const { eventId } = usePortalData();

  return (
    <>
      <div className="max-w-6xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
        <div className="animate-fade-up">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Style & décor</p>
          <h1 className="font-display text-4xl font-light text-foreground mb-2">Mood Board</h1>
          <p className="font-body text-sm text-muted-foreground mb-8 max-w-2xl">
            Collect the looks you love: screenshots, pins, posts, anything. Tell us what you love about each one
            and we'll use it to plan your florals, tables and spaces with your vendors.
          </p>
          {eventId && <MoodBoard eventId={eventId} mode="couple" />}
        </div>
      </div>
      <PortalStickyFooter onContinue={() => navigate("/portal/decor")} nextOnly />
    </>
  );
}
