import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Landmark, Check, ChevronDown, MessageCircle, ClipboardCheck, UserPen } from "lucide-react";
import {
  MARRIAGE_LICENSE_INTRO, FACTS, STEPS, CHECKLIST, NAME_CHANGE, MARRIAGE_LICENSE_CLOSING,
} from "@/content/marriageLicense";

/* ── Built to be scanned ──────────────────────────────
   Four numbers, four steps, one checklist. Every step
   is one sentence until the couple opens the details.
   Checklist ticks and the name answer stay in this
   browser only.
   ─────────────────────────────────────────────────── */

const CHECK_KEY = "marriage-license-checklist";
const NAME_KEY = "marriage-license-name";

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function StepCard({ step, last }: { step: typeof STEPS[number]; last: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative pl-14">
      {/* number + rail */}
      <div className="absolute left-0 top-0 flex flex-col items-center h-full">
        <div className="w-10 h-10 rounded-full bg-sage text-white font-display text-lg flex items-center justify-center shrink-0 shadow-soft">{step.n}</div>
        {!last && <div className="w-px flex-1 bg-border mt-2" />}
      </div>

      <div className={`rounded-xl border border-border bg-card p-5 ${last ? "" : "mb-4"}`}>
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <h2 className="font-display text-xl font-light text-foreground leading-tight">{step.title}</h2>
          <span className="font-body text-[11px] tracking-wide rounded-full bg-gold/30 px-2.5 py-0.5 text-foreground whitespace-nowrap">{step.when}</span>
        </div>
        <p className="font-body text-sm text-foreground leading-relaxed max-w-2xl">{step.oneLiner}</p>

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="mt-3 inline-flex items-center gap-1.5 font-body text-xs tracking-widest uppercase text-muted-foreground hover:text-sage transition-colors"
        >
          {open ? "Less" : "Details"} <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <ul className="mt-3 space-y-2 max-w-2xl border-l-2 border-sage/30 pl-4">
            {step.details.map((d, i) => (
              <li key={i} className="font-body text-sm text-muted-foreground leading-relaxed">{d}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default function MarriageLicense() {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => load(CHECK_KEY, {}));
  const [nameAnswer, setNameAnswer] = useState<"yes" | "no" | "unsure" | null>(() => load(NAME_KEY, null));
  useEffect(() => save(CHECK_KEY, checked), [checked]);
  useEffect(() => save(NAME_KEY, nameAnswer), [nameAnswer]);

  const done = CHECKLIST.filter(c => checked[c.id]).length;

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        {/* Header, short */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Landmark size={16} className="text-sage" strokeWidth={1.75} />
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">New York State</p>
          </div>
          <h1 className="font-display text-4xl font-light text-foreground mb-3">Marriage License</h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed max-w-2xl">{MARRIAGE_LICENSE_INTRO}</p>
        </div>

        {/* The four numbers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {FACTS.map(f => (
            <div key={f.big} className="rounded-xl bg-sage/10 border border-sage/20 px-4 py-4">
              <p className="font-display text-3xl font-light text-foreground leading-none tabular-nums">{f.big}</p>
              <p className="font-body text-xs text-muted-foreground mt-2 leading-snug">{f.label}</p>
            </div>
          ))}
        </div>

        {/* Four steps */}
        <ol className="mb-10">
          {STEPS.map((s, i) => <StepCard key={s.n} step={s} last={i === STEPS.length - 1} />)}
        </ol>

        {/* Checklist + name change, side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={16} className="text-sage" strokeWidth={1.75} />
                <h2 className="font-display text-xl font-light text-foreground">Bring to the clerk</h2>
              </div>
              <span className="font-body text-xs text-muted-foreground tabular-nums">{done}/{CHECKLIST.length}</span>
            </div>
            <ul className="space-y-1">
              {CHECKLIST.map(c => {
                const on = !!checked[c.id];
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setChecked(prev => ({ ...prev, [c.id]: !on }))}
                      className="w-full flex items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/60 transition-colors"
                    >
                      <span className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${on ? "bg-sage border-sage text-white" : "border-border bg-background"}`}>
                        {on && <Check size={13} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className={`font-body text-sm leading-snug ${on ? "text-muted-foreground line-through" : "text-foreground"}`}>{c.label}</span>
                        {c.note && <span className="block font-body text-xs text-muted-foreground mt-0.5">{c.note}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <UserPen size={16} className="text-sage" strokeWidth={1.75} />
              <h2 className="font-display text-xl font-light text-foreground">{NAME_CHANGE.question}</h2>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {([["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]] as const).map(([v, label]) => {
                const on = nameAnswer === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setNameAnswer(on ? null : v)}
                    aria-pressed={on}
                    className={`rounded-full border px-4 py-1.5 font-body text-sm transition-colors ${on ? "bg-sage text-white border-sage" : "bg-background border-border text-foreground hover:border-sage/50"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {nameAnswer === "yes" && (
              <ul className="space-y-2.5">
                {NAME_CHANGE.yes.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 font-body text-sm text-muted-foreground leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sage shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
            {nameAnswer === "no" && <p className="font-body text-sm text-muted-foreground leading-relaxed">{NAME_CHANGE.no}</p>}
            {nameAnswer === "unsure" && <p className="font-body text-sm text-muted-foreground leading-relaxed">{NAME_CHANGE.unsure}</p>}
            {nameAnswer === null && <p className="font-body text-sm text-muted-foreground leading-relaxed">Pick one. The answer changes what you do at the clerk.</p>}
          </section>
        </div>

        <p className="font-body text-xs italic text-muted-foreground text-center max-w-2xl mx-auto">{MARRIAGE_LICENSE_CLOSING}</p>

        <div className="text-center py-6">
          <p className="font-body text-sm text-muted-foreground leading-relaxed">
            Questions about timing or your officiant? Ask in{" "}
            <Link to="/portal/messages" className="inline-flex items-center gap-1 text-foreground hover:text-sage transition-colors">
              <MessageCircle size={13} /> Messages
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
