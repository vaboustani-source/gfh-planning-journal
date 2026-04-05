import { useNavigate } from "react-router-dom";
import { DecorSelections } from "./details/DecorSelections";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

export default function Decor() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
          Details & selections
        </p>
        <h1 className="font-display text-4xl font-light text-foreground mb-8">Décor</h1>
        <DecorSelections />
        <PortalStickyFooter onContinue={() => navigate("/portal/menus-meals")} nextOnly />
      </div>
    </div>
  );
}
