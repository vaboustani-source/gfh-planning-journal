import { useState } from "react";
import { SectionTabs } from "@/components/portal/SectionTabs";
import { LodgingList } from "./people/LodgingList";
import { Headcounts } from "./people/Headcounts";

const TABS = [
  { id: "lodging", label: "Lodging" },
  { id: "headcounts", label: "Headcounts" },
];

export default function OurPeople() {
  const [tab, setTab] = useState("lodging");

  return (
    <div className="max-w-lg mx-auto px-5 py-8 lg:px-8 lg:py-10">
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
  );
}
