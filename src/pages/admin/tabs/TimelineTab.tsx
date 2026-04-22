import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Plus, Trash2, GripVertical, Download, Eye, EyeOff,
  Pencil, Palette, X,
} from "lucide-react";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";
import AutosaveIndicator from "@/components/admin/AutosaveIndicator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ── Types ─────────────────────────────────────── */

interface CustomColumn {
  id: string;
  label: string;
}

interface TimeBlock {
  time: string;
  highlight: string | null;
  foh: string;
  boh: string;
  internal: string;
  custom: Record<string, string>;
  duration_minutes?: number | null;
}

interface TimelineDay {
  id: string;
  label: string;
  columns: string[];
  custom_columns: CustomColumn[];
  blocks: TimeBlock[];
}

interface TimelineDataV2 {
  days: TimelineDay[];
}

/* Legacy format */
interface LegacyBlock { time: string; foh_label: string; boh_notes: string; internal_notes: string; }
interface LegacyData { arrival_day?: LegacyBlock[]; wedding_day?: LegacyBlock[]; farewell_day?: LegacyBlock[]; }

const HIGHLIGHT_COLORS: { key: string; label: string; border: string; bg: string }[] = [
  { key: "yellow", label: "Important", border: "border-l-yellow-400", bg: "bg-yellow-50/40" },
  { key: "red", label: "Critical", border: "border-l-red-400", bg: "bg-red-50/40" },
  { key: "green", label: "Confirmed", border: "border-l-green-400", bg: "bg-green-50/40" },
  { key: "blue", label: "Vendor note", border: "border-l-blue-400", bg: "bg-blue-50/40" },
];

const CUSTOM_COL_TINTS = [
  "bg-violet-50/50",
  "bg-rose-50/50",
  "bg-teal-50/50",
  "bg-orange-50/50",
  "bg-cyan-50/50",
];

function getHighlightClasses(h: string | null) {
  if (!h) return { border: "", bg: "" };
  const found = HIGHLIGHT_COLORS.find(c => c.key === h);
  return found ?? { border: "", bg: "" };
}

/* ── Migrate old format → new format ───────────── */
function migrateToV2(raw: any): TimelineDataV2 {
  if (raw?.days && Array.isArray(raw.days)) return raw as TimelineDataV2;
  const legacy = raw as LegacyData;
  const legacyDays: { key: string; label: string }[] = [
    { key: "arrival_day", label: "Arrival Day" },
    { key: "wedding_day", label: "Wedding Day" },
    { key: "farewell_day", label: "Farewell Day" },
  ];
  const days: TimelineDay[] = legacyDays
    .filter(d => legacy[d.key as keyof LegacyData])
    .map((d, i) => ({
      id: `day_${i + 1}`,
      label: d.label,
      columns: ["foh", "boh", "internal"],
      custom_columns: [],
      blocks: (legacy[d.key as keyof LegacyData] || []).map((b: LegacyBlock) => ({
        time: b.time,
        highlight: null,
        foh: b.foh_label ?? "",
        boh: b.boh_notes ?? "",
        internal: b.internal_notes ?? "",
        custom: {},
        duration_minutes: null,
      })),
    }));
  return { days: days.length > 0 ? days : [] };
}

/* ── Sortable Row ──────────────────────────────── */
function SortableRow({
  block, index, dayId, customColumns, onChange, onDelete, onHighlight,
}: {
  block: TimeBlock;
  index: number;
  dayId: string;
  customColumns: CustomColumn[];
  onChange: (field: string, value: string) => void;
  onDelete: () => void;
  onHighlight: (color: string | null) => void;
}) {
  const id = `${dayId}-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const hc = getHighlightClasses(block.highlight);
  const totalCols = 3 + customColumns.length;
  const gridTemplate = `100px repeat(${totalCols}, 1fr)`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 group border-l-[3px] ${hc.border || "border-l-transparent"} ${hc.bg} rounded-r-md px-1 py-0.5`}
    >
      {/* Drag + highlight */}
      <div className="flex flex-col items-center gap-1 mt-2 shrink-0">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical size={14} />
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
              <Palette size={12} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="right" align="start">
            <div className="flex flex-col gap-1">
              <button onClick={() => onHighlight(null)} className="text-[11px] font-body text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted text-left">None</button>
              {HIGHLIGHT_COLORS.map(c => (
                <button key={c.key} onClick={() => onHighlight(c.key)} className={`text-[11px] font-body px-2 py-1 rounded hover:bg-muted text-left flex items-center gap-2 ${block.highlight === c.key ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${c.key === "yellow" ? "bg-yellow-400" : c.key === "red" ? "bg-red-400" : c.key === "green" ? "bg-green-400" : "bg-blue-400"}`} />
                  {c.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Grid of cells */}
      <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="flex flex-col gap-1">
          <Input value={block.time} onChange={e => onChange("time", e.target.value)} className="font-body text-sm h-auto min-h-[36px]" placeholder="Time" />
          <Input
            type="number"
            min={0}
            value={block.duration_minutes ?? ""}
            onChange={e => onChange("duration_minutes", e.target.value)}
            className="font-body text-[11px] h-7 px-2 bg-muted/40"
            placeholder="dur (min)"
            title="Optional duration in minutes — overrides auto gap"
          />
        </div>
        <Textarea value={block.foh} onChange={e => onChange("foh", e.target.value)} className="font-body text-sm min-h-[36px] resize-none bg-card" placeholder="Couple sees…" rows={1} />
        <Textarea value={block.boh} onChange={e => onChange("boh", e.target.value)} className="font-body text-sm min-h-[36px] resize-none bg-blue-50/60" placeholder="Vendor notes…" rows={1} />
        <Textarea value={block.internal} onChange={e => onChange("internal", e.target.value)} className="font-body text-sm min-h-[36px] resize-none bg-amber-50/60" placeholder="Internal…" rows={1} />
        {customColumns.map((col, ci) => (
          <Textarea
            key={col.id}
            value={block.custom?.[col.id] ?? ""}
            onChange={e => onChange(`custom.${col.id}`, e.target.value)}
            className={`font-body text-sm min-h-[36px] resize-none ${CUSTOM_COL_TINTS[ci % CUSTOM_COL_TINTS.length]}`}
            placeholder={col.label}
            rows={1}
          />
        ))}
      </div>

      <button onClick={onDelete} className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/* ── Main Component ────────────────────────────── */
export default function TimelineTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [timeline, setTimeline] = useState<TimelineDataV2 | null>(null);
  const [timelineId, setTimelineId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFoh, setExportFoh] = useState(true);
  const [exportBoh, setExportBoh] = useState(true);
  const [exportInternal, setExportInternal] = useState(false);
  const [exportAudience, setExportAudience] = useState("");
  const [renamingDay, setRenamingDay] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const { status: saveStatus, markSaving, markSaved } = useAutosaveStatus();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { loadTimeline(); }, [eventId]);

  const loadTimeline = async () => {
    const { data } = await supabase.from("working_timeline").select("*").eq("event_id", eventId).maybeSingle();
    if (data) {
      setTimeline(migrateToV2(data.timeline_data));
      setTimelineId(data.id);
      setPublished(data.published || false);
    } else {
      await supabase.rpc("seed_working_timeline", { p_event_id: eventId });
      const { data: seeded } = await supabase.from("working_timeline").select("*").eq("event_id", eventId).maybeSingle();
      if (seeded) {
        setTimeline(migrateToV2(seeded.timeline_data));
        setTimelineId(seeded.id);
        setPublished(seeded.published || false);
      }
    }
    setLoading(false);
  };

  const save = useCallback(async (data: TimelineDataV2, pub?: boolean) => {
    if (!timelineId) return;
    markSaving();
    await supabase.from("working_timeline").update({
      timeline_data: data as any,
      published: pub !== undefined ? pub : published,
      last_updated: new Date().toISOString(),
    }).eq("id", timelineId);
    markSaved();
  }, [timelineId, published, markSaving, markSaved]);

  const saveOnBlur = () => { if (timeline) save(timeline); };

  /* ── Day CRUD ── */
  const addDay = () => {
    if (!timeline) return;
    const nextNum = timeline.days.length + 1;
    const newDay: TimelineDay = {
      id: `day_${Date.now()}`,
      label: `Day ${nextNum}`,
      columns: ["foh", "boh", "internal"],
      custom_columns: [],
      blocks: [],
    };
    const updated = { days: [...timeline.days, newDay] };
    setTimeline(updated);
    save(updated);
  };

  const removeDay = (dayId: string) => {
    if (!timeline) return;
    const updated = { days: timeline.days.filter(d => d.id !== dayId) };
    setTimeline(updated);
    save(updated);
  };

  const renameDay = (dayId: string, newLabel: string) => {
    if (!timeline) return;
    const updated = { days: timeline.days.map(d => d.id === dayId ? { ...d, label: newLabel } : d) };
    setTimeline(updated);
    save(updated);
    setRenamingDay(null);
  };

  /* ── Custom column CRUD ── */
  const addCustomColumn = (dayId: string) => {
    if (!timeline) return;
    const colId = `col_${Date.now()}`;
    const updated = {
      days: timeline.days.map(d => d.id === dayId
        ? { ...d, custom_columns: [...d.custom_columns, { id: colId, label: "New Column" }] }
        : d
      ),
    };
    setTimeline(updated);
    save(updated);
  };

  const renameCustomColumn = (dayId: string, colId: string, label: string) => {
    if (!timeline) return;
    const updated = {
      days: timeline.days.map(d => d.id === dayId
        ? { ...d, custom_columns: d.custom_columns.map(c => c.id === colId ? { ...c, label } : c) }
        : d
      ),
    };
    setTimeline(updated);
  };

  const removeCustomColumn = (dayId: string, colId: string) => {
    if (!timeline) return;
    const updated = {
      days: timeline.days.map(d => d.id === dayId
        ? {
            ...d,
            custom_columns: d.custom_columns.filter(c => c.id !== colId),
            blocks: d.blocks.map(b => {
              const custom = { ...b.custom };
              delete custom[colId];
              return { ...b, custom };
            }),
          }
        : d
      ),
    };
    setTimeline(updated);
    save(updated);
  };

  /* ── Block CRUD ── */
  const updateBlock = (dayId: string, blockIdx: number, field: string, value: string) => {
    if (!timeline) return;
    const updated = {
      days: timeline.days.map(d => {
        if (d.id !== dayId) return d;
        const blocks = [...d.blocks];
        if (field.startsWith("custom.")) {
          const colId = field.replace("custom.", "");
          blocks[blockIdx] = { ...blocks[blockIdx], custom: { ...blocks[blockIdx].custom, [colId]: value } };
        } else if (field === "duration_minutes") {
          const n = value.trim() === "" ? null : Math.max(0, parseInt(value, 10));
          blocks[blockIdx] = { ...blocks[blockIdx], duration_minutes: Number.isNaN(n as number) ? null : n };
        } else {
          blocks[blockIdx] = { ...blocks[blockIdx], [field]: value };
        }
        return { ...d, blocks };
      }),
    };
    setTimeline(updated);
  };

  const setBlockHighlight = (dayId: string, blockIdx: number, color: string | null) => {
    if (!timeline) return;
    const updated = {
      days: timeline.days.map(d => {
        if (d.id !== dayId) return d;
        const blocks = [...d.blocks];
        blocks[blockIdx] = { ...blocks[blockIdx], highlight: color };
        return { ...d, blocks };
      }),
    };
    setTimeline(updated);
    save(updated);
  };

  const addBlock = (dayId: string) => {
    if (!timeline) return;
    const updated = {
      days: timeline.days.map(d => d.id === dayId
        ? { ...d, blocks: [...d.blocks, { time: "", highlight: null, foh: "", boh: "", internal: "", custom: {} }] }
        : d
      ),
    };
    setTimeline(updated);
    save(updated);
  };

  const deleteBlock = (dayId: string, blockIdx: number) => {
    if (!timeline) return;
    const updated = {
      days: timeline.days.map(d => d.id === dayId
        ? { ...d, blocks: d.blocks.filter((_, i) => i !== blockIdx) }
        : d
      ),
    };
    setTimeline(updated);
    save(updated);
  };

  const handleDragEnd = (dayId: string, event: DragEndEvent) => {
    if (!timeline) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const updated = {
      days: timeline.days.map(d => {
        if (d.id !== dayId) return d;
        const blocks = [...d.blocks];
        const oldIdx = blocks.findIndex((_, i) => `${dayId}-${i}` === active.id);
        const newIdx = blocks.findIndex((_, i) => `${dayId}-${i}` === over.id);
        if (oldIdx === -1 || newIdx === -1) return d;
        const [moved] = blocks.splice(oldIdx, 1);
        blocks.splice(newIdx, 0, moved);
        return { ...d, blocks };
      }),
    };
    setTimeline(updated);
    save(updated);
  };

  const togglePublished = () => {
    const next = !published;
    setPublished(next);
    if (timeline) save(timeline, next);
    toast.success(next ? "Timeline published to couple portal" : "Timeline hidden from couple portal");
  };

  /* ── Export ── */
  const handleExportPdf = () => {
    if (!timeline) return;
    let title = "Weekend Timeline";
    if (exportFoh && !exportBoh && !exportInternal) title = "Your Weekend Itinerary";
    if (exportFoh && exportBoh && !exportInternal) title = "Vendor Day-of Sheet";
    if (exportFoh && exportBoh && exportInternal) title = "Coordinator Timeline — Confidential";

    let html = `<!DOCTYPE html><html><head><title>${title}</title><style>
      body { font-family: 'Georgia', serif; max-width: 900px; margin: 0 auto; padding: 40px 30px; color: #2d2d2d; }
      h1 { font-size: 28px; font-weight: 300; margin-bottom: 4px; color: #5c6b5e; }
      .subtitle { font-size: 13px; color: #888; margin-bottom: 30px; }
      h2 { font-size: 18px; font-weight: 400; color: #5c6b5e; border-bottom: 1px solid #e5e5e0; padding-bottom: 6px; margin: 28px 0 14px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; padding: 4px 8px; border-bottom: 1px solid #ddd; }
      td { padding: 6px 8px; font-size: 13px; border-bottom: 1px solid #f0f0ec; vertical-align: top; white-space: pre-line; }
      .time { font-weight: 600; white-space: nowrap; width: 90px; }
      .boh { background: #f0f6ff; }
      .internal { background: #fff8ed; }
      .custom { background: #f5f0ff; }
      .hl-yellow { border-left: 3px solid #facc15; }
      .hl-red { border-left: 3px solid #f87171; }
      .hl-green { border-left: 3px solid #4ade80; }
      .hl-blue { border-left: 3px solid #60a5fa; }
      .confidential { text-align: center; color: #c0392b; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 40px; }
      @media print { body { padding: 20px; } }
    </style></head><body>`;

    html += `<h1>${title}</h1>`;
    if (exportAudience) html += `<div class="subtitle">Prepared for: ${exportAudience}</div>`;
    html += `<div class="subtitle">Gilbertsville Farmhouse</div>`;

    for (const day of timeline.days) {
      const blocks = day.blocks.filter(b => b.foh || b.boh || b.internal);
      if (blocks.length === 0) continue;
      html += `<h2>${day.label}</h2><table><tr><th>Time</th>`;
      if (exportFoh) html += `<th>Event</th>`;
      if (exportBoh) html += `<th>Staff Notes</th>`;
      if (exportInternal) html += `<th>Internal</th>`;
      if (exportBoh && day.custom_columns.length > 0) {
        for (const cc of day.custom_columns) html += `<th>${cc.label}</th>`;
      }
      html += `</tr>`;
      for (const b of blocks) {
        const hlClass = b.highlight ? `hl-${b.highlight}` : "";
        html += `<tr class="${hlClass}"><td class="time">${b.time}</td>`;
        if (exportFoh) html += `<td>${b.foh}</td>`;
        if (exportBoh) html += `<td class="boh">${b.boh || "—"}</td>`;
        if (exportInternal) html += `<td class="internal">${b.internal || "—"}</td>`;
        if (exportBoh && day.custom_columns.length > 0) {
          for (const cc of day.custom_columns) html += `<td class="custom">${b.custom?.[cc.id] || "—"}</td>`;
        }
        html += `</tr>`;
      }
      html += `</table>`;
    }

    if (exportInternal) html += `<div class="confidential">Confidential — Coordinator Use Only</div>`;
    html += `</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    setExportOpen(false);
  };

  /* ── Render ── */
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!timeline) return <p className="font-body text-muted-foreground py-10">Could not load timeline.</p>;

  return (
    <div className="space-y-6 pb-32" onBlur={saveOnBlur}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-light text-foreground">Working Timeline</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">Flexible multi-day itinerary with layered visibility.</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <AutosaveIndicator status={saveStatus} />
          <Button variant="outline" size="sm" onClick={addDay} className="gap-1.5">
            <Plus size={14} /> Add Day
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="gap-1.5">
            <Download size={14} /> Export
          </Button>
          <div className="flex items-center gap-2">
            {published ? <Eye size={14} className="text-sage" /> : <EyeOff size={14} className="text-muted-foreground" />}
            <Switch checked={published} onCheckedChange={togglePublished} />
            <span className="font-body text-xs text-muted-foreground">{published ? "Published" : "Draft"}</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs font-body text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-card border border-border" /> Couple (FOH)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-50" /> Vendor (BOH)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-50" /> Internal</div>
      </div>

      {/* Days */}
      {timeline.days.map((day) => {
        const totalCols = 3 + day.custom_columns.length;
        const gridTemplate = `100px repeat(${totalCols}, 1fr)`;

        return (
          <div key={day.id} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
            {/* Day header */}
            <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {renamingDay === day.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") renameDay(day.id, renameValue); if (e.key === "Escape") setRenamingDay(null); }}
                      className="h-8 w-48 font-display text-lg"
                    />
                    <Button size="sm" variant="ghost" onClick={() => renameDay(day.id, renameValue)} className="h-7 px-2 text-xs">Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenamingDay(null)} className="h-7 px-2 text-xs">Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-light text-foreground">{day.label}</h3>
                    <button onClick={() => { setRenamingDay(day.id); setRenameValue(day.label); }} className="text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil size={13} />
                    </button>
                  </div>
                )}
                <span className="font-body text-xs text-muted-foreground">{day.blocks.length} blocks</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => addCustomColumn(day.id)} className="h-7 px-2 text-xs gap-1">
                  <Plus size={12} /> Column
                </Button>
                {timeline.days.length > 1 && (
                  <button onClick={() => removeDay(day.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 space-y-1.5">
              {/* Column headers */}
              <div className="flex items-center gap-2 pl-[38px]">
                <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: gridTemplate }}>
                  <span className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Time</span>
                  <span className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Couple Sees</span>
                  <span className="font-body text-[10px] tracking-widest uppercase text-blue-600/70">Vendor Notes</span>
                  <span className="font-body text-[10px] tracking-widest uppercase text-amber-600/70">Internal</span>
                  {day.custom_columns.map((col, ci) => (
                    <div key={col.id} className="flex items-center gap-1">
                      <Input
                        value={col.label}
                        onChange={e => renameCustomColumn(day.id, col.id, e.target.value)}
                        className="h-5 text-[10px] tracking-widest uppercase border-0 bg-transparent p-0 font-body text-violet-600/70 focus-visible:ring-0"
                      />
                      <button onClick={() => removeCustomColumn(day.id, col.id)} className="text-muted-foreground/50 hover:text-destructive shrink-0">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="w-[14px]" />
              </div>

              {/* Rows */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(day.id, e)}>
                <SortableContext items={day.blocks.map((_, i) => `${day.id}-${i}`)} strategy={verticalListSortingStrategy}>
                  {day.blocks.map((block, i) => (
                    <SortableRow
                      key={`${day.id}-${i}`}
                      block={block}
                      index={i}
                      dayId={day.id}
                      customColumns={day.custom_columns}
                      onChange={(field, value) => updateBlock(day.id, i, field, value)}
                      onDelete={() => deleteBlock(day.id, i)}
                      onHighlight={(color) => setBlockHighlight(day.id, i, color)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <button onClick={() => addBlock(day.id)} className="flex items-center gap-1.5 text-xs font-body text-sage hover:text-sage/80 transition-colors mt-2 ml-[38px]">
                <Plus size={13} /> Add time block
              </button>
            </div>
          </div>
        );
      })}

      {/* Export Modal */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-light">Export Timeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <p className="font-body text-sm text-muted-foreground">Select which layers to include:</p>
              <div className="flex items-center gap-2">
                <Checkbox id="exp-foh" checked={exportFoh} onCheckedChange={(c) => setExportFoh(!!c)} />
                <Label htmlFor="exp-foh" className="font-body text-sm">Couple-facing events</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="exp-boh" checked={exportBoh} onCheckedChange={(c) => setExportBoh(!!c)} />
                <Label htmlFor="exp-boh" className="font-body text-sm">Vendor / staff notes</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="exp-int" checked={exportInternal} onCheckedChange={(c) => setExportInternal(!!c)} />
                <Label htmlFor="exp-int" className="font-body text-sm">Internal notes</Label>
              </div>
            </div>
            <div>
              <Label className="font-body text-xs text-muted-foreground">Audience label (optional)</Label>
              <Input value={exportAudience} onChange={(e) => setExportAudience(e.target.value)} placeholder="e.g. For: Photography Team" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button onClick={handleExportPdf} className="gap-2"><Download size={14} /> Export PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminStickyFooter
        status={saveStatus}
        onSave={() => { if (timeline) save(timeline); }}
        onSaveAndContinue={() => { if (timeline) save(timeline).then(() => onNavigateNext?.()); }}
      />
    </div>
  );
}
