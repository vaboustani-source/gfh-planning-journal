import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, User, Wrench } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AutosaveIndicator from "@/components/admin/AutosaveIndicator";

interface ChecklistItem {
  id: string;
  label: string;
  section: string;
  status: string | null;
  owner: string | null;
  paced_send_date: string | null;
  completed_at: string | null;
  notes: string | null;
  requires_addon: string | null;
}

type Filter = "all" | "incomplete" | "brandon";

const sectionLabels: Record<string, string> = {
  brandon_internal: "Brandon — Internal",
  logistics: "Logistics",
  ceremony: "Ceremony",
  decor: "Décor",
  catering: "Catering",
  lodging: "Lodging",
  vendors: "Vendors",
  music: "Music",
  general: "General",
};

export default function ChecklistTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const { status, trackSave } = useAutosaveStatus();

  useEffect(() => { fetchItems(); }, [eventId]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });
    if (data) setItems(data);
    setLoading(false);
  };

  const toggle = async (item: ChecklistItem) => {
    const next = item.status === "complete" ? "incomplete" : "complete";
    const now = next === "complete" ? new Date().toISOString() : null;
    await trackSave(async () => {
      await supabase.from("checklist_items").update({ status: next, completed_at: now }).eq("id", item.id);
    });
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: next, completed_at: now } : x));
  };

  const filtered = items.filter(i => {
    if (filter === "incomplete") return i.status !== "complete";
    if (filter === "brandon") return i.owner === "brandon" || i.section === "brandon_internal";
    return true;
  });

  const grouped = filtered.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    const key = item.section;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const completed = items.filter(i => i.status === "complete").length;
  const pct = items.length ? Math.round((completed / items.length) * 100) : 0;

  if (loading) return <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>;

  return (
    <div className="space-y-6 pb-16 animate-fade-up relative">
      <AutosaveIndicator status={status} className="absolute top-0 right-0" />
      {/* Progress + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-body text-sm text-muted-foreground">{completed} of {items.length} complete</p>
            <p className="font-body text-sm font-medium text-foreground">{pct}%</p>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-sage rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {(["all", "incomplete", "brandon"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-body text-xs transition-colors capitalize ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "brandon" ? "Brandon's" : f}
            </button>
          ))}
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-center font-body text-muted-foreground py-12">No items match this filter.</p>
      ) : (
        Object.entries(grouped).map(([section, sectionItems]) => (
          <div key={section}>
            <div className="flex items-center gap-3 mb-3">
              <p className="font-body text-xs tracking-widest uppercase text-muted-foreground whitespace-nowrap">
                {sectionLabels[section] || section}
              </p>
              <div className="flex-1 h-px bg-border" />
              <span className="font-body text-xs text-muted-foreground">
                {sectionItems.filter(i => i.status === "complete").length}/{sectionItems.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {sectionItems.map(item => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-card px-4 py-3 flex items-start gap-3 hover:border-sage/30 transition-colors"
                >
                  <button
                    onClick={() => toggle(item)}
                    className={`mt-0.5 w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-colors ${
                      item.status === "complete"
                        ? "bg-sage border-sage"
                        : "border-border hover:border-sage bg-background"
                    }`}
                  >
                    {item.status === "complete" && <Check size={10} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-body text-sm ${item.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {item.label}
                      </p>
                      {item.owner === "couple" && (
                        <span title="Couple's task" className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <User size={9} />
                          couple
                        </span>
                      )}
                      {(item.owner === "brandon" || section === "brandon_internal") && (
                        <span title="Brandon's task" className="flex items-center gap-0.5 text-[10px] text-sage">
                          <Wrench size={9} />
                          brandon
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="font-body text-xs text-muted-foreground mt-0.5">{item.notes}</p>
                    )}
                    {item.paced_send_date && (
                      <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                        Due {new Date(item.paced_send_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
