import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock } from "lucide-react";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

interface TimelineBlock { time: string; foh: string; highlight?: string | null; }
interface TimelineDayV2 { id: string; label: string; blocks: TimelineBlock[]; }
interface TimelineDataV2 { days: TimelineDayV2[]; }
interface LegacyBlock { time: string; foh_label: string; }
interface LegacyData { arrival_day?: LegacyBlock[]; wedding_day?: LegacyBlock[]; farewell_day?: LegacyBlock[]; }

function migrateForPortal(raw: any): TimelineDayV2[] {
  if (raw?.days && Array.isArray(raw.days)) {
    return (raw as TimelineDataV2).days.map(d => ({
      id: d.id,
      label: d.label,
      blocks: d.blocks.filter(b => b.foh).map(b => ({ time: b.time, foh: b.foh, highlight: b.highlight })),
    }));
  }
  const legacy = raw as LegacyData;
  const map: { key: keyof LegacyData; label: string }[] = [
    { key: "arrival_day", label: "Arrival Day" },
    { key: "wedding_day", label: "Wedding Day" },
    { key: "farewell_day", label: "Farewell Day" },
  ];
  return map
    .filter(d => legacy[d.key])
    .map((d, i) => ({
      id: `day_${i + 1}`,
      label: d.label,
      blocks: (legacy[d.key] || []).filter(b => b.foh_label).map(b => ({ time: b.time, foh: b.foh_label, highlight: null })),
    }));
}

export default function Timeline() {
  const { eventId, loading: portalLoading } = usePortalData();
  const navigate = useNavigate();
  const [days, setDays] = useState<TimelineDayV2[]>([]);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      const { data } = await supabase
        .from("working_timeline")
        .select("timeline_data, published")
        .eq("event_id", eventId)
        .maybeSingle();
      if (data) {
        setDays(migrateForPortal(data.timeline_data));
        setPublished(data.published || false);
      }
      setLoading(false);
    };
    load();
  }, [eventId]);

  const isLoading = portalLoading || loading;

  return (
    <>
      <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-24 lg:pb-20">
        <div className="animate-fade-up">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Schedule</p>
          <h1 className="font-display text-4xl font-light text-foreground mb-8">Your Weekend Timeline</h1>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !published || days.length === 0 ? (
            <div className="rounded-xl bg-card border border-border shadow-soft p-8 text-center">
              <Clock size={28} className="mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
              <p className="font-display text-lg font-light text-foreground mb-1">Coming Soon</p>
              <p className="font-body text-sm text-muted-foreground">
                Your weekend timeline is being finalized by Brandon — check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {days.map(day => {
                if (day.blocks.length === 0) return null;
                return (
                  <div
                    key={day.id}
                    className="rounded-xl bg-card border border-border shadow-soft overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-border bg-muted/30">
                      <p className="font-display text-lg font-light text-foreground">{day.label}</p>
                    </div>
                    <div className="p-4 space-y-1">
                      {day.blocks.map((b, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                            b.highlight ? "border-l-2 border-[#C9A84C] bg-[#C9A84C]/5" : "hover:bg-muted/40"
                          }`}
                        >
                          <span className="inline-flex items-center justify-center rounded-md bg-sage/10 text-sage px-2 py-0.5 font-body text-xs font-medium whitespace-nowrap min-w-[72px] text-center shrink-0 mt-0.5">
                            {b.time}
                          </span>
                          <span className="font-body text-sm text-foreground leading-relaxed">{b.foh}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <PortalStickyFooter onContinue={() => navigate("/portal/planning")} nextOnly />
    </>
  );
}
