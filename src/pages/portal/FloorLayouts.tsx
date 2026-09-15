import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Map as MapIcon, ExternalLink, FileText, Loader2, Armchair, ArrowRight, Tent, Ruler, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ── Floor Layouts & Tent Options ─────────────────────
   The drawings live in Canva so the team edits them in
   one place and the portal always shows the current
   version. Each design is embedded in the page; the
   "Open in Canva" button gives the full-screen viewer
   with download. Change a link here, nowhere else.
   ─────────────────────────────────────────────────── */

interface CanvaDeck {
  key: string;
  title: string;
  blurb: string;
  icon: React.ElementType;
  /** Canva design id + share token from the view link. */
  designPath: string;
  /** Page aspect ratio, so the viewer fits without letterboxing. */
  aspect: "4/3" | "16/9";
  pages: number;
}

const DECKS: CanvaDeck[] = [
  {
    key: "measurements",
    title: "Floor Layouts",
    blurb: "Measured drawings of every space: the barns, the courtyard, the ceremony stage, and the houses. Send a page to your planner, florist, or band.",
    icon: Ruler,
    designPath: "DAHKUC7yGoM/WYEqcgIvIfS0UvC8GWKP-g",
    aspect: "4/3",
    pages: 13,
  },
  {
    key: "tents",
    title: "Tent Options",
    blurb: "What can be tented, where it sits, and the clearances that matter. The high peak tent is the only option that covers the Hilltop ceremony stage.",
    icon: Tent,
    designPath: "DAHRisMondQ/wnlQCfl7nQ0p3ildxq7zJw",
    aspect: "16/9",
    pages: 5,
  },
];

const embedUrl = (d: CanvaDeck) => `https://www.canva.com/design/${d.designPath}/view?embed`;
const openUrl = (d: CanvaDeck) => `https://www.canva.com/design/${d.designPath}/view`;

interface Resource { id: string; title: string; description: string | null; file_url: string | null }

function DeckViewer({ deck }: { deck: CanvaDeck }) {
  const [loaded, setLoaded] = useState(false);
  const Icon = deck.icon;
  return (
    <section id={deck.key} className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center shrink-0">
              <Icon size={15} className="text-sage" strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-2xl font-light text-foreground">{deck.title}</h2>
            <span className="font-body text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{deck.pages} pages</span>
          </div>
          <p className="font-body text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">{deck.blurb}</p>
        </div>
        <a
          href={openUrl(deck)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-body text-sm text-foreground hover:border-sage/50 hover:text-sage transition-colors shrink-0"
        >
          Open full screen <ExternalLink size={13} />
        </a>
      </div>

      <div
        className="relative w-full rounded-xl border border-border bg-card shadow-soft overflow-hidden"
        style={{ aspectRatio: deck.aspect === "4/3" ? "4 / 3" : "16 / 9" }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-sage/5">
            <Loader2 size={20} className="animate-spin text-sage" />
          </div>
        )}
        <iframe
          src={embedUrl(deck)}
          title={deck.title}
          loading="lazy"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
      <p className="font-body text-xs text-muted-foreground mt-2">Use the arrows inside the viewer to move between pages. Full screen gives you download and print.</p>
    </section>
  );
}

export default function FloorLayouts() {
  const [pdfs, setPdfs] = useState<Resource[]>([]);
  const [showPdfs, setShowPdfs] = useState(false);

  useEffect(() => {
    supabase
      .from("gfh_resources")
      .select("id, title, description, file_url")
      .eq("visible", true)
      .eq("category", "Venue Maps")
      .order("sort_order", { ascending: true })
      .then(({ data }) => { if (data) setPdfs(data as Resource[]); });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <MapIcon size={16} className="text-sage" strokeWidth={1.75} />
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Maps, measurements, and cover</p>
          </div>
          <h1 className="font-display text-4xl font-light text-foreground mb-4">Floor Layouts & Tent Options</h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed max-w-2xl">
            Every drawing your planner, florist, or band will ask for. These are the live versions, so what you see here is always current.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {DECKS.map(d => (
              <a key={d.key} href={`#${d.key}`} className="font-body text-sm rounded-full border border-border bg-card px-3 py-1 text-foreground hover:border-sage/50 hover:text-sage transition-colors">
                {d.title}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-12">
          {DECKS.map(d => <DeckViewer key={d.key} deck={d} />)}
        </div>

        {/* Reception table layouts */}
        <section className="mt-12">
          <div className="flex items-center gap-2 mb-1">
            <Armchair size={16} className="text-sage" strokeWidth={1.75} />
            <h2 className="font-display text-xl font-light text-foreground">Reception table layout</h2>
          </div>
          <p className="font-body text-sm text-muted-foreground max-w-2xl">
            The Chandelier Barn has a proven table layout for every guest count. Yours is chosen with you once your headcount settles, and it lives in{" "}
            <Link to="/portal/seating" className="inline-flex items-center gap-1 text-foreground hover:text-sage transition-colors">Seating <ArrowRight size={12} /></Link>.
          </p>
        </section>

        {/* Individual PDFs, tucked away */}
        {pdfs.length > 0 && (
          <section className="mt-10">
            <button
              type="button"
              onClick={() => setShowPdfs(o => !o)}
              aria-expanded={showPdfs}
              className="inline-flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText size={14} /> Individual drawings as PDF ({pdfs.length})
              <ChevronDown size={14} className={`transition-transform ${showPdfs ? "rotate-180" : ""}`} />
            </button>
            {showPdfs && (
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pdfs.map(r => (
                  <li key={r.id}>
                    <a href={r.file_url || "#"} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 hover:border-sage/40 transition-colors">
                      <FileText size={14} className="text-sage shrink-0" />
                      <span className="font-body text-sm text-foreground truncate flex-1">{r.title}</span>
                      <ExternalLink size={12} className="text-muted-foreground group-hover:text-sage shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
