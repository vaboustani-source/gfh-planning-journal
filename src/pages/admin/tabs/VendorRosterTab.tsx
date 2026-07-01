import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Printer, Beaker, Send, X, CheckCircle2 } from "lucide-react";
import { FRIENDLY_CATEGORY } from "@/components/vendor/VendorCard";

type Vendor = {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  category: string;
  checkin_sent: boolean | null;
  checkin_sent_at: string | null;
  checkin_replied_at?: string | null;
  checkin_parsed_at?: string | null;
};

type Response = {
  id: string;
  vendor_id: string | null;
  event_id: string;
  gmail_message_id: string | null;
  raw_text: string | null;
  headcount: number | null;
  attendee_names: string[] | null;
  at_dinner: boolean | null;
  dietary_allergens: string | null;
  setup_needs: string | null;
  arrival: string | null;
  departure: string | null;
  parse_confidence: number | null;
  needs_review: boolean;
  status: string;
  parsed_at: string | null;
  confirmed_at: string | null;
};

type Status = "Not sent" | "Sent" | "Replied/Parsed" | "Confirmed";

function statusOf(v: Vendor, r?: Response): Status {
  if (r && r.status === "confirmed") return "Confirmed";
  if (r) return "Replied/Parsed";
  if (v.checkin_sent) return "Sent";
  return "Not sent";
}

function statusPill(s: Status): string {
  switch (s) {
    case "Confirmed": return "bg-forest/10 text-forest border-forest/30";
    case "Replied/Parsed": return "bg-gold/10 text-gold-dark border-gold/30";
    case "Sent": return "bg-cream text-forest/70 border-forest/20";
    default: return "bg-background text-muted-foreground border-border";
  }
}

const gold = "text-gold-dark";

export default function VendorRosterTab({ eventId }: { eventId: string }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    const [{ data: vs }, { data: rs }] = await Promise.all([
      supabase.from("vendors").select("id, business_name, contact_name, email, category, checkin_sent, checkin_sent_at, checkin_replied_at, checkin_parsed_at").eq("event_id", eventId),
      supabase.from("vendor_checkin_responses").select("*").eq("event_id", eventId).order("parsed_at", { ascending: false }),
    ]);
    setVendors((vs || []) as Vendor[]);
    setResponses((rs || []) as Response[]);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [eventId]);

  // Latest response per vendor.
  const responseByVendor = useMemo(() => {
    const m = new Map<string, Response>();
    for (const r of responses) {
      if (!r.vendor_id) continue;
      if (!m.has(r.vendor_id)) m.set(r.vendor_id, r);
    }
    return m;
  }, [responses]);

  const rows = useMemo(() => {
    return vendors
      .filter((v) => v.business_name)
      .map((v) => ({ vendor: v, response: responseByVendor.get(v.id) }))
      .sort((a, b) => (a.vendor.business_name || "").localeCompare(b.vendor.business_name || ""));
  }, [vendors, responseByVendor]);

  const anySent = vendors.some((v) => v.checkin_sent);

  async function sendReminder(v: Vendor) {
    if (!v.email) { toast.error("No email on file"); return; }
    setReminding(v.id);
    try {
      const { error } = await supabase.functions.invoke("send-vendor-checkin", { body: { vendor_id: v.id } });
      if (error) throw error;
      toast.success("Reminder sent");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send reminder");
    } finally {
      setReminding(null);
    }
  }

  const openRow = openId ? rows.find((r) => r.vendor.id === openId) : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-forest">Weekend Vendor Roster</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">
            One line per vendor for the weekend. Confirm answers before the day so nothing rides on an unread email.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTestOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border font-body text-sm text-forest hover:bg-cream"
          >
            <Beaker className="w-4 h-4" /> Test with sample reply
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-forest text-cream font-body text-sm hover:bg-forest/90"
          >
            <Printer className="w-4 h-4" /> Print roster
          </button>
        </div>
      </header>

      {loading ? (
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-cream/40 p-10 text-center">
          <p className="font-heading text-xl text-forest">No vendors yet</p>
          <p className="font-body text-sm text-muted-foreground mt-2">Add vendors on the Vendors tab first, then send check-ins.</p>
        </div>
      ) : !anySent ? (
        <div className="rounded-lg border border-border bg-cream/40 p-10 text-center">
          <p className="font-heading text-xl text-forest">Nothing sent yet</p>
          <p className="font-body text-sm text-muted-foreground mt-2">Head to the Vendors tab and send the weekend check-in. Replies will collect here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="min-w-full font-body text-sm">
            <thead className="bg-cream/60 text-forest">
              <tr className="text-left">
                <th className="px-4 py-3 font-heading font-normal">Vendor</th>
                <th className="px-4 py-3 font-heading font-normal">Role</th>
                <th className="px-4 py-3 font-heading font-normal">Status</th>
                <th className="px-4 py-3 font-heading font-normal">Head</th>
                <th className="px-4 py-3 font-heading font-normal">Names</th>
                <th className="px-4 py-3 font-heading font-normal">Dinner</th>
                <th className="px-4 py-3 font-heading font-normal">Dietary / Allergens</th>
                <th className="px-4 py-3 font-heading font-normal">Setup</th>
                <th className="px-4 py-3 font-heading font-normal">Arrival</th>
                <th className="px-4 py-3 font-heading font-normal">Departure</th>
                <th className="px-4 py-3 font-heading font-normal print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ vendor, response }) => {
                const s = statusOf(vendor, response);
                return (
                  <tr key={vendor.id} className="border-t border-border align-top hover:bg-cream/30">
                    <td className="px-4 py-3">
                      <div className="text-forest">{vendor.business_name}</div>
                      {vendor.contact_name && (
                        <div className="text-xs text-muted-foreground">{vendor.contact_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {FRIENDLY_CATEGORY[vendor.category] || vendor.category}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full border text-xs ${statusPill(s)}`}>{s}</span>
                      {response?.needs_review && (
                        <span className={`inline-flex items-center gap-1 ml-2 text-xs ${gold}`} title="Needs review">
                          <AlertTriangle className="w-3 h-3" /> review
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{response?.headcount ?? "—"}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={(response?.attendee_names || []).join(", ")}>
                      {(response?.attendee_names || []).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">{response?.at_dinner == null ? "—" : response.at_dinner ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 max-w-[220px]">{response?.dietary_allergens || "—"}</td>
                    <td className="px-4 py-3 max-w-[200px]">{response?.setup_needs || "—"}</td>
                    <td className="px-4 py-3">{response?.arrival || "—"}</td>
                    <td className="px-4 py-3">{response?.departure || "—"}</td>
                    <td className="px-4 py-3 print:hidden">
                      <div className="flex flex-col gap-1 items-end">
                        {response && (
                          <button onClick={() => setOpenId(vendor.id)}
                            className="text-xs text-forest underline underline-offset-2 hover:text-forest/70">
                            {response.status === "confirmed" ? "Review" : "Open / Confirm"}
                          </button>
                        )}
                        {s === "Sent" && (
                          <button
                            disabled={reminding === vendor.id}
                            onClick={() => sendReminder(vendor)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-forest disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" /> {reminding === vendor.id ? "Sending…" : "Send reminder"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openRow && openRow.response && (
        <ConfirmModal
          vendor={openRow.vendor}
          response={openRow.response}
          onClose={() => setOpenId(null)}
          onSaved={reload}
        />
      )}

      {testOpen && (
        <TestParseModal
          eventId={eventId}
          vendors={vendors}
          onClose={() => setTestOpen(false)}
          onDone={async () => { setTestOpen(false); await reload(); }}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  vendor, response, onClose, onSaved,
}: {
  vendor: Vendor;
  response: Response;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Response>(response);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function saveField(patch: Partial<Response>) {
    setSavingField(Object.keys(patch)[0] || null);
    const merged = { ...draft, ...patch };
    setDraft(merged);
    const { error } = await supabase.from("vendor_checkin_responses").update(patch as any).eq("id", response.id);
    setSavingField(null);
    if (error) toast.error(error.message);
  }

  async function confirmRow() {
    setConfirming(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("vendor_checkin_responses").update({
      status: "confirmed",
      needs_review: false,
      confirmed_by: u.user?.id,
      confirmed_at: new Date().toISOString(),
    } as any).eq("id", response.id);
    if (!error) {
      try {
        await supabase.from("change_history").insert({
          table_name: "vendor_checkin_responses",
          record_id: response.id,
          action: "checkin_confirmed",
          changed_by: u.user?.id,
        } as any);
      } catch {}
      toast.success("Confirmed");
      await onSaved();
      onClose();
    } else {
      toast.error(error.message);
    }
    setConfirming(false);
  }

  const Field = ({ label, k, area = false }: { label: string; k: keyof Response; area?: boolean }) => (
    <label className="block">
      <div className="font-body text-xs text-muted-foreground mb-1">{label}{savingField === k && " · saving…"}</div>
      {area ? (
        <textarea
          value={(draft[k] as string) || ""}
          onChange={(e) => setDraft({ ...draft, [k]: e.target.value } as Response)}
          onBlur={(e) => saveField({ [k]: e.target.value } as any)}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm"
        />
      ) : (
        <input
          value={(draft[k] as any) ?? ""}
          onChange={(e) => setDraft({ ...draft, [k]: e.target.value } as Response)}
          onBlur={(e) => saveField({ [k]: e.target.value } as any)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm"
        />
      )}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-heading text-2xl text-forest">{vendor.business_name}</h3>
            <p className="font-body text-xs text-muted-foreground">
              {FRIENDLY_CATEGORY[vendor.category] || vendor.category} · parsed {response.parsed_at ? new Date(response.parsed_at).toLocaleString() : ""}
              {response.parse_confidence != null && <> · confidence {Math.round((response.parse_confidence || 0) * 100)}%</>}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-6">
          <div>
            <div className="font-body text-xs text-muted-foreground mb-2">Original reply</div>
            <div className="rounded-md border border-border bg-cream/40 p-4 font-body text-sm whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
              {response.raw_text || "(empty)"}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className="font-body text-xs text-muted-foreground mb-1">Headcount</div>
                <input
                  type="number"
                  value={draft.headcount ?? ""}
                  onChange={(e) => setDraft({ ...draft, headcount: e.target.value ? Number(e.target.value) : null })}
                  onBlur={(e) => saveField({ headcount: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm"
                />
              </label>
              <label className="block">
                <div className="font-body text-xs text-muted-foreground mb-1">At dinner?</div>
                <select
                  value={draft.at_dinner == null ? "" : draft.at_dinner ? "yes" : "no"}
                  onChange={(e) => {
                    const val = e.target.value === "" ? null : e.target.value === "yes";
                    setDraft({ ...draft, at_dinner: val });
                    saveField({ at_dinner: val });
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm"
                >
                  <option value="">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>

            <label className="block">
              <div className="font-body text-xs text-muted-foreground mb-1">Attendee names (comma separated)</div>
              <input
                value={(draft.attendee_names || []).join(", ")}
                onChange={(e) => setDraft({ ...draft, attendee_names: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                onBlur={(e) => saveField({ attendee_names: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm"
              />
            </label>

            <div className="rounded-md border border-gold/40 bg-gold/5 p-3">
              <div className="font-body text-xs text-gold-dark flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Dietary and allergen info must be human-confirmed before it is trusted.
              </div>
              <Field label="Dietary / Allergens" k="dietary_allergens" area />
            </div>

            <Field label="Setup needs" k="setup_needs" area />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Arrival" k="arrival" />
              <Field label="Departure" k="departure" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-cream/40">
          <div className="font-body text-xs text-muted-foreground">
            {response.status === "confirmed"
              ? `Confirmed ${response.confirmed_at ? new Date(response.confirmed_at).toLocaleString() : ""}`
              : "Edits save automatically. Click Confirm when the row is trustworthy."}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-md border border-border font-body text-sm">Close</button>
            <button
              onClick={confirmRow}
              disabled={confirming || response.status === "confirmed"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-forest text-cream font-body text-sm hover:bg-forest/90 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {response.status === "confirmed" ? "Confirmed" : confirming ? "Confirming…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestParseModal({
  eventId, vendors, onClose, onDone,
}: {
  eventId: string;
  vendors: Vendor[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [vendorId, setVendorId] = useState<string>(vendors[0]?.id || "");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!vendorId || !raw.trim()) { toast.error("Pick a vendor and paste reply text"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("parse-vendor-checkin", {
        body: { raw_text: raw, event_id: eventId, vendor_id: vendorId },
      });
      if (error) throw error;
      toast.success("Parsed. Row added to the roster.");
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-heading text-2xl text-forest">Test with sample reply</h3>
            <p className="font-body text-xs text-muted-foreground">Staff-only test tool. Runs the AI parser against pasted text so we can verify extraction before an inbox is connected.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block">
            <div className="font-body text-xs text-muted-foreground mb-1">Vendor</div>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm">
              {vendors.filter((v) => v.business_name).map((v) => (
                <option key={v.id} value={v.id}>{v.business_name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="font-body text-xs text-muted-foreground mb-1">Sample reply text</div>
            <textarea rows={10} value={raw} onChange={(e) => setRaw(e.target.value)}
              placeholder="Paste the full body of a vendor reply here..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm" />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-cream/40">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-border font-body text-sm">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 rounded-md bg-forest text-cream font-body text-sm hover:bg-forest/90 disabled:opacity-50">
            {busy ? "Parsing…" : "Parse"}
          </button>
        </div>
      </div>
    </div>
  );
}
