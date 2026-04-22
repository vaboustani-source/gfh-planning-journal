import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Eye, X } from "lucide-react";
import { toast } from "sonner";
import FormFiller from "@/components/forms/FormFiller";
import { FormField, ResponseMap, AssignmentStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/formFields";

interface AssignmentWithForm {
  id: string;
  status: AssignmentStatus;
  submitted_at: string | null;
  form: { id: string; title: string; description: string | null; fields: FormField[] };
  responses: ResponseMap;
}

export default function EventForms({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<AssignmentWithForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<AssignmentWithForm | null>(null);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      const { data: assignments } = await supabase
        .from("form_assignments")
        .select("id, status, submitted_at, forms(id, title, description, fields)")
        .eq("event_id", eventId);

      if (!assignments) { setLoading(false); return; }

      const withResponses = await Promise.all(
        assignments.map(async (a: any) => {
          const { data: r } = await supabase
            .from("form_responses")
            .select("responses")
            .eq("assignment_id", a.id)
            .maybeSingle();
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
          };
        })
      );
      setItems(withResponses);
      setLoading(false);
    })();
  }, [eventId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <FileText className="mx-auto mb-3 text-muted-foreground" size={28} />
        <p className="font-body text-sm text-muted-foreground mb-1">No forms assigned yet.</p>
        <p className="font-body text-xs text-muted-foreground">Assign forms from the Forms page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
          <FileText className="text-muted-foreground shrink-0" size={18} />
          <div className="flex-1 min-w-0">
            <p className="font-display text-base font-light truncate">{item.form.title}</p>
            {item.form.description && <p className="font-body text-xs text-muted-foreground truncate">{item.form.description}</p>}
            {item.submitted_at && (
              <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                Submitted {new Date(item.submitted_at).toLocaleString()}
              </p>
            )}
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium ${STATUS_COLORS[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>
          <button
            onClick={() => setViewing(item)}
            className="p-2 text-muted-foreground hover:text-foreground"
            title="View responses"
          >
            <Eye size={15} />
          </button>
        </div>
      ))}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/40 backdrop-blur-sm" onClick={() => setViewing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-xl border border-border shadow-elevated w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="font-display text-base font-light">{viewing.form.title}</h3>
              <button onClick={() => setViewing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-5">
              {viewing.status === "not_started" ? (
                <p className="font-body text-sm text-muted-foreground italic">Couple has not started this form yet.</p>
              ) : (
                <FormFiller fields={viewing.form.fields} responses={viewing.responses} onChange={() => {}} readOnly />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
