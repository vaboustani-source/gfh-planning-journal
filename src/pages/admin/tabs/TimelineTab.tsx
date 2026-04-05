import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, GripVertical, Download, Eye, EyeOff } from "lucide-react";
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
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TimeBlock {
  time: string;
  foh_label: string;
  boh_notes: string;
  internal_notes: string;
}

interface TimelineData {
  arrival_day: TimeBlock[];
  wedding_day: TimeBlock[];
  farewell_day: TimeBlock[];
}

const DAY_KEYS: { key: keyof TimelineData; label: string }[] = [
  { key: "arrival_day", label: "Arrival Day" },
  { key: "wedding_day", label: "Wedding Day" },
  { key: "farewell_day", label: "Farewell Day" },
];

function SortableRow({
  block,
  index,
  dayKey,
  onChange,
  onDelete,
}: {
  block: TimeBlock;
  index: number;
  dayKey: string;
  onChange: (field: keyof TimeBlock, value: string) => void;
  onDelete: () => void;
}) {
  const id = `${dayKey}-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 group">
      <button {...attributes} {...listeners} className="mt-3 cursor-grab text-muted-foreground hover:text-foreground shrink-0">
        <GripVertical size={14} />
      </button>
      <div className="flex-1 grid grid-cols-[100px_1fr_1fr_1fr] gap-2">
        <Input
          value={block.time}
          onChange={(e) => onChange("time", e.target.value)}
          className="font-body text-sm h-9"
          placeholder="Time"
        />
        <Input
          value={block.foh_label}
          onChange={(e) => onChange("foh_label", e.target.value)}
          className="font-body text-sm h-9 bg-white"
          placeholder="Couple sees..."
        />
        <Input
          value={block.boh_notes}
          onChange={(e) => onChange("boh_notes", e.target.value)}
          className="font-body text-sm h-9 bg-blue-50/60"
          placeholder="Vendor notes..."
        />
        <Input
          value={block.internal_notes}
          onChange={(e) => onChange("internal_notes", e.target.value)}
          className="font-body text-sm h-9 bg-amber-50/60"
          placeholder="Internal..."
        />
      </div>
      <button
        onClick={onDelete}
        className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function TimelineTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [timelineId, setTimelineId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFoh, setExportFoh] = useState(true);
  const [exportBoh, setExportBoh] = useState(true);
  const [exportInternal, setExportInternal] = useState(false);
  const [exportAudience, setExportAudience] = useState("");
  const { status: saveStatus, trackSave, markSaving, markSaved } = useAutosaveStatus();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadTimeline();
  }, [eventId]);

  const loadTimeline = async () => {
    // Try to load existing
    const { data } = await supabase
      .from("working_timeline")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (data) {
      const td = data.timeline_data as unknown as TimelineData;
      setTimeline(td || { arrival_day: [], wedding_day: [], farewell_day: [] });
      setTimelineId(data.id);
      setPublished(data.published || false);
    } else {
      // Seed it
      await supabase.rpc("seed_working_timeline", { p_event_id: eventId });
      const { data: seeded } = await supabase
        .from("working_timeline")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();
      if (seeded) {
        const td = seeded.timeline_data as unknown as TimelineData;
        setTimeline(td || { arrival_day: [], wedding_day: [], farewell_day: [] });
        setTimelineId(seeded.id);
        setPublished(seeded.published || false);
      }
    }
    setLoading(false);
  };

  const save = useCallback(async (data: TimelineData, pub?: boolean) => {
    if (!timelineId) return;
    markSaving();
    await supabase
      .from("working_timeline")
      .update({
        timeline_data: data as any,
        published: pub !== undefined ? pub : published,
        last_updated: new Date().toISOString(),
      })
      .eq("id", timelineId);
    markSaved();
  }, [timelineId, published, markSaving, markSaved]);

  const updateBlock = (dayKey: keyof TimelineData, index: number, field: keyof TimeBlock, value: string) => {
    if (!timeline) return;
    const updated = { ...timeline };
    const blocks = [...updated[dayKey]];
    blocks[index] = { ...blocks[index], [field]: value };
    updated[dayKey] = blocks;
    setTimeline(updated);
  };

  const saveOnBlur = () => {
    if (timeline) save(timeline);
  };

  const addBlock = (dayKey: keyof TimelineData) => {
    if (!timeline) return;
    const updated = { ...timeline };
    updated[dayKey] = [...updated[dayKey], { time: "", foh_label: "", boh_notes: "", internal_notes: "" }];
    setTimeline(updated);
    save(updated);
  };

  const deleteBlock = (dayKey: keyof TimelineData, index: number) => {
    if (!timeline) return;
    const updated = { ...timeline };
    updated[dayKey] = updated[dayKey].filter((_, i) => i !== index);
    setTimeline(updated);
    save(updated);
  };

  const handleDragEnd = (dayKey: keyof TimelineData, event: DragEndEvent) => {
    if (!timeline) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const blocks = [...timeline[dayKey]];
    const oldIdx = blocks.findIndex((_, i) => `${dayKey}-${i}` === active.id);
    const newIdx = blocks.findIndex((_, i) => `${dayKey}-${i}` === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const [moved] = blocks.splice(oldIdx, 1);
    blocks.splice(newIdx, 0, moved);

    const updated = { ...timeline, [dayKey]: blocks };
    setTimeline(updated);
    save(updated);
  };

  const togglePublished = async () => {
    const next = !published;
    setPublished(next);
    if (timeline) save(timeline, next);
    toast.success(next ? "Timeline published to couple portal" : "Timeline hidden from couple portal");
  };

  const handleExportPdf = async () => {
    if (!timeline) return;
    
    // Build a printable HTML and open in new window
    const days = DAY_KEYS.map(d => ({
      label: d.label,
      blocks: timeline[d.key].filter(b => b.foh_label || b.boh_notes || b.internal_notes),
    }));

    let title = "Weekend Timeline";
    if (exportFoh && !exportBoh && !exportInternal) title = "Your Weekend Itinerary";
    if (exportFoh && exportBoh && !exportInternal) title = "Vendor Day-of Sheet";
    if (exportFoh && exportBoh && exportInternal) title = "Coordinator Timeline — Confidential";

    let html = `<!DOCTYPE html><html><head><title>${title}</title><style>
      body { font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 40px 30px; color: #2d2d2d; }
      h1 { font-size: 28px; font-weight: 300; margin-bottom: 4px; color: #5c6b5e; }
      .subtitle { font-size: 13px; color: #888; margin-bottom: 30px; }
      h2 { font-size: 18px; font-weight: 400; color: #5c6b5e; border-bottom: 1px solid #e5e5e0; padding-bottom: 6px; margin: 28px 0 14px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; padding: 4px 8px; border-bottom: 1px solid #ddd; }
      td { padding: 6px 8px; font-size: 13px; border-bottom: 1px solid #f0f0ec; vertical-align: top; }
      .time { font-weight: 600; white-space: nowrap; width: 90px; }
      .boh { background: #f0f6ff; }
      .internal { background: #fff8ed; }
      .confidential { text-align: center; color: #c0392b; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 40px; }
      @media print { body { padding: 20px; } }
    </style></head><body>`;
    
    html += `<h1>${title}</h1>`;
    if (exportAudience) html += `<div class="subtitle">Prepared for: ${exportAudience}</div>`;
    html += `<div class="subtitle">Gilbertsville Farmhouse</div>`;

    for (const day of days) {
      if (day.blocks.length === 0) continue;
      html += `<h2>${day.label}</h2><table><tr><th>Time</th>`;
      if (exportFoh) html += `<th>Event</th>`;
      if (exportBoh) html += `<th>Staff Notes</th>`;
      if (exportInternal) html += `<th>Internal</th>`;
      html += `</tr>`;
      for (const b of day.blocks) {
        html += `<tr><td class="time">${b.time}</td>`;
        if (exportFoh) html += `<td>${b.foh_label}</td>`;
        if (exportBoh) html += `<td class="boh">${b.boh_notes || "—"}</td>`;
        if (exportInternal) html += `<td class="internal">${b.internal_notes || "—"}</td>`;
        html += `</tr>`;
      }
      html += `</table>`;
    }

    if (exportInternal) html += `<div class="confidential">Confidential — Coordinator Use Only</div>`;
    html += `</body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
    setExportOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!timeline) {
    return <p className="font-body text-muted-foreground py-10">Could not load timeline.</p>;
  }

  return (
    <div className="space-y-8 pb-32" onBlur={saveOnBlur}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-light text-foreground">Working Timeline</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">Three-day itinerary with FOH, BOH, and internal layers.</p>
        </div>
        <div className="flex items-center gap-4">
          <AutosaveIndicator status={saveStatus} />
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="gap-2">
            <Download size={14} /> Export
          </Button>
          <div className="flex items-center gap-2">
            {published ? <Eye size={14} className="text-sage" /> : <EyeOff size={14} className="text-muted-foreground" />}
            <Switch checked={published} onCheckedChange={togglePublished} />
            <span className="font-body text-xs text-muted-foreground">
              {published ? "Published" : "Draft"}
            </span>
          </div>
        </div>
      </div>

      {/* Column legend */}
      <div className="flex items-center gap-4 text-xs font-body text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-white border border-border" />
          Couple Sees (FOH)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-50" />
          Vendor Notes (BOH)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-50" />
          Internal Only
        </div>
      </div>

      {DAY_KEYS.map(({ key, label }) => (
        <div key={key} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <h3 className="font-display text-lg font-light text-foreground">{label}</h3>
            <p className="font-body text-xs text-muted-foreground">{timeline[key].length} time blocks</p>
          </div>

          <div className="p-4 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2 pl-8">
              <div className="flex-1 grid grid-cols-[100px_1fr_1fr_1fr] gap-2">
                <span className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Time</span>
                <span className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Couple Sees</span>
                <span className="font-body text-[10px] tracking-widest uppercase text-muted-foreground text-blue-600/70">Vendor Notes</span>
                <span className="font-body text-[10px] tracking-widest uppercase text-muted-foreground text-amber-600/70">Internal</span>
              </div>
              <div className="w-[14px]" />
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleDragEnd(key, e)}
            >
              <SortableContext
                items={timeline[key].map((_, i) => `${key}-${i}`)}
                strategy={verticalListSortingStrategy}
              >
                {timeline[key].map((block, i) => (
                  <SortableRow
                    key={`${key}-${i}`}
                    block={block}
                    index={i}
                    dayKey={key}
                    onChange={(field, value) => updateBlock(key, i, field, value)}
                    onDelete={() => deleteBlock(key, i)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <button
              onClick={() => addBlock(key)}
              className="flex items-center gap-1.5 text-xs font-body text-sage hover:text-sage/80 transition-colors mt-2 ml-8"
            >
              <Plus size={13} /> Add time block
            </button>
          </div>
        </div>
      ))}

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
              <Input
                value={exportAudience}
                onChange={(e) => setExportAudience(e.target.value)}
                placeholder="e.g. For: Photography Team"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button onClick={handleExportPdf} className="gap-2">
              <Download size={14} /> Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminStickyFooter onContinue={onNavigateNext} />
    </div>
  );
}
