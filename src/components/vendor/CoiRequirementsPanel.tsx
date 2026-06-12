import { useEffect, useRef, useState } from "react";
import { Copy, Printer, ShieldCheck, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Shared Certificate of Insurance requirements panel.
 *
 * Sources its body text from the `coi_request` email template so that editing
 * the template wording in one place keeps the on-page panel and the outgoing
 * email perfectly in sync.
 *
 * Falls back to the verbatim legal copy if the template fails to load, so the
 * exact requirements are always shown.
 */

const FALLBACK_BODY = `In order for a third-party vendor to operate on our venue, we require a Certificate of Insurance evidencing the following:
- Commercial General Liability $1,000,000 per occurrence / $2,000,000 aggregate
- Name the "Gilbertsville Farmhouse, Inc. and Sharon & Aldo Boustani", and its officers, employees, agents, and volunteers added as additional insured with respect to specific project/service/event.
- Automobile Liability $1,000,000 CSL (if applicable)
Ask your insurance agent to email the certificate to Experience@gilbertsvillefarmhouse.com. The certificate is due prior to the actual work start date.`;

/** Strip the {{business_name}} salutation and the intro line for display. */
function extractRequirementsBlock(body: string): string {
  const marker = "In order for a third-party vendor";
  const idx = body.indexOf(marker);
  if (idx === -1) return body.trim();
  return body.slice(idx).trim();
}

export function CoiRequirementsPanel({ intro }: { intro?: string }) {
  const [requirements, setRequirements] = useState<string>(FALLBACK_BODY);
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("email_templates")
      .select("body")
      .eq("key", "coi_request")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.body) setRequirements(extractRequirementsBlock(data.body));
      });
    return () => { cancelled = true; };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requirements);
      setCopied(true);
      toast.success("Requirements copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Certificate of Insurance Requirements</title>
      <style>
        body { font-family: Georgia, 'Times New Roman', serif; color: #2C3E2D; padding: 40px; max-width: 640px; margin: 0 auto; line-height: 1.6; }
        h1 { font-weight: 300; font-size: 24px; letter-spacing: 0.02em; margin: 0 0 8px; }
        .sub { font-family: Helvetica, Arial, sans-serif; font-size: 11px; letter-spacing: 0.18em; color: #9aa097; text-transform: uppercase; margin-bottom: 24px; }
        pre { white-space: pre-wrap; font-family: Helvetica, Arial, sans-serif; font-size: 14px; color: #2C3E2D; line-height: 1.7; }
      </style></head><body>
      <h1>Gilbertsville Farmhouse</h1>
      <div class="sub">Certificate of Insurance Requirements</div>
      <pre>${requirements.replace(/</g, "&lt;")}</pre>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 250);
  };

  // Render the requirements with simple bullet styling. Lines starting with "- "
  // become list items; everything else is a paragraph.
  const lines = requirements.split("\n").map((l) => l.trim()).filter(Boolean);
  const intro1 = lines.find((l) => l.startsWith("In order for"));
  const bullets = lines.filter((l) => l.startsWith("-"));
  const trailing = lines.filter((l) => !l.startsWith("-") && l !== intro1);

  return (
    <div className="rounded-xl border border-sage/30 bg-cream/40 p-5 lg:p-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="rounded-full bg-sage/15 p-2 text-sage shrink-0">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-light text-foreground">Certificate of Insurance</h2>
          {intro && (
            <p className="font-body text-sm text-muted-foreground mt-1">{intro}</p>
          )}
        </div>
      </div>

      <div ref={printRef} className="space-y-3 rounded-lg bg-white border border-border p-4 lg:p-5">
        {intro1 && (
          <p className="font-body text-sm text-foreground leading-relaxed">{intro1}</p>
        )}
        {bullets.length > 0 && (
          <ul className="space-y-1.5 list-disc pl-5">
            {bullets.map((b, i) => (
              <li key={i} className="font-body text-sm text-foreground leading-relaxed">
                {b.replace(/^-\s*/, "")}
              </li>
            ))}
          </ul>
        )}
        {trailing.map((t, i) => (
          <p key={i} className="font-body text-sm text-foreground leading-relaxed">{t}</p>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-foreground font-body text-xs hover:bg-muted/50 transition-colors">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy text"}
        </button>
        <button onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-foreground font-body text-xs hover:bg-muted/50 transition-colors">
          <Printer size={13} /> Print or save as PDF
        </button>
      </div>
    </div>
  );
}

export default CoiRequirementsPanel;
