import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionTabs } from "@/components/portal/SectionTabs";
import { LodgingList } from "./people/LodgingList";
import { Headcounts } from "./people/Headcounts";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

const TABS = [
  { id: "lodging", label: "Lodging" },
  { id: "headcounts", label: "Headcounts" },
];

export default function OurPeople() {
  const [tab, setTab] = useState("lodging");
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
          Guests & lodging
        </p>
        <h1 className="font-display text-4xl font-light text-foreground mb-8">Our People</h1>

        <SectionTabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === "lodging" && <LodgingList />}
        {tab === "headcounts" && <Headcounts />}
      </div>
    </div>
    <PortalStickyFooter onContinue={() => navigate("/portal/financials")} />
    </>
  );
}
