import { useEffect, useState } from "react";
import { Star, Instagram, Globe, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PREFERRED_CATEGORIES, getCategoryDef } from "@/lib/preferredVendorConfig";
import { PreferredVendor } from "@/components/admin/PreferredVendorCard";

interface Props {
  eventId: string;
  /** Called after a vendor is added so the parent can refresh its list */
  onVendorAdded?: () => void;
}

interface ExistingSlot {
  id: string;
  category: string;
  business_name: string | null;
}

export function VendorsWeLoveSection({ eventId, onVendorAdded }: Props) {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<PreferredVendor[]>([]);
  const [existing, setExisting] = useState<ExistingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ pv: PreferredVendor; targetCategory: string; existingSlotId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, [eventId]);

  const load = async () => {
    const [pvRes, evRes] = await Promise.all([
      supabase.from("preferred_vendors").select("*").eq("active", true)
        .order("family_favorite", { ascending: false })
        .order("name", { ascending: true }),
      supabase.from("vendors").select("id, category, business_name").eq("event_id", eventId),
    ]);
    setVendors((pvRes.data || []) as PreferredVendor[]);
    setExisting((evRes.data || []) as ExistingSlot[]);
    setLoading(false);
  };

  const handleAddClick = (pv: PreferredVendor) => {
    const def = getCategoryDef(pv.category);
    const targetCategory = def.eventCategories[0];
    // Find an empty slot in this category, or the first filled one
    const emptySlot = existing.find(e => e.category === targetCategory && !e.business_name);
    const filledSlot = existing.find(e => e.category === targetCategory && e.business_name);

    if (emptySlot) {
      // Just fill it — no prompt needed
      void copyToSlot(pv, emptySlot.id);
      return;
    }
    if (filledSlot) {
      // Ask the couple
      setPending({ pv, targetCategory, existingSlotId: filledSlot.id });
      return;
    }
    // No slot of this category at all — insert as new
    void insertNew(pv, targetCategory);
  };

  const copyToSlot = async (pv: PreferredVendor, slotId: string) => {
    setBusy(true);
    const fields = {
      business_name: pv.name,
      contact_name: pv.contact_name,
      phone: pv.phone,
      email: pv.email,
      instagram: pv.instagram,
      brandon_notes: pv.notes,
    };
    const { error } = await supabase.from("vendors").update(fields).eq("id", slotId);
    setBusy(false);
    if (error) { toast({ title: "Couldn't add vendor", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Added to your team", description: pv.name });
    await load();
    onVendorAdded?.();
  };

  const insertNew = async (pv: PreferredVendor, category: string) => {
    setBusy(true);
    const { error } = await supabase.from("vendors").insert({
      event_id: eventId,
      category,
      business_name: pv.name,
      contact_name: pv.contact_name,
      phone: pv.phone,
      email: pv.email,
      instagram: pv.instagram,
      brandon_notes: pv.notes,
      status: "pending",
    });
    setBusy(false);
    if (error) { toast({ title: "Couldn't add vendor", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Added to your team", description: pv.name });
    await load();
    onVendorAdded?.();
  };

  if (loading) return null;
  if (vendors.length === 0) return null;

  return (
    <section className="mt-16 pt-10 border-t border-border">
      <div className="mb-8">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Recommended by Gilbertsville Farmhouse</p>
        <h2 className="font-display text-3xl font-light text-foreground">Vendors We Love</h2>
        <p className="font-body text-sm text-muted-foreground mt-2 max-w-2xl">
          Trusted partners who know our property well. Tap "Add to My Team" on anyone you'd like to bring on board.
        </p>
      </div>

      <div className="space-y-8">
        {PREFERRED_CATEGORIES.map(cat => {
          const list = vendors.filter(v => v.category === cat.key);
          if (list.length === 0) return null;
          return (
            <div key={cat.key}>
              <p className="font-display text-sm font-light text-foreground border-b border-border pb-1.5 mb-2.5">{cat.label}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {list.map(v => (
                  <div key={v.id} className="rounded-xl border border-border bg-card p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
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

                    {pending?.pv.id === v.id ? (
                      <div className="mt-2 p-2.5 rounded-lg bg-cream border border-sage/30 space-y-2">
                        <p className="font-body text-xs text-foreground">
                          You already have a {getCategoryDef(pending.targetCategory).label.toLowerCase()} on your team. What would you like to do?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button disabled={busy} onClick={() => copyToSlot(pending.pv, pending.existingSlotId)}
                            className="px-2.5 py-1 rounded-md bg-sage text-white font-body text-xs hover:opacity-90 disabled:opacity-50">
                            Replace
                          </button>
                          <button disabled={busy} onClick={() => insertNew(pending.pv, pending.targetCategory)}
                            className="px-2.5 py-1 rounded-md border border-sage text-sage font-body text-xs hover:bg-sage/10 disabled:opacity-50">
                            Add as additional
                          </button>
                          <button disabled={busy} onClick={() => setPending(null)}
                            className="px-2.5 py-1 rounded-md border border-border text-muted-foreground font-body text-xs hover:text-foreground">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => handleAddClick(v)} disabled={busy}
                        className="flex items-center gap-1 mt-1 px-2.5 py-1.5 rounded-md border border-sage/40 text-sage font-body text-xs hover:bg-sage/10 disabled:opacity-50 transition-colors">
                        <Plus size={11} /> Add to My Team
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
