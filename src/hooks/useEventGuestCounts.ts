import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for guest counts. Every component that displays
 * a guest/headcount number MUST read from this hook (or computeGuestCounts
 * below) — never store or manually enter a static guest count.
 */

export type GuestRow = {
  rsvp_status: string | null;
  lodging_preference: string | null;
  meal_preference: string | null;
};

export interface GuestCounts {
  invited: number;            // all guest rows for the event
  confirmed: number;          // rsvp_status === 'confirmed'
  declined: number;           // rsvp_status === 'declined'
  awaiting: number;           // not confirmed and not declined
  onSiteConfirmed: number;
  offSiteConfirmed: number;
  undecidedLodging: number;   // confirmed guests with no lodging preference set
  byMealPreference: Record<string, number>; // confirmed only
}

export const EMPTY_COUNTS: GuestCounts = {
  invited: 0, confirmed: 0, declined: 0, awaiting: 0,
  onSiteConfirmed: 0, offSiteConfirmed: 0, undecidedLodging: 0,
  byMealPreference: {},
};

export function computeGuestCounts(rows: GuestRow[]): GuestCounts {
  const counts: GuestCounts = { ...EMPTY_COUNTS, byMealPreference: {} };
  for (const r of rows) {
    counts.invited++;
    const status = r.rsvp_status;
    if (status === "confirmed") {
      counts.confirmed++;
      if (r.lodging_preference === "on_site") counts.onSiteConfirmed++;
      else if (r.lodging_preference === "off_site") counts.offSiteConfirmed++;
      else counts.undecidedLodging++;
      const meal = r.meal_preference?.trim();
      if (meal) counts.byMealPreference[meal] = (counts.byMealPreference[meal] ?? 0) + 1;
    } else if (status === "declined") {
      counts.declined++;
    } else {
      counts.awaiting++;
    }
  }
  return counts;
}

export function useEventGuestCounts(eventId: string | null | undefined) {
  const [counts, setCounts] = useState<GuestCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!eventId) { setCounts(EMPTY_COUNTS); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("guests")
      .select("rsvp_status,lodging_preference,meal_preference")
      .eq("event_id", eventId);
    setCounts(computeGuestCounts((data ?? []) as GuestRow[]));
    setLoading(false);
  }, [eventId]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  // Realtime: any guests change for this event refreshes counts
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`guest-counts-${eventId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "guests", filter: `event_id=eq.${eventId}` },
        () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, load]);

  return { counts, loading, reload: load };
}
