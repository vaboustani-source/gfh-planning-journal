import { Check } from "lucide-react";

export type PeopleSubTab = "guests" | "lodging" | "seating";

interface Props {
  active: PeopleSubTab;
  onChange: (t: PeopleSubTab) => void;
  guestCount: number;
  onSiteCount: number;
  seatedCount: number;
  confirmedCount: number;
}

const TABS: { id: PeopleSubTab; label: string }[] = [
  { id: "guests", label: "Guest List" },
  { id: "lodging", label: "Lodging" },
  { id: "seating", label: "Seating" },
];

export function PeopleSubTabs({ active, onChange, guestCount, onSiteCount, seatedCount, confirmedCount }: Props) {
  const steps = [
    { label: "Add Guests", count: `${guestCount} guests`, done: guestCount >= 5 },
    { label: "Assign Lodging", count: `${onSiteCount} on-site`, done: onSiteCount > 0 },
    { label: "Plan Seating", count: `${seatedCount} seated`, done: confirmedCount > 0 && seatedCount >= confirmedCount },
  ];
  return (
    <div className="space-y-4 mb-8">
      <div className="flex gap-0 border-b border-border overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => onChange(t.id)}
            className={`shrink-0 pb-3 px-1 mr-7 font-body text-sm transition-colors border-b-2 -mb-px ${
              active === t.id ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap font-body text-xs text-muted-foreground">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              s.done ? "border-sage/40 bg-sage/10 text-sage-dark" :
              ((i === 0 && active === "guests") || (i === 1 && active === "lodging") || (i === 2 && active === "seating"))
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-border bg-white"
            }`}>
              {s.done ? <Check size={12} /> : <span className="font-medium">{i + 1}.</span>}
              <span className="font-medium">{s.label}</span>
              <span className="text-[11px] opacity-70">· {s.count}</span>
            </div>
            {i < steps.length - 1 && <span className="text-muted-foreground/50">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
