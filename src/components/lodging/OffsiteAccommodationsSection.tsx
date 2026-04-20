import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Star, MapPin, Phone, ExternalLink, Minus, Plus, Sparkles } from "lucide-react";

interface Hotel {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  distance_minutes: number | null;
  distance_description: string | null;
  amenities: string[] | null;
  notes: string | null;
  is_primary: boolean | null;
  coming_soon: boolean | null;
  sort_order: number | null;
}

interface Lodging {
  id: string;
  hotel_id: string;
  guest_count: number;
  block_code: string | null;
  notes: string | null;
}

interface Props {
  eventId: string;
  variant?: "portal" | "admin";
}

function ensureUrl(url: string) {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function OffsiteAccommodationsSection({ eventId, variant = "portal" }: Props) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [lodging, setLodging] = useState<Record<string, Lodging>>({});
  const [loading, setLoading] = useState(true);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const [{ data: hData }, { data: lData }] = await Promise.all([
        supabase.from("offsite_hotels").select("*").eq("active", true).order("sort_order", { ascending: true }),
        supabase.from("offsite_lodging").select("id, hotel_id, guest_count, block_code, notes").eq("event_id", eventId),
      ]);
      setHotels((hData || []) as Hotel[]);
      const map: Record<string, Lodging> = {};
      (lData || []).forEach(l => { if (l.hotel_id) map[l.hotel_id] = { id: l.id, hotel_id: l.hotel_id, guest_count: l.guest_count ?? 0, block_code: l.block_code, notes: l.notes }; });
      setLodging(map);
      setLoading(false);
    })();
  }, [eventId]);

  const persist = useCallback(async (hotelId: string, patch: Partial<Lodging>) => {
    const existing = lodging[hotelId];
    if (existing?.id) {
      await supabase.from("offsite_lodging").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      const { data } = await supabase
        .from("offsite_lodging")
        .upsert({ event_id: eventId, hotel_id: hotelId, guest_count: patch.guest_count ?? 0, block_code: patch.block_code ?? null, notes: patch.notes ?? null }, { onConflict: "event_id,hotel_id" })
        .select("id, hotel_id, guest_count, block_code, notes")
        .single();
      if (data) setLodging(prev => ({ ...prev, [hotelId]: { id: data.id, hotel_id: data.hotel_id!, guest_count: data.guest_count ?? 0, block_code: data.block_code, notes: data.notes } }));
    }
  }, [eventId, lodging]);

  const updateLocal = (hotelId: string, patch: Partial<Lodging>) => {
    setLodging(prev => ({
      ...prev,
      [hotelId]: { id: prev[hotelId]?.id ?? "", hotel_id: hotelId, guest_count: prev[hotelId]?.guest_count ?? 0, block_code: prev[hotelId]?.block_code ?? null, notes: prev[hotelId]?.notes ?? null, ...patch },
    }));
  };

  const debouncedSave = (hotelId: string, patch: Partial<Lodging>) => {
    if (saveTimers.current[hotelId]) clearTimeout(saveTimers.current[hotelId]);
    saveTimers.current[hotelId] = setTimeout(() => persist(hotelId, patch), 600);
  };

  const stepCount = (hotelId: string, delta: number) => {
    const current = lodging[hotelId]?.guest_count ?? 0;
    const next = Math.max(0, current + delta);
    updateLocal(hotelId, { guest_count: next });
    debouncedSave(hotelId, { guest_count: next, block_code: lodging[hotelId]?.block_code ?? null, notes: lodging[hotelId]?.notes ?? null });
  };

  const totalGuests = Object.values(lodging).reduce((sum, l) => sum + (l.guest_count || 0), 0);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>;
  }

  if (!hotels.length) return null;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="pt-4">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-1.5">
          Off-Site Accommodations
        </p>
        <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-2xl">
          For guests staying off property — let us know how many to expect at each hotel so we can plan transportation.
        </p>
        {variant === "admin" && (
          <p className="font-body text-xs text-sage-dark mt-2">
            Total off-site guests entered: <span className="font-medium">{totalGuests}</span>
          </p>
        )}
      </div>

      {hotels.map(hotel => {
        const l = lodging[hotel.id];
        const count = l?.guest_count ?? 0;
        const isPrimary = !!hotel.is_primary;
        const isComing = !!hotel.coming_soon;

        return (
          <div
            key={hotel.id}
            className={`rounded-xl bg-card border border-sage/20 shadow-soft overflow-hidden ${isPrimary ? "border-l-4" : ""}`}
            style={isPrimary ? { borderLeftColor: "#C9A84C" } : undefined}
          >
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="space-y-2">
                {isPrimary && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#C9A84C]/12 text-[#8a7330] font-body text-[11px] font-medium">
                      <Star size={11} className="fill-[#C9A84C] text-[#C9A84C]" />
                      Our Primary Recommendation
                    </span>
                    {isComing && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-body text-[11px] font-medium">
                        <Sparkles size={11} />
                        Opening October 2026
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-light text-foreground">{hotel.name}</h3>
                    <p className="font-body text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <MapPin size={11} /> {hotel.city}
                    </p>
                  </div>
                  {hotel.distance_description && (
                    <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-body text-[11px] shrink-0">
                      {hotel.distance_description.replace(/from Gilbertsville/i, "").trim() || `~${hotel.distance_minutes} min`}
                    </span>
                  )}
                </div>

                {/* Amenities */}
                {hotel.amenities && hotel.amenities.length > 0 && !isComing && (
                  <div className="flex flex-wrap gap-1.5">
                    {hotel.amenities.map(a => (
                      <span key={a} className="px-2 py-0.5 rounded-full bg-sage/8 text-sage-dark font-body text-[11px]">
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                {/* Contact */}
                {!isComing && (hotel.phone || hotel.website) && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {hotel.phone && (
                      <a href={`tel:${hotel.phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1.5 font-body text-xs text-sage-dark hover:text-foreground transition-colors">
                        <Phone size={12} /> {hotel.phone}
                      </a>
                    )}
                    {hotel.website && (
                      <a href={ensureUrl(hotel.website)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-body text-xs text-sage-dark hover:text-foreground transition-colors">
                        <ExternalLink size={12} /> Website
                      </a>
                    )}
                  </div>
                )}

                {hotel.notes && (
                  <p className="font-body text-xs text-muted-foreground leading-relaxed italic pt-1">
                    {hotel.notes}
                  </p>
                )}
              </div>

              {/* Editable inputs */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <label className="font-body text-sm text-foreground">How many guests are staying here?</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => stepCount(hotel.id, -1)}
                      disabled={count <= 0}
                      aria-label="Decrease"
                      className="w-11 h-11 rounded-lg border border-border bg-background hover:bg-muted flex items-center justify-center text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={count}
                      onChange={e => {
                        const v = Math.max(0, parseInt(e.target.value || "0", 10) || 0);
                        updateLocal(hotel.id, { guest_count: v });
                      }}
                      onBlur={() => persist(hotel.id, { guest_count: count, block_code: l?.block_code ?? null, notes: l?.notes ?? null })}
                      className="w-16 h-11 text-center rounded-lg border border-border bg-background font-body text-base text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => stepCount(hotel.id, 1)}
                      aria-label="Increase"
                      className="w-11 h-11 rounded-lg border border-border bg-background hover:bg-muted flex items-center justify-center text-foreground transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {!isComing && (
                  <div className="space-y-1">
                    <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Room block code (if you have one)</label>
                    <input
                      type="text"
                      value={l?.block_code ?? ""}
                      onChange={e => updateLocal(hotel.id, { block_code: e.target.value })}
                      onBlur={() => persist(hotel.id, { guest_count: count, block_code: l?.block_code ?? null, notes: l?.notes ?? null })}
                      placeholder="e.g. SMITH-WEDDING"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Any notes for us?</label>
                  <textarea
                    value={l?.notes ?? ""}
                    onChange={e => updateLocal(hotel.id, { notes: e.target.value })}
                    onBlur={() => persist(hotel.id, { guest_count: count, block_code: l?.block_code ?? null, notes: l?.notes ?? null })}
                    rows={2}
                    placeholder="Shuttle preferences, arrival timing, etc."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
