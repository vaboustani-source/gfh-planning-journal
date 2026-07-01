import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, Phone, Clock } from "lucide-react";

const db = supabase as any;

interface Offsite {
  id: string;
  name: string;
  description: string | null;
  drive_time: string | null;
  phone: string | null;
  website_url: string | null;
}

function ensureUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function RecommendedNearbyStays() {
  const [rows, setRows] = useState<Offsite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await db
        .from("offsite_accommodations")
        .select("id, name, description, drive_time, phone, website_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name");
      setRows((data ?? []) as Offsite[]);
      setLoading(false);
    })();
  }, []);

  return (
    <section className="space-y-5">
      <div>
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-1.5">Nearby</p>
        <h2 className="font-display text-2xl font-light text-foreground">Recommended Nearby Stays</h2>
        <p className="font-body text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          A short list of places we like for guests staying off property.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-8">
          <p className="font-body text-sm text-muted-foreground">Recommendations are on the way.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className="rounded-xl border border-sage/20 bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h3 className="font-display text-lg font-light text-foreground">{r.name}</h3>
                {r.drive_time && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-body text-[11px] shrink-0">
                    <Clock size={11} /> {r.drive_time}
                  </span>
                )}
              </div>
              {r.description && (
                <p className="font-body text-sm text-foreground/80 leading-relaxed mt-2">{r.description}</p>
              )}
              {(r.phone || r.website_url) && (
                <div className="flex flex-wrap gap-4 mt-3">
                  {r.phone && (
                    <a href={`tel:${r.phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1.5 font-body text-xs text-sage-dark hover:text-foreground transition-colors">
                      <Phone size={12} /> {r.phone}
                    </a>
                  )}
                  {r.website_url && (
                    <a href={ensureUrl(r.website_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-body text-xs text-sage-dark hover:text-foreground transition-colors">
                      <ExternalLink size={12} /> Website
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
