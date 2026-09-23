import { supabase } from "@/integrations/supabase/client";
import type { ContractContext } from "@/lib/contractTemplate";

const db = supabase as any;

/** Everything the hub can fill into a contract automatically for one wedding. */
export async function loadContractContext(eventId: string): Promise<ContractContext> {
  const [{ data: ev }, { data: fin }, { data: members }] = await Promise.all([
    db.from("events")
      .select("title, partner1_name, partner2_name, wedding_date, arrival_date, departure_date, estimated_guest_count, package_tier, pending_partner1_email, pending_partner2_email")
      .eq("id", eventId).maybeSingle(),
    db.from("financials").select("site_fee_total, catering_estimate").eq("event_id", eventId).maybeSingle(),
    db.from("event_users").select("role_in_event, users(email, role)").eq("event_id", eventId),
  ]);
  if (!ev) return {};

  // Couple logins, partner_1 first; fall back to the invite emails on the event.
  const couple = ((members ?? []) as Array<{ role_in_event: string; users: { email: string; role: string } | null }>)
    .filter((m) => m.users?.role === "couple" && m.users.email)
    .sort((a, b) => (a.role_in_event === "partner_2" ? 1 : 0) - (b.role_in_event === "partner_2" ? 1 : 0))
    .map((m) => m.users!.email);

  const total = (Number(fin?.site_fee_total) || 0) + (Number(fin?.catering_estimate) || 0);
  return {
    couple_names: [ev.partner1_name, ev.partner2_name].filter(Boolean).join(" & ") || ev.title,
    wedding_date: ev.wedding_date,
    venue_name: "Gilbertsville Farmhouse",
    guest_count: ev.estimated_guest_count,
    package_tier: ev.package_tier,
    total_amount: total || null,
    client1_name: ev.partner1_name,
    client2_name: ev.partner2_name,
    client1_email: ev.pending_partner1_email ?? couple[0] ?? null,
    client2_email: ev.pending_partner2_email ?? couple[1] ?? null,
    check_in_date: ev.arrival_date,
    check_out_date: ev.departure_date,
    site_fee: Number(fin?.site_fee_total) || null,
  };
}

/** Adds the amended contract's title and signing date, for amendments. */
export async function withParentContract(ctx: ContractContext, parentId: string | null | undefined): Promise<ContractContext> {
  if (!parentId) return ctx;
  const [{ data: parent }, { data: sigs }] = await Promise.all([
    db.from("contracts").select("title").eq("id", parentId).maybeSingle(),
    db.from("contract_signatures").select("signed_at").eq("contract_id", parentId).order("signed_at", { ascending: false }).limit(1),
  ]);
  const signed = sigs?.[0]?.signed_at as string | undefined;
  return {
    ...ctx,
    original_contract_title: parent?.title ?? null,
    original_signed_date: signed
      ? new Date(signed).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null,
  };
}
