import { useEffect, useState } from "react";
import { X, Star, Instagram, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { preferredKeysForEventCategory, getCategoryDef } from "@/lib/preferredVendorConfig";
import { PreferredVendor } from "@/components/admin/PreferredVendorCard";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The per-event vendor category we're filling (e.g. "photographer") */
  eventCategory: string;
  /**
   * Called when the admin clicks "Add to Event" on a preferred vendor.
   * Receives the preferred vendor — caller copies fields into the slot.
   */
  onAdd: (preferred: PreferredVendor) => Promise<void>;
}

export function BrowsePreferredDrawer({ open, onClose, eventCategory, onAdd }: Props) {
  const [vendors, setVendors] = useState<PreferredVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const keys = preferredKeysForEventCategory(eventCategory);
    if (keys.length === 0) { setVendors([]); setLoading(false); return; }
    supabase
      .from("preferred_vendors")
      .select("*")
      .in("category", keys)
      .eq("active", true)
      .order("family_favorite", { ascending: false })
      .order("name", { ascending: true })
      .then(({ data }) => {
        setVendors((data || []) as PreferredVendor[]);
        setLoading(false);
      });
  }, [open, eventCategory]);

  if (!open) return null;

  const friendly = getCategoryDef(eventCategory).label;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />
      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[400px] bg-cream border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-label="Browse preferred vendors"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Preferred</p>
            <h2 className="font-display text-lg font-light text-foreground">{friendly}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 flex justify-center"><div className="w-5 h-5 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>
          ) : vendors.length === 0 ? (
            <p className="font-body text-sm italic text-muted-foreground text-center py-12">No preferred vendors in this category yet.</p>
          ) : (
            vendors.map(v => (
              <div key={v.id} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <p className="font-body text-sm font-medium text-foreground truncate">{v.name}</p>
                    {v.tier && <span className="rounded-full bg-muted px-1.5 py-0.5 font-body text-[10px] text-muted-foreground">{v.tier}</span>}
                    {v.family_favorite && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 border border-gold/30 px-1.5 py-0.5 font-body text-[10px]">
                        <Star size={9} className="fill-gold text-gold" />
                      </span>
                    )}
                  </div>
                </div>
                {v.subcategory && (
                  <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{v.subcategory}</p>
                )}
                <div className="flex items-center gap-3 text-muted-foreground mb-1.5">
                  {v.instagram && (
                    <a href={`https://instagram.com/${v.instagram.replace("@","")}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-foreground"><Instagram size={10} /><span className="font-body text-[10px]">@{v.instagram.replace("@","")}</span></a>
                  )}
                  {v.website && (
                    <a href={v.website.startsWith("http") ? v.website : `https://${v.website}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-foreground"><Globe size={10} /><span className="font-body text-[10px]">Website</span></a>
                  )}
                </div>
                {v.notes && <p className="font-body text-xs italic text-muted-foreground mb-2">{v.notes}</p>}
                <button
                  disabled={addingId === v.id}
                  onClick={async () => {
                    setAddingId(v.id);
                    await onAdd(v);
                    setAddingId(null);
                    onClose();
                  }}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-md bg-sage text-white font-body text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {addingId === v.id ? "Adding…" : "Add to Event"}
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
