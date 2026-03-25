import { useEffect, useState } from "react";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  section: string;
  status: string | null;
  paced_send_date: string | null;
  notes: string | null;
}

export default function Planning() {
  const { eventId, loading: eventLoading } = usePortalData();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("checklist_items")
      .select("id, label, section, status, paced_send_date, notes")
      .eq("event_id", eventId)
      .eq("owner", "couple")
      .order("paced_send_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (data) setItems(data);
        setLoading(false);
      });
  }, [eventId]);

  const sections = [...new Set(items.map(i => i.section))];

  const toggleItem = async (id: string, current: string | null) => {
    const newStatus = current === "complete" ? "incomplete" : "complete";
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    await supabase.from("checklist_items").update({
      status: newStatus,
      completed_at: newStatus === "complete" ? new Date().toISOString() : null,
    }).eq("id", id);
  };

  return (
    <div className="max-w-lg mx-auto px-5 py-8 lg:px-8 lg:py-10">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Your tasks</p>
        <h1 className="font-display text-4xl font-light text-foreground mb-8">Planning</h1>

        {(loading || eventLoading) ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 size={32} className="text-primary mx-auto mb-3" />
            <p className="font-display text-xl italic text-foreground">All caught up!</p>
            <p className="font-body text-sm text-muted-foreground mt-1">No planning tasks assigned to you yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map(section => (
              <div key={section}>
                <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-3">{section}</p>
                <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
                  {items.filter(i => i.section === section).map((item, idx, arr) => (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id, item.status)}
                      className={`w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors ${idx < arr.length - 1 ? "border-b border-border" : ""}`}
                    >
                      {item.status === "complete"
                        ? <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
                        : <Circle size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                      }
                      <div className="min-w-0">
                        <p className={`font-body text-sm leading-snug ${item.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {item.label}
                        </p>
                        {item.paced_send_date && (
                          <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                            Due {new Date(item.paced_send_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
