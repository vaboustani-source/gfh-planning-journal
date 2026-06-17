import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, AlertCircle } from "lucide-react";
import MenuSelectionsDisplay from "@/components/menu/MenuSelectionsDisplay";

type Status = "not_started" | "submitted" | "under_review" | "approved" | "declined";

interface Approval {
  id: string | null;
  status: Status;
  final_price: number | null;
  final_price_label: string | null;
  admin_notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  not_started: "Not started",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  declined: "Declined",
};

const STATUS_TONE: Record<Status, string> = {
  not_started: "bg-muted text-muted-foreground border-border",
  submitted: "bg-sage/10 text-sage border-sage/30",
  under_review: "bg-amber-50 text-amber-800 border-amber-300",
  approved: "bg-primary/10 text-primary border-primary/30",
  declined: "bg-red-50 text-red-800 border-red-300",
};

function emptyApproval(): Approval {
  return {
    id: null,
    status: "not_started",
    final_price: null,
    final_price_label: null,
    admin_notes: null,
    submitted_at: null,
    approved_at: null,
  };
}

export default function MenuSelectionsSubTab({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approval, setApproval] = useState<Approval>(emptyApproval());
  const [priceInput, setPriceInput] = useState("");
  const [priceLabelInput, setPriceLabelInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("menu_approvals")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const a: Approval = {
          id: data.id,
          status: data.status as Status,
          final_price: data.final_price as number | null,
          final_price_label: data.final_price_label,
          admin_notes: data.admin_notes,
          submitted_at: data.submitted_at,
          approved_at: data.approved_at,
        };
        setApproval(a);
        setPriceInput(a.final_price != null ? String(a.final_price) : "");
        setPriceLabelInput(a.final_price_label ?? "");
        setNotesInput(a.admin_notes ?? "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function upsert(patch: Partial<Approval>) {
    setSaving(true);
    setError(null);
    const priceNum = priceInput.trim() === "" ? null : Number(priceInput);
    const payload: any = {
      event_id: eventId,
      status: patch.status ?? approval.status,
      final_price: priceNum,
      final_price_label: priceLabelInput.trim() || null,
      admin_notes: notesInput.trim() || null,
    };
    if (patch.status === "approved") {
      payload.approved_at = new Date().toISOString();
      const { data: userRes } = await supabase.auth.getUser();
      payload.approved_by = userRes?.user?.id ?? null;
    }
    const { data, error: err } = await supabase
      .from("menu_approvals")
      .upsert(payload, { onConflict: "event_id" })
      .select("*")
      .maybeSingle();
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data) {
      setApproval({
        id: data.id,
        status: data.status as Status,
        final_price: data.final_price as number | null,
        final_price_label: data.final_price_label,
        admin_notes: data.admin_notes,
        submitted_at: data.submitted_at,
        approved_at: data.approved_at,
      });
    }
  }

  function handleApprove() {
    const priceNum = priceInput.trim() === "" ? null : Number(priceInput);
    if (priceNum === null || isNaN(priceNum)) {
      setError("Set a final catering price before approving.");
      return;
    }
    upsert({ status: "approved" });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="rounded-xl bg-card border border-border p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-light text-foreground">Menu approval</p>
            <p className="font-body text-xs text-muted-foreground">
              Approving with a final price posts a Catering line to the couple's Financials automatically. Un-approving or clearing the price removes it.
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 font-body text-xs ${STATUS_TONE[approval.status]}`}
          >
            {STATUS_LABEL[approval.status]}
          </span>
        </div>
      </div>

      {/* Selections */}
      <div className="rounded-xl bg-card border border-border p-5 shadow-soft">
        <p className="font-display text-base font-light text-foreground mb-3">Couple's selections</p>
        <MenuSelectionsDisplay eventId={eventId} />
      </div>

      {/* Approval form */}
      <div className="rounded-xl bg-card border border-border p-5 shadow-soft space-y-4">
        <p className="font-display text-base font-light text-foreground">Catering total &amp; decision</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">
              Final catering price
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm mt-1"
            />
          </div>
          <div>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">
              Price label (optional)
            </label>
            <input
              type="text"
              value={priceLabelInput}
              onChange={(e) => setPriceLabelInput(e.target.value)}
              placeholder="$185/guest x 142"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm mt-1"
            />
          </div>
        </div>

        <div>
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">
            Admin notes
          </label>
          <textarea
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            rows={3}
            placeholder="Internal notes for this approval."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm resize-none mt-1"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <AlertCircle size={14} className="text-red-700 mt-0.5 shrink-0" />
            <p className="font-body text-xs text-red-800">{error}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={handleApprove}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Approve
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => upsert({ status: "under_review" })}
            className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 font-body text-sm text-foreground hover:bg-muted/40 transition-colors disabled:opacity-60"
          >
            Mark under review
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => upsert({ status: "declined" })}
            className="inline-flex items-center rounded-lg border border-red-300 bg-background px-4 py-2 font-body text-sm text-red-800 hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
