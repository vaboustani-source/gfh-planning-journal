import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Search, Download, FileUp, X, UtensilsCrossed, Info, AlertTriangle, ClipboardPaste, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import DietaryEntriesEditor from "@/components/dietary/DietaryEntriesEditor";
import { SEVERITY_BADGE } from "@/lib/dietary";

const db = supabase as any;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ImportRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  lodging_preference: "on_site" | "off_site" | "undecided";
  is_child: boolean;
  rsvp_status: "invited" | "confirmed" | "declined" | "maybe";
  side: string;
  relationship: string;
  notes: string;
  exclude: boolean;
}

const CSV_HEADERS = ["First", "Last", "Email", "Phone", "Lodging", "Adult or Child", "RSVP", "Side", "Relationship", "Notes"];

// Robust CSV parser: handles quoted fields, embedded commas, doubled quotes, CRLF
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { cur.push(field); field = ""; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.some(c => c.trim().length > 0));
}

function findEmail(s: string): string | null {
  const m = s.match(/[^\s,;<>"']+@[^\s,;<>"']+\.[^\s,;<>"']+/);
  return m ? m[0] : null;
}

function blankImportRow(partial: Partial<ImportRow> = {}): ImportRow {
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    lodging_preference: "undecided",
    is_child: false,
    rsvp_status: "invited",
    side: "",
    relationship: "",
    notes: "",
    exclude: false,
    ...partial,
  };
}

// Parse a single pasted line into an import row.
// Splits on tabs first, then commas. Falls back to email detection by regex.
function parseQuickLine(raw: string): ImportRow {
  const line = raw.trim();
  const parts = (line.includes("\t") ? line.split("\t") : line.split(","))
    .map(p => p.trim());
  // Pull out any email from the whole line if columns don't line up
  const detectedEmail = findEmail(line) ?? "";
  const emailIdx = parts.findIndex(p => EMAIL_RE.test(p));
  let first = "", last = "", email = "", phone = "";
  if (emailIdx >= 0) {
    email = parts[emailIdx];
    const before = parts.slice(0, emailIdx);
    const after = parts.slice(emailIdx + 1);
    first = before[0] ?? "";
    last = before.slice(1).join(" ").trim() || (before.length === 1 ? "" : "");
    phone = after[0] ?? "";
  } else {
    first = parts[0] ?? "";
    last = parts[1] ?? "";
    email = detectedEmail;
    phone = parts[2] ?? "";
  }
  return blankImportRow({ first_name: first, last_name: last, email, phone });
}

function normalizeLodging(v: string): "on_site" | "off_site" | "undecided" {
  const s = v.trim().toLowerCase().replace(/[-_\s]+/g, "");
  if (s === "onsite" || s === "on") return "on_site";
  if (s === "offsite" || s === "off") return "off_site";
  return "undecided";
}

function normalizeChild(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "child" || s === "kid" || s === "yes" || s === "true" || s === "y";
}

function normalizeRsvp(v: string): "invited" | "confirmed" | "declined" | "maybe" {
  const s = v.trim().toLowerCase();
  if (s === "confirmed" || s === "yes") return "confirmed";
  if (s === "declined" || s === "no") return "declined";
  if (s === "maybe") return "maybe";
  return "invited";
}

// Map a parsed CSV grid (header row + data rows) into ImportRows.
function csvRowsToImportRows(grid: string[][]): ImportRow[] {
  if (grid.length === 0) return [];
  const headers = grid[0].map(h => h.trim().toLowerCase());
  const findCol = (...names: string[]) => {
    for (const n of names) {
      const idx = headers.findIndex(h => h === n.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const cFirst = findCol("first", "first name", "firstname", "given name");
  const cLast = findCol("last", "last name", "lastname", "surname", "family name");
  const cEmail = findCol("email", "e-mail", "email address");
  const cPhone = findCol("phone", "mobile", "cell", "telephone");
  const cLodging = findCol("lodging", "lodging preference", "stay");
  const cChild = findCol("adult or child", "child", "kid", "type");
  const cRsvp = findCol("rsvp", "rsvp status", "status");
  const cSide = findCol("side", "which side");
  const cRel = findCol("relationship", "relation");
  const cNotes = findCol("notes", "note", "comment");

  return grid.slice(1).map(cols => {
    const get = (i: number) => (i >= 0 ? (cols[i] ?? "").trim() : "");
    return blankImportRow({
      first_name: get(cFirst),
      last_name: get(cLast),
      email: get(cEmail),
      phone: get(cPhone),
      lodging_preference: cLodging >= 0 ? normalizeLodging(get(cLodging)) : "undecided",
      is_child: cChild >= 0 ? normalizeChild(get(cChild)) : false,
      rsvp_status: cRsvp >= 0 ? normalizeRsvp(get(cRsvp)) : "invited",
      side: get(cSide),
      relationship: get(cRel),
      notes: get(cNotes),
    });
  });
}


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
  is_child?: boolean | null;
  invited_optional_meals?: string[] | null;
  created_at?: string;
}

const OPTIONAL_MEALS: { code: string; label: string }[] = [
  { code: "rehearsal_dinner", label: "Rehearsal Dinner" },
  { code: "welcome_party", label: "Welcome Party" },
  { code: "farewell_brunch", label: "Farewell Brunch" },
];

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
  is_child: false,
  invited_optional_meals: [],
});

export default function GuestList({ eventId, isAdmin = false, onCountChange }: Props) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Guest> | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [importMode, setImportMode] = useState<null | "quick" | "csv">(null);
  const [importText, setImportText] = useState("");
  const [parsedRows, setParsedRows] = useState<ImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
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

  const openQuick = () => { setImportText(""); setParsedRows(null); setImportMode("quick"); };
  const openCsv = () => { setParsedRows(null); setImportMode("csv"); setTimeout(() => csvInputRef.current?.click(), 0); };
  const closeImport = () => { setImportMode(null); setParsedRows(null); setImportText(""); };

  const handleQuickParse = () => {
    const lines = importText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast.error("Paste at least one guest first"); return; }
    setParsedRows(lines.map(parseQuickLine));
  };

  const handleCsvFile = async (file: File) => {
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length < 2) { toast.error("CSV looks empty. Include a header row and at least one guest."); return; }
      const rows = csvRowsToImportRows(grid);
      if (rows.length === 0) { toast.error("No data rows found"); return; }
      setParsedRows(rows);
    } catch (err: any) {
      toast.error(`Could not read CSV: ${err?.message ?? "unknown error"}`);
    }
  };

  const downloadCsvTemplate = () => {
    const csv = CSV_HEADERS.map(h => `"${h}"`).join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "guest-list-template.csv"; a.click(); URL.revokeObjectURL(url);
  };

  // Validation for the review grid
  const existingEmails = useMemo(
    () => new Set(guests.map(g => (g.email ?? "").trim().toLowerCase()).filter(Boolean)),
    [guests]
  );

  const rowErrors = useMemo(() => {
    if (!parsedRows) return [] as { error: string | null; duplicate: boolean }[];
    const seen = new Map<string, number>();
    return parsedRows.map((r, idx) => {
      let error: string | null = null;
      if (!r.first_name.trim()) error = "First name required";
      else if (!r.last_name.trim()) error = "Last name required";
      else if (!r.email.trim()) error = "Email required";
      else if (!EMAIL_RE.test(r.email.trim())) error = "Email looks invalid";
      const key = r.email.trim().toLowerCase();
      let duplicate = false;
      if (key) {
        if (existingEmails.has(key)) duplicate = true;
        const first = seen.get(key);
        if (first !== undefined && first !== idx) duplicate = true;
        if (!seen.has(key)) seen.set(key, idx);
      }
      return { error, duplicate };
    });
  }, [parsedRows, existingEmails]);

  const updateRow = (idx: number, patch: Partial<ImportRow>) => {
    setParsedRows(prev => prev ? prev.map((r, i) => i === idx ? { ...r, ...patch } : r) : prev);
  };
  const removeRow = (idx: number) => {
    setParsedRows(prev => prev ? prev.filter((_, i) => i !== idx) : prev);
  };

  const importValid = useMemo(() => {
    if (!parsedRows) return { rows: [], skippedDup: 0, hasErrors: false };
    const rows: ImportRow[] = [];
    let skippedDup = 0;
    let hasErrors = false;
    parsedRows.forEach((r, i) => {
      const v = rowErrors[i];
      if (v?.error) hasErrors = true;
      if (v?.duplicate && r.exclude) { skippedDup++; return; }
      if (v?.error) return;
      if (v?.duplicate && !r.exclude) { rows.push(r); return; }
      rows.push(r);
    });
    return { rows, skippedDup, hasErrors };
  }, [parsedRows, rowErrors]);

  const confirmImport = async () => {
    if (!parsedRows) return;
    if (importValid.hasErrors) { toast.error("Fix the rows marked in red first"); return; }
    if (importValid.rows.length === 0) { toast.error("Nothing to import"); return; }
    setImporting(true);
    const payload = importValid.rows.map(r => ({
      ...emptyGuest(eventId, isAdmin),
      first_name: r.first_name.trim(),
      last_name: r.last_name.trim(),
      email: r.email.trim(),
      phone: r.phone.trim() || null,
      lodging_preference: r.lodging_preference,
      is_child: r.is_child,
      rsvp_status: r.rsvp_status,
      side: r.side || null,
      relationship: r.relationship || null,
      notes: r.notes || null,
    }));
    const { error } = await db.from("guests").insert(payload);
    setImporting(false);
    if (error) return toast.error(error.message);
    const added = payload.length;
    const dups = parsedRows.filter((r, i) => rowErrors[i]?.duplicate && r.exclude).length;
    toast.success(`Added ${added} guest${added === 1 ? "" : "s"}${dups > 0 ? `, skipped ${dups} duplicate${dups === 1 ? "" : "s"}` : ""}`);
    closeImport();
    load();
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
          <Field label="Adult or child">
            <Pills
              options={[{ value: "adult", label: "Adult" }, { value: "child", label: "Child" }]}
              value={editing.is_child ? "child" : "adult"}
              onChange={async (v) => {
                const next = v === "child";
                setEditing({ ...editing, is_child: next });
                if (editing.id) {
                  const { error } = await db.from("guests").update({ is_child: next }).eq("id", editing.id);
                  if (error) toast.error(error.message);
                  else setGuests(prev => prev.map(g => g.id === editing.id ? { ...g, is_child: next } as Guest : g));
                }
              }}
            />
          </Field>
          <div className="rounded-lg bg-cream-dark/30 border border-border px-4 py-3">
            <p className="font-body text-xs text-foreground">
              On-site guests are automatically invited to every event. Off-site guests automatically get the welcome hour, cocktail hour, and reception. You can add off-site guests to the optional events below.
            </p>
          </div>
          {editing.lodging_preference !== "on_site" && (
            <Field label="Also invite to (off-site guests only)">
              <div className="flex flex-col gap-2">
                {OPTIONAL_MEALS.map(m => {
                  const current = editing.invited_optional_meals ?? [];
                  const checked = current.includes(m.code);
                  return (
                    <label key={m.code} className="inline-flex items-center gap-2 font-body text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={async (e) => {
                          const on = e.target.checked;
                          const next = on
                            ? Array.from(new Set([...current, m.code]))
                            : current.filter(c => c !== m.code);
                          setEditing({ ...editing, invited_optional_meals: next });
                          if (editing.id) {
                            const { error } = await db.from("guests").update({ invited_optional_meals: next }).eq("id", editing.id);
                            if (error) toast.error(error.message);
                            else setGuests(prev => prev.map(g => g.id === editing.id ? { ...g, invited_optional_meals: next } as Guest : g));
                          }
                        }}
                      />
                      {m.label}
                    </label>
                  );
                })}
              </div>
            </Field>
          )}
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

