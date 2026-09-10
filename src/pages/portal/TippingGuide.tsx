import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Gift, ArrowRight, ArrowLeft, Check, Copy, Printer, Minus, Plus, MessageCircle, Heart,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePortalData } from "@/hooks/usePortalData";
import {
  TIPPING_INTRO, TIPPING_BASIS, TIPPING_CLOSING, TEAM_ROLES, ENVELOPE_BASICS,
  VENDOR_GUIDES, EXPECTATION_LABEL, type TeamRole, type Expectation,
} from "@/content/tippingGuide";

/* ── Envelope plan state ───────────────────────────────
   Nothing is chosen by default. A couple picks a range
   per role (or types their own amount) and the page adds
   it up. Saved in this browser only, per wedding.
   ──────────────────────────────────────────────────── */

interface RolePlan {
  tier: number | null;      // index into role.tiers, or null when custom / unset
  amount: number | null;    // per envelope
  count: number;            // envelopes for per-person roles
}

type Plan = Record<string, RolePlan>;

const emptyPlan = (): Plan =>
  Object.fromEntries(TEAM_ROLES.map(r => [r.slug, { tier: null, amount: null, count: r.perPerson ? 2 : 1 }]));

function storageKey(eventId: string | null) {
  return `tipping-plan:${eventId ?? "default"}`;
}

function loadPlan(eventId: string | null): Plan {
  const base = emptyPlan();
  try {
    const raw = localStorage.getItem(storageKey(eventId));
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Plan>;
    for (const slug of Object.keys(base)) {
      const s = saved[slug];
      if (s && typeof s === "object") base[slug] = { ...base[slug], ...s };
    }
  } catch { /* fall through */ }
  return base;
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/* ── Pieces ─────────────────────────────────────────── */

function expectationClass(e: Expectation): string {
  if (e === "expected") return "bg-gold/30 border-gold/60 text-foreground";
  if (e === "recommended") return "bg-sage/15 border-sage/30 text-sage";
  return "bg-muted border-border text-muted-foreground";
}

function RoleCard({ role, plan, onChange }: { role: TeamRole; plan: RolePlan; onChange: (p: RolePlan) => void }) {
  const chosen = plan.tier != null ? role.tiers[plan.tier] : null;
  const isCustom = plan.tier == null && plan.amount != null;

  const pickTier = (i: number) => {
    if (plan.tier === i) { onChange({ ...plan, tier: null, amount: null }); return; }
    onChange({ ...plan, tier: i, amount: role.tiers[i].low });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-light text-foreground leading-tight">{role.title}</h3>
          <p className="font-body text-sm text-muted-foreground mt-1 leading-relaxed">{role.description}</p>
        </div>
        {plan.amount != null && (
          <span className="shrink-0 font-body text-sm text-foreground tabular-nums">
            {money(plan.amount * (role.perPerson ? plan.count : 1))}
          </span>
        )}
      </div>

      {role.info ? (
        <p className="font-body text-sm text-muted-foreground mt-3 leading-relaxed">{role.info}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mt-4">
            {role.tiers.map((t, i) => {
              const on = plan.tier === i;
              return (
                <button
                  key={t.range}
                  type="button"
                  onClick={() => pickTier(i)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-body text-sm transition-colors ${
                    on ? "bg-sage text-white border-sage" : "bg-background border-border text-foreground hover:border-sage/50"
                  }`}
                >
                  {on && <Check size={13} strokeWidth={2.5} />}
                  {t.range}
                </button>
              );
            })}
          </div>

          {chosen && (
            <p className="font-body text-sm italic text-muted-foreground mt-3 leading-relaxed border-l-2 border-sage/40 pl-3">
              “{chosen.note}”
            </p>
          )}

          <div className="flex flex-wrap items-end gap-4 mt-4">
            <label className="block">
              <span className="font-body text-[11px] tracking-widest uppercase text-muted-foreground">
                {role.perPerson ? "Per envelope" : "Amount"}
              </span>
              <div className="mt-1 flex items-center rounded-md border border-border bg-background focus-within:ring-2 focus-within:ring-sage">
                <span className="pl-3 font-body text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={10}
                  value={plan.amount ?? ""}
                  placeholder="0"
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value)));
                    onChange({ ...plan, tier: null, amount: v });
                  }}
                  className="w-28 bg-transparent px-2 py-1.5 font-body text-sm text-foreground tabular-nums outline-none"
                />
              </div>
            </label>

            {role.perPerson && (
              <div>
                <span className="font-body text-[11px] tracking-widest uppercase text-muted-foreground">Envelopes</span>
                <div className="mt-1 inline-flex items-center rounded-md border border-border bg-background">
                  <button type="button" aria-label="Fewer" onClick={() => onChange({ ...plan, count: Math.max(1, plan.count - 1) })} className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground"><Minus size={14} /></button>
                  <span className="w-8 text-center font-body text-sm text-foreground tabular-nums">{plan.count}</span>
                  <button type="button" aria-label="More" onClick={() => onChange({ ...plan, count: Math.min(20, plan.count + 1) })} className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground"><Plus size={14} /></button>
                </div>
              </div>
            )}

            {isCustom && <span className="font-body text-xs text-muted-foreground pb-2">Your own amount</span>}
          </div>
          {role.countHint && <p className="font-body text-xs text-muted-foreground mt-2">{role.countHint}</p>}
        </>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────── */

export default function TippingGuide() {
  const { eventId } = usePortalData();
  const [plan, setPlan] = useState<Plan>(() => loadPlan(eventId));
  const [openVendor, setOpenVendor] = useState<string | null>(null);

  useEffect(() => { setPlan(loadPlan(eventId)); }, [eventId]);
  useEffect(() => {
    try { localStorage.setItem(storageKey(eventId), JSON.stringify(plan)); } catch { /* ignore */ }
  }, [plan, eventId]);

  const envelopes = useMemo(() => {
    const rows: { title: string; count: number; each: number; total: number }[] = [];
    for (const role of TEAM_ROLES) {
      const p = plan[role.slug];
      if (!p || p.amount == null || p.amount <= 0) continue;
      const count = role.perPerson ? p.count : 1;
      rows.push({ title: role.title, count, each: p.amount, total: p.amount * count });
    }
    return rows;
  }, [plan]);
  const total = envelopes.reduce((s, r) => s + r.total, 0);
  const envelopeCount = envelopes.reduce((s, r) => s + r.count, 0);

  const summaryText = () =>
    [
      "Envelopes for our Gilbertsville Farmhouse team",
      ...envelopes.map(r => r.count > 1 ? `${r.title}: ${r.count} × ${money(r.each)} = ${money(r.total)}` : `${r.title}: ${money(r.total)}`),
      `Total: ${money(total)} in ${envelopeCount} envelope${envelopeCount === 1 ? "" : "s"}`,
    ].join("\n");

  const copy = async () => {
    try { await navigator.clipboard.writeText(summaryText()); toast.success("Envelope list copied"); }
    catch { toast.error("Could not copy. Select the list and copy it by hand."); }
  };

  const reset = () => setPlan(emptyPlan());

  const vIdx = VENDOR_GUIDES.findIndex(v => v.slug === openVendor);
  const vendor = vIdx >= 0 ? VENDOR_GUIDES[vIdx] : null;
  const vPrev = vIdx > 0 ? VENDOR_GUIDES[vIdx - 1] : null;
  const vNext = vIdx >= 0 && vIdx < VENDOR_GUIDES.length - 1 ? VENDOR_GUIDES[vIdx + 1] : null;

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        {/* Header */}
        <div className="mb-8 print:hidden">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={16} className="text-sage" strokeWidth={1.75} />
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">A delicate subject, handled gently</p>
          </div>
          <h1 className="font-display text-4xl font-light text-foreground mb-4">Tipping Guide</h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed max-w-2xl">{TIPPING_INTRO}</p>
          <p className="font-body text-sm italic text-muted-foreground leading-relaxed max-w-2xl mt-3">{TIPPING_BASIS}</p>
        </div>

        {/* Our team + envelope planner */}
        <section id="our-team" className="mb-12 scroll-mt-24">
          <div className="print:hidden">
            <h2 className="font-display text-xl font-light text-foreground mb-2">Our team</h2>
            <p className="font-body text-sm text-muted-foreground mb-5 leading-relaxed max-w-2xl">
              Tap a range if it feels right, or type your own amount. Nothing is chosen for you. The list on the side adds up whatever you decide, so the envelopes are ready before the weekend.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
            <div className="space-y-4 print:hidden">
              {TEAM_ROLES.map(role => (
                <RoleCard
                  key={role.slug}
                  role={role}
                  plan={plan[role.slug]}
                  onChange={(p) => setPlan(prev => ({ ...prev, [role.slug]: p }))}
                />
              ))}
              <p className="font-body text-sm italic text-muted-foreground text-center pt-2 flex items-center justify-center gap-1.5">
                <Heart size={13} className="text-sage" /> {TIPPING_CLOSING}
              </p>
            </div>

            {/* Envelope list */}
            <aside className="lg:sticky lg:top-6 rounded-xl border border-border bg-card p-5 print:border-0 print:p-0">
              <p className="font-body text-[11px] tracking-widest uppercase text-sage mb-3">Your envelopes</p>
              {envelopes.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground leading-relaxed">
                  Nothing yet. Choose a range on any role and it will appear here.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {envelopes.map(r => (
                    <li key={r.title} className="py-2 flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-body text-sm text-foreground leading-snug">{r.title}</p>
                        {r.count > 1 && <p className="font-body text-xs text-muted-foreground tabular-nums">{r.count} × {money(r.each)}</p>}
                      </div>
                      <span className="font-body text-sm text-foreground tabular-nums shrink-0">{money(r.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 pt-3 border-t border-border flex items-baseline justify-between">
                <span className="font-body text-sm text-muted-foreground">
                  {envelopeCount} envelope{envelopeCount === 1 ? "" : "s"}
                </span>
                <span className="font-display text-2xl font-light text-foreground tabular-nums">{money(total)}</span>
              </div>
              <p className="font-body text-xs text-muted-foreground mt-2 leading-relaxed print:hidden">
                Cash, in labeled envelopes, handed to your Weekend Event Coordinator at the rehearsal.
              </p>
              {envelopes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 print:hidden">
                  <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-body text-sm text-foreground hover:border-sage/50 transition-colors">
                    <Copy size={14} /> Copy list
                  </button>
                  <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-body text-sm text-foreground hover:border-sage/50 transition-colors">
                    <Printer size={14} /> Print
                  </button>
                  <button type="button" onClick={reset} className="ml-auto font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Start over
                  </button>
                </div>
              )}
            </aside>
          </div>
        </section>

        {/* Before the envelopes */}
        <section id="basics" className="mb-12 scroll-mt-24 print:hidden">
          <h2 className="font-display text-xl font-light text-foreground mb-2">Before you fill the envelopes</h2>
          <div className="rounded-xl border border-border bg-card p-5 md:p-6">
            <ul className="space-y-3">
              {ENVELOPE_BASICS.map((b) => (
                <li key={b.lead} className="flex items-start gap-2.5 font-body text-sm leading-relaxed">
                  <Check size={15} className="text-sage mt-0.5 shrink-0" strokeWidth={2} />
                  <span><span className="text-foreground font-medium">{b.lead}</span> <span className="text-muted-foreground">{b.text}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Outside vendors */}
        <section id="vendors" className="mb-12 scroll-mt-24 print:hidden">
          <h2 className="font-display text-xl font-light text-foreground mb-2">Your outside vendors</h2>
          <p className="font-body text-sm text-muted-foreground mb-5 leading-relaxed max-w-2xl">
            Industry norms for the vendors you hire yourselves. Tap one for the amount, the timing, and the fine print.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {VENDOR_GUIDES.map((v) => (
              <button
                key={v.slug}
                type="button"
                onClick={() => setOpenVendor(v.slug)}
                className="group text-left rounded-xl border border-border bg-card p-4 hover:border-sage/50 hover:shadow-card transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-light text-foreground leading-tight">{v.title}</h3>
                  <ArrowRight size={13} className="ml-auto text-muted-foreground group-hover:text-sage group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className={`inline-block rounded-full border text-[11px] font-medium px-2 py-0.5 ${expectationClass(v.expectation)}`}>{EXPECTATION_LABEL[v.expectation]}</span>
                  <span className="font-body text-[11px] rounded-full bg-muted px-2 py-0.5 text-foreground">{v.amount}</span>
                </div>
              </button>
            ))}
          </div>

          <Sheet open={!!vendor} onOpenChange={(o) => { if (!o) setOpenVendor(null); }}>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
              {vendor && (
                <div className="px-6 py-6 sm:px-8 sm:py-8">
                  <SheetHeader className="text-left space-y-2 mb-5">
                    <span className="font-body text-[11px] tracking-widest uppercase text-muted-foreground">
                      Outside vendors · {vIdx + 1} of {VENDOR_GUIDES.length}
                    </span>
                    <SheetTitle className="font-display text-3xl font-light text-foreground">{vendor.title}</SheetTitle>
                    <SheetDescription className="font-body text-sm text-muted-foreground">
                      <span className={`inline-block rounded-full border text-[11px] font-medium px-2 py-0.5 ${expectationClass(vendor.expectation)}`}>{EXPECTATION_LABEL[vendor.expectation]}</span>
                    </SheetDescription>
                  </SheetHeader>

                  <div className="rounded-xl bg-sage/10 border border-sage/20 p-4 mb-6">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                      <dt className="font-body text-[11px] tracking-widest uppercase text-sage pt-0.5">How much</dt>
                      <dd className="font-body text-sm text-foreground">{vendor.amount}</dd>
                      <dt className="font-body text-[11px] tracking-widest uppercase text-sage pt-0.5">When</dt>
                      <dd className="font-body text-sm text-foreground">{vendor.when}</dd>
                    </dl>
                  </div>

                  <div className="space-y-3">
                    {vendor.detail.map((d, i) => (
                      <p key={i} className="font-body text-sm text-muted-foreground leading-relaxed max-w-2xl">{d}</p>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-border">
                    {vPrev ? (
                      <button type="button" onClick={() => setOpenVendor(vPrev.slug)} className="inline-flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft size={14} /> {vPrev.title}
                      </button>
                    ) : <span />}
                    {vNext ? (
                      <button type="button" onClick={() => setOpenVendor(vNext.slug)} className="inline-flex items-center gap-1.5 font-body text-sm text-foreground hover:text-sage transition-colors">
                        {vNext.title} <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button type="button" onClick={() => setOpenVendor(null)} className="font-body text-sm text-foreground hover:text-sage transition-colors">Done</button>
                    )}
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </section>

        <div className="text-center py-6 print:hidden">
          <p className="font-body text-sm text-muted-foreground leading-relaxed">
            Not sure who will be on your weekend, or how many? Ask in{" "}
            <Link to="/portal/messages" className="inline-flex items-center gap-1 text-foreground hover:text-sage transition-colors">
              <MessageCircle size={13} /> Messages
            </Link>
            . That is exactly what it is for.
          </p>
        </div>
      </div>
    </div>
  );
}
