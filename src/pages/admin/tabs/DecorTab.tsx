import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon, ExternalLink } from "lucide-react";
import { getCategoryLabel } from "@/lib/decorCategories";

interface SelectionRow {
  id: string;
  quantity: number;
  unit_price: number;
  catalog_item_id: string | null;
}

interface CatalogRow {
  id: string;
  title: string;
  category: string;
  photo_url: string | null;
  price_label: string | null;
}

function currency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function DecorTab({ eventId }: { eventId: string; onNavigateNext?: () => void }) {
  const [selections, setSelections] = useState<SelectionRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [decorNotes, setDecorNotes] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("decor_selections").select("id, quantity, unit_price, catalog_item_id").eq("event_id", eventId),
      supabase.from("decor_catalog").select("id, title, category, photo_url, price_label"),
      supabase.from("events").select("decor_notes").eq("id", eventId).maybeSingle(),
    ]).then(([{ data: sData }, { data: cData }, { data: eData }]) => {
      if (sData) setSelections(sData as SelectionRow[]);
      if (cData) setCatalog(cData as CatalogRow[]);
      if (eData) setDecorNotes(((eData as any).decor_notes as string) ?? "");
      setLoading(false);
    });
  }, [eventId]);

  const total = useMemo(
    () => selections.reduce((s, x) => s + x.quantity * Number(x.unit_price), 0),
    [selections]
  );

  if (loading) {
    return <div className="py-12 flex justify-center"><div className="w-6 h-6 rounded-full border-2 border-sage/30 border-t-sage animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-1">Décor</p>
          <p className="font-display text-2xl font-light text-foreground">Couple's Selections</p>
        </div>
        <Link
          to="/admin/decor-catalog"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-sage/30 bg-sage/5 text-sage font-body text-xs hover:bg-sage/10 transition-colors"
        >
          <ExternalLink size={12} /> Browse Catalog
        </Link>
      </div>

      <div className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/20">
          <p className="font-body text-sm text-foreground">{selections.length} item{selections.length === 1 ? "" : "s"} selected</p>
          <p className="font-display text-xl font-light text-foreground tabular-nums">{currency(total)}</p>
        </div>
        {selections.length === 0 ? (
          <div className="p-8 text-center">
            <ImageIcon size={24} className="text-muted-foreground mx-auto mb-2" />
            <p className="font-body text-sm text-muted-foreground">No décor items selected yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {selections.map(sel => {
              const item = catalog.find(c => c.id === sel.catalog_item_id);
              const lineTotal = sel.quantity * Number(sel.unit_price);
              return (
                <div key={sel.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-md bg-muted overflow-hidden shrink-0">
                    {item?.photo_url ? (
                      <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-muted-foreground/40" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-foreground truncate">{item?.title ?? "Item"}</p>
                    <p className="font-body text-xs text-muted-foreground">
                      {getCategoryLabel(item?.category)} · Qty {sel.quantity} × {currency(Number(sel.unit_price))}
                    </p>
                  </div>
                  <p className="font-body text-sm tabular-nums text-foreground">{currency(lineTotal)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {decorNotes && (
        <div className="rounded-xl bg-cream/40 border border-sage/20 p-4">
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5">Notes from couple</p>
          <p className="font-body text-sm text-foreground whitespace-pre-wrap">{decorNotes}</p>
        </div>
      )}
    </div>
  );
}
