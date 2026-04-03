import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionTabs } from "@/components/portal/SectionTabs";
import { MealPrefs } from "./details/MealPrefs";
import { Headcounts } from "./people/Headcounts";
import { DietaryRestrictions } from "./details/DietaryRestrictions";
import { BarSelections } from "./details/BarSelections";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

const TABS = [
  { id: "meals", label: "Meal Preferences" },
  { id: "headcounts", label: "Headcounts" },
  { id: "dietary", label: "Dietary & Kids" },
  { id: "bar", label: "Bar" },
];

export default function MenusMeals() {
  const [tab, setTab] = useState("meals");
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
          Food & drink
        </p>
        <h1 className="font-display text-4xl font-light text-foreground mb-8">Menus & Meals</h1>

        <SectionTabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "meals" && <MealPrefs />}
        {tab === "headcounts" && <Headcounts />}
        {tab === "dietary" && <DietaryRestrictions />}
        {tab === "bar" && <BarSelections />}
        <PortalStickyFooter onContinue={() => navigate("/portal/our-people")} />
      </div>
    </div>
  );
}
