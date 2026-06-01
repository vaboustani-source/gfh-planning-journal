import { useEventGuestCounts } from "@/hooks/useEventGuestCounts";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Backwards-compatible wrapper around the canonical useEventGuestCounts hook. */
export function usePeopleCounts(eventId: string | null | undefined) {
  const { counts, reload } = useEventGuestCounts(eventId);
  const [seated, setSeated] = useState(0);

  const loadSeated = async () => {
    if (!eventId) { setSeated(0); return; }
    const { count } = await (supabase as any)
      .from("seating_assignments")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    setSeated(count ?? 0);
  };

  useEffect(() => { void loadSeated(); }, [eventId, counts.confirmed]);

  return {
    counts: {
      guests: counts.invited,
      onSite: counts.onSiteConfirmed,
      confirmed: counts.confirmed,
      seated,
    },
    reload: async () => { await reload(); await loadSeated(); },
  };
}
