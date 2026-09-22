/* Planning calls a couple books from the portal (/portal/calls).
   The booking windows here must match CALL_WINDOWS in
   supabase/functions/_shared/scheduling.ts, which enforces them. */

export type CallKind = "post_booking" | "ninety_day" | "thirty_day" | "extra";

export interface CallType {
  kind: CallKind;
  title: string;
  /** One line on what the call is for. */
  blurb: string;
  included: boolean;
}

export const INCLUDED_CALLS: CallType[] = [
  {
    kind: "post_booking",
    title: "Post-booking call",
    blurb: "Meet your coordinator, walk through the weekend at a high level, and set up how we'll work together.",
    included: true,
  },
  {
    kind: "ninety_day",
    title: "90-day call",
    blurb: "Your timeline, vendors, and spaces. The weekend takes shape here.",
    included: true,
  },
  {
    kind: "thirty_day",
    title: "30-day call",
    blurb: "Final details, final counts, and the run of show for every day of your weekend.",
    included: true,
  },
];

export const EXTRA_CALL: CallType = {
  kind: "extra",
  title: "Additional planning call",
  blurb: "For anything that can't wait for your next included call.",
  included: false,
};

export const CALL_TITLES: Record<CallKind, string> = {
  post_booking: "Post-booking call",
  ninety_day: "90-day call",
  thirty_day: "30-day call",
  extra: "Additional planning call",
};

/** Matches RATES in howWeWork.ts ("Coordination planning call"). */
export const EXTRA_CALL_RATE = "$100 per hour";
