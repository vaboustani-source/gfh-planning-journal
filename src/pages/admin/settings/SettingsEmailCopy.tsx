import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ArrowLeft, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  subject: string;
  heading: string | null;
  body: string;
  cta_label: string | null;
  variables: string | null;
  updated_at: string;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function substitute(input: string, sample: Record<string, string>) {
  return (input || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, n) => sample[n] ?? `{{${n}}}`);
}

function bodyToHtml(plain: string) {
  return escapeHtml(plain)
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#55615a;margin:0 0 16px;">${p.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
}

function renderPreview(t: { heading: string | null; body: string; cta_label: string | null }, sample: Record<string, string>) {
  const heading = substitute(t.heading ?? "", sample);
  const bodyHtml = bodyToHtml(substitute(t.body ?? "", sample));
  const ctaLabel = substitute(t.cta_label ?? "", sample);
  const cta = ctaLabel
    ? `<div style="text-align:center;margin:16px 0 12px;">
         <a href="#" style="display:inline-block;background:#2C3E2D;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:6px;font-size:14px;letter-spacing:0.06em;">${escapeHtml(ctaLabel)}</a>
       </div>`
    : "";
  const headingHtml = heading
    ? `<h1 style="font-family:Georgia,'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:#2C3E2D;margin:0 0 18px;letter-spacing:0.02em;">${escapeHtml(heading)}</h1>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#FAF8F4;font-family:Georgia,'Times New Roman',serif;color:#2C3E2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF8F4;padding:24px 8px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #E8E2D9;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 40px 14px;text-align:center;border-bottom:1px solid #F0EDE6;">
          <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:0.06em;color:#2C3E2D;font-weight:300;">Gilbertsville Farmhouse</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#C9A84C;letter-spacing:0.18em;margin-top:6px;text-transform:uppercase;">Planning Journal</div>
        </td></tr>
        <tr><td style="padding:28px 40px 20px;">${headingHtml}${bodyHtml}${cta}</td></tr>
        <tr><td style="padding:18px 40px 24px;text-align:center;border-top:1px solid #F0EDE6;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9aa097;letter-spacing:0.08em;">GILBERTSVILLE FARMHOUSE</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function sampleFor(varsCsv: string | null): Record<string, string> {
  const samples: Record<string, string> = {
    greeting: "Hello Jordan,",
    invited_name: "Jordan",
    inviter_name: "Brandon",
    event_title: "the Smith Wedding",
    link: "https://plan.gilbertsvillefarmhouse.com/accept-invite/sample",
    signer_name: "Jordan Smith",
    contract_title: "Venue Agreement",
    signed_date: "June 11, 2026, 2:30 PM",
  };
  return samples;
}

export default function SettingsEmailCopy() {
  const { toast } = useToast();
  const [rows, setRows] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name");
      if (error) console.error(error);
      setRows((data as EmailTemplate[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const editing = useMemo(() => rows.find((r) => r.id === editingId) ?? null, [rows, editingId]);
  useEffect(() => {
    setDraft(editing ? { ...editing } : null);
  }, [editing]);

  const variables = useMemo(() => {
    if (!draft?.variables) return [] as string[];
    return draft.variables.split(",").map((v) => v.trim()).filter(Boolean);
  }, [draft]);

  const previewHtml = useMemo(() => {
    if (!draft) return "";
    return renderPreview(draft, sampleFor(draft.variables));
  }, [draft]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    const { error } = await supabase
      .from("email_templates")
      .update({
        subject: draft.subject,
        heading: draft.heading,
        body: draft.body,
        cta_label: draft.cta_label,
      })
      .eq("id", draft.id);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
    setRows((prev) =>
      prev.map((r) => (r.id === draft.id ? { ...r, ...draft, updated_at: new Date().toISOString() } : r)),
    );
    setEditingId(null);
  }

  if (loading) {
    return (
      <div className="max-w-5xl">
        <p className="font-body" style={{ color: "#6B6B6B" }}>Loading email templates...</p>
      </div>
    );
  }

  if (editingId && draft) {
    return (
      <div className="max-w-5xl">
        <button
          onClick={() => setEditingId(null)}
          className="font-body inline-flex items-center gap-2 mb-4 hover:underline"
          style={{ color: "#6B6B6B", fontSize: "13px" }}
        >
          <ArrowLeft size={14} /> Back to email copy
        </button>

        <h2 className="font-display text-3xl font-light" style={{ color: "#2C3E2D" }}>
          {draft.name}
        </h2>
        <p className="font-body mt-2" style={{ color: "#6B6B6B", fontSize: "14px" }}>
          Edit the wording only. The branded layout, logo, and footer are applied automatically when the email sends.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <div className="space-y-5">
            <Field label="Subject">
              <input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                className="w-full rounded-md border px-3 py-2 font-body text-sm"
                style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF" }}
              />
            </Field>
            <Field label="Heading">
              <input
                value={draft.heading ?? ""}
                onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
                className="w-full rounded-md border px-3 py-2 font-body text-sm"
                style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF" }}
              />
            </Field>
            <Field label="Body">
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={10}
                className="w-full rounded-md border px-3 py-2 font-body text-sm leading-relaxed"
                style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF" }}
              />
              <p className="font-body mt-1" style={{ color: "#9aa097", fontSize: "12px" }}>
                Line breaks are preserved. Use a blank line to start a new paragraph.
              </p>
            </Field>
            <Field label="Button label">
              <input
                value={draft.cta_label ?? ""}
                onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })}
                placeholder="Leave empty to hide the button"
                className="w-full rounded-md border px-3 py-2 font-body text-sm"
                style={{ borderColor: "#E8E2D9", backgroundColor: "#FFFFFF" }}
              />
            </Field>

            {variables.length > 0 && (
              <div>
                <p className="font-body uppercase mb-2" style={{ color: "#6B6B6B", fontSize: "11px", letterSpacing: "2px" }}>
                  Available merge variables
                </p>
                <div className="flex flex-wrap gap-2">
                  {variables.map((v) => (
                    <span
                      key={v}
                      className="font-body inline-flex items-center px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "#FAF8F4", border: "1px solid #E8E2D9", color: "#2C3E2D", fontSize: "12px" }}
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
                <p className="font-body mt-2" style={{ color: "#9aa097", fontSize: "12px" }}>
                  These fill in automatically when the email sends.
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-body text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "#2C3E2D", color: "#FFFFFF" }}
              >
                <Save size={14} /> {saving ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="font-body text-sm hover:underline"
                style={{ color: "#6B6B6B" }}
              >
                Cancel
              </button>
            </div>
          </div>

          <div>
            <p className="font-body uppercase mb-2" style={{ color: "#6B6B6B", fontSize: "11px", letterSpacing: "2px" }}>
              Live preview
            </p>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E8E2D9" }}>
              <div className="px-4 py-2.5" style={{ backgroundColor: "#FAF8F4", borderBottom: "1px solid #E8E2D9" }}>
                <p className="font-body" style={{ fontSize: "12px", color: "#6B6B6B" }}>
                  Subject
                </p>
                <p className="font-body" style={{ fontSize: "14px", color: "#1A1A1A" }}>
                  {substitute(draft.subject, sampleFor(draft.variables))}
                </p>
              </div>
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                style={{ width: "100%", height: "560px", border: "0", backgroundColor: "#FAF8F4" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h2 className="font-display text-3xl font-light" style={{ color: "#2C3E2D" }}>
        Email Copy
      </h2>
      <p className="font-body mt-2" style={{ color: "#6B6B6B", fontSize: "14px" }}>
        Edit the wording of the Hub's automated emails. The branded layout is applied automatically.
      </p>

      <div className="mt-8 rounded-xl overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E2D9" }}>
        {rows.length === 0 && (
          <div className="p-10 text-center">
            <p className="font-body" style={{ color: "#6B6B6B" }}>No email templates yet.</p>
          </div>
        )}
        {rows.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setEditingId(r.id)}
            className="w-full text-left flex items-center justify-between px-5 py-4 hover:bg-[#FAF8F4] transition-colors"
            style={{ borderTop: i === 0 ? "none" : "1px solid #F0EDE6" }}
          >
            <div className="flex items-start gap-3">
              <Mail size={18} className="mt-0.5" style={{ color: "#C9A84C" }} />
              <div>
                <p className="font-display text-lg font-light" style={{ color: "#1A1A1A" }}>{r.name}</p>
                <p className="font-body" style={{ color: "#6B6B6B", fontSize: "12px" }}>
                  Subject: {r.subject}
                </p>
              </div>
            </div>
            <p className="font-body shrink-0 ml-4" style={{ color: "#9aa097", fontSize: "12px" }}>
              Updated {new Date(r.updated_at).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-body block mb-1.5" style={{ color: "#2C3E2D", fontSize: "13px", fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
