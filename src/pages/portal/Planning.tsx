import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, Loader2, ChevronDown, Plus, AlertTriangle, StickyNote } from "lucide-react";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";
import { SectionTabs } from "@/components/portal/SectionTabs";

interface ChecklistItem {
  id: string;
  label: string;
  section: string;
  status: string | null;
  owner: string | null;
  paced_send_date: string | null;
  completed_at: string | null;
  notes: string | null;
  sort_order: number | null;
}

const CHECKLIST_SECTIONS = ["arrival", "ceremony", "reception", "attire", "decor", "logistics"];
const SECTION_LABELS: Record<string, string> = {
  arrival: "Arrival",
  ceremony: "Ceremony",
  reception: "Reception",
  attire: "Attire & Rings",
  decor: "Décor",
  logistics: "Logistics",
};

const TIMELINE_SECTIONS = [
  { key: "timeline_7_12_months", label: "7–12 Months Out" },
  { key: "timeline_6_months", label: "6 Months Out" },
  { key: "timeline_5_months", label: "5 Months Out" },
  { key: "timeline_4_months", label: "4 Months Out" },
  { key: "timeline_3_months", label: "3 Months Out" },
  { key: "timeline_1_month", label: "1 Month Out" },
  { key: "timeline_2_weeks", label: "2 Weeks Out" },
  { key: "timeline_1_week", label: "1 Week Out" },
];

const TIMELINE_DAYS_MAP: Record<string, number> = {
  timeline_7_12_months: 365,
  timeline_6_months: 180,
  timeline_5_months: 150,
  timeline_4_months: 120,
  timeline_3_months: 90,
  timeline_1_month: 30,
  timeline_2_weeks: 14,
  timeline_1_week: 7,
};

function getCurrentTimeframe(daysUntil: number | null): string | null {
  if (daysUntil === null) return null;
  for (const { key } of TIMELINE_SECTIONS) {
    const days = TIMELINE_DAYS_MAP[key];
    if (daysUntil <= days) continue;
    return key;
  }
  return TIMELINE_SECTIONS[TIMELINE_SECTIONS.length - 1].key;
}

export default function Planning() {
  const { eventId: portalEventId, event, loading: eventLoading, refreshChecklist } = usePortalData();
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const eventId = portalEventId || routeEventId || null;

  const navigate = useNavigate();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("checklist");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");

  const daysUntil = (() => {
    if (!event?.wedding_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const wd = new Date(event.wedding_date); wd.setHours(0, 0, 0, 0);
    return Math.round((wd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const fetchItems = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("checklist_items")
      .select("id, label, section, status, owner, paced_send_date, completed_at, notes, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });
    if (data) setItems(data);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Auto-expand current timeframe
  useEffect(() => {
    if (tab === "timeline") {
      const current = getCurrentTimeframe(daysUntil);
      if (current) setExpanded(prev => new Set([...prev, current]));
    }
  }, [tab, daysUntil]);

  const toggleItem = async (id: string, current: string | null) => {
    const newStatus = current === "complete" ? "incomplete" : "complete";
    const now = newStatus === "complete" ? new Date().toISOString() : null;
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus, completed_at: now } : i));
    await supabase.from("checklist_items").update({ status: newStatus, completed_at: now }).eq("id", id);
    refreshChecklist();
  };

  const toggleSection = (section: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
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

  const saveNotes = async (itemId: string, notes: string) => {
    setItems(prev => prev.map(x => x.id === itemId ? { ...x, notes } : x));
    await supabase.from("checklist_items").update({ notes: notes || null }).eq("id", itemId);
  };

  const addItem = async (section: string) => {
    if (!newLabel.trim() || !eventId) return;
    const maxSort = Math.max(0, ...items.filter(i => i.section === section).map(i => i.sort_order ?? 0));
    const { data } = await supabase.from("checklist_items").insert({
      event_id: eventId,
      section,
      label: newLabel.trim(),
      status: "incomplete",
      owner: "couple",
      sort_order: maxSort + 1,
    }).select().single();
    if (data) setItems(prev => [...prev, data]);
    setNewLabel("");
    setAddingTo(null);
    refreshChecklist();
  };

  const checklistItems = items.filter(i => CHECKLIST_SECTIONS.includes(i.section));
  const timelineItems = items.filter(i => i.section.startsWith("timeline_"));

  const activeItems = tab === "checklist" ? checklistItems : timelineItems;
  const totalActive = activeItems.length;
  const completedActive = activeItems.filter(i => i.status === "complete").length;
  const pctActive = totalActive > 0 ? Math.round((completedActive / totalActive) * 100) : 0;

  // Always show all 6 checklist sections so "Add item" is available even when empty
  const sections = tab === "checklist"
    ? CHECKLIST_SECTIONS
    : TIMELINE_SECTIONS.filter(t => items.some(i => i.section === t.key)).map(t => t.key);

  const getSectionLabel = (section: string) => {
    if (SECTION_LABELS[section]) return SECTION_LABELS[section];
    const tl = TIMELINE_SECTIONS.find(t => t.key === section);
    return tl?.label ?? section;
  };

  const currentTimeframe = getCurrentTimeframe(daysUntil);

  const isLoading = loading || eventLoading;

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Your tasks</p>
        <h1 className="font-display text-4xl font-light text-foreground mb-6">Planning</h1>

        <SectionTabs
          tabs={[
            { id: "checklist", label: "My Checklist" },
            { id: "timeline", label: "Planning Timeline" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : tab === "timeline" && totalActive === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 size={32} className="text-primary mx-auto mb-3" />
            <p className="font-display text-xl italic text-foreground">No tasks yet</p>
            <p className="font-body text-sm text-muted-foreground mt-1">Tasks will appear here as your planning progresses.</p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            {totalActive > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-body text-xs text-muted-foreground">{completedActive} of {totalActive} complete</p>
                  <p className="font-body text-xs font-medium text-foreground">{pctActive}%</p>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pctActive}%` }} />
                </div>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-3">
              {sections.map(section => {
                const sectionItems = activeItems.filter(i => i.section === section);
                const sectionCompleted = sectionItems.filter(i => i.status === "complete").length;
                const allDone = sectionCompleted === sectionItems.length;
                const isExpanded = expanded.has(section);
                const isCurrent = tab === "timeline" && section === currentTimeframe;
                const isPastIncomplete = tab === "timeline" && !allDone && daysUntil !== null && TIMELINE_DAYS_MAP[section] > (daysUntil ?? 0);

                return (
                  <div key={section} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
                    <button
                      onClick={() => toggleSection(section)}
                      className={`w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-muted/30 ${isCurrent ? "bg-sage/8" : ""}`}
                    >
                      {allDone ? (
                        <CheckCircle2 size={18} className="text-primary shrink-0" />
                      ) : isPastIncomplete ? (
                        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                      ) : (
                        <ChevronDown size={18} className={`text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-medium text-foreground">{getSectionLabel(section)}</p>
                        <p className="font-body text-[11px] text-muted-foreground">
                          {sectionCompleted} of {sectionItems.length} complete
                          {isPastIncomplete && " · worth catching up"}
                          {isCurrent && " · current timeframe"}
                        </p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border">
                        {sectionItems.map((item) => {
                          const isItemExpanded = expandedItems.has(item.id);
                          return (
                            <div key={item.id} className="border-b border-border last:border-b-0">
                              <div className="w-full flex items-start gap-3 p-4 py-3 hover:bg-muted/20 transition-colors">
                                <button
                                  onClick={() => toggleItem(item.id, item.status)}
                                  className="shrink-0 mt-0.5"
                                >
                                  {item.status === "complete"
                                    ? <CheckCircle2 size={16} className="text-primary" />
                                    : <Circle size={16} className="text-muted-foreground" />
                                  }
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className={`font-body text-sm leading-snug ${item.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                      {item.label}
                                    </p>
                                    {item.notes && <StickyNote size={11} className="text-sage shrink-0" />}
                                  </div>
                                  {item.completed_at && (
                                    <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                                      Completed {new Date(item.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
                                <div className="px-5 pb-3 pl-[44px]">
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

                        {/* Add item */}
                        {addingTo === section ? (
                          <div className="px-5 py-3 flex gap-2">
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
                            className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-muted/20 transition-colors"
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
          </>
        )}

        <PortalStickyFooter onContinue={() => navigate("/portal/vendors")} nextOnly />
      </div>
    </div>
  );
}
