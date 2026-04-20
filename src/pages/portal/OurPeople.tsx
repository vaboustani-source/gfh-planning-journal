import { useNavigate } from "react-router-dom";
import { LodgingList } from "./people/LodgingList";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";
import { OffsiteAccommodationsSection } from "@/components/lodging/OffsiteAccommodationsSection";
import { usePortalData } from "@/hooks/usePortalData";

export default function OurPeople() {
  const navigate = useNavigate();
  const { eventId } = usePortalData();

  return (
    <>
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up space-y-10">
        <div>
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
            Guests & lodging
          </p>
          <h1 className="font-display text-4xl font-light text-foreground mb-8">Guest Lodging</h1>

          <LodgingList />
        </div>

        {eventId && <OffsiteAccommodationsSection eventId={eventId} variant="portal" />}
      </div>
    </div>
    <PortalStickyFooter onContinue={() => navigate("/portal/financials")} />
    </>
  );
}
