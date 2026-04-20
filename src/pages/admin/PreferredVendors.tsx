import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PREFERRED_CATEGORIES, getCategoryDef } from "@/lib/preferredVendorConfig";
import { PreferredVendorCard, PreferredVendor } from "@/components/admin/PreferredVendorCard";

export default function PreferredVendors() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<PreferredVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PreferredVendor>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase
      .from("preferred_vendors")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (data) setVendors(data as PreferredVendor[]);
    setLoading(false);
  };

  const lastUpdated = useMemo(() => {
    const ts = (vendors as any[])
      .map(v => v.updated_at)
      .filter(Boolean)
      .sort()
      .pop();
    if (!ts) return null;
    const d = parseISO(ts);
    return isValid(d) ? format(d, "MMMM d, yyyy") : null;
  }, [vendors]);

  const updateVendor = async (id: string, fields: Partial<PreferredVendor>) => {
    const { error } = await supabase.from("preferred_vendors").update(fields).eq("id", id);
    if (error) { console.error(error); return; }
    setVendors(prev => prev.map(v => v.id === id ? { ...v, ...fields } : v));
  };

  const deleteVendor = async (id: string) => {
    await supabase.from("preferred_vendors").delete().eq("id", id);
    setVendors(prev => prev.filter(v => v.id !== id));
  };

  const startAdd = (categoryKey: string) => {
    setAddingTo(categoryKey);
    setDraft({
      category: categoryKey,
      name: "",
      tier: null,
      family_favorite: false,
      active: true,
    });
  };

  const saveAdd = async () => {
    if (!draft.name?.trim() || !draft.category) return;
    const { data, error } = await supabase
      .from("preferred_vendors")
      .insert({
        category: draft.category,
        subcategory: draft.subcategory || null,
        name: draft.name.trim(),
        tier: draft.tier || null,
        family_favorite: !!draft.family_favorite,
        contact_name: draft.contact_name || null,
        phone: draft.phone || null,
        email: draft.email || null,
        website: draft.website || null,
        instagram: draft.instagram || null,
        notes: draft.notes || null,
        active: true,
      })
      .select()
      .single();
    if (error) { console.error(error); return; }
    if (data) setVendors(prev => [...prev, data as PreferredVendor]);
    setAddingTo(null);
    setDraft({});
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/admin")} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <span className="font-display text-base font-light text-foreground">Preferred Vendors</span>
          <div className="w-32" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8 animate-fade-up">
          <div>
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Coordinator List</p>
            <h1 className="font-display text-4xl font-light text-foreground mb-1">Preferred Vendors</h1>
            {lastUpdated && (
              <p className="font-body text-xs text-muted-foreground">Last updated {lastUpdated}</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>
        ) : (
          <div className="space-y-8">
            {PREFERRED_CATEGORIES.map(cat => {
              const list = vendors.filter(v => v.category === cat.key);
              return (
                <section key={cat.key}>
                  <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                    <h2 className="font-display text-lg font-light text-foreground">{cat.label}</h2>
                    <button onClick={() => startAdd(cat.key)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 font-body text-xs">
                      <Plus size={12} /> Add Vendor
                    </button>
                  </div>

                  {addingTo === cat.key && (
                    <AddInline
                      categoryKey={cat.key}
                      draft={draft}
                      setDraft={setDraft}
                      onCancel={() => { setAddingTo(null); setDraft({}); }}
                      onSave={saveAdd}
                    />
                  )}

                  {list.length === 0 && addingTo !== cat.key ? (
                    <p className="font-body text-sm italic text-muted-foreground py-2">No vendors in this category yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {list.map(v => (
                        <PreferredVendorCard key={v.id} vendor={v} onUpdate={updateVendor} onDelete={deleteVendor} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            {/* Vendors with unknown/legacy categories */}
            {(() => {
              const knownKeys = new Set(PREFERRED_CATEGORIES.map(c => c.key));
              const others = vendors.filter(v => !knownKeys.has(v.category));
              if (others.length === 0) return null;
              return (
                <section>
                  <h2 className="font-display text-lg font-light text-foreground border-b border-border pb-2 mb-3">Other</h2>
                  <div className="space-y-2">
                    {others.map(v => (
                      <PreferredVendorCard key={v.id} vendor={v} onUpdate={updateVendor} onDelete={deleteVendor} />
                    ))}
                  </div>
                </section>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}

function AddInline({ categoryKey, draft, setDraft, onCancel, onSave }: {
  categoryKey: string;
  draft: Partial<PreferredVendor>;
  setDraft: (d: Partial<PreferredVendor>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const def = getCategoryDef(categoryKey);
  const inputCls = "w-full border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background focus:outline-none focus:border-primary/50";
  return (
    <div className="rounded-xl border border-sage/40 bg-card p-4 space-y-3 mb-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Lbl label="Name *">
          <input autoFocus value={draft.name || ""} onChange={e => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
        </Lbl>
        {def.subcategories && (
          <Lbl label="Subcategory">
            <select value={draft.subcategory || ""} onChange={e => setDraft({ ...draft, subcategory: e.target.value || null })} className={inputCls}>
              <option value="">—</option>
              {def.subcategories.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Lbl>
        )}
        <Lbl label="Tier">
          <select value={draft.tier || ""} onChange={e => setDraft({ ...draft, tier: e.target.value || null })} className={inputCls}>
            <option value="">—</option>
            <option value="$">$</option>
            <option value="$$">$$</option>
            <option value="$$$">$$$</option>
          </select>
        </Lbl>
        <Lbl label="Contact name">
          <input value={draft.contact_name || ""} onChange={e => setDraft({ ...draft, contact_name: e.target.value })} className={inputCls} />
        </Lbl>
        <Lbl label="Phone">
          <input value={draft.phone || ""} onChange={e => setDraft({ ...draft, phone: e.target.value })} className={inputCls} />
        </Lbl>
        <Lbl label="Email">
          <input value={draft.email || ""} onChange={e => setDraft({ ...draft, email: e.target.value })} className={inputCls} />
        </Lbl>
        <Lbl label="Website">
          <input value={draft.website || ""} onChange={e => setDraft({ ...draft, website: e.target.value })} placeholder="https://…" className={inputCls} />
        </Lbl>
        <Lbl label="Instagram">
          <input value={draft.instagram || ""} onChange={e => setDraft({ ...draft, instagram: e.target.value })} placeholder="@handle" className={inputCls} />
        </Lbl>
      </div>
      <Lbl label="Notes">
        <textarea value={draft.notes || ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={2}
          className="w-full border border-border rounded-md px-2.5 py-1.5 font-body text-xs bg-background focus:outline-none focus:border-primary/50 resize-none" />
      </Lbl>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={!!draft.family_favorite} onChange={e => setDraft({ ...draft, family_favorite: e.target.checked })} />
        <span className="font-body text-xs text-foreground">⭐ Family Favorite</span>
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-2.5 py-1 rounded-md border border-border font-body text-xs text-muted-foreground hover:text-foreground">Cancel</button>
        <button onClick={onSave} disabled={!draft.name?.trim()}
          className="px-2.5 py-1 rounded-md bg-sage text-white font-body text-xs hover:opacity-90 disabled:opacity-50">
          Add
        </button>
      </div>
    </div>
  );
}

function Lbl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  );
}
