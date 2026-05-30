import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export function usePeopleCounts(eventId: string | null | undefined) {
  const [counts, setCounts] = useState({ guests: 0, onSite: 0, confirmed: 0, seated: 0 });

  const load = async () => {
    if (!eventId) return;
    const [{ data: gs }, { count: seatedCount }] = await Promise.all([
      db.from("guests").select("rsvp_status,lodging_preference").eq("event_id", eventId),
      db.from("seating_assignments").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    ]);
    const guests = (gs ?? []) as Array<{ rsvp_status: string; lodging_preference: string | null }>;
    setCounts({
      guests: guests.length,
      onSite: guests.filter(g => g.lodging_preference === "on_site").length,
      confirmed: guests.filter(g => g.rsvp_status === "confirmed").length,
      seated: seatedCount ?? 0,
    });
  };

  useEffect(() => { load(); }, [eventId]);
  return { counts, reload: load };
}
