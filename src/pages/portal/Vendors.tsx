import { useNavigate } from "react-router-dom";
import { VendorList } from "./people/VendorList";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

export default function Vendors() {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
          Your team
        </p>
        <h1 className="font-display text-4xl font-light text-foreground mb-8">Vendors</h1>
        <VendorList />
        <PortalStickyFooter onContinue={() => navigate("/portal/ceremony")} nextOnly />
      </div>
    </div>
  );
}
