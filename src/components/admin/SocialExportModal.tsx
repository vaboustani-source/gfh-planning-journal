import { useState, useMemo } from "react";
import { Copy, Check, X, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Vendor, VENDOR_GROUPS, FRIENDLY_CATEGORY } from "@/components/vendor/VendorCard";

const SOCIAL_LABELS: Record<string, string> = {
  venue: "Venue",
  caterer: "Catering",
  planner: "Planning & Design",
  photographer: "Photography",
  videographer: "Videography",
  hair: "Hair",
  makeup: "Makeup",
  florals: "Florals",
  rentals: "Décor & Rentals",
  officiant: "Officiant",
  ceremony_music: "Ceremony Music",
  dj_band: "DJ / Band",
  photo_booth: "Photo Booth",
  fireworks: "Fireworks",
  shuttle: "Transportation",
  cake: "Cake",
  invitations: "Invitations",
  other: "Other",
};

function formatHandle(raw: string | null): string {
  if (!raw) return "";
  const cleaned = raw.trim().replace(/^@/, "");
  return cleaned ? `@${cleaned}` : "";
}

function getLabel(v: Vendor): string {
  return SOCIAL_LABELS[v.category] || FRIENDLY_CATEGORY[v.category] || v.category;
}

export interface SocialExportModalProps {
  open: boolean;
  onClose: () => void;
  vendors: Vendor[];
}

export function SocialExportModal({ open, onClose, vendors }: SocialExportModalProps) {
  const [withLabels, setWithLabels] = useState(true);
  const [copied, setCopied] = useState(false);

  const credits = useMemo(() => {
    const eligible = vendors.filter(
      (v) => v.business_name?.trim() && v.instagram?.trim()
    );

    // Group by normalized handle
    const handleMap = new Map<string, { labels: string[]; handle: string }>();

    for (const v of eligible) {
      const handle = formatHandle(v.instagram);
      if (!handle) continue;
      const label = getLabel(v);
      const existing = handleMap.get(handle);
      if (existing) {
        if (!existing.labels.includes(label)) existing.labels.push(label);
      } else {
        handleMap.set(handle, { labels: [label], handle });
      }
    }

    // Ensure Gilbertsville Farmhouse is always at top — inject if missing
    const gfHandle = "@gilbertsvillefarmhouse";
    if (!handleMap.has(gfHandle)) {
      handleMap.set(gfHandle, { labels: ["Venue", "Catering"], handle: gfHandle });
    }

    // Sort: GFH first, then alphabetically by first label
    const entries = Array.from(handleMap.values());
    entries.sort((a, b) => {
      const aIsGF = a.handle === gfHandle;
      const bIsGF = b.handle === gfHandle;
      if (aIsGF && !bIsGF) return -1;
      if (bIsGF && !aIsGF) return 1;
      return a.labels[0].localeCompare(b.labels[0]);
    });

    // Build lines
    const lines = entries.map((entry) => {
      if (entry.labels.length > 1) {
        // Combine labels naturally (e.g., "Venue & Catering")
        const all = entry.labels.join(" & ");
        return `${all}: ${entry.handle}`;
      }
      return `${entry.labels[0]}: ${entry.handle}`;
    });

    return { lines, count: entries.length };
  }, [vendors]);

  const handlesOnlyText = useMemo(() => {
    const handles = credits.lines
      .map((line) => line.split(": ")[1] || "")
      .filter(Boolean)
      .join(" ");
    return handles;
  }, [credits.lines]);

  const displayText = withLabels ? credits.lines.join("\n") : handlesOnlyText;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = displayText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-lg font-medium text-foreground">
              Social Media Credits
            </DialogTitle>
          </div>
          <DialogDescription className="font-body text-sm text-muted-foreground mt-1">
            {credits.count} vendor{credits.count !== 1 ? "s" : ""} with Instagram
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <span className="font-body text-sm text-foreground">With role labels</span>
            <Switch
              checked={withLabels}
              onCheckedChange={setWithLabels}
            />
          </div>

          {/* Text block */}
          <div className="relative">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <pre className="font-body text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {displayText}
              </pre>
            </div>
          </div>

          <p className="font-body text-xs text-muted-foreground">
            Paste these credits into your Instagram caption or story to tag the team.
          </p>
        </div>

        <div className="px-6 pb-6 pt-2 flex items-center gap-3">
          <button
            onClick={copyToClipboard}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:bg-primary/90 transition-colors"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
