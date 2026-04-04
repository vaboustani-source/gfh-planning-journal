import { useNavigate } from "react-router-dom";
import { CeremonyMusic } from "./details/CeremonyMusic";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

export default function Ceremony() {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
          Your ceremony
        </p>
        <h1 className="font-display text-4xl font-light text-foreground mb-8">Ceremony & Music</h1>
        <CeremonyMusic />
        <PortalStickyFooter onContinue={() => navigate("/portal/decor")} />
      </div>
    </div>
  );
}
