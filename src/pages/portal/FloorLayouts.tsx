import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Map as MapIcon, FileText, Image as ImageIcon, ExternalLink, Loader2, Armchair, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ── Floor Layouts ────────────────────────────────────
   Two sources, nothing new to maintain:
   1. gfh_resources rows in the "Venue Maps" category
      (the same files Documents shows under "From GFH").
   2. layout_library: Chandelier Barn table layouts by
      guest count, shown once a layout has an image.
   ─────────────────────────────────────────────────── */

const MAP_CATEGORY = "Venue Maps";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  file_url: string | null;
  file_name: string | null;
}

interface TableLayout {
  id: string;
  label: string;
  guest_count_min: number;
  guest_count_max: number;
  image_url: string | null;
  table_config_description: string | null;
}

/* Group titles by what the map is of, so the page reads top-down: whole property, event spaces, lodging. */
const GROUPS: { key: string; title: string; blurb: string; match: (r: Resource) => boolean }[] = [
  { key: "property", title: "The estate", blurb: "The whole property at a glance.", match: (r) => /property/i.test(r.title) },
  { key: "event", title: "Event spaces", blurb: "Measured drawings of the barns, courtyard, and ceremony stage.", match: (r) => /barn|parlor|building|courtyard|ceremony|stage/i.test(r.title) },
  { key: "lodging", title: "Lodging", blurb: "Room maps for the houses your guests stay in.", match: (r) => /room map|farmhouse|grove|victoria|hearth/i.test(r.title) },
];

const isImage = (name: string | null | undefined) => /\.(jpe?g|png|webp|gif)$/i.test(name ?? "");

function ResourceCard({ r }: { r: Resource }) {
  const img = isImage(r.file_name) || isImage(r.file_url);
  return (
    <a
      href={r.file_url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-xl bg-card border border-border shadow-soft overflow-hidden hover:border-sage/40 hover:shadow-md transition-all flex flex-col"
    >
      {img && r.file_url ? (
        <div className="aspect-[4/3] bg-muted overflow-hidden">
          <img src={r.file_url} alt={r.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        </div>
      ) : (
        <div className="aspect-[4/3] bg-sage/5 flex items-center justify-center">
          <FileText size={28} className="text-sage/60" strokeWidth={1.25} />
        </div>
      )}
      <div className="p-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-medium text-foreground leading-snug">{r.title}</p>
          {r.description && <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
        </div>
        <ExternalLink size={14} className="text-muted-foreground group-hover:text-sage transition-colors shrink-0 mt-0.5" />
      </div>
    </a>
  );
}

export default function FloorLayouts() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [layouts, setLayouts] = useState<TableLayout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [res, lay] = await Promise.all([
        supabase
          .from("gfh_resources")
          .select("id, title, description, category, file_url, file_name")
          .eq("visible", true)
          .eq("category", MAP_CATEGORY)
          .order("sort_order", { ascending: true }),
        (supabase as any)
          .from("layout_library")
          .select("id, label, guest_count_min, guest_count_max, image_url, table_config_description")
          .eq("is_active", true)
          .not("image_url", "is", null)
          .order("sort_order", { ascending: true }),
      ]);
      setResources((res.data as Resource[]) ?? []);
      setLayouts((lay.data as TableLayout[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const used = new Set<string>();
    const out = GROUPS.map(g => {
      const items = resources.filter(r => !used.has(r.id) && g.match(r));
      items.forEach(r => used.add(r.id));
      return { ...g, items };
    }).filter(g => g.items.length > 0);
    const rest = resources.filter(r => !used.has(r.id));
    if (rest.length > 0) out.push({ key: "other", title: "More maps", blurb: "", match: () => true, items: rest });
    return out;
  }, [resources]);

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <MapIcon size={16} className="text-sage" strokeWidth={1.75} />
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Maps and measurements</p>
          </div>
          <h1 className="font-display text-4xl font-light text-foreground mb-4">Floor Layouts</h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed max-w-2xl">
            Every drawing your planner, florist, or band will ask for, in one place. Each one opens in a new tab so you can send it along.
          </p>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-sage" /></div>
        ) : resources.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="font-body text-sm text-muted-foreground">No maps have been shared yet. Check back soon, or ask in Messages.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(g => (
              <section key={g.key}>
                <h2 className="font-display text-xl font-light text-foreground mb-1">{g.title}</h2>
                {g.blurb && <p className="font-body text-sm text-muted-foreground mb-4">{g.blurb}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {g.items.map(r => <ResourceCard key={r.id} r={r} />)}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Reception table layouts */}
        <section className="mt-12">
          <div className="flex items-center gap-2 mb-1">
            <Armchair size={16} className="text-sage" strokeWidth={1.75} />
            <h2 className="font-display text-xl font-light text-foreground">Reception table layouts</h2>
          </div>
          <p className="font-body text-sm text-muted-foreground mb-4 max-w-2xl">
            The Chandelier Barn has a proven layout for every guest count. Yours is chosen with you once your headcount settles, and it lives in{" "}
            <Link to="/portal/seating" className="inline-flex items-center gap-1 text-foreground hover:text-sage transition-colors">Seating <ArrowRight size={12} /></Link>.
          </p>
          {layouts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {layouts.map(l => (
                <div key={l.id} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    <img src={l.image_url!} alt={l.label} loading="lazy" className="w-full h-full object-contain" />
                  </div>
                  <div className="p-4">
                    <p className="font-body text-sm font-medium text-foreground">{l.label}</p>
                    <p className="font-body text-xs text-muted-foreground mt-0.5">{l.guest_count_min}–{l.guest_count_max} guests{l.table_config_description ? ` · ${l.table_config_description}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-5 flex items-center gap-3">
              <ImageIcon size={18} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
              <p className="font-body text-sm text-muted-foreground">Layout drawings by guest count are being added. Until then, ask your Weekend Event Coordinator for the one that fits your headcount.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
