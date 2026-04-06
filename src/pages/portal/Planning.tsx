import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2, Circle, Loader2, ChevronDown, Plus,
  AlertTriangle, StickyNote, Pencil, Trash2, ClipboardList,
} from "lucide-react";
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

const CATEGORY_OPTIONS = [
  { value: "arrival", label: "Arrival" },
  { value: "ceremony", label: "Ceremony" },
  { value: "reception", label: "Reception" },
  { value: "attire", label: "Attire & Rings" },
  { value: "decor", label: "Décor" },
  { value: "logistics", label: "Logistics" },
  { value: "other", label: "Other" },
];

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

/* ── My Checklist flat list view ── */
function MyChecklistView({
  items,
  eventId,
  onToggle,
  onSaveNotes,
  onDelete,
  onItemAdded,
}: {
  items: ChecklistItem[];
  eventId: string;
  onToggle: (id: string, status: string | null) => void;
  onSaveNotes: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
  onItemAdded: (item: ChecklistItem) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("logistics");
  const [newNotes, setNewNotes] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const incomplete = items.filter(i => i.status !== "complete").sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const completed = items.filter(i => i.status === "complete").sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Group by section, only sections with items
  const groupItems = (list: ChecklistItem[]) => {
    const groups: { section: string; label: string; items: ChecklistItem[] }[] = [];
    for (const s of CHECKLIST_SECTIONS) {
      const sItems = list.filter(i => i.section === s);
      if (sItems.length > 0) groups.push({ section: s, label: SECTION_LABELS[s] || s, items: sItems });
    }
    return groups;
  };

  const handleSave = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    const section = newCategory === "other" ? "logistics" : newCategory;
    const maxSort = Math.max(0, ...items.filter(i => i.section === section).map(i => i.sort_order ?? 0));
    const { data } = await supabase.from("checklist_items").insert({
      event_id: eventId,
      section,
      label: newLabel.trim(),
      notes: newNotes.trim() || null,
      status: "incomplete",
      owner: "couple",
      sort_order: maxSort + 1,
      paced_send_date: newDueDate || null,
    }).select().single();
    if (data) onItemAdded(data);
    setNewLabel("");
    setNewNotes("");
    setNewDueDate("");
    setNewCategory("logistics");
    setShowAddForm(false);
    setSaving(false);
  };

  const totalCount = items.length;
  const completedCount = completed.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div>
      {/* Header row with progress + add button */}
      <div className="flex items-center justify-between mb-4">
        {totalCount > 0 ? (
          <p className="font-body text-xs text-muted-foreground">
            {completedCount} of {totalCount} complete · {pct}%
          </p>
        ) : <div />}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Add Task
        </button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-6">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Inline add form */}
      {showAddForm && (
        <div className="rounded-xl bg-card border border-border shadow-soft p-5 mb-6 animate-fade-up">
          <input
            autoFocus
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="What needs to get done?"
            className="w-full font-body text-sm bg-transparent border-b border-border focus:border-primary outline-none py-2 text-foreground placeholder:text-muted-foreground mb-3"
          />
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="font-body text-sm bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label className="font-body text-xs text-muted-foreground shrink-0">Due date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="font-body text-sm bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <textarea
            value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            placeholder="Add any details..."
            rows={2}
            className="w-full font-body text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none mb-4"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!newLabel.trim() || saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 font-body text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewLabel(""); setNewNotes(""); }}
              className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalCount === 0 && !showAddForm && (
        <div className="text-center py-16">
          <ClipboardList size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-display text-xl italic text-foreground mb-1">No tasks yet</p>
          <p className="font-body text-sm text-muted-foreground mb-5">
            Start adding what needs to get done — we'll keep track of everything for you.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 font-body text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} />
            Add your first task
          </button>
        </div>
      )}

      {/* Incomplete items grouped by category */}
      {groupItems(incomplete).map(group => (
        <div key={group.section} className="mb-5">
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-2">{group.label}</p>
          <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
            {group.items.map((item, idx) => {
              const isEditing = editingId === item.id;
              return (
                <div key={item.id} className={`${idx > 0 ? "border-t border-border" : ""}`}>
                  <div className="group flex items-start gap-3 p-4 py-3 hover:bg-muted/20 transition-colors">
                    <button onClick={() => onToggle(item.id, item.status)} className="shrink-0 mt-0.5">
                      <Circle size={16} className="text-muted-foreground" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-foreground leading-snug">{item.label}</p>
                      {item.paced_send_date && !isEditing && (
                        <p className={`font-body text-[10px] mt-0.5 ${
                          item.status !== "complete" && new Date(item.paced_send_date + "T00:00:00") < new Date()
                            ? "text-amber-600" : "text-muted-foreground"
                        }`}>
                          Due {new Date(item.paced_send_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      )}
                      {item.notes && !isEditing && (
                        <p className="font-body text-xs text-muted-foreground mt-0.5 truncate">{item.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => { setEditingId(isEditing ? null : item.id); setEditNotes(item.notes ?? ""); setEditDueDate(item.paced_send_date ?? ""); }}
                        className="p-1 rounded hover:bg-muted/40 transition-colors"
                      >
                        <Pencil size={13} className="text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1 rounded hover:bg-muted/40 transition-colors"
                      >
                        <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                  {isEditing && (
                    <div className="px-4 pb-3 pl-[44px] space-y-2">
                      <textarea
                        autoFocus
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        onBlur={() => { onSaveNotes(item.id, editNotes); setEditingId(null); }}
                        placeholder="Add any details..."
                        rows={2}
                        className="w-full font-body text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <label className="font-body text-[11px] text-muted-foreground shrink-0">Due date</label>
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={e => {
                            setEditDueDate(e.target.value);
                            const updated = e.target.value || null;
                            supabase.from("checklist_items").update({ paced_send_date: updated }).eq("id", item.id);
                          }}
                          className="font-body text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {editDueDate && (
                          <button
                            onClick={() => {
                              setEditDueDate("");
                              supabase.from("checklist_items").update({ paced_send_date: null }).eq("id", item.id);
                            }}
                            className="font-body text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Completed items */}
      {completed.length > 0 && (
        <div className="mt-6">
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
            Completed ({completed.length})
          </p>
          <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
            {completed.map((item, idx) => (
              <div key={item.id} className={`${idx > 0 ? "border-t border-border" : ""}`}>
                <div className="group flex items-start gap-3 p-4 py-3 hover:bg-muted/20 transition-colors">
                  <button onClick={() => onToggle(item.id, item.status)} className="shrink-0 mt-0.5">
                    <CheckCircle2 size={16} className="text-primary" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-muted-foreground leading-snug line-through">{item.label}</p>
                    {item.completed_at && (
                      <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                        Completed {new Date(item.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => onDelete(item.id)} className="p-1 rounded hover:bg-muted/40 transition-colors">
                      <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */
export default function Planning() {
  const { eventId: portalEventId, event, loading: eventLoading, refreshChecklist } = usePortalData();
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const eventId = portalEventId || routeEventId || null;

  const navigate = useNavigate();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("timeline");
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
    if (!eventId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const selectFields = "id, label, section, status, owner, paced_send_date, completed_at, notes, sort_order";
    const [
      { data: checklistData, error: checklistError },
      { data: timelineData, error: timelineError },
    ] = await Promise.all([
      supabase.from("checklist_items").select(selectFields).eq("event_id", eventId).in("section", CHECKLIST_SECTIONS).order("sort_order", { ascending: true }),
      supabase.from("checklist_items").select(selectFields).eq("event_id", eventId).in("section", TIMELINE_SECTIONS.map(({ key }) => key)).order("sort_order", { ascending: true }),
    ]);
    if (checklistError || timelineError) console.error("Failed to load planning items", { checklistError, timelineError });
    setItems([...(checklistData ?? []), ...(timelineData ?? [])]);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

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

  const saveNotes = async (itemId: string, notes: string) => {
    setItems(prev => prev.map(x => x.id === itemId ? { ...x, notes: notes || null } : x));
    await supabase.from("checklist_items").update({ notes: notes || null }).eq("id", itemId);
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from("checklist_items").delete().eq("id", id);
    refreshChecklist();
  };

  const toggleSection = (section: string) => {
    setExpanded(prev => { const next = new Set(prev); next.has(section) ? next.delete(section) : next.add(section); return next; });
  };
  const toggleItemExpand = (id: string) => {
    setExpandedItems(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const addTimelineItem = async (section: string) => {
    if (!newLabel.trim() || !eventId) return;
    const maxSort = Math.max(0, ...items.filter(i => i.section === section).map(i => i.sort_order ?? 0));
    const { data } = await supabase.from("checklist_items").insert({
      event_id: eventId, section, label: newLabel.trim(), status: "incomplete", owner: "couple", sort_order: maxSort + 1,
    }).select().single();
    if (data) setItems(prev => [...prev, data]);
    setNewLabel(""); setAddingTo(null); refreshChecklist();
  };

  const checklistItems = items.filter(i => CHECKLIST_SECTIONS.includes(i.section));
  const timelineItems = items.filter(i => i.section.startsWith("timeline_"));

  const timelineSections = TIMELINE_SECTIONS.filter(t => timelineItems.some(i => i.section === t.key)).map(t => t.key);
  const timelineTotal = timelineItems.length;
  const timelineCompleted = timelineItems.filter(i => i.status === "complete").length;
  const timelinePct = timelineTotal > 0 ? Math.round((timelineCompleted / timelineTotal) * 100) : 0;
  const currentTimeframe = getCurrentTimeframe(daysUntil);

  const isLoading = loading || eventLoading;

  return (
    <>
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Your tasks</p>
        <h1 className="font-display text-4xl font-light text-foreground mb-6">Planning</h1>

        <SectionTabs
          tabs={[
            { id: "timeline", label: "Planning Timeline" },
            { id: "checklist", label: "My Checklist" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : tab === "checklist" ? (
          <MyChecklistView
            items={checklistItems}
            eventId={eventId!}
            onToggle={toggleItem}
            onSaveNotes={saveNotes}
            onDelete={deleteItem}
            onItemAdded={(item) => { setItems(prev => [...prev, item]); refreshChecklist(); }}
          />
        ) : timelineTotal === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 size={32} className="text-primary mx-auto mb-3" />
            <p className="font-display text-xl italic text-foreground">No tasks yet</p>
            <p className="font-body text-sm text-muted-foreground mt-1">Tasks will appear here as your planning progresses.</p>
          </div>
        ) : (
          <>
            {/* Timeline progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-body text-xs text-muted-foreground">{timelineCompleted} of {timelineTotal} complete</p>
                <p className="font-body text-xs font-medium text-foreground">{timelinePct}%</p>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${timelinePct}%` }} />
              </div>
            </div>

            {/* Timeline sections */}
            <div className="space-y-3">
              {timelineSections.map(section => {
                const sectionItems = timelineItems.filter(i => i.section === section);
                const sectionCompleted = sectionItems.filter(i => i.status === "complete").length;
                const allDone = sectionCompleted === sectionItems.length;
                const isExpanded = expanded.has(section);
                const isCurrent = section === currentTimeframe;
                const isPastIncomplete = !allDone && daysUntil !== null && TIMELINE_DAYS_MAP[section] > (daysUntil ?? 0);
                const tl = TIMELINE_SECTIONS.find(t => t.key === section);

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
                        <p className="font-body text-sm font-medium text-foreground">{tl?.label ?? section}</p>
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
                                <button onClick={() => toggleItem(item.id, item.status)} className="shrink-0 mt-0.5">
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
                                <button onClick={() => toggleItemExpand(item.id)} className="mt-0.5 p-1 rounded hover:bg-muted/40 transition-colors shrink-0">
                                  <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isItemExpanded ? "rotate-180" : ""}`} />
                                </button>
                              </div>
                              {isItemExpanded && (
                                <div className="px-4 pb-3 pl-[44px]">
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
                          <div className="px-5 py-3 flex gap-2">
                            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addTimelineItem(section)} placeholder="New task…"
                              className="flex-1 font-body text-sm bg-transparent border-b border-border focus:border-primary outline-none py-1 text-foreground placeholder:text-muted-foreground" />
                            <button onClick={() => addTimelineItem(section)} className="font-body text-xs text-primary hover:underline">Add</button>
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

      </div>
    </div>
    <PortalStickyFooter onContinue={() => navigate("/portal/vendors")} nextOnly />
    </>
  );
}
