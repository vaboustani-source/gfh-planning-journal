import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionTabs } from "@/components/portal/SectionTabs";
import { CeremonyMusic } from "./details/CeremonyMusic";
import { DecorSelections } from "./details/DecorSelections";
import { MealPrefs } from "./details/MealPrefs";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

const TABS = [
  { id: "ceremony", label: "Ceremony & Music" },
  { id: "decor", label: "Décor" },
  { id: "meals", label: "Meal Preferences" },
];

export default function WeekendDetails() {
  const [tab, setTab] = useState("ceremony");

  return (
    <div className="max-w-lg mx-auto px-5 py-8 lg:px-8 lg:py-10">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
          Ceremony & reception
        </p>
        <h1 className="font-display text-4xl font-light text-foreground mb-8">
          Weekend Details
        </h1>

        <SectionTabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "ceremony" && <CeremonyMusic />}
        {tab === "decor" && <DecorSelections />}
        {tab === "meals" && <MealPrefs />}
      </div>
    </div>
  );
}
