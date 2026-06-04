import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Search, Download, FileUp, X, UtensilsCrossed, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import DietaryEntriesEditor from "@/components/dietary/DietaryEntriesEditor";
import { SEVERITY_BADGE } from "@/lib/dietary";

const db = supabase as any;

export interface Guest {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  rsvp_status: "invited" | "confirmed" | "declined" | "maybe";
  side: "partner_1" | "partner_2" | "both" | "other" | null;
  relationship: string | null;
  is_plus_one: boolean | null;
  plus_one_of: string | null;
  lodging_preference: "on_site" | "off_site" | "undecided" | null;
  dietary_restrictions: string[] | null;
  meal_preference: string | null;
  notes: string | null;
  added_by: string | null;
  created_at?: string;
}

const RSVP = ["invited", "confirmed", "declined", "maybe"] as const;
const SIDES = [
  { value: "partner_1", label: "Partner 1" },
  { value: "partner_2", label: "Partner 2" },
  { value: "both", label: "Both" },
  { value: "other", label: "Other" },
];
const RELATIONSHIPS = [
  { value: "immediate_family", label: "Immediate Family" },
  { value: "extended_family", label: "Extended Family" },
  { value: "wedding_party", label: "Wedding Party" },
  { value: "friend", label: "Friend" },
  { value: "coworker", label: "Coworker" },
  { value: "other", label: "Other" },
];
const LODGING = [
  { value: "on_site", label: "On-site" },
  { value: "off_site", label: "Off-site" },
  { value: "undecided", label: "Undecided" },
];
const DIET = ["Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy", "Halal", "Kosher", "Other"];

type Filter = "all" | "confirmed" | "declined" | "invited" | "on_site" | "off_site";

interface Props {
  eventId: string;
  isAdmin?: boolean;
  onCountChange?: (count: number) => void;
}

const emptyGuest = (eventId: string, isAdmin: boolean): Partial<Guest> => ({
  event_id: eventId,
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  rsvp_status: "invited",
  side: null,
  relationship: null,
  is_plus_one: false,
  plus_one_of: null,
  lodging_preference: "undecided",
  dietary_restrictions: [],
  meal_preference: "",
  notes: "",
  added_by: isAdmin ? "admin" : "couple",
});

export default function GuestList({ eventId, isAdmin = false, onCountChange }: Props) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Guest> | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [dietaryByGuest, setDietaryByGuest] = useState<Record<string, { count: number; topSeverity: string | null; hasProximity: boolean }>>({});

  useEffect(() => { if (eventId) load(); }, [eventId]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.from("guests").select("*").eq("event_id", eventId).order("created_at");
    if (error) toast.error("Could not load guests");
    const list = (data ?? []) as Guest[];
    setGuests(list);
    onCountChange?.(list.length);

    // Aggregate structured dietary entries
    const { data: entries } = await db
      .from("guest_dietary_entries")
      .select("guest_id,severity,restriction_type")
      .eq("event_id", eventId);
    const map: Record<string, { count: number; topSeverity: string | null; hasProximity: boolean }> = {};
    const rank = (s: string | null) => (s === "fatal" ? 3 : s === "medical" ? 2 : s === "preference" ? 1 : 0);
    for (const e of (entries ?? []) as any[]) {
      const gid = e.guest_id;
      if (!gid) continue;
      const cur = map[gid] ?? { count: 0, topSeverity: null, hasProximity: false };
      cur.count += 1;
      if (rank(e.severity) > rank(cur.topSeverity)) cur.topSeverity = e.severity;
      if ((e.restriction_type ?? "").toLowerCase().startsWith("proximity")) cur.hasProximity = true;
      map[gid] = cur;
    }
    setDietaryByGuest(map);
    setLoading(false);
  };

  const stats = useMemo(() => ({
    total: guests.length,
    confirmed: guests.filter(g => g.rsvp_status === "confirmed").length,
    declined: guests.filter(g => g.rsvp_status === "declined").length,
    awaiting: guests.filter(g => g.rsvp_status === "invited" || g.rsvp_status === "maybe").length,
  }), [guests]);

  const filtered = useMemo(() => {
    let list = guests;
    if (filter === "confirmed") list = list.filter(g => g.rsvp_status === "confirmed");
    else if (filter === "declined") list = list.filter(g => g.rsvp_status === "declined");
    else if (filter === "invited") list = list.filter(g => g.rsvp_status === "invited" || g.rsvp_status === "maybe");
    else if (filter === "on_site") list = list.filter(g => g.lodging_preference === "on_site");
    else if (filter === "off_site") list = list.filter(g => g.lodging_preference === "off_site");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(g => `${g.first_name} ${g.last_name}`.toLowerCase().includes(q));
    }
    return list;
  }, [guests, filter, search]);

  const save = async () => {
    if (!editing?.first_name?.trim() || !editing?.last_name?.trim()) {
      toast.error("First and last name required");
      return;
    }
    const payload: any = { ...editing };
    delete payload.created_at;
    if (editing.id) {
      const { error } = await db.from("guests").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await db.from("guests").insert(payload);
      if (error) return toast.error(error.message);
    }
    setEditing(null);
    toast.success("Saved");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this guest?")) return;
    const { error } = await db.from("guests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const exportCsv = () => {
    const headers = ["First", "Last", "Email", "Phone", "RSVP", "Side", "Relationship", "Lodging", "Dietary", "Notes", "Added By"];
    const rows = guests.map(g => [g.first_name, g.last_name, g.email ?? "", g.phone ?? "", g.rsvp_status,
      g.side ?? "", g.relationship ?? "", g.lodging_preference ?? "", (g.dietary_restrictions ?? []).join("; "),
      (g.notes ?? "").replace(/[\r\n]+/g, " "), g.added_by ?? ""]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "guest-list.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const bulkImport = async () => {
    const lines = importText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const rows = lines.map(line => {
      const parts = line.split(/\s+/);
      const first = parts[0] ?? "";
      const last = parts.slice(1).join(" ") || "—";
      return { ...emptyGuest(eventId, isAdmin), first_name: first, last_name: last };
    });
    const { error } = await db.from("guests").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`Added ${rows.length} guests — open each to add details`);
    setImportText(""); setImportOpen(false); load();
  };

  if (loading) return <div className="py-12 text-center font-body text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg bg-sage/10 border border-sage/20 px-4 py-3">
        <Info size={16} className="text-sage-dark shrink-0 mt-0.5" />
        <p className="font-body text-sm text-foreground">
          Guest dietary information is collected automatically when guests RSVP. You can also add guests
          and their dietary needs manually here.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Confirmed", value: stats.confirmed, tone: "text-sage-dark" },
          { label: "Declined", value: stats.declined, tone: "text-muted-foreground" },
          { label: "Awaiting", value: stats.awaiting, tone: "text-foreground" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-border rounded-lg px-4 py-3">
            <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className={`font-display text-2xl font-light ${s.tone ?? "text-foreground"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background font-body text-sm" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "confirmed", "declined", "invited", "on_site", "off_site"] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full font-body text-xs transition-colors ${
                filter === f ? "bg-sage text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}>
              {f === "all" ? "All" : f === "on_site" ? "On-site" : f === "off_site" ? "Off-site" : f === "invited" ? "Awaiting" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border font-body text-sm hover:bg-muted/40">
          <FileUp size={14} /> Import
        </button>
        {isAdmin && (
          <button onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border font-body text-sm hover:bg-muted/40">
            <Download size={14} /> Export
          </button>
        )}
        <button onClick={() => setEditing(emptyGuest(eventId, isAdmin))}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-sage text-primary-foreground font-body text-sm hover:bg-sage-dark">
          <Plus size={14} /> Add Guest
        </button>
      </div>

      {/* Import panel */}
      {importOpen && (
        <div className="bg-white border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Quick import</h3>
            <button onClick={() => setImportOpen(false)}><X size={16} /></button>
          </div>
          <p className="font-body text-sm text-muted-foreground">Paste one name per line. You can fill in details after.</p>
          <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={6}
            placeholder="Jane Smith&#10;John Doe&#10;…"
            className="w-full p-3 rounded-md border border-input bg-background font-body text-sm" />
          <div className="flex justify-end">
            <button onClick={bulkImport} className="px-4 py-2 rounded-md bg-sage text-primary-foreground font-body text-sm hover:bg-sage-dark">Add all</button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="bg-white border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl">{editing.id ? "Edit guest" : "Add guest"}</h3>
            <button onClick={() => setEditing(null)}><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="First name *">
              <input className="input" value={editing.first_name ?? ""} onChange={e => setEditing({ ...editing, first_name: e.target.value })} />
            </Field>
            <Field label="Last name *">
              <input className="input" value={editing.last_name ?? ""} onChange={e => setEditing({ ...editing, last_name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={editing.email ?? ""} onChange={e => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className="input" value={editing.phone ?? ""} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
            </Field>
          </div>

          <Field label="Which side">
            <Pills options={SIDES} value={editing.side ?? ""} onChange={v => setEditing({ ...editing, side: v as any })} />
          </Field>
          <Field label="Relationship">
            <select className="input" value={editing.relationship ?? ""}
              onChange={e => setEditing({ ...editing, relationship: e.target.value || null })}>
              <option value="">—</option>
              {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="RSVP">
            <Pills options={RSVP.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))}
              value={editing.rsvp_status ?? "invited"} onChange={v => setEditing({ ...editing, rsvp_status: v as any })} />
          </Field>
          <Field label="Lodging preference">
            <Pills options={LODGING} value={editing.lodging_preference ?? "undecided"}
              onChange={v => setEditing({ ...editing, lodging_preference: v as any })} />
          </Field>
          <Field label="Dietary needs">
            {editing.id ? (
              <>
                {(editing.dietary_restrictions ?? []).length > 0 && (
                  <p className="font-body text-[11px] text-muted-foreground italic mb-2">
                    Legacy notes: {(editing.dietary_restrictions ?? []).join(", ")}
                  </p>
                )}
                <DietaryEntriesEditor eventId={eventId} guestId={editing.id!} />
              </>
            ) : (
              <p className="font-body text-xs text-muted-foreground italic">
                Save this guest first, then re-open to add dietary needs.
              </p>
            )}
          </Field>
          <Field label="Plus one">
            <label className="inline-flex items-center gap-2 font-body text-sm">
              <input type="checkbox" checked={!!editing.is_plus_one}
                onChange={e => setEditing({ ...editing, is_plus_one: e.target.checked })} />
              This guest is a plus one
            </label>
          </Field>
          {editing.is_plus_one && (
            <Field label="Plus one for">
              <select className="input" value={editing.plus_one_of ?? ""}
                onChange={e => setEditing({ ...editing, plus_one_of: e.target.value || null })}>
                <option value="">— Select guest —</option>
                {guests.filter(g => g.id !== editing.id).map(g =>
                  <option key={g.id} value={g.id}>{g.first_name} {g.last_name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Notes">
            <textarea className="input" rows={3} value={editing.notes ?? ""}
              onChange={e => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-md border border-border font-body text-sm hover:bg-muted/40">Cancel</button>
            <button onClick={save} className="px-4 py-2 rounded-md bg-sage text-primary-foreground font-body text-sm hover:bg-sage-dark">Save</button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-border rounded-lg p-10 text-center">
          <p className="font-body text-sm text-muted-foreground">No guests yet. Add your first to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/40">
              <tr className="text-left font-body text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Side</th>
                <th className="px-4 py-3">RSVP</th>
                <th className="px-4 py-3">Lodging</th>
                <th className="px-4 py-3">Dietary</th>
                {isAdmin && <th className="px-4 py-3">Added by</th>}
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-sm">
                    {g.first_name} {g.last_name}
                    {g.is_plus_one && <span className="ml-1.5 text-xs text-muted-foreground">+1</span>}
                  </td>
                  <td className="px-4 py-3"><SideBadge side={g.side} /></td>
                  <td className="px-4 py-3"><RsvpChip status={g.rsvp_status} /></td>
                  <td className="px-4 py-3"><LodgingChip pref={g.lodging_preference} /></td>
                  <td className="px-4 py-3"><DietaryCell guestId={g.id} legacy={g.dietary_restrictions} info={dietaryByGuest[g.id]} /></td>
                  {isAdmin && (
                    <td className="px-4 py-3 font-body text-xs text-muted-foreground capitalize">{g.added_by ?? "—"}</td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(g)} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                    <button onClick={() => remove(g.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`.input { width:100%; padding:0.5rem 0.75rem; border:1px solid hsl(var(--input)); background:hsl(var(--background)); border-radius:0.375rem; font-size:0.875rem; }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-body text-xs uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Pills({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full font-body text-xs border transition-colors ${
            value === o.value ? "bg-sage text-primary-foreground border-sage" : "bg-white text-muted-foreground border-border hover:text-foreground"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SideBadge({ side }: { side: string | null }) {
  if (!side) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    partner_1: { label: "P1", cls: "bg-sage/15 text-sage-dark" },
    partner_2: { label: "P2", cls: "bg-gold/20 text-foreground" },
    both: { label: "Both", cls: "bg-muted text-foreground" },
    other: { label: "Other", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[side] ?? map.other;
  return <span className={`px-2 py-0.5 rounded-full font-body text-[11px] ${m.cls}`}>{m.label}</span>;
}

function RsvpChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-sage/15 text-sage-dark",
    declined: "bg-muted text-muted-foreground line-through",
    invited: "bg-gold/20 text-foreground",
    maybe: "bg-gold/20 text-foreground",
  };
  return <span className={`px-2 py-0.5 rounded-full font-body text-[11px] capitalize ${map[status] ?? "bg-muted"}`}>{status}</span>;
}

function LodgingChip({ pref }: { pref: string | null }) {
  if (!pref || pref === "undecided") return <span className="text-muted-foreground text-xs">Undecided</span>;
  return (
    <span className={`px-2 py-0.5 rounded-full font-body text-[11px] ${
      pref === "on_site" ? "bg-sage/15 text-sage-dark" : "bg-cream-dark/40 text-foreground"
    }`}>
      {pref === "on_site" ? "On-site" : "Off-site"}
    </span>
  );
}

function DietaryCell({ guestId, legacy, info }: { guestId: string; legacy: string[] | null; info?: { count: number; topSeverity: string | null; hasProximity: boolean } }) {
  const legacyItems = legacy ?? [];
  if ((!info || info.count === 0) && legacyItems.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  const sevBadge = info?.topSeverity ? SEVERITY_BADGE[info.topSeverity] : null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {info && info.count > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-body text-[11px] text-secondary-foreground">
          <UtensilsCrossed size={10} /> {info.count} {info.count === 1 ? "need" : "needs"}
        </span>
      )}
      {sevBadge && (
        <span className={`px-2 py-0.5 rounded-full font-body text-[10px] border ${sevBadge.cls}`}>{sevBadge.label}</span>
      )}
      {info?.hasProximity && (
        <span title="Proximity restriction" className="inline-flex items-center text-amber-700"><AlertTriangle size={12} /></span>
      )}
      {legacyItems.length > 0 && (
        <span className="font-body text-[10px] text-muted-foreground italic" title={legacyItems.join(", ")}>
          legacy: {legacyItems.slice(0, 2).join(", ")}{legacyItems.length > 2 ? "…" : ""}
        </span>
      )}
    </div>
  );
}

