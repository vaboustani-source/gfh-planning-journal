import { useState } from "react";
import { Star, Instagram, Globe, Pencil, Trash2, Save, X } from "lucide-react";
import { getCategoryDef, TIER_OPTIONS } from "@/lib/preferredVendorConfig";

export interface PreferredVendor {
  id: string;
  category: string;
  subcategory: string | null;
  name: string;
  tier: string | null;
  family_favorite: boolean | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  notes: string | null;
  active: boolean | null;
  sort_order: number | null;
}

interface Props {
  vendor: PreferredVendor;
  onUpdate: (id: string, fields: Partial<PreferredVendor>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function PreferredVendorCard({ vendor, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState(vendor);
  const def = getCategoryDef(vendor.category);

  const saveAndClose = async () => {
    await onUpdate(vendor.id, draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-sage/40 bg-card overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Category">
              <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value, subcategory: null })} className={inputCls}>
                {Array.from(new Set([draft.category, ...["planner","rentals","photographer","videographer","photo_booth","florals","hair_makeup","dj","band","ceremony_music","officiant","cake","shuttle","fireworks"]])).map(k => (
                  <option key={k} value={k}>{getCategoryDef(k).label}</option>
                ))}
              </select>
            </Field>
            {def.subcategories && (
              <Field label="Subcategory">
                <select value={draft.subcategory || ""} onChange={e => setDraft({ ...draft, subcategory: e.target.value || null })} className={inputCls}>
                  <option value="">—</option>
                  {def.subcategories.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}
            <Field label="Tier">
              <select value={draft.tier || ""} onChange={e => setDraft({ ...draft, tier: e.target.value || null })} className={inputCls}>
                {TIER_OPTIONS.map(t => <option key={t} value={t}>{t || "—"}</option>)}
              </select>
            </Field>
            <Field label="Contact name">
              <input value={draft.contact_name || ""} onChange={e => setDraft({ ...draft, contact_name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Phone">
              <input value={draft.phone || ""} onChange={e => setDraft({ ...draft, phone: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Email">
              <input value={draft.email || ""} onChange={e => setDraft({ ...draft, email: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Website">
              <input value={draft.website || ""} onChange={e => setDraft({ ...draft, website: e.target.value })} placeholder="https://…" className={inputCls} />
            </Field>
            <Field label="Instagram">
              <input value={draft.instagram || ""} onChange={e => setDraft({ ...draft, instagram: e.target.value })} placeholder="@handle" className={inputCls} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={draft.notes || ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={2}
              className="w-full border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background focus:outline-none focus:border-primary/50 resize-none" />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!draft.family_favorite} onChange={e => setDraft({ ...draft, family_favorite: e.target.checked })} className="rounded" />
            <span className="font-body text-xs text-foreground">⭐ Family Favorite</span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setDraft(vendor); setEditing(false); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground font-body text-xs">
              <X size={12} /> Cancel
            </button>
            <button onClick={saveAndClose}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sage text-white hover:opacity-90 font-body text-xs">
              <Save size={12} /> Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW MODE
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-body text-sm font-medium text-foreground">{vendor.name}</p>
            {vendor.tier && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-body text-[10px] text-muted-foreground">{vendor.tier}</span>
            )}
            {vendor.family_favorite && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 border border-gold/30 px-2 py-0.5 font-body text-[10px] text-foreground">
                <Star size={9} className="fill-gold text-gold" /> Family Favorite
              </span>
            )}
            {vendor.subcategory && (
              <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">{vendor.subcategory}</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-muted-foreground">
            {vendor.instagram && (
              <a href={`https://instagram.com/${vendor.instagram.replace("@","")}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors">
                <Instagram size={11} /><span className="font-body text-[11px]">@{vendor.instagram.replace("@","")}</span>
              </a>
            )}
            {vendor.website && (
              <a href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors">
                <Globe size={11} /><span className="font-body text-[11px]">Website</span>
              </a>
            )}
            {vendor.phone && <span className="font-body text-[11px]">{vendor.phone}</span>}
            {vendor.email && <span className="font-body text-[11px]">{vendor.email}</span>}
          </div>
          {vendor.notes && (
            <p className="font-body text-xs italic text-muted-foreground mt-1.5">{vendor.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors font-body text-xs">
            <Pencil size={12} /> Edit
          </button>
          {!confirmDelete && (
            <button onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      {confirmDelete && (
        <div className="mt-3 flex items-center gap-3 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
          <p className="font-body text-xs text-foreground flex-1">Remove this preferred vendor?</p>
          <button onClick={() => { onDelete(vendor.id); setConfirmDelete(false); }}
            className="px-3 py-1 rounded-md bg-destructive text-destructive-foreground font-body text-xs hover:opacity-90">Yes, remove</button>
          <button onClick={() => setConfirmDelete(false)}
            className="px-3 py-1 rounded-md border border-border font-body text-xs text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  );
}
