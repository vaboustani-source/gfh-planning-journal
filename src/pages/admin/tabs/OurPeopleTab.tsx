import { useEffect, useState } from "react";
import GuestList from "@/components/people/GuestList";
import { PeopleSubTabs, PeopleSubTab } from "@/components/people/PeopleSubTabs";
import { usePeopleCounts } from "@/components/people/usePeopleCounts";
import LodgingTab from "./Lodging";
import SeatingTab from "./SeatingTab";

export default function OurPeopleTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [sub, setSub] = useState<PeopleSubTab>("guests");
  const { counts, reload } = usePeopleCounts(eventId);

  useEffect(() => { reload(); }, [sub]);

  return (
    <div>
      <PeopleSubTabs active={sub} onChange={setSub}
        guestCount={counts.guests} onSiteCount={counts.onSite}
        seatedCount={counts.seated} confirmedCount={counts.confirmed} />

      {sub === "guests" && <GuestList eventId={eventId} isAdmin onCountChange={reload} />}
      {sub === "lodging" && <LodgingTab eventId={eventId} onNavigateNext={onNavigateNext} />}
      {sub === "seating" && <SeatingTab eventId={eventId} onNavigateNext={onNavigateNext} />}
    </div>
  );
}
