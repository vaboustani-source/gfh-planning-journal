import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LodgingList } from "./people/LodgingList";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";
import { OffsiteAccommodationsSection } from "@/components/lodging/OffsiteAccommodationsSection";
import { usePortalData } from "@/hooks/usePortalData";
import GuestList from "@/components/people/GuestList";
import { PeopleSubTabs, PeopleSubTab } from "@/components/people/PeopleSubTabs";
import { usePeopleCounts } from "@/components/people/usePeopleCounts";
import Seating from "@/components/seating/Seating";

const tabFromParam = (tab: string | null): PeopleSubTab => {
  if (tab === "lodging") return "lodging";
  if (tab === "seating") return "seating";
  return "guests";
};

export default function OurPeople() {
  const navigate = useNavigate();
  const { eventId } = usePortalData();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const [sub, setSub] = useState<PeopleSubTab>(() => tabFromParam(tabParam));
  const { counts, reload } = usePeopleCounts(eventId);

  useEffect(() => { setSub(tabFromParam(tabParam)); }, [tabParam]);

  useEffect(() => {
    const nextTab = sub === "guests" ? null : sub;
    if (tabParam === nextTab || (!tabParam && !nextTab)) return;
    const next = new URLSearchParams(params);
    if (!nextTab) next.delete("tab"); else next.set("tab", nextTab);
    setParams(next, { replace: true });
  }, [params, setParams, sub, tabParam]);

  const onSub = (t: PeopleSubTab) => { setSub(t); reload(); };

  return (
    <>
      <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32" style={{ background: "#FAF8F4" }}>
        <div className="animate-fade-up space-y-2">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Your weekend, your people</p>
          <h1 className="font-display text-4xl font-light text-foreground mb-6">Our People</h1>

          <PeopleSubTabs active={sub} onChange={onSub}
            guestCount={counts.guests} onSiteCount={counts.onSite}
            seatedCount={counts.seated} confirmedCount={counts.confirmed} />

          {sub === "guests" && eventId && (
            <div className="space-y-2">
              <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Your guests</p>
              <h2 className="font-display text-2xl font-light mb-4">Guest List</h2>
              <GuestList eventId={eventId} onCountChange={reload} />
            </div>
          )}

          {sub === "lodging" && (
            <div className="space-y-10">
              <LodgingList />
              {eventId && <OffsiteAccommodationsSection eventId={eventId} variant="portal" />}
            </div>
          )}

          {sub === "seating" && eventId && <Seating eventId={eventId} />}
        </div>
      </div>
      <PortalStickyFooter onContinue={() => navigate("/portal/financials")} />
    </>
  );
}
