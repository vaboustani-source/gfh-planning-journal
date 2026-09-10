import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { BookOpen } from "lucide-react";
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

/* ── Sections (embeddable) ─────────────────────── */

export function HowWeWorkSections({ embedded = false }: { embedded?: boolean }) {
  const location = useLocation();
  const [active, setActive] = useState<string>(HOW_WE_WORK_SECTIONS[0].slug);
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const jumpTo = (slug: string) => {
    const el = document.getElementById(slug);
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    if (history.replaceState) history.replaceState(null, "", `#${slug}`);
  };

  // Landing on #slug scrolls to that section once the page has rendered.
  useEffect(() => {
    const slug = location.hash.replace(/^#/, "");
    if (!slug || !HOW_WE_WORK_SECTIONS.some(s => s.slug === slug)) return;
    const t = window.setTimeout(() => jumpTo(slug), 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash]);

  // Highlight the section in view on the jump bar.
  useEffect(() => {
    if (embedded) return;
    const els = HOW_WE_WORK_SECTIONS.map(s => document.getElementById(s.slug)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-30% 0px -60% 0px", threshold: 0 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [embedded]);

  return (
    <>
      {!embedded && (
        <nav aria-label="Sections" className="sticky top-0 z-10 -mx-5 px-5 lg:-mx-8 lg:px-8 py-3 mb-8 bg-background/95 backdrop-blur border-b border-border print:hidden">
          <div className="hidden md:flex flex-wrap gap-x-5 gap-y-1">
            {HOW_WE_WORK_SECTIONS.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => jumpTo(s.slug)}
                className={`font-body text-[11px] tracking-widest uppercase py-1 border-b transition-colors ${
                  active === s.slug ? "text-foreground border-gold" : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
          <select
            aria-label="Jump to a section"
            className="md:hidden w-full px-3 py-2 rounded-md border border-input bg-background font-body text-sm"
            value={active}
            onChange={(e) => { setActive(e.target.value); jumpTo(e.target.value); }}
          >
            {HOW_WE_WORK_SECTIONS.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}
          </select>
        </nav>
      )}

      <div className="space-y-16">
        {HOW_WE_WORK_SECTIONS.map((s, idx) => (
          <section key={s.slug} id={s.slug} className="scroll-mt-24">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-body text-[11px] tracking-widest uppercase text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
              <h2 className="font-display text-2xl font-light text-foreground">{s.title}</h2>
              {s.draft && (
                <span className="font-body text-[10px] tracking-widest uppercase rounded-full bg-gold/30 text-foreground px-2 py-0.5">Drafted for review</span>
              )}
            </div>
            <p className="font-body text-sm text-muted-foreground mb-5">{s.blurb}</p>
            <div className="space-y-4">
              {s.blocks.map((b, i) => <BlockView key={i} block={b} />)}
            </div>
          </section>
        ))}
      </div>

      <div className="text-center pt-16">
        <p className="font-body text-sm italic text-muted-foreground leading-relaxed">{HOW_WE_WORK_CLOSING}</p>
      </div>
    </>
  );
}

/* ── Standalone page (kept for direct links; the portal route redirects to Start Here) ── */

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
        <HowWeWorkSections />
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
