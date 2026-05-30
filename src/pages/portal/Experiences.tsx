import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image as ImageIcon, Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";
import {
  EXPERIENCE_CATEGORIES,
  PricingConfig,
  PricingType,
  formatPriceForCouple,
  getCategoryLabel,
} from "@/lib/experienceCategories";

const db = supabase as any;

interface CatalogItem {
  id: string;
  title: string;
  category: string;
  description: string | null;
  photo_url: string | null;
  pricing_type: PricingType | null;
  pricing_config: PricingConfig | null;
  pricing_visible_to_couple: boolean | null;
  requires_discussion: boolean | null;
  available: boolean | null;
}

interface RequestRow {
  id: string;
  catalog_item_id: string | null;
  status: "requested" | "under_review" | "approved" | "declined" | "cancelled";
  guest_count: number | null;
  preferred_day: string | null;
  hours: number | null;
  selected_tier: string | null;
  couple_notes: string | null;
  final_price: number | null;
  final_price_label: string | null;
  decline_reason: string | null;
}

export default function Experiences() {
  const navigate = useNavigate();
  const { eventId, isPreviewMode } = usePortalData();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [requesting, setRequesting] = useState<CatalogItem | null>(null);

  useEffect(() => {
    if (!eventId) return;
    load();
  }, [eventId]);

  const load = async () => {
    const [{ data: cat }, { data: reqs }] = await Promise.all([
      db.from("experience_catalog").select("*").eq("available", true).order("category").order("sort_order"),
      db.from("experience_requests").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
    ]);
    setCatalog((cat ?? []) as CatalogItem[]);
    setRequests((reqs ?? []) as RequestRow[]);
    setLoading(false);
  };

  const filtered = useMemo(
    () => (filter === "all" ? catalog : catalog.filter(c => c.category === filter)),
    [catalog, filter]
  );

  const pendingByCatalogId = useMemo(() => {
    const m = new Map<string, RequestRow>();
    for (const r of requests) {
      if (r.catalog_item_id && (r.status === "requested" || r.status === "under_review")) m.set(r.catalog_item_id, r);
    }
    return m;
  }, [requests]);

  return (
    <>
      <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
        <div className="animate-fade-up">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Make it yours</p>
          <h1 className="font-display text-4xl font-light text-foreground mb-2">Experiences</h1>
          <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
            Curated activities, add-ons and special touches to weave through your weekend. Browse what speaks to you and we'll talk through the details together.
          </p>

          <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-none -mx-1 px-1">
            {[{ key: "all", label: "All" }, ...EXPERIENCE_CATEGORIES].map(c => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full font-body text-xs transition-colors border ${
                  filter === c.key
                    ? "bg-sage text-primary-foreground border-sage"
                    : "bg-white text-muted-foreground border-border hover:border-sage/40"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-border bg-white">
              <Sparkles size={24} className="text-muted-foreground/50 mx-auto mb-2" />
              <p className="font-display text-lg italic text-foreground">Nothing here yet</p>
              <p className="font-body text-sm text-muted-foreground">Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(item => (
                <CoupleCard
                  key={item.id}
                  item={item}
                  pending={pendingByCatalogId.get(item.id)}
                  onRequest={() => setRequesting(item)}
                  disabled={isPreviewMode}
                />
              ))}
            </div>
          )}

          {requests.length > 0 && (
            <section className="mt-14">
              <h2 className="font-display text-2xl font-light text-foreground mb-4">My Experiences</h2>
              <div className="space-y-3">
                {requests.map(r => {
                  const item = catalog.find(c => c.id === r.catalog_item_id);
                  return <MyRequestRow key={r.id} request={r} item={item} />;
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {requesting && eventId && (
        <RequestPanel
          item={requesting}
          eventId={eventId}
          onClose={() => setRequesting(null)}
          onSubmitted={() => { setRequesting(null); load(); }}
        />
      )}

      <PortalStickyFooter onContinue={() => navigate("/portal/menus-meals")} nextOnly />
    </>
  );
}

function CoupleCard({ item, pending, onRequest, disabled }: {
  item: CatalogItem;
  pending?: RequestRow;
  onRequest: () => void;
  disabled: boolean;
}) {
  const priceText = formatPriceForCouple(item);
  const isCustomQuote = item.pricing_type === "custom_quote";
  const isMuted = priceText === "Inquire for Pricing";

  return (
    <div className={`rounded-xl bg-white border shadow-soft overflow-hidden flex flex-col ${
      isCustomQuote ? "border-l-4 border-l-[#c9a84c] border-border" : "border-border"
    }`}>
      <div className="relative h-48 bg-muted overflow-hidden">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sage/10 to-cream">
            <ImageIcon size={28} className="text-muted-foreground/40" />
          </div>
        )}
        {pending && (
          <span className="absolute top-3 left-3 rounded-full bg-[#f5e9c8] text-[#8a6914] px-2.5 py-1 font-body text-[10px] tracking-wide">
            Pending Review
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <p className="font-display text-base text-foreground leading-tight">{item.title}</p>
        <span className="self-start rounded-full bg-sage/10 px-2 py-0.5 font-body text-[10px] tracking-wide text-sage">
          {getCategoryLabel(item.category)}
        </span>
        {item.description && (
          <p className="font-body text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        <p className={`font-body text-sm mt-1 ${isMuted ? "text-[#a68838]" : "text-foreground"}`}>{priceText}</p>
        <button
          onClick={onRequest}
          disabled={disabled || !!pending}
          className="mt-auto flex items-center justify-center gap-1.5 py-2 rounded-lg bg-sage text-primary-foreground font-body text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={13} /> {pending ? "Requested" : "Request"}
        </button>
      </div>
    </div>
  );
}

function MyRequestRow({ request, item }: { request: RequestRow; item: CatalogItem | undefined }) {
  const badge = (() => {
    switch (request.status) {
      case "requested":
        return { label: "Pending Review", cls: "bg-[#f5e9c8] text-[#8a6914]" };
      case "under_review":
        return { label: "In Discussion with Brandon", cls: "bg-sky-100 text-sky-800" };
      case "approved":
        return {
          label: `Confirmed · ${request.final_price_label || (request.final_price ? `$${Number(request.final_price).toLocaleString()}` : "—")}`,
          cls: "bg-sage/15 text-sage-dark",
        };
      case "declined":
        return { label: `Not available — ${request.decline_reason || "decided not to proceed"}`, cls: "bg-muted text-muted-foreground" };
      case "cancelled":
        return { label: "Cancelled", cls: "bg-muted text-muted-foreground" };
    }
  })();

  return (
    <div className="rounded-xl bg-white border border-border p-4 flex items-center gap-4">
      <div className="w-14 h-14 rounded-lg bg-muted shrink-0 overflow-hidden">
        {item?.photo_url ? (
          <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-muted-foreground/40" /></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-base text-foreground leading-tight">{item?.title ?? "Experience"}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 font-body text-[11px] text-muted-foreground">
          {request.preferred_day && <span>{request.preferred_day}</span>}
          {request.guest_count != null && <span>{request.guest_count} guests</span>}
          {request.hours != null && <span>{request.hours}h</span>}
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 font-body text-[10px] tracking-wide ${badge.cls}`}>
        {badge.label}
      </span>
    </div>
  );
}

function RequestPanel({ item, eventId, onClose, onSubmitted }: {
  item: CatalogItem; eventId: string; onClose: () => void; onSubmitted: () => void;
}) {
  const [day, setDay] = useState<string>("");
  const [guests, setGuests] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isCustom = item.pricing_type === "custom_quote";
  const showGuests = item.pricing_type === "per_person" || item.pricing_type === "tiered";
  const showHours = item.pricing_type === "per_hour";
  const showTier = item.pricing_type === "tiered" && (item.pricing_config?.tiers?.length ?? 0) > 0;

  const estimate = useMemo(() => {
    if (!item.pricing_visible_to_couple) return null;
    if (item.pricing_type === "flat") return item.pricing_config?.rate;
    if (item.pricing_type === "per_person" && guests) return (item.pricing_config?.rate ?? 0) * (parseInt(guests) || 0);
    if (item.pricing_type === "per_hour" && hours) return (item.pricing_config?.rate ?? 0) * (parseFloat(hours) || 0);
    if (item.pricing_type === "tiered" && tier) {
      const t = item.pricing_config?.tiers?.find(x => x.name === tier);
      return t?.price;
    }
    return null;
  }, [item, guests, hours, tier]);

  const submit = async () => {
    setSubmitting(true);
    const { error } = await db.from("experience_requests").insert({
      event_id: eventId,
      catalog_item_id: item.id,
      preferred_day: day || null,
      guest_count: guests ? parseInt(guests) : null,
      hours: hours ? parseFloat(hours) : null,
      selected_tier: tier || null,
      couple_notes: notes || null,
      status: "requested",
    });
    setSubmitting(false);
    if (error) { alert(error.message); return; }
    setSubmitted(true);
    setTimeout(onSubmitted, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-[480px] h-full bg-background shadow-2xl overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 bg-white border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <p className="font-display text-lg font-light">{item.title}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <Sparkles size={28} className="text-sage mx-auto mb-3" />
            <p className="font-display text-xl font-light text-foreground mb-2">Thank you</p>
            <p className="font-body text-sm text-muted-foreground max-w-xs mx-auto">
              We've received your request. Brandon will be in touch to talk through the details.
            </p>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {item.photo_url && (
              <img src={item.photo_url} alt="" className="w-full h-44 object-cover rounded-lg" />
            )}
            {item.description && <p className="font-body text-sm text-muted-foreground">{item.description}</p>}

            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-2">Preferred day</label>
              <div className="flex flex-wrap gap-2">
                {["Thursday", "Friday", "Saturday", "Sunday"].map(d => (
                  <button key={d} onClick={() => setDay(d)}
                    className={`px-3.5 py-1.5 rounded-full font-body text-xs border transition-colors ${
                      day === d ? "bg-sage text-primary-foreground border-sage" : "bg-white text-muted-foreground border-border hover:border-sage/40"
                    }`}>{d}</button>
                ))}
              </div>
            </div>

            {showGuests && (
              <div>
                <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-2">Guest count</label>
                <input type="number" min={1} value={guests} onChange={e => setGuests(e.target.value)} className={inputCls} />
                {item.pricing_config?.min_guests && (
                  <p className="font-body text-[11px] text-muted-foreground mt-1">Minimum {item.pricing_config.min_guests} guests</p>
                )}
              </div>
            )}
            {showHours && (
              <div>
                <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-2">Hours</label>
                <input type="number" min={0} step={item.pricing_config?.increment === "30min" ? 0.5 : 1}
                  value={hours} onChange={e => setHours(e.target.value)} className={inputCls} />
              </div>
            )}
            {showTier && (
              <div>
                <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-2">Choose a tier</label>
                <div className="space-y-2">
                  {item.pricing_config!.tiers!.map(t => (
                    <button key={t.name} onClick={() => setTier(t.name)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        tier === t.name ? "border-sage bg-sage/5" : "border-border bg-white hover:border-sage/40"
                      }`}>
                      <div className="flex items-center justify-between">
                        <p className="font-body text-sm font-medium text-foreground">{t.name}</p>
                        {item.pricing_visible_to_couple && (
                          <p className="font-body text-sm text-foreground">${Number(t.price).toLocaleString()}</p>
                        )}
                      </div>
                      {t.description && <p className="font-body text-[11px] text-muted-foreground mt-0.5">{t.description}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-2">
                {isCustom ? "Describe your vision" : "Tell us what you're envisioning"}
              </label>
              <textarea
                rows={isCustom ? 5 : 3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={isCustom ? "Describe your vision — we'll build the perfect experience together." : ""}
                className={`${inputCls} resize-none`}
              />
            </div>

            {estimate != null && estimate > 0 && (
              <p className="rounded-lg bg-sage/8 border border-sage/20 px-3 py-2 font-body text-sm text-sage-dark">
                Estimated: ${Number(estimate).toLocaleString()}
              </p>
            )}

            <button onClick={submit} disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-sage text-primary-foreground font-body text-sm hover:opacity-90 disabled:opacity-50">
              {submitting ? "Sending…" : "Send Request to Brandon"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20";
