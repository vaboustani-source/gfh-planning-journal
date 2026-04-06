import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalData } from "@/hooks/usePortalData";
import { CalendarHeart, MapPin, Users, Clock, Check, Loader2 } from "lucide-react";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";
import { supabase } from "@/integrations/supabase/client";
import { formatPackageTier } from "@/lib/formatMealType";

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-border last:border-0">
      <Icon size={15} className="text-sage mt-0.5 shrink-0" strokeWidth={1.75} />
      <div>
        <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-0.5">{label}</p>
        <p className="font-body text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

interface Milestone {
  id: string;
  title: string;
  timeframe_label: string | null;
  status: string | null;
  sort_order: number | null;
}

function PlanningJourney({ eventId }: { eventId: string }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      const { data } = await supabase
        .from("milestones")
        .select("id, title, timeframe_label, status, sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });
      if (data) setMilestones(data);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`milestones-portal-${eventId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "milestones", filter: `event_id=eq.${eventId}` },
        (payload) => { setMilestones(prev => prev.map(m => m.id === payload.new.id ? { ...m, status: payload.new.status } : m)); }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}</div>;
  if (milestones.length === 0) return null;

  const firstIncompleteIdx = milestones.findIndex(m => m.status !== "complete");

  return (
    <div className="mt-10">
      <p className="font-display text-2xl font-light text-foreground mb-1">Your Planning Journey</p>
      <p className="font-body text-sm text-muted-foreground mb-6">Here's where you are in the process.</p>
      <div className="relative">
        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />
        <div className="space-y-1">
          {milestones.map((m, i) => {
            const done = m.status === "complete";
            const isActive = i === firstIncompleteIdx;
            return (
              <div key={m.id} className="flex items-start gap-4 relative py-2.5">
                <div className={`relative z-10 w-[23px] h-[23px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  done ? "bg-sage border-sage" : isActive ? "bg-sage/15 border-sage animate-pulse" : "bg-muted border-border"
                }`}>
                  {done && <Check size={11} className="text-white" />}
                  {isActive && <div className="w-2 h-2 rounded-full bg-sage" />}
                </div>
                <div className="pt-0.5">
                  <p className={`font-body text-sm ${done ? "text-muted-foreground" : isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>{m.title}</p>
                  {m.timeframe_label && (
                    <p className={`font-body text-[11px] ${isActive ? "text-sage" : "text-muted-foreground"}`}>{m.timeframe_label}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


export default function OurWeekend() {
  const { event, eventId, loading } = usePortalData();
  const navigate = useNavigate();

  return (
    <>
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Overview</p>
        <h1 className="font-display text-4xl font-light text-foreground mb-8">Our Weekend</h1>

        {loading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : !event ? (
          <p className="font-body text-sm text-muted-foreground">Event details will appear here once your coordinator sets things up.</p>
        ) : (
          <>
            <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
              <div className="px-5 py-1">
                <InfoRow icon={CalendarHeart} label="Arrival" value={formatDate(event.arrival_date)} />
                <InfoRow icon={CalendarHeart} label="Wedding Day" value={formatDate(event.wedding_date)} />
                <InfoRow icon={CalendarHeart} label="Departure" value={formatDate(event.departure_date)} />
                <InfoRow icon={MapPin} label="Ceremony" value={event.ceremony_location} />
                <InfoRow icon={MapPin} label="Cocktail Hour" value={event.cocktail_hour_location} />
                <InfoRow icon={MapPin} label="Rehearsal Dinner" value={event.rehearsal_dinner_location} />
                <InfoRow icon={Users} label="Estimated Guests" value={event.estimated_guest_count ? `${event.estimated_guest_count} guests` : null} />
                <InfoRow icon={Clock} label="Package" value={formatPackageTier(event.package_tier)} />
              </div>
            </div>
            {eventId && <PlanningJourney eventId={eventId} />}
            
          </>
        )}
      </div>
    </div>
    <PortalStickyFooter onContinue={() => navigate("/portal/timeline")} nextOnly />
    </>
  );
}
