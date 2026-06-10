import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, FileText } from "lucide-react";
import { PLACEHOLDER_TOKENS, docTypeLabel } from "@/lib/contractTemplate";

type Template = {
  id: string;
  name: string;
  document_type: string;
  body: string;
  requires_both_partners: boolean;
  requires_countersignature: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const emptyTemplate = (): Template => ({
  id: "",
  name: "",
  document_type: "contract",
  body: "",
  requires_both_partners: false,
  requires_countersignature: false,
  is_active: true,
  created_by: null,
  created_at: "",
  updated_at: "",
});

export default function SettingsContractTemplates() {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("contract_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Template[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-light" style={{ color: "#2C3E2D" }}>
            Contract Templates
          </h1>
          <p className="font-body text-sm mt-2" style={{ color: "#6B6B6B" }}>
            Reusable starting points for the contracts you send to each couple.
          </p>
        </div>
        <button
          onClick={() => setEditing(emptyTemplate())}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 font-body text-sm text-white transition hover:opacity-90"
          style={{ backgroundColor: "#2C3E2D" }}
        >
          <Plus size={15} /> New Template
        </button>
      </div>

      {loading ? (
        <p className="font-body text-sm" style={{ color: "#6B6B6B" }}>Loading...</p>
      ) : items.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF" }}
        >
          <FileText size={28} className="mx-auto mb-3" strokeWidth={1.5} style={{ color: "#6B6B6B" }} />
          <p className="font-display text-lg" style={{ color: "#2C3E2D" }}>No templates yet</p>
          <p className="font-body text-sm mt-1" style={{ color: "#6B6B6B" }}>
            Create your first template to speed up new contracts.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF" }}
        >
          {items.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setEditing(t)}
              className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-[#FAF8F4] transition"
              style={{ borderTop: i === 0 ? "none" : "1px solid #E8E2D9" }}
            >
              <FileText size={18} strokeWidth={1.5} style={{ color: "#C9A84C" }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display text-base truncate" style={{ color: "#2C3E2D" }}>
                    {t.name || "Untitled"}
                  </p>
                  <span
                    className="font-body text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border"
                    style={{ color: "#6B6B6B", borderColor: "#E8E2D9" }}
                  >
                    {docTypeLabel(t.document_type)}
                  </span>
                  <span
                    className="font-body text-[11px] rounded-full px-2 py-0.5 border"
                    style={
                      t.is_active
                        ? { backgroundColor: "#FAF8F4", color: "#2C3E2D", borderColor: "#C9A84C" }
                        : { backgroundColor: "#F4F4F4", color: "#6B6B6B", borderColor: "#E8E2D9" }
                    }
                  >
                    {t.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="font-body text-xs mt-1" style={{ color: "#6B6B6B" }}>
                  Updated {new Date(t.updated_at).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  template, onClose, onSaved,
}: { template: Template; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(template.name);
  const [docType, setDocType] = useState(template.document_type);
  const [body, setBody] = useState(template.body);
  const [both, setBoth] = useState(template.requires_both_partners);
  const [counter, setCounter] = useState(template.requires_countersignature);
  const [active, setActive] = useState(template.is_active);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertToken = (token: string) => {
    const el = textareaRef.current;
    if (!el) { setBody(b => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const save = async () => {
    if (!name.trim() || !body.trim()) {
      toast.error("Name and body are required");
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = {
        name: name.trim(),
        document_type: docType,
        body,
        requires_both_partners: both,
        is_active: active,
        updated_at: new Date().toISOString(),
      };
      let res;
      if (template.id) {
        res = await (supabase as any)
          .from("contract_templates").update(payload).eq("id", template.id);
      } else {
        payload.created_by = user?.id ?? null;
        res = await (supabase as any).from("contract_templates").insert(payload);
      }
      if (res.error) throw res.error;
      toast.success(template.id ? "Template updated" : "Template created");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-stretch justify-center p-4 overflow-y-auto">
      <div
        className="rounded-xl border w-full max-w-3xl my-auto flex flex-col max-h-[95vh]"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E2D9" }}
      >
        <header
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "#E8E2D9" }}
        >
          <div>
            <p className="font-display text-xl" style={{ color: "#2C3E2D" }}>
              {template.id ? "Edit Template" : "New Template"}
            </p>
            <p className="font-body text-xs" style={{ color: "#6B6B6B" }}>
              Templates are starting points. Each contract stays fully editable per event.
            </p>
          </div>
          <button onClick={onClose} style={{ color: "#6B6B6B" }}><X size={18} /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-body text-[11px] uppercase tracking-wider" style={{ color: "#6B6B6B" }}>
                Name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full mt-1 border rounded-md px-3 py-2 font-body text-sm"
                style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF", color: "#1A1A1A" }}
                placeholder="e.g. Standard Wedding Services Agreement"
              />
            </div>
            <div>
              <label className="font-body text-[11px] uppercase tracking-wider" style={{ color: "#6B6B6B" }}>
                Document Type
              </label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="w-full mt-1 border rounded-md px-3 py-2 font-body text-sm"
                style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF", color: "#1A1A1A" }}
              >
                <option value="contract">Contract</option>
                <option value="addendum">Addendum</option>
                <option value="beo">BEO</option>
                <option value="invoice_agreement">Invoice Agreement</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            <label className="inline-flex items-center gap-2 font-body text-sm cursor-pointer" style={{ color: "#1A1A1A" }}>
              <input
                type="checkbox" checked={both} onChange={e => setBoth(e.target.checked)}
                className="rounded"
              />
              Requires both partners to sign
            </label>
            <label className="inline-flex items-center gap-2 font-body text-sm cursor-pointer" style={{ color: "#1A1A1A" }}>
              <input
                type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
                className="rounded"
              />
              Active
            </label>
          </div>

          <div>
            <label className="font-body text-[11px] uppercase tracking-wider" style={{ color: "#6B6B6B" }}>
              Merge Fields
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {PLACEHOLDER_TOKENS.map(token => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertToken(token)}
                  className="font-body text-xs rounded-full border px-2.5 py-1 transition hover:opacity-80"
                  style={{ borderColor: "#C9A84C", color: "#2C3E2D", backgroundColor: "#FAF8F4" }}
                >
                  {token}
                </button>
              ))}
            </div>
            <p className="font-body text-[11px] mt-1.5" style={{ color: "#6B6B6B" }}>
              These fill in automatically from each event when a contract is created.
            </p>
          </div>

          <div>
            <label className="font-body text-[11px] uppercase tracking-wider" style={{ color: "#6B6B6B" }}>
              Body
            </label>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={18}
              className="w-full mt-1 border rounded-md px-3 py-2 font-body text-sm leading-relaxed"
              style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF", color: "#1A1A1A" }}
              placeholder="Write the agreement language here. Use the merge fields above to insert event details."
            />
          </div>
        </div>

        <footer
          className="px-6 py-4 border-t flex items-center justify-end gap-2"
          style={{ borderColor: "#E8E2D9" }}
        >
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border px-4 py-2 font-body text-sm"
            style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF", color: "#1A1A1A" }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="rounded-md px-4 py-2 font-body text-sm text-white hover:opacity-90"
            style={{ backgroundColor: "#2C3E2D" }}
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}
