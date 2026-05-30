import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Image as ImageIcon, X, Trash2, Upload, Pencil, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPERIENCE_CATEGORIES,
  PRICING_TYPES,
  PricingConfig,
  PricingType,
  getCategoryLabel,
  isPricingConfigured,
} from "@/lib/experienceCategories";

interface CatalogItem {
  id: string;
  title: string;
  category: string;
  description: string | null;
  photo_url: string | null;
  pricing_type: PricingType | null;
  pricing_config: PricingConfig | null;
  pricing_visible_to_couple: boolean | null;
  requires_discussion: boolean | null;
  available: boolean | null;
  sort_order: number | null;
}

const BUCKET = "experience-catalog";
const db = supabase as any;

export default function ExperienceCatalog() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<CatalogItem | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await db
      .from("experience_catalog")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (data) setItems(data as CatalogItem[]);
    setLoading(false);
  };

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter(i => i.category === filter)),
    [items, filter]
  );

  const startNew = () => {
    setEditing({
      id: "",
      title: "",
      category: "friday_experiences",
      description: "",
      photo_url: null,
      pricing_type: null,
      pricing_config: null,
      pricing_visible_to_couple: false,
      requires_discussion: true,
      available: true,
      sort_order: 0,
    });
  };

  const handleSaved = (saved: CatalogItem) => {
    setItems(prev => {
      const exists = prev.find(p => p.id === saved.id);
      if (exists) return prev.map(p => p.id === saved.id ? saved : p);
      return [...prev, saved];
    });
    setEditing(null);
  };

  const handleDeleted = (id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
    setEditing(null);
  };

  const toggleAvailable = async (item: CatalogItem) => {
    const next = !item.available;
    await db.from("experience_catalog").update({ available: next }).eq("id", item.id);
    setItems(prev => prev.map(p => p.id === item.id ? { ...p, available: next } : p));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} /> Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <p className="font-display text-lg font-light text-foreground">Experiences</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 pb-24">
        <div className="flex items-end justify-between mb-6 animate-fade-up">
          <div>
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Coordinator library</p>
            <h1 className="font-display text-4xl font-light text-foreground mb-1">Experiences</h1>
            <p className="font-body text-sm text-muted-foreground">Friday activities, Saturday add-ons, rehearsal themes & amenities.</p>
          </div>
          <button
            onClick={startNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> Add Experience
          </button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-none -mx-1 px-1">
          {[{ key: "all", label: "All" }, ...EXPERIENCE_CATEGORIES].map(c => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full font-body text-xs transition-colors border ${
                filter === c.key
                  ? "bg-sage text-primary-foreground border-sage"
                  : "bg-card text-muted-foreground border-border hover:border-sage/40"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-xl border border-dashed border-border">
            <ImageIcon size={28} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-display text-xl italic text-foreground">No experiences yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(item => (
              <CatalogCard
                key={item.id}
                item={item}
                onEdit={() => setEditing(item)}
                onToggleAvailable={() => toggleAvailable(item)}
              />
            ))}
          </div>
        )}
      </main>

      {editing && (
        <EditPanel
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

function CatalogCard({ item, onEdit, onToggleAvailable }: {
  item: CatalogItem; onEdit: () => void; onToggleAvailable: () => void;
}) {
  const configured = isPricingConfigured(item.pricing_type, item.pricing_config);
  const isCustomQuote = item.pricing_type === "custom_quote";
  const isRehearsalTier = item.category === "rehearsal_dinner_themes";

  return (
    <div
      className={`rounded-xl bg-card border shadow-soft overflow-hidden flex flex-col ${
        isCustomQuote ? "border-l-4 border-l-[#c9a84c]" : ""
      } ${isCustomQuote ? "border-border" : "border-border"}`}
    >
      <button onClick={onEdit} className="relative h-[200px] bg-muted overflow-hidden text-left">
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sage/10 to-cream">
            <ImageIcon size={32} className="text-muted-foreground/40" />
          </div>
        )}
        {!item.available && (
          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 font-body text-[10px] tracking-widest uppercase text-muted-foreground">
            Unavailable
          </span>
        )}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
          {configured ? (
            <span className="rounded-full bg-sage text-primary-foreground px-2.5 py-1 font-body text-[10px] tracking-wide">Pricing Set</span>
          ) : (
            <span className="rounded-full bg-[#f5e9c8] text-[#8a6914] px-2.5 py-1 font-body text-[10px] tracking-wide">No Pricing Yet</span>
          )}
          {isRehearsalTier && (
            <span className="rounded-full bg-background/95 px-2.5 py-1 font-body text-[10px] tracking-wide text-foreground border border-border">
              3 Tiers
            </span>
          )}
        </div>
      </button>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-base text-foreground leading-tight">{item.title || "Untitled"}</p>
          <button onClick={onEdit} className="text-muted-foreground hover:text-foreground shrink-0">
            <Pencil size={13} />
          </button>
        </div>
        <span className="self-start rounded-full bg-sage/10 px-2 py-0.5 font-body text-[10px] tracking-wide text-sage">
          {getCategoryLabel(item.category)}
        </span>
        {item.description && (
          <p className="font-body text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        <label className="flex items-center gap-2 mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={!!item.available}
            onChange={onToggleAvailable}
            className="rounded border-border accent-sage"
          />
          <span className="font-body text-[11px] text-muted-foreground">Available to couples</span>
        </label>
      </div>
    </div>
  );
}

function EditPanel({ initial, onClose, onSaved, onDeleted }: {
  initial: CatalogItem;
  onClose: () => void;
  onSaved: (item: CatalogItem) => void;
  onDeleted: (id: string) => void;
}) {
  const isNew = !initial.id;
  const [form, setForm] = useState<CatalogItem>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CatalogItem>(k: K, v: CatalogItem[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const setCfg = (patch: Partial<PricingConfig>) =>
    setForm(prev => ({ ...prev, pricing_config: { ...(prev.pricing_config || {}), ...patch } }));

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const id = form.id || crypto.randomUUID();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${id}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      setForm(prev => ({ ...prev, id, photo_url: url }));
    } catch (e: any) {
      alert("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title.trim()) { alert("Title is required"); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        category: form.category,
        description: form.description,
        photo_url: form.photo_url,
        pricing_type: form.pricing_type,
        pricing_config: form.pricing_config,
        pricing_visible_to_couple: form.pricing_visible_to_couple ?? false,
        requires_discussion: form.requires_discussion ?? true,
        available: form.available ?? true,
        sort_order: form.sort_order ?? 0,
      };
      if (isNew) {
        const insertPayload = form.id ? { id: form.id, ...payload } : payload;
        const { data, error } = await db.from("experience_catalog").insert(insertPayload).select().single();
        if (error) throw error;
        onSaved(data as CatalogItem);
      } else {
        const { data, error } = await db.from("experience_catalog").update(payload).eq("id", form.id).select().single();
        if (error) throw error;
        onSaved(data as CatalogItem);
      }
    } catch (e: any) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await db.from("experience_catalog").delete().eq("id", form.id);
    onDeleted(form.id);
  };

  const tiers = form.pricing_config?.tiers ?? [];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-[540px] h-full bg-background shadow-2xl overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <p className="font-display text-lg font-light">{isNew ? "Add Experience" : "Edit Experience"}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Photo */}
          <div>
            <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Photo</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-2 rounded-xl border-2 border-dashed border-border hover:border-sage/40 transition-colors cursor-pointer overflow-hidden bg-muted/30"
            >
              {form.photo_url ? (
                <img src={form.photo_url} alt="" className="w-full h-48 object-cover" />
              ) : (
                <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Upload size={22} />
                  <p className="font-body text-xs">Click to upload</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
            {uploading && <p className="font-body text-xs text-muted-foreground mt-1">Uploading…</p>}
          </div>

          <Field label="Title*">
            <input value={form.title} onChange={e => set("title", e.target.value)} className={inputCls} />
          </Field>

          <Field label="Category*">
            <select value={form.category} onChange={e => set("category", e.target.value)} className={inputCls}>
              {EXPERIENCE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>

          <Field label="Description">
            <textarea value={form.description ?? ""} onChange={e => set("description", e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </Field>

          <Toggle
            label="Requires discussion before booking"
            checked={!!form.requires_discussion}
            onChange={v => set("requires_discussion", v)}
          />
          <Toggle
            label="Available to couples"
            checked={!!form.available}
            onChange={v => set("available", v)}
          />

          {/* PRICING SECTION */}
          <div className="rounded-xl border border-border bg-cream/40 p-4 space-y-4">
            <div>
              <p className="font-display text-base font-light text-foreground">Pricing</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                {!form.pricing_type
                  ? "Pricing not configured — couple will see Inquire for Pricing."
                  : "Choose how this experience is priced."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRICING_TYPES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => set("pricing_type", t.key as PricingType)}
                  className={`text-left rounded-lg border p-2.5 transition-colors ${
                    form.pricing_type === t.key
                      ? "border-sage bg-sage/8"
                      : "border-border bg-background hover:border-sage/40"
                  }`}
                >
                  <p className="font-body text-sm font-medium text-foreground">{t.label}</p>
                  <p className="font-body text-[11px] text-muted-foreground leading-snug mt-0.5">{t.blurb}</p>
                </button>
              ))}
            </div>

            {form.pricing_type === "flat" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price">
                  <PriceInput value={form.pricing_config?.rate} onChange={v => setCfg({ rate: v })} />
                </Field>
                <Field label="Price label">
                  <input className={inputCls} placeholder="flat fee"
                    value={form.pricing_config?.price_label ?? ""}
                    onChange={e => setCfg({ price_label: e.target.value })} />
                </Field>
              </div>
            )}

            {form.pricing_type === "per_person" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rate (per person)">
                  <PriceInput value={form.pricing_config?.rate} onChange={v => setCfg({ rate: v })} />
                </Field>
                <Field label="Minimum guests">
                  <input type="number" min={1} className={inputCls}
                    value={form.pricing_config?.min_guests ?? ""}
                    onChange={e => setCfg({ min_guests: parseInt(e.target.value) || undefined })} />
                </Field>
                <Field label="Price label">
                  <input className={inputCls} placeholder="per person"
                    value={form.pricing_config?.price_label ?? ""}
                    onChange={e => setCfg({ price_label: e.target.value })} />
                </Field>
              </div>
            )}

            {form.pricing_type === "per_hour" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rate (per hour)">
                  <PriceInput value={form.pricing_config?.rate} onChange={v => setCfg({ rate: v })} />
                </Field>
                <Field label="Minimum hours">
                  <input type="number" min={0} step={0.5} className={inputCls}
                    value={form.pricing_config?.min_hours ?? ""}
                    onChange={e => setCfg({ min_hours: parseFloat(e.target.value) || undefined })} />
                </Field>
                <Field label="Increment">
                  <select className={inputCls}
                    value={form.pricing_config?.increment ?? "1hr"}
                    onChange={e => setCfg({ increment: e.target.value as "30min" | "1hr" })}>
                    <option value="30min">30 minutes</option>
                    <option value="1hr">1 hour</option>
                  </select>
                </Field>
                <Field label="Price label">
                  <input className={inputCls} placeholder="per hour"
                    value={form.pricing_config?.price_label ?? ""}
                    onChange={e => setCfg({ price_label: e.target.value })} />
                </Field>
              </div>
            )}

            {form.pricing_type === "tiered" && (
              <div className="space-y-2">
                {tiers.map((tier, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5">
                    <GripVertical size={14} className="text-muted-foreground mt-2 shrink-0" />
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input className={inputCls} placeholder="Tier name" value={tier.name}
                        onChange={e => {
                          const next = [...tiers]; next[i] = { ...tier, name: e.target.value };
                          setCfg({ tiers: next });
                        }} />
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">$</span>
                        <input type="number" className={`${inputCls} pl-6`} placeholder="Price" value={tier.price}
                          onChange={e => {
                            const next = [...tiers]; next[i] = { ...tier, price: parseFloat(e.target.value) || 0 };
                            setCfg({ tiers: next });
                          }} />
                      </div>
                      <input className={`${inputCls} col-span-2`} placeholder="Description (optional)" value={tier.description ?? ""}
                        onChange={e => {
                          const next = [...tiers]; next[i] = { ...tier, description: e.target.value };
                          setCfg({ tiers: next });
                        }} />
                    </div>
                    <button onClick={() => setCfg({ tiers: tiers.filter((_, idx) => idx !== i) })}
                      className="text-muted-foreground hover:text-destructive mt-2">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => setCfg({ tiers: [...tiers, { name: "", price: 0, description: "" }] })}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border font-body text-xs text-muted-foreground hover:border-sage/40 hover:text-foreground">
                  <Plus size={12} /> Add Tier
                </button>
              </div>
            )}

            {form.pricing_type === "custom_quote" && (
              <p className="rounded-lg bg-[#fdf6e3] border border-[#e6d39a]/60 p-3 font-body text-xs text-[#6d5410]">
                Couple will be prompted to describe their vision.
              </p>
            )}

            {form.pricing_type && form.pricing_type !== "custom_quote" && (
              <Toggle
                label="Show pricing to couple"
                checked={!!form.pricing_visible_to_couple}
                onChange={v => set("pricing_visible_to_couple", v)}
                hint={form.pricing_visible_to_couple ? "Couple sees exact pricing." : "Couple sees 'Inquire for Pricing'."}
              />
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button onClick={save} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>

          {!isNew && (
            <div className="pt-4 border-t border-border">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 font-body text-xs text-destructive hover:underline">
                  <Trash2 size={12} /> Delete this experience
                </button>
              ) : (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-2">
                  <p className="font-body text-xs text-destructive">Delete permanently?</p>
                  <div className="flex gap-2">
                    <button onClick={remove} className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground font-body text-xs">Yes, delete</button>
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-md border border-border font-body text-xs">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground block mb-2">{label}</label>
      {children}
    </div>
  );
}

function PriceInput({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-body text-xs text-muted-foreground">$</span>
      <input type="number" min={0} value={value ?? ""} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`${inputCls} pl-6`} />
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded border-border accent-sage mt-0.5" />
      <div>
        <span className="font-body text-sm text-foreground">{label}</span>
        {hint && <p className="font-body text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </label>
  );
}
