import { Link } from "react-router-dom";
import { Shield, ExternalLink, MessageCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Provider links ────────────────────────────
   Edit these URLs or notes here; they are used throughout the page.
   ──────────────────────────────────────────── */
const PROVIDERS = [
  {
    name: "WedSafe",
    note: "No account required.",
    url: "https://www.wedsafe.com/Pages/WedsafeEligibility.aspx?Purchase=New",
    cta: "Get a WedSafe quote",
  },
  {
    name: "WedSure",
    note: "Requires creating an account.",
    url: "https://service.rvnuccio.com/pei/policy/start?ref=QP#BtVOW",
    cta: "Get a WedSure quote",
  },
];

/* ── Main component ─────────────────────────── */

export default function Insurance() {
  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-sage" strokeWidth={1.75} />
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">
              Protect your day
            </p>
          </div>
          <h1 className="font-display text-4xl font-light text-foreground mb-4">
            Wedding Insurance
          </h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed max-w-2xl">
            Wedding insurance is highly recommended in your Gilbertsville Farmhouse agreement.
            It protects your investment, and it can be purchased at any time.
            Both options below work well.
          </p>
        </div>

        {/* Provider cards */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROVIDERS.map((provider) => (
              <div
                key={provider.name}
                className="rounded-xl border border-border bg-card p-6 flex flex-col items-start gap-3 hover:border-sage/40 hover:shadow-card transition-all duration-200"
              >
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-sage" strokeWidth={1.75} />
                  <h2 className="font-display text-xl font-light text-foreground">
                    {provider.name}
                  </h2>
                </div>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">
                  {provider.note}
                </p>
                <a
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto"
                >
                  <Button variant="default" className="gap-2">
                    {provider.cta}
                    <ExternalLink size={14} strokeWidth={1.75} />
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Difference note */}
        <section className="mb-8">
          <div className="rounded-xl border border-border bg-card p-5 md:p-6">
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              WedSure asks you to make an account and WedSafe does not, but both work great.
            </p>
          </div>
        </section>

        {/* Next step */}
        <section className="mb-8">
          <h2 className="font-display text-xl font-light text-foreground mb-3">
            Once you have your policy
          </h2>
          <div className="rounded-xl border border-border bg-card p-5 md:p-6">
            <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
              Send the certificate to Brandon when it is ready. You can also upload it to your{" "}
              <Link
                to="/portal/documents"
                className="inline-flex items-center gap-1 text-foreground hover:text-sage underline underline-offset-4 transition-colors"
              >
                <FileText size={14} strokeWidth={1.75} />
                Documents
              </Link>{" "}
              section for safekeeping.
            </p>
            <Link to="/portal/messages" className="inline-flex">
              <Button variant="outline" className="gap-2">
                <MessageCircle size={16} strokeWidth={1.75} />
                Send it to Brandon
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
