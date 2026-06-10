import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Plus, Send, Eye, X, Lock, AlertTriangle, ShieldCheck, Ban } from "lucide-react";
import {
  renderContract, sha256Hex, statusLabel, statusPillClass, docTypeLabel,
  PLACEHOLDER_TOKENS, type ContractContext,
} from "@/lib/contractTemplate";

type Contract = {
  id: string;
  event_id: string;
  title: string;
  document_type: string;
  content: string;
  rendered_content: string | null;
  content_hash: string | null;
  status: string;
  requires_both_partners: boolean;
  requires_countersignature: boolean;
  sent_at: string | null;
  created_at: string;
};

type Signature = {
  id: string;
  contract_id: string;
  signer_role: string;
  signer_name: string;
  signer_email: string;
  signer_user_id: string | null;
  typed_name: string;
  agreed_to_terms: boolean;
  ip_address: string | null;
  user_agent: string | null;
  content_version_hash: string;
  signed_at: string;
};

interface Props {
  eventId: string;
}

type Template = {
  id: string;
  name: string;
  document_type: string;
  body: string;
  requires_both_partners: boolean;
  requires_countersignature: boolean;
};

export default function ContractsManager({ eventId }: Props) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [sigCounts, setSigCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Contract | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewer, setViewer] = useState<Contract | null>(null);
  const [ctx, setCtx] = useState<ContractContext>({});
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cs } = await (supabase as any)
      .from("contracts").select("*").eq("event_id", eventId)
      .order("created_at", { ascending: false });
    const list = (cs ?? []) as Contract[];
    setContracts(list);

    if (list.length) {
      const { data: sigs } = await (supabase as any)
        .from("contract_signatures").select("contract_id")
        .in("contract_id", list.map(c => c.id));
      const counts: Record<string, number> = {};
      for (const s of (sigs ?? []) as { contract_id: string }[]) {
        counts[s.contract_id] = (counts[s.contract_id] ?? 0) + 1;
      }
      setSigCounts(counts);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void load();
    // Build context from event data
    (async () => {
      const { data: ev } = await supabase
        .from("events")
        .select("title, partner1_name, partner2_name, wedding_date, ceremony_location, estimated_guest_count, package_tier")
        .eq("id", eventId).maybeSingle();
      const { data: fin } = await (supabase as any)
        .from("financials").select("site_fee_total, catering_estimate").eq("event_id", eventId).maybeSingle();
      if (ev) {
        const couple = [ev.partner1_name, ev.partner2_name].filter(Boolean).join(" & ") || ev.title;
        const total = (Number(fin?.site_fee_total) || 0) + (Number(fin?.catering_estimate) || 0);
        setCtx({
          couple_names: couple,
          wedding_date: ev.wedding_date,
          venue_name: "Gilbertsville Farmhouse",
          guest_count: ev.estimated_guest_count,
          package_tier: ev.package_tier,
          total_amount: total || null,
        });
      }
    })();
  }, [eventId, load]);

  const openNew = async () => {
    const { data } = await (supabase as any)
      .from("contract_templates")
      .select("id, name, document_type, body, requires_both_partners, requires_countersignature")
      .eq("is_active", true)
      .order("name", { ascending: true });
    setTemplates((data ?? []) as Template[]);
    setTemplatePickerOpen(true);
  };

  const startFromBlank = () => {
    setTemplatePickerOpen(false);
    setEditor({
      id: "", event_id: eventId, title: "", document_type: "contract",
      content: "", rendered_content: null, content_hash: null, status: "draft",
      requires_both_partners: false, requires_countersignature: false, sent_at: null, created_at: "",
    });
    setEditorOpen(true);
  };

  const startFromTemplate = (t: Template) => {
    setTemplatePickerOpen(false);
    setEditor({
      id: "", event_id: eventId, title: t.name, document_type: t.document_type,
      content: t.body, rendered_content: null, content_hash: null, status: "draft",
      requires_both_partners: t.requires_both_partners,
      requires_countersignature: t.requires_countersignature,
      sent_at: null, created_at: "",
    });
    setEditorOpen(true);
  };


  const openEdit = (c: Contract) => {
    if (c.status === "fully_signed") {
      toast.error("This contract is signed and locked. Create an addendum instead.");
      return;
    }
    setEditor(c);
    setEditorOpen(true);
  };

  const voidContract = async (c: Contract) => {
    if (!confirm(`Void "${c.title}"? Signatures remain on file but the contract becomes inactive.`)) return;
    const { error } = await (supabase as any).from("contracts").update({ status: "voided" }).eq("id", c.id);
    if (error) return toast.error(error.message);
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any).from("contract_audit_log").insert({
      contract_id: c.id, action: "voided", actor_user_id: user?.id, actor_label: user?.email ?? null,
    });
    toast.success("Contract voided");
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-foreground">Contracts</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Send legal agreements for signature. Each signature is permanently recorded.
          </p>
        </div>
        <button onClick={openNew}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 font-body text-sm hover:opacity-90 transition">
          <Plus size={15} /> New Contract
        </button>
      </div>

      {loading ? (
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      ) : contracts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <FileText size={28} className="mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
          <p className="font-display text-lg text-foreground">No contracts yet</p>
          <p className="font-body text-sm text-muted-foreground mt-1">Start a new agreement to send to this couple.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map(c => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
              <FileText size={20} className="text-sage shrink-0" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display text-base text-foreground truncate">{c.title || "Untitled"}</p>
                  <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    {docTypeLabel(c.document_type)}
                  </span>
                  <span className={`font-body text-[11px] rounded-full px-2 py-0.5 border ${statusPillClass(c.status)}`}>
                    {statusLabel(c.status)}
                  </span>
                  {c.status === "fully_signed" && <Lock size={12} className="text-sage" />}
                </div>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  {sigCounts[c.id] ?? 0} signature{(sigCounts[c.id] ?? 0) === 1 ? "" : "s"}
                  {c.sent_at && ` · Sent ${new Date(c.sent_at).toLocaleDateString()}`}
                  {` · Created ${new Date(c.created_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewer(c)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-body text-xs hover:border-primary/40">
                  <Eye size={13} /> View
                </button>
                {c.status !== "fully_signed" && c.status !== "voided" && (
                  <button onClick={() => openEdit(c)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 font-body text-xs hover:border-primary/40">
                    Edit
                  </button>
                )}
                {c.status !== "voided" && c.status !== "draft" && (
                  <button onClick={() => voidContract(c)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-background px-3 py-1.5 font-body text-xs text-red-700 hover:bg-red-50">
                    <Ban size={12} /> Void
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOpen && editor && (
        <ContractEditor
          contract={editor}
          ctx={ctx}
          onClose={() => { setEditorOpen(false); setEditor(null); }}
          onSaved={() => { setEditorOpen(false); setEditor(null); void load(); }}
        />
      )}

      {viewer && (
        <ContractViewer
          contract={viewer}
          ctx={ctx}
          onClose={() => setViewer(null)}
        />
      )}

      {templatePickerOpen && (
        <TemplatePicker
          templates={templates}
          onClose={() => setTemplatePickerOpen(false)}
          onBlank={startFromBlank}
          onPick={startFromTemplate}
        />
      )}
    </div>
  );
}

/* ============== Template Picker ============== */
function TemplatePicker({ templates, onClose, onBlank, onPick }: {
  templates: Template[];
  onClose: () => void;
  onBlank: () => void;
  onPick: (t: Template) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-stretch justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-xl border border-border w-full max-w-xl my-auto flex flex-col max-h-[95vh]">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="font-display text-xl text-foreground">Start a New Contract</p>
            <p className="font-body text-xs text-muted-foreground">
              Choose a template or start from a blank document. You can edit everything before sending.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2">
          <button
            onClick={onBlank}
            className="w-full text-left rounded-lg border border-border bg-background hover:border-primary/40 px-4 py-3 transition"
          >
            <p className="font-display text-base text-foreground">Blank</p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">Start from an empty document.</p>
          </button>
          {templates.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground px-1 pt-2">
              No active templates yet. Add some in Settings, GFH Libraries, Contract Templates.
            </p>
          ) : (
            templates.map(t => (
              <button
                key={t.id}
                onClick={() => onPick(t)}
                className="w-full text-left rounded-lg border border-border bg-background hover:border-primary/40 px-4 py-3 transition"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display text-base text-foreground">{t.name}</p>
                  <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    {docTypeLabel(t.document_type)}
                  </span>
                  {t.requires_both_partners && (
                    <span className="font-body text-[10px] uppercase tracking-wider text-sage-dark border border-sage/30 bg-sage/10 rounded px-1.5 py-0.5">
                      Both partners
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        <footer className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="rounded-md border border-border bg-background px-4 py-2 font-body text-sm">Cancel</button>
        </footer>
      </div>
    </div>
  );
}

/* ============== Editor ============== */
function ContractEditor({ contract, ctx, onClose, onSaved }: {
  contract: Contract; ctx: ContractContext;
  onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(contract.title);
  const [docType, setDocType] = useState(contract.document_type);
  const [content, setContent] = useState(contract.content);
  const [both, setBoth] = useState(contract.requires_both_partners);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const save = async (send: boolean) => {
    if (!title.trim() || !content.trim()) return toast.error("Title and content are required");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = {
        event_id: contract.event_id,
        title: title.trim(),
        document_type: docType,
        content,
        requires_both_partners: both,
      };
      if (!contract.id) payload.created_by = user?.id;
      if (send) {
        const frozen = renderContract(content, ctx);
        payload.status = "sent";
        payload.sent_at = new Date().toISOString();
        payload.rendered_content = frozen;
        payload.content_hash = await sha256Hex(frozen);
      }
      let res;
      if (contract.id) {
        res = await (supabase as any).from("contracts").update(payload).eq("id", contract.id).select().maybeSingle();
      } else {
        res = await (supabase as any).from("contracts").insert(payload).select().maybeSingle();
      }
      if (res.error) throw res.error;
      const savedId = res.data?.id ?? contract.id;
      if (savedId) {
        const auditRows: Array<Record<string, unknown>> = [];
        if (!contract.id) {
          auditRows.push({
            contract_id: savedId, action: "created",
            actor_user_id: user?.id, actor_label: user?.email ?? null,
          });
        }
        if (send) {
          auditRows.push({
            contract_id: savedId, action: "sent",
            actor_user_id: user?.id, actor_label: user?.email ?? null,
          });
        }
        if (auditRows.length) {
          await (supabase as any).from("contract_audit_log").insert(auditRows);
        }
      }
      toast.success(send ? "Contract sent to couple" : "Draft saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-stretch justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-xl border border-border w-full max-w-4xl my-auto flex flex-col max-h-[95vh]">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="font-display text-xl text-foreground">{contract.id ? "Edit Contract" : "New Contract"}</p>
            <p className="font-body text-xs text-muted-foreground">Drafts can be edited. Once sent, the content hash locks the signed version.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-body text-[11px] uppercase tracking-wider text-muted-foreground">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full mt-1 border border-border rounded-md px-3 py-2 font-body text-sm bg-background"
                placeholder="e.g. Wedding Services Agreement" />
            </div>
            <div>
              <label className="font-body text-[11px] uppercase tracking-wider text-muted-foreground">Document Type</label>
              <select value={docType} onChange={e => setDocType(e.target.value)}
                className="w-full mt-1 border border-border rounded-md px-3 py-2 font-body text-sm bg-background">
                <option value="contract">Contract</option>
                <option value="addendum">Addendum</option>
                <option value="beo">BEO</option>
                <option value="invoice_agreement">Invoice Agreement</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 font-body text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={both} onChange={e => setBoth(e.target.checked)} className="rounded border-border" />
              Requires both partners to sign
            </label>
            <button type="button" onClick={() => setShowPreview(p => !p)}
              className="font-body text-xs text-sage hover:underline">
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          </div>

          <div>
            <label className="font-body text-[11px] uppercase tracking-wider text-muted-foreground">Content</label>
            <p className="font-body text-[11px] text-muted-foreground mt-0.5 mb-1">
              Placeholders: {PLACEHOLDER_TOKENS.map(t => <code key={t} className="bg-muted px-1 rounded mx-0.5">{t}</code>)}
            </p>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={16}
              className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background leading-relaxed"
              placeholder="Write the full agreement here. Markdown is supported. Use {couple_names}, {wedding_date}, {total_amount} to auto-fill from event data." />
          </div>

          {showPreview && (
            <div className="rounded-lg border border-border bg-background p-5">
              <p className="font-body text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Preview (with substituted values)</p>
              <div className="font-body text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {renderContract(content, ctx) || <span className="text-muted-foreground italic">Empty</span>}
              </div>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={busy}
            className="rounded-md border border-border bg-background px-4 py-2 font-body text-sm">Cancel</button>
          <button onClick={() => save(false)} disabled={busy}
            className="rounded-md border border-border bg-background px-4 py-2 font-body text-sm hover:border-primary/40">
            Save as Draft
          </button>
          <button onClick={() => save(true)} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 font-body text-sm hover:opacity-90">
            <Send size={14} /> Send to Couple
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ============== Viewer / Audit Trail ============== */
function ContractViewer({ contract, ctx, onClose }: {
  contract: Contract; ctx: ContractContext; onClose: () => void;
}) {
  const [sigs, setSigs] = useState<Signature[]>([]);
  const [currentHash, setCurrentHash] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("contract_signatures").select("*").eq("contract_id", contract.id)
        .order("signed_at", { ascending: true });
      setSigs((data ?? []) as Signature[]);
      const frozen = contract.rendered_content ?? contract.content;
      setCurrentHash(await sha256Hex(frozen));
    })();
  }, [contract.id, contract.content, contract.rendered_content]);

  // If the contract has frozen rendered_content (sent or later), show that verbatim.
  // Drafts fall back to live token substitution for preview only.
  const rendered = contract.rendered_content ?? renderContract(contract.content, ctx);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-stretch justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-xl border border-border w-full max-w-4xl my-auto flex flex-col max-h-[95vh]">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="font-display text-xl text-foreground">{contract.title}</p>
            <p className="font-body text-xs text-muted-foreground">
              {docTypeLabel(contract.document_type)} · {statusLabel(contract.status)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <section>
            <p className="font-display text-base text-foreground mb-2">Agreement</p>
            <div className="rounded-lg border border-border bg-background p-5 font-body text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {rendered}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-sage" />
              <p className="font-display text-base text-foreground">Certificate of Signature</p>
            </div>
            {sigs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-5 text-center">
                <p className="font-body text-sm text-muted-foreground">No signatures recorded yet.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-background divide-y divide-border">
                {sigs.map((s, i) => {
                  const match = currentHash === s.content_version_hash;
                  return (
                    <div key={s.id} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 font-body text-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Signer</p>
                        <p className="text-foreground">{s.signer_name}</p>
                        <p className="text-muted-foreground text-xs">{s.signer_email}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Typed Name</p>
                        <p className="text-foreground italic" style={{ fontFamily: "Cormorant Garamond, serif" }}>{s.typed_name}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Signed</p>
                        <p className="text-foreground">{new Date(s.signed_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">IP Address</p>
                        <p className="text-foreground">{s.ip_address || "—"}</p>
                      </div>
                      <div className="md:col-span-2 flex items-center gap-2 pt-1">
                        {match ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-sage-dark">
                            <ShieldCheck size={13} /> Signed the current version of this document
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-amber-700">
                            <AlertTriangle size={13} /> Content has changed since this signature was recorded
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground truncate" title={s.content_version_hash}>
                          hash: {s.content_version_hash.slice(0, 16)}…
                        </span>
                      </div>
                      <p className="md:col-span-2 text-[11px] text-muted-foreground border-t border-border pt-2">
                        Audit #{i + 1} · Agreed to terms: {s.agreed_to_terms ? "Yes" : "No"} · UA: {(s.user_agent || "").slice(0, 80)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
