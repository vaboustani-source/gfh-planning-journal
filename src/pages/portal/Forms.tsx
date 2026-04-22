import { useEffect, useRef, useState } from "react";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Lock, ChevronRight, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import FormFiller from "@/components/forms/FormFiller";
import { FormField, ResponseMap, ResponseValue, AssignmentStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/formFields";

interface AssignmentRow {
  id: string;
  status: AssignmentStatus;
  submitted_at: string | null;
  form: { id: string; title: string; description: string | null; fields: FormField[] };
  responses: ResponseMap;
  responseRowId: string | null;
}

export default function PortalForms() {
  const { eventId } = usePortalData();
  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = async () => {
    if (!eventId) return;
    setLoading(true);
    const { data } = await supabase
      .from("form_assignments")
      .select("id, status, submitted_at, forms(id, title, description, fields)")
      .eq("event_id", eventId);

    if (!data) { setLoading(false); return; }

    const enriched = await Promise.all(data.map(async (a: any) => {
      const { data: r } = await supabase
        .from("form_responses").select("id, responses")
        .eq("assignment_id", a.id).maybeSingle();
      return {
        id: a.id,
        status: (a.status as AssignmentStatus) ?? "not_started",
        submitted_at: a.submitted_at,
        form: {
          id: a.forms?.id,
          title: a.forms?.title ?? "Untitled",
          description: a.forms?.description ?? null,
          fields: (a.forms?.fields as FormField[]) ?? [],
        },
        responses: (r?.responses as ResponseMap) ?? {},
        responseRowId: r?.id ?? null,
      };
    }));
    setItems(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [eventId]);

  const active = items.find(i => i.id === activeId) ?? null;

  const updateResponse = (id: string, fieldId: string, value: ResponseValue) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, responses: { ...it.responses, [fieldId]: value } } : it));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(id), 600);
  };

  const persist = async (id: string) => {
    const it = items.find(i => i.id === id);
    if (!it || it.status === "submitted") return;

    if (it.responseRowId) {
      await supabase.from("form_responses").update({
        responses: it.responses as any,
        updated_at: new Date().toISOString(),
      }).eq("id", it.responseRowId);
    } else {
      const { data } = await supabase.from("form_responses").insert({
        assignment_id: it.id, responses: it.responses as any,
      }).select("id").single();
      if (data) {
        setItems(prev => prev.map(x => x.id === id ? { ...x, responseRowId: data.id } : x));
      }
    }

    if (it.status === "not_started") {
      await supabase.from("form_assignments").update({ status: "in_progress" }).eq("id", id);
      setItems(prev => prev.map(x => x.id === id ? { ...x, status: "in_progress" } : x));
    }
  };

  const submit = async (id: string) => {
    const it = items.find(i => i.id === id);
    if (!it) return;
    const missing = it.form.fields.filter(f => f.required && (it.responses[f.id] === undefined || it.responses[f.id] === null || it.responses[f.id] === ""));
    if (missing.length) {
      toast.error(`Please answer all required fields (${missing.length} missing)`);
      return;
    }
    await persist(id);
    const { error } = await supabase.from("form_assignments").update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Form submitted");
    setItems(prev => prev.map(x => x.id === id ? { ...x, status: "submitted", submitted_at: new Date().toISOString() } : x));
    setActiveId(null);
  };

  if (loading) {
    return <div className="px-4 lg:px-8 py-8 max-w-5xl mx-auto"><div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div></div>;
  }

  if (active) {
    const isSubmitted = active.status === "submitted";
    return (
      <div className="px-4 lg:px-8 py-8 max-w-3xl mx-auto">
        <button onClick={() => { persist(active.id); setActiveId(null); fetchAll(); }} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={15} /> Back to forms
        </button>
        <div className="bg-card rounded-xl border border-border p-6 lg:p-8">
          <div className="flex items-start gap-3 mb-1">
            <h1 className="font-display text-2xl font-light flex-1">{active.form.title}</h1>
            {isSubmitted && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-medium bg-emerald-100 text-emerald-700">
                <Lock size={10} /> Submitted
              </span>
            )}
          </div>
          {active.form.description && <p className="font-body text-sm text-muted-foreground mb-6">{active.form.description}</p>}

          <FormFiller
            fields={active.form.fields}
            responses={active.responses}
            onChange={(fid, v) => updateResponse(active.id, fid, v)}
            readOnly={isSubmitted}
          />

          {!isSubmitted && (
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
              <p className="font-body text-xs text-muted-foreground">Progress saves automatically</p>
              <button
                onClick={() => submit(active.id)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-sage text-white font-body text-sm hover:bg-sage-dark transition-colors"
              >
                <Check size={14} /> Submit Form
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl lg:text-3xl font-light text-foreground">Forms</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Forms from Brandon to fill out for your event.</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto mb-3 text-muted-foreground" size={28} />
          <p className="font-body text-sm text-muted-foreground">No forms have been assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveId(item.id)}
              className="w-full text-left bg-card rounded-lg border border-border p-4 hover:border-sage/40 hover:shadow-sm transition-all flex items-center gap-3"
            >
              <FileText className="text-sage shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <p className="font-display text-base font-light truncate">{item.form.title}</p>
                {item.form.description && <p className="font-body text-xs text-muted-foreground truncate">{item.form.description}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium ${STATUS_COLORS[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
              <ChevronRight className="text-muted-foreground shrink-0" size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
