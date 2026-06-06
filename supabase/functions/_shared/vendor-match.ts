// Shared vendor-matching logic for filed emails.
// Resolves the sender's email/domain against the event's vendor list (with
// learned overrides from email_sender_map and a soft fallback to preferred_vendors).

export interface VendorMatch {
  vendor_id: string | null;
  vendor_name: string | null;
  vendor_category: string | null;
}

const GENERIC_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
  "aol.com", "me.com", "msn.com", "live.com", "comcast.net", "proton.me",
  "protonmail.com", "mac.com",
]);

export function emailDomain(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const at = addr.toLowerCase().trim().split("@");
  if (at.length !== 2) return null;
  return at[1] || null;
}

export function websiteDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = url.trim().toLowerCase();
    const stripped = u.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0];
    return stripped || null;
  } catch {
    return null;
  }
}

interface VendorRow { id: string; event_id: string; category: string | null; business_name: string | null; contact_name: string | null; email: string | null; }
interface PreferredRow { id: string; category: string | null; name: string | null; email: string | null; website: string | null; }

export interface MatchContext {
  eventVendors: VendorRow[];                              // vendors on this event
  senderMap: Record<string, { vendor_id: string | null; vendor_name: string | null; vendor_category: string | null }>; // learned per-sender for this event
  preferred: PreferredRow[];                              // preferred vendors (soft fallback)
}

export function matchVendorForSender(senderAddress: string | null | undefined, ctx: MatchContext): VendorMatch {
  const empty: VendorMatch = { vendor_id: null, vendor_name: null, vendor_category: null };
  const addr = (senderAddress || "").toLowerCase().trim();
  if (!addr) return empty;

  // 1. Learned mapping (manual assigns)
  if (ctx.senderMap[addr]) {
    const m = ctx.senderMap[addr];
    if (m.vendor_id || m.vendor_category) {
      return { vendor_id: m.vendor_id, vendor_name: m.vendor_name, vendor_category: m.vendor_category };
    }
  }

  // 2. Exact email match on event vendors
  for (const v of ctx.eventVendors) {
    if (v.email && v.email.toLowerCase().trim() === addr) {
      return { vendor_id: v.id, vendor_name: v.business_name || v.contact_name || "Vendor", vendor_category: v.category };
    }
  }

  const dom = emailDomain(addr);
  if (!dom || GENERIC_DOMAINS.has(dom)) return empty;

  // 3. Domain match against event vendor emails
  for (const v of ctx.eventVendors) {
    const vdom = emailDomain(v.email);
    if (vdom && vdom === dom) {
      return { vendor_id: v.id, vendor_name: v.business_name || v.contact_name || "Vendor", vendor_category: v.category };
    }
  }

  // 4. Soft fallback: preferred vendor catalog (suggest category only)
  for (const p of ctx.preferred) {
    const pdom = emailDomain(p.email) || websiteDomain(p.website);
    if (pdom && pdom === dom) {
      return { vendor_id: null, vendor_name: p.name, vendor_category: p.category };
    }
  }

  return empty;
}

export async function loadMatchContext(admin: any, eventId: string): Promise<MatchContext> {
  const [vendorsRes, mapRes, prefRes] = await Promise.all([
    admin.from("vendors").select("id, event_id, category, business_name, contact_name, email").eq("event_id", eventId),
    admin.from("email_sender_map").select("sender_address, vendor_id, vendor_name, vendor_category").eq("event_id", eventId),
    admin.from("preferred_vendors").select("id, category, name, email, website").eq("active", true),
  ]);
  const senderMap: MatchContext["senderMap"] = {};
  for (const r of mapRes.data ?? []) {
    const k = (r.sender_address || "").toLowerCase();
    if (k) senderMap[k] = { vendor_id: r.vendor_id, vendor_name: r.vendor_name, vendor_category: r.vendor_category };
  }
  return {
    eventVendors: (vendorsRes.data ?? []) as VendorRow[],
    senderMap,
    preferred: (prefRes.data ?? []) as PreferredRow[],
  };
}
