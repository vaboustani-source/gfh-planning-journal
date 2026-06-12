import { useNavigate } from "react-router-dom";
import { VendorList } from "./people/VendorList";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";
import { VendorsWeLoveSection } from "@/components/portal/VendorsWeLoveSection";
import { usePortalData } from "@/hooks/usePortalData";
import { CoiRequirementsPanel } from "@/components/vendor/CoiRequirementsPanel";

export default function Vendors() {
  const navigate = useNavigate();
  const { eventId } = usePortalData();

  return (
    <>
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up space-y-8">
        <div>
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
            Your team
          </p>
          <h1 className="font-display text-4xl font-light text-foreground mb-8">Vendors</h1>
          <VendorList />
          {eventId && <VendorsWeLoveSection eventId={eventId} />}
        </div>

        <CoiRequirementsPanel
          intro="Any vendor working on the estate needs a current Certificate of Insurance on file. You can send these requirements straight to each vendor using the Request COI button on their card above."
        />
      </div>
    </div>
    <PortalStickyFooter onContinue={() => navigate("/portal/ceremony")} nextOnly />
    </>
  );
}
