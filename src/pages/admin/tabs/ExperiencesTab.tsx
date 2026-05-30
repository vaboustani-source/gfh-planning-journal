import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MessageCircle, Check, X as XIcon, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryLabel, PricingConfig, PricingType } from "@/lib/experienceCategories";

const db = supabase as any;

interface CatalogItem {
  id: string;
  title: string;
  category: string;
  photo_url: string | null;
  pricing_type: PricingType | null;
  pricing_config: PricingConfig | null;
  available: boolean | null;
}

interface RequestRow {
  id: string;
  event_id: string;
  catalog_item_id: string | null;
  status: "requested" | "under_review" | "approved" | "declined" | "cancelled";
  guest_count: number | null;
  preferred_day: string | null;
  hours: number | null;
  selected_tier: string | null;
  couple_notes: string | null;
  brandon_notes: string | null;
  decline_reason: string | null;
  final_price: number | null;
  final_price_label: string | null;
  created_at: string;
  catalog?: CatalogItem | null;
}

const STATUS_GROUPS: { key: RequestRow["status"]; label: string; tone: string }[] = [
  { key: "requested", label: "New Requests", tone: "bg-[#f5e9c8] text-[#8a6914]" },
  { key: "under_review", label: "Under Review", tone: "bg-sky-100 text-sky-800" },
  { key: "approved", label: "Approved", tone: "bg-sage/15 text-sage-dark" },
  { key: "declined", label: "Declined", tone: "bg-muted text-muted-foreground" },
  { key: "cancelled", label: "Cancelled", tone: "bg-muted text-muted-foreground" },
];

export default function ExperiencesTab({ eventId, onNavigateNext: _ }: { eventId: string; onNavigateNext?: () => void }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => { load(); }, [eventId]);

  const load = async () => {
    const [{ data: reqs }, { data: cat }] = await Promise.all([
      db.from("experience_requests").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
      db.from("experience_catalog").select("*").order("category").order("sort_order"),
    ]);
    const catList = (cat ?? []) as CatalogItem[];
    setCatalog(catList);
    const byId = new Map(catList.map(c => [c.id, c]));
    setRequests((reqs ?? []).map((r: any) => ({ ...r, catalog: byId.get(r.catalog_item_id) ?? null })));
    setLoading(false);
  };

  const grouped = STATUS_GROUPS.map(g => ({ ...g, items: requests.filter(r => r.status === g.key) }));

  if (loading) {
    return <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Curated extras</p>
          <h2 className="font-display text-3xl font-light text-foreground">Experience Requests</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">Everything the couple has asked about.</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90">
          <Plus size={14} /> Add for Couple
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-20 rounded-xl border border-dashed border-border">
          <p className="font-display text-xl italic text-foreground">No experiences requested yet</p>
          <p className="font-body text-sm text-muted-foreground mt-1">When the couple submits a request, it'll appear here.</p>
        </div>
      ) : (
        grouped.filter(g => g.items.length > 0).map(g => (
          <section key={g.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 font-body text-[10px] tracking-wide ${g.tone}`}>{g.label}</span>
              <span className="font-body text-xs text-muted-foreground">{g.items.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {g.items.map(r => (
                <RequestCard key={r.id} request={r} eventId={eventId} onUpdated={load} />
              ))}
            </div>
          </section>
        ))
      )}

      {addOpen && (
        <AddForCoupleModal eventId={eventId} catalog={catalog} onClose={() => setAddOpen(false)} onAdded={load} />
      )}
    </div>
  );
}

function RequestCard({ request, eventId, onUpdated }: { request: RequestRow; eventId: string; onUpdated: () => void }) {
  const [showApprove, setShowApprove] = useState(false);
  const [showDecline, setShowDecline] = useState(false);

  const markReview = async () => {
    await db.from("experience_requests").update({ status: "under_review" }).eq("id", request.id);
    if (confirm("Open Messages to discuss with couple?")) {
      window.location.href = `/admin/events/${eventId}?tab=messages`;
    } else {
      onUpdated();
    }
  };

  return (
    <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
      <div className="flex">
        <div className="w-24 h-24 bg-muted shrink-0">
          {request.catalog?.photo_url ? (
            <img src={request.catalog.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><ImageIcon size={18} className="text-muted-foreground/40" /></div>
          )}
        </div>
        <div className="flex-1 p-3 min-w-0">
          <p className="font-display text-base text-foreground leading-tight">{request.catalog?.title ?? "Experience"}</p>
          <p className="font-body text-[11px] text-muted-foreground">{getCategoryLabel(request.catalog?.category ?? "")}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 font-body text-xs text-muted-foreground">
            {request.preferred_day && <span>{request.preferred_day}</span>}
            {request.guest_count != null && <span>{request.guest_count} guests</span>}
            {request.hours != null && <span>{request.hours}h</span>}
            {request.selected_tier && <span>Tier: {request.selected_tier}</span>}
          </div>
        </div>
      </div>
      {request.couple_notes && (
        <div className="px-4 py-2 border-t border-border bg-cream/30">
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Couple's note</p>
          <p className="font-body text-xs text-foreground whitespace-pre-wrap">{request.couple_notes}</p>
        </div>
      )}
      {request.status === "approved" && (
        <div className="px-4 py-2 border-t border-border bg-sage/8">
          <p className="font-body text-xs text-sage-dark">
            Confirmed · {request.final_price_label || (request.final_price ? `$${Number(request.final_price).toLocaleString()}` : "—")}
          </p>
        </div>
      )}
      {request.status === "declined" && request.decline_reason && (
        <div className="px-4 py-2 border-t border-border">
          <p className="font-body text-xs text-muted-foreground">Reason: {request.decline_reason}</p>
        </div>
      )}
      {(request.status === "requested" || request.status === "under_review") && (
        <div className="px-3 py-2 border-t border-border flex flex-wrap gap-2">
          {request.status === "requested" && (
            <button onClick={markReview} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border font-body text-xs hover:bg-muted/40">
              <MessageCircle size={12} /> Mark Under Review
            </button>
          )}
          <button onClick={() => setShowApprove(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-sage text-primary-foreground font-body text-xs hover:opacity-90">
            <Check size={12} /> Approve
          </button>
          <button onClick={() => setShowDecline(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border font-body text-xs text-muted-foreground hover:text-destructive">
            <XIcon size={12} /> Decline
          </button>
        </div>
      )}

      {showApprove && (
        <ApproveModal request={request} onClose={() => setShowApprove(false)} onDone={onUpdated} />
      )}
      {showDecline && (
        <DeclineModal request={request} onClose={() => setShowDecline(false)} onDone={onUpdated} />
      )}
    </div>
  );
}

function ApproveModal({ request, onClose, onDone }: { request: RequestRow; onClose: () => void; onDone: () => void }) {
  const [price, setPrice] = useState<string>(request.final_price?.toString() ?? "");
  const [label, setLabel] = useState<string>(request.final_price_label ?? "flat fee");
  const [notes, setNotes] = useState<string>(request.brandon_notes ?? "");
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    const { error } = await db.from("experience_requests").update({
      status: "approved",
      final_price: parseFloat(price) || null,
      final_price_label: label,
      brandon_notes: notes || null,
      approved_at: new Date().toISOString(),
    }).eq("id", request.id);
    setSaving(false);
    if (error) { alert(error.message); return; }
    onDone();
    onClose();
  };

  return (
    <ModalShell title="Approve Experience" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Final price</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">$</span>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className={`${inputCls} pl-6`} />
          </div>
        </div>
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Price label</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="flat fee" className={inputCls} />
        </div>
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Brandon's note (internal)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
        </div>
        <p className="font-body text-[11px] text-muted-foreground">Approval auto-creates a Site Fee line item in Financials.</p>
        <div className="flex gap-2 pt-2">
          <button onClick={confirm} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-sage text-primary-foreground font-body text-sm disabled:opacity-50">
            {saving ? "Confirming…" : "Confirm Approval"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border font-body text-sm">Cancel</button>
        </div>
      </div>
    </ModalShell>
  );
}

function DeclineModal({ request, onClose, onDone }: { request: RequestRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const confirm = async () => {
    if (!reason.trim()) { alert("Please give a reason."); return; }
    setSaving(true);
    const { error } = await db.from("experience_requests").update({
      status: "declined", decline_reason: reason,
    }).eq("id", request.id);
    setSaving(false);
    if (error) { alert(error.message); return; }
    onDone(); onClose();
  };
  return (
    <ModalShell title="Decline Experience" onClose={onClose}>
      <div className="space-y-3">
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} placeholder="Reason (shared with couple)" className={`${inputCls} resize-none`} />
        <div className="flex gap-2">
          <button onClick={confirm} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-body text-sm disabled:opacity-50">
            {saving ? "Saving…" : "Decline"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border font-body text-sm">Cancel</button>
        </div>
      </div>
    </ModalShell>
  );
}

function AddForCoupleModal({ eventId, catalog, onClose, onAdded }: {
  eventId: string; catalog: CatalogItem[]; onClose: () => void; onAdded: () => void;
}) {
  const [catalogItemId, setCatalogItemId] = useState<string>("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [price, setPrice] = useState("");
  const [label, setLabel] = useState("flat fee");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!catalogItemId) { alert("Pick an experience."); return; }
    setSaving(true);
    const payload: any = {
      event_id: eventId,
      catalog_item_id: catalogItemId,
      status: autoApprove ? "approved" : "requested",
      brandon_notes: notes || null,
    };
    if (autoApprove) {
      payload.final_price = parseFloat(price) || null;
      payload.final_price_label = label;
      payload.approved_at = new Date().toISOString();
    }
    const { error } = await db.from("experience_requests").insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    onAdded(); onClose();
  };

  return (
    <ModalShell title="Add Experience for Couple" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Experience</label>
          <select value={catalogItemId} onChange={e => setCatalogItemId(e.target.value)} className={inputCls}>
            <option value="">— select —</option>
            {catalog.filter(c => c.available).map(c => (
              <option key={c.id} value={c.id}>{c.title} · {getCategoryLabel(c.category)}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} className="rounded border-border accent-sage" />
          <span className="font-body text-sm">Auto-approve and set final price</span>
        </label>
        {autoApprove && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Final price</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">$</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} className={`${inputCls} pl-6`} />
              </div>
            </div>
            <div>
              <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Label</label>
              <input value={label} onChange={e => setLabel(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}
        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={submit} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm disabled:opacity-50">
            {saving ? "Adding…" : "Add"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border font-body text-sm">Cancel</button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="font-display text-lg font-light">{title}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20";
