import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import RichTextEditor from "@/components/admin/RichTextEditor";

interface Template {
  id: string;
  name: string;
  subject: string | null;
  body_html: string;
  updated_at: string;
}

export default function SettingsEmailTemplates() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; subject: string; body_html: string }>({ name: "", subject: "", body_html: "" });
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("gmail_reply_templates")
      .select("*")
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    setTemplates((data as Template[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const startNew = () => {
    setEditingId("__new__");
    setDraft({ name: "", subject: "", body_html: "" });
  };

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setDraft({ name: t.name, subject: t.subject ?? "", body_html: t.body_html ?? "" });
  };

  const cancel = () => { setEditingId(null); };

  const save = async () => {
    if (!draft.name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        name: draft.name.trim(),
        subject: draft.subject.trim() || null,
        body_html: draft.body_html,
        updated_at: new Date().toISOString(),
      };
      if (editingId && editingId !== "__new__") {
        const { error } = await (supabase as any).from("gmail_reply_templates").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        const { error } = await (supabase as any).from("gmail_reply_templates").insert(payload);
        if (error) throw error;
      }
      toast.success("Template saved.");
      setEditingId(null);
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await (supabase as any).from("gmail_reply_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted.");
    await reload();
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-3xl font-light text-foreground">Email reply templates</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Shared canned replies the team can insert into Gmail replies from the Emails tab.
          </p>
        </div>
        <button
          onClick={startNew}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sage text-white font-body text-sm hover:bg-sage-dark"
        >
          <Plus size={14} /> New template
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground font-body text-sm">
          <Loader2 size={14} className="animate-spin" /> Loading
        </div>
      ) : (
        <div className="space-y-3">
          {editingId === "__new__" && (
            <Editor draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} title="New template" />
          )}
          {templates.length === 0 && editingId !== "__new__" && (
            <p className="font-body text-sm text-muted-foreground">No templates yet. Create one to get started.</p>
          )}
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card">
              {editingId === t.id ? (
                <Editor draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} saving={saving} title="Edit template" />
              ) : (
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-foreground">{t.name}</p>
                    {t.subject && <p className="font-body text-xs text-muted-foreground mt-0.5">Subject: {t.subject}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(t)} className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/40 font-body text-xs text-foreground">
                      Edit
                    </button>
                    <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg border border-border hover:bg-muted/40 text-muted-foreground" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Editor({
  draft, setDraft, onSave, onCancel, saving, title,
}: {
  draft: { name: string; subject: string; body_html: string };
  setDraft: (d: { name: string; subject: string; body_html: string }) => void;
  onSave: () => void; onCancel: () => void; saving: boolean; title: string;
}) {
  return (
    <div className="p-4 space-y-3 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between">
        <p className="font-body text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>
      <input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="Template name (e.g. Vendor confirmation)"
        className="w-full px-3 py-2 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
      />
      <input
        value={draft.subject}
        onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
        placeholder="Subject (optional)"
        className="w-full px-3 py-2 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
      />
      <RichTextEditor value={draft.body_html} onChange={(html) => setDraft({ ...draft, body_html: html })} placeholder="Template body..." minHeight={160} />
      <div className="flex justify-end">
        <button onClick={onSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sage text-white font-body text-sm hover:bg-sage-dark disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save template
        </button>
      </div>
    </div>
  );
}
