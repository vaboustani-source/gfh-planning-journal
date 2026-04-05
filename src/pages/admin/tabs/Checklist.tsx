import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, User, Wrench, ChevronDown, Plus, Loader2, StickyNote } from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";

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
  sort_order: number | null;
}

type Filter = "all" | "incomplete" | "complete";

const CHECKLIST_SECTIONS = ["arrival", "ceremony", "reception", "attire", "decor", "logistics"];
const INTERNAL_SECTIONS = ["brandon_internal"];
const TIMELINE_KEYS = [
  "timeline_7_12_months", "timeline_6_months", "timeline_5_months",
  "timeline_4_months", "timeline_3_months", "timeline_1_month",
  "timeline_2_weeks", "timeline_1_week",
];

const SECTION_LABELS: Record<string, string> = {
  brandon_internal: "Brandon — Internal",
  arrival: "Arrival",
  ceremony: "Ceremony",
  reception: "Reception",
  attire: "Attire & Rings",
  decor: "Décor",
  logistics: "Logistics",
  timeline_7_12_months: "7–12 Months Out",
  timeline_6_months: "6 Months Out",
  timeline_5_months: "5 Months Out",
  timeline_4_months: "4 Months Out",
  timeline_3_months: "3 Months Out",
  timeline_1_month: "1 Month Out",
  timeline_2_weeks: "2 Weeks Out",
  timeline_1_week: "1 Week Out",
};

export default function ChecklistTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [activeTab, setActiveTab] = useState<"timeline" | "couple" | "internal">("timeline");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const { status, trackSave, debouncedSave } = useAutosaveStatus();

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });
    if (data) setItems(data);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const toggle = async (item: ChecklistItem) => {
    const next = item.status === "complete" ? "incomplete" : "complete";
    const now = next === "complete" ? new Date().toISOString() : null;
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: next, completed_at: now } : x));
    await trackSave(async () => {
      await supabase.from("checklist_items").update({ status: next, completed_at: now }).eq("id", item.id);
    });
  };

  const addItem = async (section: string) => {
    if (!newLabel.trim()) return;
    const owner = INTERNAL_SECTIONS.includes(section) ? "brandon" : "couple";
    const maxSort = Math.max(0, ...items.filter(i => i.section === section).map(i => i.sort_order ?? 0));
    const { data } = await supabase.from("checklist_items").insert({
      event_id: eventId,
      section,
      label: newLabel.trim(),
      status: "incomplete",
      owner,
      sort_order: maxSort + 1,
    }).select().single();
    if (data) setItems(prev => [...prev, data]);
    setNewLabel("");
    setAddingTo(null);
  };

  const toggleSection = (s: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const toggleItemExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveNotes = (itemId: string, notes: string) => {
    setItems(prev => prev.map(x => x.id === itemId ? { ...x, notes } : x));
    debouncedSave(`notes-${itemId}`, async () => {
      await supabase.from("checklist_items").update({ notes: notes || null }).eq("id", itemId);
    });
  };

  // Determine which sections to show
  const sectionKeys = activeTab === "couple" ? CHECKLIST_SECTIONS
    : activeTab === "timeline" ? TIMELINE_KEYS
    : INTERNAL_SECTIONS;

  const tabItems = items.filter(i => sectionKeys.includes(i.section));
  const filtered = tabItems.filter(i => {
    if (filter === "incomplete") return i.status !== "complete";
    if (filter === "complete") return i.status === "complete";
    return true;
  });

  const grouped = sectionKeys
    .map(key => ({ key, items: filtered.filter(i => i.section === key) }))
    .filter(g => g.items.length > 0);

  const totalTab = tabItems.length;
  const completedTab = tabItems.filter(i => i.status === "complete").length;
  const pct = totalTab ? Math.round((completedTab / totalTab) * 100) : 0;

  if (loading) return <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 pb-24 animate-fade-up relative">
      {/* Tab switcher */}
      <div className="flex gap-0 border-b border-border overflow-x-auto scrollbar-none">
        {(["timeline", "couple", "internal"] as const).map(t => (
          <button
            key={t}
            onClick={() => { setActiveTab(t); setFilter("all"); }}
            className={`shrink-0 pb-3 px-1 mr-7 font-body text-sm transition-colors border-b-2 -mb-px ${
              activeTab === t
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "couple" ? "Couple Checklist" : t === "timeline" ? "Planning Timeline" : "Internal"}
          </button>
        ))}
      </div>

      {/* Progress + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-body text-sm text-muted-foreground">{completedTab} of {totalTab} complete</p>
            <p className="font-body text-sm font-medium text-foreground">{pct}%</p>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-sage rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {(["all", "incomplete", "complete"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-body text-xs transition-colors capitalize ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="text-center font-body text-muted-foreground py-12">No items match this filter.</p>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ key: section, items: sectionItems }) => {
            const allSectionItems = tabItems.filter(i => i.section === section);
            const sectionCompleted = allSectionItems.filter(i => i.status === "complete").length;
            const isExpanded = expanded.has(section);

            return (
              <div key={section} className="rounded-lg border border-border bg-card overflow-hidden">
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <ChevronDown size={16} className={`text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-foreground">
                      {SECTION_LABELS[section] || section}
                    </p>
                  </div>
                  <span className="font-body text-xs text-muted-foreground shrink-0">
                    {sectionCompleted}/{allSectionItems.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {sectionItems.map(item => {
                      const isItemExpanded = expandedItems.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className="border-b border-border last:border-b-0"
                        >
                          <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                            <button
                              onClick={() => toggle(item)}
                              className={`mt-0.5 w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-colors ${
                                item.status === "complete"
                                  ? "bg-sage border-sage"
                                  : "border-muted-foreground/40 hover:border-sage bg-background"
                              }`}
                            >
                              {item.status === "complete" && <Check size={10} className="text-white" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-body text-sm ${item.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                  {item.label}
                                </p>
                                {item.notes && (
                                  <StickyNote size={11} className="text-sage shrink-0" />
                                )}
                                {item.owner === "couple" && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <User size={9} /> couple
                                  </span>
                                )}
                                {(item.owner === "brandon" || INTERNAL_SECTIONS.includes(item.section)) && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-sage">
                                    <Wrench size={9} /> brandon
                                  </span>
                                )}
                              </div>
                              {item.completed_at && (
                                <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                                  Completed {new Date(item.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              )}
                              {item.paced_send_date && (
                                <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                                  Due {new Date(item.paced_send_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => toggleItemExpand(item.id)}
                              className="mt-0.5 p-1 rounded hover:bg-muted/40 transition-colors shrink-0"
                            >
                              <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isItemExpanded ? "rotate-180" : ""}`} />
                            </button>
                          </div>
                          {isItemExpanded && (
                            <div className="px-4 pb-3 pl-[42px]">
                              <textarea
                                defaultValue={item.notes ?? ""}
                                onBlur={e => saveNotes(item.id, e.target.value)}
                                placeholder="Add a note…"
                                rows={2}
                                className="w-full font-body text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {addingTo === section ? (
                      <div className="px-4 py-3 flex gap-2 border-t border-border">
                        <input
                          autoFocus
                          value={newLabel}
                          onChange={e => setNewLabel(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addItem(section)}
                          placeholder="New task…"
                          className="flex-1 font-body text-sm bg-transparent border-b border-border focus:border-primary outline-none py-1 text-foreground placeholder:text-muted-foreground"
                        />
                        <button onClick={() => addItem(section)} className="font-body text-xs text-primary hover:underline">Add</button>
                        <button onClick={() => { setAddingTo(null); setNewLabel(""); }} className="font-body text-xs text-muted-foreground hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTo(section); setExpanded(prev => new Set([...prev, section])); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors border-t border-border"
                      >
                        <Plus size={14} className="text-muted-foreground" />
                        <span className="font-body text-xs text-muted-foreground">Add item</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AdminStickyFooter status={status} onSave={() => {}} onSaveAndContinue={() => onNavigateNext?.()} />
    </div>
  );
}
