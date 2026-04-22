import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, Trash2, Edit, FileText, Users, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import FormBuilder from "@/components/forms/FormBuilder";
import FormFiller from "@/components/forms/FormFiller";
import { FormField, ResponseMap, AssignmentStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/formFields";

interface FormRow {
  id: string;
  title: string;
  description: string | null;
  fields: FormField[];
  is_template: boolean;
  created_at: string;
}

interface EventOption {
  id: string;
  title: string;
  couple_names: string;
}

interface AssignmentRow {
  id: string;
  form_id: string;
  event_id: string;
  status: AssignmentStatus;
  submitted_at: string | null;
  event_title?: string;
  responses?: ResponseMap;
}

export default function AdminForms() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<FormRow> | null>(null);
  const [assignTarget, setAssignTarget] = useState<FormRow | null>(null);
  const [viewResponse, setViewResponse] = useState<{ form: FormRow; assignment: AssignmentRow } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: f }, { data: ev }, { data: a }] = await Promise.all([
      supabase.from("forms").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("id, title, partner1_name, partner2_name").order("created_at", { ascending: false }),
      supabase.from("form_assignments").select("id, form_id, event_id, status, submitted_at, events(title)"),
    ]);
    if (f) setForms(f.map(r => ({ ...r, fields: (r.fields as FormField[]) ?? [] })));
    if (ev) setEvents(ev.map(e => ({
      id: e.id,
      title: e.title,
      couple_names: [e.partner1_name, e.partner2_name].filter(Boolean).join(" & ") || e.title,
    })));
    if (a) setAssignments(a.map((r: any) => ({
      id: r.id, form_id: r.form_id, event_id: r.event_id,
      status: (r.status as AssignmentStatus) ?? "not_started",
      submitted_at: r.submitted_at, event_title: r.events?.title,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const startNew = () => setEditing({ title: "", description: "", fields: [], is_template: false });

  const saveForm = async () => {
    if (!editing) return;
    if (!editing.title?.trim()) { toast.error("Title required"); return; }
    const payload = {
      title: editing.title.trim(),
      description: editing.description ?? null,
      fields: (editing.fields ?? []) as any,
      is_template: !!editing.is_template,
    };
    if (editing.id) {
      const { error } = await supabase.from("forms").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Form updated");
    } else {
      const { error } = await supabase.from("forms").insert({ ...payload, created_by: user?.id ?? null });
      if (error) { toast.error(error.message); return; }
      toast.success("Form created");
    }
    setEditing(null);
    fetchAll();
  };

  const deleteForm = async (id: string) => {
    if (!confirm("Delete this form? All assignments and responses will also be removed.")) return;
    const { error } = await supabase.from("forms").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Form deleted");
    fetchAll();
  };

  const viewSubmission = async (form: FormRow, assignment: AssignmentRow) => {
    const { data } = await supabase.from("form_responses").select("responses").eq("assignment_id", assignment.id).maybeSingle();
    setViewResponse({ form, assignment: { ...assignment, responses: (data?.responses as ResponseMap) ?? {} } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 h-14 flex items-center gap-4">
          <button onClick={() => navigate("/admin")} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={15} /> Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <h1 className="font-display text-lg font-light flex-1">Forms</h1>
          <button onClick={startNew} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-sage text-white font-body text-sm hover:bg-sage-dark transition-colors">
            <Plus size={14} /> Create Form
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : forms.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <FileText className="mx-auto mb-3 text-muted-foreground" size={28} />
            <p className="font-body text-sm text-muted-foreground">No forms yet — click "Create Form" to make one.</p>
          </div>
        ) : (
          forms.map(form => {
            const formAssignments = assignments.filter(a => a.form_id === form.id);
            return (
              <div key={form.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="font-display text-base font-light truncate">{form.title}</h2>
                      {form.is_template && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-sage/15 text-sage font-medium">Template</span>
                      )}
                    </div>
                    {form.description && <p className="font-body text-xs text-muted-foreground mb-1">{form.description}</p>}
                    <p className="font-body text-[11px] text-muted-foreground">
                      {form.fields.length} field{form.fields.length === 1 ? "" : "s"} · {formAssignments.length} assignment{formAssignments.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setAssignTarget(form)} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Assign">
                      <Users size={15} />
                    </button>
                    <button onClick={() => setEditing(form)} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                      <Edit size={15} />
                    </button>
                    <button onClick={() => deleteForm(form.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {formAssignments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                    {formAssignments.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <span className="font-body flex-1 truncate">{a.event_title ?? "—"}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium ${STATUS_COLORS[a.status]}`}>
                          {STATUS_LABELS[a.status]}
                        </span>
                        {a.status === "submitted" && (
                          <button onClick={() => viewSubmission(form, a)} className="font-body text-xs text-sage hover:underline">View</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* Builder modal */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Edit Form" : "Create Form"}>
          <div className="space-y-4">
            <input
              value={editing.title ?? ""}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Form title"
              className="w-full px-3 py-2 rounded-md border border-input bg-background font-body text-sm"
            />
            <textarea
              value={editing.description ?? ""}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-background font-body text-sm"
            />
            <label className="flex items-center gap-2 font-body text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!editing.is_template}
                onChange={(e) => setEditing({ ...editing, is_template: e.target.checked })}
              />
              Save as reusable template
            </label>
            <FormBuilder
              fields={(editing.fields as FormField[]) ?? []}
              onChange={(fields) => setEditing({ ...editing, fields })}
            />
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 font-body text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={saveForm} className="px-3 py-1.5 rounded-md bg-sage text-white font-body text-sm hover:bg-sage-dark">Save Form</button>
          </div>
        </Modal>
      )}

      {/* Assign modal */}
      {assignTarget && (
        <AssignModal
          form={assignTarget}
          events={events}
          existing={assignments.filter(a => a.form_id === assignTarget.id)}
          onClose={() => setAssignTarget(null)}
          onSaved={() => { setAssignTarget(null); fetchAll(); }}
        />
      )}

      {/* View submission */}
      {viewResponse && (
        <Modal onClose={() => setViewResponse(null)} title={`${viewResponse.form.title} — Response`}>
          <FormFiller
            fields={viewResponse.form.fields}
            responses={viewResponse.assignment.responses ?? {}}
            onChange={() => {}}
            readOnly
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-xl border border-border shadow-elevated w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-display text-base font-light">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function AssignModal({
  form, events, existing, onClose, onSaved,
}: {
  form: FormRow;
  events: EventOption[];
  existing: AssignmentRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(existing.map(a => a.event_id)));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    setSaving(true);
    const existingIds = new Set(existing.map(a => a.event_id));
    const toAdd = [...selected].filter(id => !existingIds.has(id));
    const toRemove = existing.filter(a => !selected.has(a.event_id)).map(a => a.id);

    if (toAdd.length) {
      const { error } = await supabase.from("form_assignments").insert(
        toAdd.map(event_id => ({ form_id: form.id, event_id, status: "not_started" as AssignmentStatus }))
      );
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    if (toRemove.length) {
      const { error } = await supabase.from("form_assignments").delete().in("id", toRemove);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    toast.success("Assignments updated");
    onSaved();
  };

  return (
    <Modal onClose={onClose} title={`Assign "${form.title}"`}>
      <div className="space-y-2 mb-4">
        {events.length === 0 && <p className="font-body text-sm text-muted-foreground">No events available.</p>}
        {events.map(ev => (
          <label key={ev.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border cursor-pointer hover:bg-muted/40">
            <input type="checkbox" checked={selected.has(ev.id)} onChange={() => toggle(ev.id)} className="h-4 w-4" />
            <span className="font-body text-sm">{ev.couple_names}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button onClick={onClose} className="px-3 py-1.5 font-body text-sm text-muted-foreground">Cancel</button>
        <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-md bg-sage text-white font-body text-sm hover:bg-sage-dark disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
