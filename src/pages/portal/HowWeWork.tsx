import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  BookOpen, Users, UtensilsCrossed, Leaf, CalendarCheck, BedDouble, Palette, Briefcase,
  Truck, CalendarDays, MessageSquare, Sparkles, HelpCircle, MessageCircleQuestion, Receipt,
  ArrowRight, ArrowLeft, Check,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  HOW_WE_WORK_SECTIONS, HOW_WE_WORK_INTRO, HOW_WE_WORK_CLOSING, RATES,
  type Block, type ListItem,
} from "@/content/howWeWork";

/* ── Inline text: anything in [square brackets] is a placeholder to fill ── */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\[[^\]]+\]$/.test(part)
          ? <mark key={i} className="bg-gold/40 text-foreground rounded px-1 font-medium">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

function Item({ item }: { item: ListItem }) {
  return (
    <li className="font-body text-sm text-muted-foreground leading-relaxed">
      {item.lead && <span className="text-foreground font-medium"><Inline text={item.lead} />{item.text ? " " : ""}</span>}
      {item.text && <Inline text={item.text} />}
    </li>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return (
        <p className={`font-body text-sm leading-relaxed max-w-2xl ${block.italic ? "italic text-muted-foreground" : "text-muted-foreground"}`}>
          {block.lead && <span className="text-foreground font-medium"><Inline text={block.lead} /> </span>}
          <Inline text={block.text} />
        </p>
      );
    case "heading":
      return <h3 className="font-body text-xs tracking-widest uppercase text-foreground pt-2">{block.text}</h3>;
    case "ul":
      return <ul className="list-disc pl-5 space-y-2 max-w-2xl">{block.items.map((it, i) => <Item key={i} item={it} />)}</ul>;
    case "ol":
      return <ol className="list-decimal pl-5 space-y-2 max-w-2xl">{block.items.map((it, i) => <Item key={i} item={it} />)}</ol>;
    case "quote":
      return (
        <blockquote className="border-l-2 border-sage/60 pl-4 font-display text-lg font-light text-foreground leading-snug max-w-2xl">
          <Inline text={block.text} />
        </blockquote>
      );
    case "note":
      return <p className="font-body text-sm italic text-muted-foreground max-w-2xl"><Inline text={block.text} /></p>;
    case "cards":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {block.cards.map((card) => (
            <div key={card.title} className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-display text-lg font-light text-foreground mb-3">{card.title}</h3>
              <ul className="list-disc pl-5 space-y-2">
                {card.items.map((t, i) => <li key={i} className="font-body text-sm text-muted-foreground leading-relaxed"><Inline text={t} /></li>)}
              </ul>
            </div>
          ))}
        </div>
      );
    case "table":
      return <EditorialTable columns={block.columns} rows={block.rows} pillColumn={block.pillColumn} />;
    case "rates":
      return <EditorialTable columns={["Item", "Rate", "Applies when"]} rows={RATES.map(r => [r.item, r.rate, r.when])} />;
  }
}

function EditorialTable({ columns, rows, pillColumn }: { columns: string[]; rows: string[][]; pillColumn?: number }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-left border-collapse min-w-[560px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="font-body text-[11px] tracking-widest uppercase text-muted-foreground font-medium pb-2 pr-4 border-b border-border align-bottom">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border last:border-b-0 align-top">
              {row.map((cell, ci) => (
                <td key={ci} className={`py-3 pr-4 font-body text-sm leading-relaxed ${ci === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                  {pillColumn === ci
                    ? <span className="inline-block whitespace-nowrap rounded-full bg-sage/10 border border-sage/20 text-sage text-xs font-medium px-2.5 py-0.5">{cell}</span>
                    : <Inline text={cell} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Tiles: one section at a time ─────────────── */

const ICONS: Record<string, React.ElementType> = {
  "our-roles": Users,
  "food-beverage": UtensilsCrossed,
  "dietary-needs": Leaf,
  "weekend-coordination": CalendarCheck,
  "resort-coordination": BedDouble,
  "design": Palette,
  "vendors": Briefcase,
  "load-in-hours": Truck,
  "two-dates": CalendarDays,
  "one-voice": MessageSquare,
  "what-to-expect": Sparkles,
  "who-to-ask": HelpCircle,
  "common-questions": MessageCircleQuestion,
  "rates": Receipt,
};

export function HowWeWorkTiles() {
  const location = useLocation();
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  // Landing on #slug (from an old link or a redirect) opens that section.
  useEffect(() => {
    const slug = location.hash.replace(/^#/, "");
    if (slug && HOW_WE_WORK_SECTIONS.some(s => s.slug === slug)) setOpenSlug(slug);
  }, [location.hash]);

  const open = (slug: string) => {
    setOpenSlug(slug);
    if (history.replaceState) history.replaceState(null, "", `#${slug}`);
  };
  const close = () => {
    setOpenSlug(null);
    if (history.replaceState) history.replaceState(null, "", location.pathname);
  };

  const idx = HOW_WE_WORK_SECTIONS.findIndex(s => s.slug === openSlug);
  const section = idx >= 0 ? HOW_WE_WORK_SECTIONS[idx] : null;
  const prev = idx > 0 ? HOW_WE_WORK_SECTIONS[idx - 1] : null;
  const next = idx >= 0 && idx < HOW_WE_WORK_SECTIONS.length - 1 ? HOW_WE_WORK_SECTIONS[idx + 1] : null;
  const Icon = section ? (ICONS[section.slug] ?? BookOpen) : BookOpen;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {HOW_WE_WORK_SECTIONS.map((s, i) => {
          const TileIcon = ICONS[s.slug] ?? BookOpen;
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => open(s.slug)}
              className="group text-left rounded-xl border border-border bg-card p-4 hover:border-sage/50 hover:shadow-card transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center">
                  <TileIcon size={16} className="text-sage" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-[10px] tracking-widest text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="font-display text-lg font-light text-foreground leading-tight">{s.title}</h3>
                    <ArrowRight size={13} className="ml-auto text-muted-foreground group-hover:text-sage group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">{s.blurb}</p>
                  {s.facts && s.facts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {s.facts.map((f) => (
                        <span key={f} className="font-body text-[11px] rounded-full bg-muted px-2 py-0.5 text-foreground whitespace-nowrap">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Sheet open={!!section} onOpenChange={(o) => { if (!o) close(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          {section && (
            <div className="px-6 py-6 sm:px-8 sm:py-8">
              <SheetHeader className="text-left space-y-2 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center">
                    <Icon size={15} className="text-sage" strokeWidth={1.75} />
                  </div>
                  <span className="font-body text-[11px] tracking-widest uppercase text-muted-foreground">
                    How we work · {idx + 1} of {HOW_WE_WORK_SECTIONS.length}
                  </span>
                  {section.draft && (
                    <span className="font-body text-[10px] tracking-widest uppercase rounded-full bg-gold/30 text-foreground px-2 py-0.5">Drafted for review</span>
                  )}
                </div>
                <SheetTitle className="font-display text-3xl font-light text-foreground">{section.title}</SheetTitle>
                <SheetDescription className="font-body text-sm text-muted-foreground">{section.blurb}</SheetDescription>
              </SheetHeader>

              {/* Key points: the section in a glance */}
              <div className="rounded-xl bg-sage/10 border border-sage/20 p-4 mb-6">
                <p className="font-body text-[11px] tracking-widest uppercase text-sage mb-2">Key points</p>
                <ul className="space-y-2">
                  {section.keyPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 font-body text-sm text-foreground leading-relaxed">
                      <Check size={15} className="text-sage mt-0.5 shrink-0" strokeWidth={2} />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
                {section.facts && section.facts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {section.facts.map((f) => (
                      <span key={f} className="font-body text-[11px] rounded-full bg-background border border-border px-2 py-0.5 text-foreground">{f}</span>
                    ))}
                  </div>
                )}
              </div>

              <p className="font-body text-[11px] tracking-widest uppercase text-muted-foreground mb-3">The full text</p>
              <div className="space-y-4">
                {section.blocks.map((b, i) => <BlockView key={i} block={b} />)}
              </div>

              {/* Previous / next */}
              <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-border">
                {prev ? (
                  <button type="button" onClick={() => open(prev.slug)} className="inline-flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft size={14} /> {prev.title}
                  </button>
                ) : <span />}
                {next ? (
                  <button type="button" onClick={() => open(next.slug)} className="inline-flex items-center gap-1.5 font-body text-sm text-foreground hover:text-sage transition-colors">
                    {next.title} <ArrowRight size={14} />
                  </button>
                ) : (
                  <button type="button" onClick={close} className="font-body text-sm text-foreground hover:text-sage transition-colors">Done</button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <p className="font-body text-sm italic text-muted-foreground text-center pt-6">{HOW_WE_WORK_CLOSING}</p>
    </>
  );
}

/* ── Standalone page (the portal route redirects to Start Here) ── */

export default function HowWeWork() {
  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-sage" strokeWidth={1.75} />
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Service expectations</p>
          </div>
          <h1 className="font-display text-4xl font-light text-foreground mb-4">How We Work</h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed max-w-2xl">{HOW_WE_WORK_INTRO}</p>
        </div>
        <HowWeWorkTiles />
      </div>
    </div>
  );
}

/** Old link target. Sends couples to Start Here, keeping any #section. */
export function HowWeWorkRedirect() {
  const location = useLocation();
  const hash = location.hash || "#how-we-work";
  return <Navigate to={{ pathname: "../start", hash }} replace relative="path" />;
}
