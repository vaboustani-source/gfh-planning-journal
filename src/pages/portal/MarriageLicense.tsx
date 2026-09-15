import { Link } from "react-router-dom";
import { Landmark, Check, MessageCircle } from "lucide-react";
import {
  MARRIAGE_LICENSE_DRAFT, MARRIAGE_LICENSE_INTRO, MARRIAGE_LICENSE_KEY_POINTS,
  MARRIAGE_LICENSE_SECTIONS, MARRIAGE_LICENSE_CLOSING,
} from "@/content/marriageLicense";

/* Anything in [square brackets] is a placeholder still to fill. */
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

export default function MarriageLicense() {
  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Landmark size={16} className="text-sage" strokeWidth={1.75} />
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">New York State</p>
            {MARRIAGE_LICENSE_DRAFT && (
              <span className="font-body text-[10px] tracking-widest uppercase rounded-full bg-gold/30 text-foreground px-2 py-0.5">Drafted for review</span>
            )}
          </div>
          <h1 className="font-display text-4xl font-light text-foreground mb-4">Marriage License</h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed max-w-2xl">{MARRIAGE_LICENSE_INTRO}</p>
        </div>

        <div className="rounded-xl bg-sage/10 border border-sage/20 p-4 mb-8 max-w-2xl">
          <p className="font-body text-[11px] tracking-widest uppercase text-sage mb-2">Key points</p>
          <ul className="space-y-2">
            {MARRIAGE_LICENSE_KEY_POINTS.map((pt, i) => (
              <li key={i} className="flex items-start gap-2 font-body text-sm text-foreground leading-relaxed">
                <Check size={15} className="text-sage mt-0.5 shrink-0" strokeWidth={2} />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          {MARRIAGE_LICENSE_SECTIONS.map((s, si) => (
            <section key={s.slug} id={s.slug} className="rounded-xl border border-border bg-card p-5 md:p-6 scroll-mt-24">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-body text-[10px] tracking-widest text-muted-foreground">{String(si + 1).padStart(2, "0")}</span>
                <h2 className="font-display text-xl font-light text-foreground">{s.title}</h2>
              </div>
              <ul className="space-y-2.5 max-w-2xl">
                {s.items.map((it, i) => (
                  <li key={i} className="font-body text-sm leading-relaxed">
                    {it.lead && <span className="text-foreground font-medium"><Inline text={it.lead} /> </span>}
                    <span className="text-muted-foreground"><Inline text={it.text} /></span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="font-body text-sm italic text-muted-foreground text-center pt-8 max-w-2xl mx-auto">{MARRIAGE_LICENSE_CLOSING}</p>

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
