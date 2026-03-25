import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { CheckCircle2, Loader2, Save, Check } from "lucide-react";

interface DecorItem {
  id: string;
  item_name: string;
  event_section: string | null;
  quantity: number | null;
  provided_by: string | null;
  couple_notes: string;
  confirmed_by_brandon: boolean;
  ordered: boolean | null;
}

function formatSection(raw: string | null) {
  if (!raw) return "General";
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function DecorSelections() {
  const { eventId } = usePortalData();
  const [items, setItems] = useState<DecorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("decor_items")
      .select("id, item_name, event_section, quantity, provided_by, couple_notes, confirmed_by_brandon, ordered")
      .eq("event_id", eventId)
      .order("event_section")
      .order("item_name")
      .then(({ data }) => {
        if (data) {
          setItems(
            data.map((d) => ({
              ...d,
              couple_notes: d.couple_notes ?? "",
              confirmed_by_brandon: d.confirmed_by_brandon ?? false,
            }))
          );
        }
        setLoading(false);
      });
  }, [eventId]);

  const updateNote = (id: string, note: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, couple_notes: note } : i)));
    setSavedId(null);
  };

  const saveNote = async (id: string, note: string) => {
    setSavingId(id);
    await supabase.from("decor_items").update({ couple_notes: note || null }).eq("id", id);
    setSavingId(null);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 2500);
  };

  const sections = [...new Set(items.map((i) => i.event_section))].sort();

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-display text-xl italic text-muted-foreground">Decor items coming soon</p>
        <p className="font-body text-sm text-muted-foreground mt-1">Brandon will add your decor selections here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => {
        const sectionItems = items.filter((i) => i.event_section === section);
        return (
          <div key={section ?? "general"}>
            <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-3">
              {formatSection(section)}
            </p>
            <div className="space-y-3">
              {sectionItems.map((item) => (
                <div key={item.id} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
                  {/* Item header */}
                  <div className="px-5 py-3.5 border-b border-border flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-body text-sm font-medium text-foreground">{item.item_name}</p>
                        {item.confirmed_by_brandon && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sage/10 border border-sage/20 px-2 py-0.5 font-body text-[10px] text-sage">
                            <CheckCircle2 size={10} /> Confirmed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {item.quantity && item.quantity > 1 && (
                          <span className="font-body text-xs text-muted-foreground">Qty: {item.quantity}</span>
                        )}
                        {item.provided_by && (
                          <span className="font-body text-xs text-muted-foreground">· {item.provided_by}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="px-5 py-3.5 space-y-2">
                    <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Your notes</label>
                    <textarea
                      value={item.couple_notes}
                      onChange={(e) => updateNote(item.id, e.target.value)}
                      placeholder="Add a note, preference, or question…"
                      rows={2}
                      maxLength={500}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => saveNote(item.id, item.couple_notes)}
                        disabled={savingId === item.id}
                        className="flex items-center gap-1.5 font-body text-xs text-primary hover:text-sage-dark transition-colors disabled:opacity-50"
                      >
                        {savingId === item.id ? (
                          <><Loader2 size={12} className="animate-spin" /> Saving…</>
                        ) : savedId === item.id ? (
                          <><Check size={12} /> Saved</>
                        ) : (
                          <><Save size={12} /> Save note</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
