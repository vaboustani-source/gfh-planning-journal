import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { canEdit } from "@/lib/permissions";
import {
  Loader2, Upload, Trash2, Plus, ArrowUp, ArrowDown, Eye, EyeOff,
  Map as MapIcon, Info, Save,
} from "lucide-react";
import { toast } from "sonner";

const db = supabase as any;

interface LodgingSection {
  id: string;
  section_key: string;
  name: string;
  sort_order: number;
  map_image_url: string | null;
  is_active: boolean;
}

interface Offsite {
  id: string;
  name: string;
  description: string | null;
  drive_time: string | null;
  phone: string | null;
  website_url: string | null;
  sort_order: number;
  is_active: boolean;
}

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `section_${Date.now()}`;
}

async function logChange(table: string, recordId: string, action: string, userId?: string | null) {
  await db.from("change_history").insert({
    table_name: table, record_id: recordId, action, changed_by: userId ?? null,
  });
}

export default function SettingsLodging() {
  const { profile } = useAuth();
  const isStaff = canEdit(profile?.role, "our_people");

  if (!isStaff) {
    return (
      <div className="max-w-3xl">
        <p className="font-body text-sm text-muted-foreground">You don't have access to this area.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-14">
      <header>
        <h1 className="font-display text-3xl font-light" style={{ color: "#2C3E2D" }}>Lodging Manager</h1>
        <p className="font-body text-sm text-muted-foreground mt-2 max-w-2xl">
          These lodging details are property-wide and shared across every couple's portal. Changes here appear in every event's People &rarr; Lodging view.
        </p>
      </header>

      <OnSiteSectionsPanel userId={profile?.id ?? null} />
      <OffsiteAccommodationsPanel userId={profile?.id ?? null} />
    </div>
  );
}

/* ============================================================
   Panel A: On-Site Lodging Sections
   ============================================================ */
function OnSiteSectionsPanel({ userId }: { userId: string | null }) {
  const [rows, setRows] = useState<LodgingSection[]>([]);
  const [mapUrls, setMapUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const nameTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    const { data } = await db
      .from("lodging_sections")
      .select("id, section_key, name, sort_order, map_image_url, is_active")
      .order("sort_order", { ascending: true });
    const list = (data ?? []) as LodgingSection[];
    setRows(list);

    const urls: Record<string, string> = {};
    await Promise.all(list.map(async r => {
      if (!r.map_image_url) return;
      const { data: s } = await supabase.storage.from("lodging-maps").createSignedUrl(r.map_image_url, 60 * 60);
      if (s?.signedUrl) urls[r.id] = s.signedUrl;
    }));
    setMapUrls(urls);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateNameLocal = (id: string, name: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, name } : r));
    if (nameTimers.current[id]) clearTimeout(nameTimers.current[id]);
    nameTimers.current[id] = setTimeout(async () => {
      const row = rows.find(r => r.id === id);
      await db.from("lodging_sections").update({ name }).eq("id", id);
      await logChange("lodging_sections", id, `Renamed section to "${name}"${row ? ` (was "${row.name}")` : ""}`, userId);
    }, 700);
  };

  const toggleActive = async (r: LodgingSection) => {
    const next = !r.is_active;
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, is_active: next } : x));
    await db.from("lodging_sections").update({ is_active: next }).eq("id", r.id);
    await logChange("lodging_sections", r.id, `${next ? "Showed" : "Hid"} section ${r.name}`, userId);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index]; const b = rows[target];
    const nextRows = [...rows];
    nextRows[index] = { ...b, sort_order: a.sort_order };
    nextRows[target] = { ...a, sort_order: b.sort_order };
    setRows(nextRows);
    await Promise.all([
      db.from("lodging_sections").update({ sort_order: b.sort_order }).eq("id", a.id),
      db.from("lodging_sections").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await logChange("lodging_sections", a.id, `Reordered section ${a.name}`, userId);
  };

  const uploadMap = async (r: LodgingSection, file: File) => {
    setUploadingId(r.id);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${r.section_key}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("lodging-maps").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: updErr } = await db.from("lodging_sections").update({ map_image_url: path }).eq("id", r.id);
      if (updErr) throw updErr;
      const wasReplace = !!r.map_image_url;
      await logChange("lodging_sections", r.id, `${wasReplace ? "Replaced" : "Uploaded"} map for ${r.name}`, userId);
      const { data: s } = await supabase.storage.from("lodging-maps").createSignedUrl(path, 60 * 60);
      setRows(prev => prev.map(x => x.id === r.id ? { ...x, map_image_url: path } : x));
      if (s?.signedUrl) setMapUrls(prev => ({ ...prev, [r.id]: s.signedUrl }));
      toast.success(wasReplace ? "Map replaced" : "Map uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't upload");
    } finally {
      setUploadingId(null);
    }
  };

  const removeMap = async (r: LodgingSection) => {
    if (!r.map_image_url) return;
    if (!confirm(`Remove the map for ${r.name}?`)) return;
    await supabase.storage.from("lodging-maps").remove([r.map_image_url]);
    await db.from("lodging_sections").update({ map_image_url: null }).eq("id", r.id);
    await logChange("lodging_sections", r.id, `Removed map for ${r.name}`, userId);
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, map_image_url: null } : x));
    setMapUrls(prev => { const n = { ...prev }; delete n[r.id]; return n; });
    toast.success("Map removed");
  };

  const addSection = async () => {
    const name = newName.trim();
    if (!name) return;
    const nextSort = (rows[rows.length - 1]?.sort_order ?? 0) + 10;
    const key = slugify(name);
    const { data, error } = await db.from("lodging_sections")
      .insert({ section_key: key, name, sort_order: nextSort, is_active: true })
      .select("id, section_key, name, sort_order, map_image_url, is_active")
      .single();
    if (error) { toast.error(error.message); return; }
    setRows(prev => [...prev, data as LodgingSection]);
    await logChange("lodging_sections", (data as any).id, `Added section ${name}`, userId);
    setNewName(""); setShowAdd(false);
    toast.success("Section added");
  };

  return (
    <section>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Panel A</p>
          <h2 className="font-display text-2xl font-light text-foreground">On-Site Lodging Sections</h2>
          <p className="font-body text-sm text-muted-foreground mt-1 max-w-2xl">
            The lodging areas at the farmhouse. Manage the display name, property map, order, and visibility.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Add lodging section
        </button>
      </div>

      <div className="rounded-lg border border-sage/20 bg-sage/5 p-4 mb-4 flex gap-3">
        <Info size={16} className="text-sage-dark shrink-0 mt-0.5" />
        <p className="font-body text-xs text-muted-foreground leading-relaxed">
          Adding a new section here will show its name and map in every couple's portal. Wiring the actual rooms and guest room assignments is a separate setup step (rooms are currently configuration-driven), so this alone will not create bookable rooms.
        </p>
      </div>

      {showAdd && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4 flex items-center gap-3 flex-wrap">
          <input
            type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Section name (e.g. Hilltop Cottages)"
            className="flex-1 min-w-[240px] rounded-lg border border-border bg-background px-3 py-2 font-body text-sm focus:outline-none focus:border-primary/50"
          />
          <button onClick={addSection} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm inline-flex items-center gap-1.5">
            <Save size={13} /> Save section
          </button>
          <button onClick={() => { setShowAdd(false); setNewName(""); }} className="px-3 py-2 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center font-body text-sm text-muted-foreground">No sections yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r, i) => (
              <li key={r.id} className={`p-5 ${!r.is_active ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30" aria-label="Move up"><ArrowUp size={13} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30" aria-label="Move down"><ArrowDown size={13} /></button>
                  </div>

                  <div className="flex-1 min-w-[220px] space-y-3">
                    <input
                      type="text" value={r.name} onChange={e => updateNameLocal(r.id, e.target.value)}
                      className="w-full font-display text-lg font-light text-foreground bg-transparent border-b border-transparent focus:border-primary/40 focus:outline-none px-1 py-1"
                    />
                    <p className="font-body text-[11px] text-muted-foreground">Key: {r.section_key}</p>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 font-body text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted cursor-pointer transition-colors">
                        {uploadingId === r.id ? (
                          <><Loader2 size={12} className="animate-spin" /> Uploading&hellip;</>
                        ) : (
                          <><Upload size={12} /> {r.map_image_url ? "Replace map" : "Upload map"}</>
                        )}
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingId === r.id}
                          onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadMap(r, f); }}
                        />
                      </label>
                      {r.map_image_url && (
                        <button onClick={() => removeMap(r)} className="inline-flex items-center gap-1.5 font-body text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors">
                          <Trash2 size={12} /> Remove map
                        </button>
                      )}
                      <button onClick={() => toggleActive(r)} className="inline-flex items-center gap-1.5 font-body text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                        {r.is_active ? <><Eye size={12} /> Visible</> : <><EyeOff size={12} /> Hidden</>}
                      </button>
                    </div>

                    {mapUrls[r.id] && (
                      <div className="mt-3">
                        <img src={mapUrls[r.id]} alt={`${r.name} map`} className="w-full max-w-md h-auto rounded-lg border border-border" />
                      </div>
                    )}
                    {!mapUrls[r.id] && (
                      <p className="font-body text-xs text-muted-foreground flex items-center gap-1.5"><MapIcon size={12} /> No map uploaded yet.</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ============================================================
   Panel B: Off-Site Accommodations
   ============================================================ */
function OffsiteAccommodationsPanel({ userId }: { userId: string | null }) {
  const [rows, setRows] = useState<Offsite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Offsite | null>(null);

  const load = useCallback(async () => {
    const { data } = await db
      .from("offsite_accommodations")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name");
    setRows((data ?? []) as Offsite[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index]; const b = rows[target];
    const nextRows = [...rows];
    nextRows[index] = { ...b, sort_order: a.sort_order };
    nextRows[target] = { ...a, sort_order: b.sort_order };
    setRows(nextRows);
    await Promise.all([
      db.from("offsite_accommodations").update({ sort_order: b.sort_order }).eq("id", a.id),
      db.from("offsite_accommodations").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await logChange("offsite_accommodations", a.id, `Reordered ${a.name}`, userId);
  };

  const toggleActive = async (r: Offsite) => {
    const next = !r.is_active;
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, is_active: next } : x));
    await db.from("offsite_accommodations").update({ is_active: next }).eq("id", r.id);
    await logChange("offsite_accommodations", r.id, `${next ? "Activated" : "Deactivated"} ${r.name}`, userId);
  };

  const remove = async (r: Offsite) => {
    if (!confirm(`Delete ${r.name}? This cannot be undone.`)) return;
    await db.from("offsite_accommodations").delete().eq("id", r.id);
    await logChange("offsite_accommodations", r.id, `Deleted ${r.name}`, userId);
    setRows(prev => prev.filter(x => x.id !== r.id));
    toast.success("Deleted");
  };

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (r: Offsite) => { setEditing(r); setShowForm(true); };

  return (
    <section>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Panel B</p>
          <h2 className="font-display text-2xl font-light text-foreground">Off-Site Accommodations</h2>
          <p className="font-body text-sm text-muted-foreground mt-1 max-w-2xl">
            Recommended nearby places to stay. Couples see the active entries on their People &rarr; Lodging tab.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Add accommodation
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center font-body text-sm text-muted-foreground">No accommodations yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r, i) => (
              <li key={r.id} className={`p-5 flex items-start gap-4 ${!r.is_active ? "opacity-60" : ""}`}>
                <div className="flex flex-col gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30" aria-label="Move up"><ArrowUp size={13} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30" aria-label="Move down"><ArrowDown size={13} /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display text-lg font-light text-foreground">{r.name}</p>
                    {!r.is_active && (
                      <span className="rounded-full bg-muted border border-border px-2 py-0.5 font-body text-[10px] text-muted-foreground">Hidden</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 font-body text-xs text-muted-foreground">
                    {r.drive_time && <span>{r.drive_time}</span>}
                    {r.phone && <span>{r.phone}</span>}
                    {r.website_url && <span className="truncate max-w-[280px]">{r.website_url.replace(/^https?:\/\//, "")}</span>}
                  </div>
                  {r.description && <p className="font-body text-sm text-foreground/80 mt-2 leading-relaxed">{r.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(r)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title={r.is_active ? "Deactivate" : "Activate"}>
                    {r.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => openEdit(r)} className="px-2.5 py-1.5 rounded-lg font-body text-xs border border-border hover:bg-muted transition-colors">Edit</button>
                  <button onClick={() => remove(r)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete"><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && (
        <OffsiteForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={async (savedId, action) => {
            await logChange("offsite_accommodations", savedId, action, userId);
            setShowForm(false);
            load();
          }}
          nextSort={(rows[rows.length - 1]?.sort_order ?? 0) + 10}
        />
      )}
    </section>
  );
}

function OffsiteForm({
  initial, onClose, onSaved, nextSort,
}: {
  initial: Offsite | null;
  onClose: () => void;
  onSaved: (id: string, action: string) => void;
  nextSort: number;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [driveTime, setDriveTime] = useState(initial?.drive_time ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [website, setWebsite] = useState(initial?.website_url ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (initial) {
        const { error } = await db.from("offsite_accommodations").update({
          name: name.trim(), description: description.trim() || null,
          drive_time: driveTime.trim() || null, phone: phone.trim() || null,
          website_url: website.trim() || null,
        }).eq("id", initial.id);
        if (error) throw error;
        onSaved(initial.id, `Updated ${name.trim()}`);
      } else {
        const { data, error } = await db.from("offsite_accommodations").insert({
          name: name.trim(), description: description.trim() || null,
          drive_time: driveTime.trim() || null, phone: phone.trim() || null,
          website_url: website.trim() || null, sort_order: nextSort, is_active: true,
        }).select("id").single();
        if (error) throw error;
        onSaved((data as any).id, `Added ${name.trim()}`);
      }
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-xl font-light text-foreground">{initial ? "Edit accommodation" : "Add accommodation"}</h3>
        <div className="space-y-3">
          <Field label="Name">
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Cooperstown Inn" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputCls} placeholder="A calm room block near town." />
          </Field>
          <Field label="Drive time">
            <input value={driveTime} onChange={e => setDriveTime(e.target.value)} className={inputCls} placeholder="12 min drive" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="(607) 555-0123" />
          </Field>
          <Field label="Website">
            <input value={website} onChange={e => setWebsite(e.target.value)} className={inputCls} placeholder="https://example.com" />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg font-body text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm inline-flex items-center gap-1.5 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
